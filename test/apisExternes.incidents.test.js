/**
 * Incidents remontés à SOEK pour les API externes : météo (Open-Meteo) et
 * transports (IDFM PRIM, template trafic). Les modules sont chargés hors
 * navigateur (vm) avec un faux window.api qui capture les incidents.
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.join(__dirname, '..')
const silent = () => {}

function contexte(extra = {}) {
  const incidents = []
  const files = {}
  const el = () => ({ classList: { add() {}, remove() {} }, style: {}, set innerHTML(v) {}, set textContent(v) {}, set src(v) {} })
  const window = {
    __log: silent,
    api: {
      reportIncident: (type, niveau, message, ctx) => incidents.push({ type, niveau, message, contexte: ctx }),
      readFile: async (p) => (p in files ? files[p] : null),
      writeFile: async (p, c) => { files[p] = c }
    }
  }
  const ctx = vm.createContext(Object.assign({
    window, console: { log: silent, info: silent, warn: silent, error: silent, debug: silent },
    document: { getElementById: el, querySelector: el, createElement: el, body: { appendChild() {} } },
    setInterval: () => 0, clearInterval() {}, setTimeout: (f) => 0, clearTimeout() {},
    Date, JSON, Math, Promise, Set, Map, String, Number, Object, Array, encodeURIComponent, module: {}
  }, extra))
  ctx.window.window = ctx.window
  return { ctx, window, incidents, files }
}

const OK_METEO = { current_weather: { temperature: 12, weathercode: 1, windspeed: 10 }, daily: { temperature_2m_min: [5], temperature_2m_max: [14], weathercode: [1], time: ['2026-11-10'] } }

describe('incidents API externes', function () {
  describe('météo (js/meteo.js)', () => {
    function loadMeteo(reponses) {
      const c = contexte()
      let n = 0
      c.window.apiManager = {
        lastMeteoError: null,
        getMeteoWithErrorHandling: async () => {
          const r = reponses[Math.min(n++, reponses.length - 1)]
          if (r instanceof Error) { c.window.apiManager.lastMeteoError = r.message; return null }
          c.window.apiManager.lastMeteoError = null
          return r
        }
      }
      vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/meteo.js'), 'utf8'), c.ctx, { filename: 'meteo.js' })
      c.run = () => vm.runInContext('requestJsonMeteo()', c.ctx)
      return c
    }

    it('panne ponctuelle (1-2 échecs) : absorbée par le cache, aucun incident', async () => {
      const c = loadMeteo([new Error('HTTP 503'), new Error('HTTP 503'), OK_METEO])
      for (let i = 0; i < 3; i++) await c.run()
      assert.deepStrictEqual(c.incidents, [])
    })

    it('3 échecs consécutifs : un seul METEO_INDISPONIBLE avec la cause et l\'âge du cache', async () => {
      const c = loadMeteo([OK_METEO, new Error('HTTP 429')])
      await c.run() // succès → cache écrit
      for (let i = 0; i < 6; i++) await c.run()
      const inc = c.incidents.filter(i => i.type === 'METEO_INDISPONIBLE')
      assert.strictEqual(inc.length, 1, 'une seule fois par panne')
      assert.strictEqual(inc[0].niveau, 'warn')
      assert.strictEqual(inc[0].contexte.cause, 'HTTP 429')
      assert.strictEqual(inc[0].contexte.echecsConsecutifs, 3)
      assert.strictEqual(inc[0].contexte.cacheAgeMin, 0)
      assert.ok(/dernières données affichées/.test(inc[0].message), inc[0].message)
    })

    it('sans cache : le message dit que le bloc météo est vide', async () => {
      const c = loadMeteo([new Error('ENOTFOUND')])
      for (let i = 0; i < 3; i++) await c.run()
      const inc = c.incidents.find(i => i.type === 'METEO_INDISPONIBLE')
      assert.strictEqual(inc.contexte.cacheAgeMin, null)
      assert.ok(/bloc météo vide/.test(inc.message), inc.message)
    })

    it('retour de la météo après une panne signalée : METEO_RETABLIE, puis le compteur repart de zéro', async () => {
      const c = loadMeteo([new Error('x'), new Error('x'), new Error('x'), OK_METEO, new Error('y'), OK_METEO])
      for (let i = 0; i < 6; i++) await c.run()
      assert.deepStrictEqual(c.incidents.map(i => i.type), ['METEO_INDISPONIBLE', 'METEO_RETABLIE'])
      assert.strictEqual(c.incidents[1].niveau, 'info')
      assert.strictEqual(c.window._meteoHealth.echecs, 0)
    })

    it('réponse 200 sans données météo : comptée comme un échec', async () => {
      const c = loadMeteo([{ error: true }])
      for (let i = 0; i < 3; i++) await c.run()
      assert.strictEqual(c.incidents[0].contexte.cause, 'réponse sans données météo')
    })
  })

  describe('transports (js/TemplateRenderer.js)', () => {
    const ARRET = { id: 'stop_area:IDFM:71517', nom: 'Antony', lignesSelectionnees: [] }
    const DEPARTS = { departures: [{ display_informations: { code: 'B', direction: 'Paris' }, stop_date_time: { departure_date_time: '20261110T120000' }, stop_point: { name: 'Antony' } }] }

    function loadTrafic(repondre) {
      const c = contexte()
      c.window.api.fetchJsonResult = async (url, opts) => repondre(url, opts)
      vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/TemplateRenderer.js'), 'utf8'), c.ctx, { filename: 'TemplateRenderer.js' })
      c.tr = c.window.templateRenderer
      c.fetch = (arrets = [ARRET]) => c.tr._fetchAllDepartures(arrets, 'cle-secrete')
      return c
    }
    const ok = (url) => ({ ok: true, status: 200, data: /departures/.test(url) ? DEPARTS : { places_nearby: [], places: [] } })
    const ko = (status, code) => (url) => /stop_areas\/[^/]+\/departures/.test(url) && url.includes('71517')
      ? { ok: false, status, data: null, code: code || null, error: 'Request failed' } : ok(url)

    it('API qui répond : départs récupérés, aucun incident, la clé passe en en-tête', async () => {
      let entete = null
      const c = loadTrafic((url, opts) => { entete = opts.headers.apikey; return ok(url) })
      const res = await c.fetch()
      assert.strictEqual(res[0].departures.length, 1)
      assert.strictEqual(entete, 'cle-secrete')
      assert.deepStrictEqual(c.incidents, [])
    })

    it('un échec isolé (refresh 45s) : pas d\'incident', async () => {
      let n = 0
      const c = loadTrafic((url) => (n++ === 0 ? ko(503)(url) : ok(url)))
      await c.fetch(); await c.fetch()
      assert.deepStrictEqual(c.incidents, [])
    })

    for (const [status, attendu] of [[401, 'clé API IDFM refusée'], [403, 'clé API IDFM refusée'], [429, 'quota IDFM dépassé'], [404, 'arrêt inconnu chez IDFM'], [502, 'serveur IDFM en erreur']]) {
      it(`HTTP ${status} répété : un TRAFIC_INDISPONIBLE « ${attendu} » avec le code HTTP`, async () => {
        const c = loadTrafic(ko(status))
        for (let i = 0; i < 5; i++) await c.fetch()
        const inc = c.incidents.filter(i => i.type === 'TRAFIC_INDISPONIBLE')
        assert.strictEqual(inc.length, 1, 'une seule fois par panne')
        assert.strictEqual(inc[0].contexte.http, status)
        assert.strictEqual(inc[0].contexte.cle, 'trafic:' + ARRET.id)
        assert.strictEqual(inc[0].contexte.arret, 'Antony')
        assert.ok(inc[0].message.includes(attendu), inc[0].message)
        assert.ok(!JSON.stringify(inc[0]).includes('cle-secrete'), 'la clé IDFM ne part jamais dans un incident')
      })
    }

    it('timeout réseau : cause = code d\'erreur (ECONNABORTED)', async () => {
      const c = loadTrafic(ko(null, 'ECONNABORTED'))
      await c.fetch(); await c.fetch()
      const inc = c.incidents.find(i => i.type === 'TRAFIC_INDISPONIBLE')
      assert.strictEqual(inc.contexte.http, null)
      assert.strictEqual(inc.contexte.cause, 'ECONNABORTED')
      assert.ok(inc.message.includes('API IDFM injoignable'))
    })

    it('rétablissement : TRAFIC_RETABLI puis nouvelle panne signalée de nouveau', async () => {
      let panne = true
      const c = loadTrafic((url) => (panne ? ko(503)(url) : ok(url)))
      await c.fetch(); await c.fetch()
      panne = false; await c.fetch()
      panne = true; await c.fetch(); await c.fetch()
      assert.deepStrictEqual(c.incidents.map(i => i.type), ['TRAFIC_INDISPONIBLE', 'TRAFIC_RETABLI', 'TRAFIC_INDISPONIBLE'])
    })

    it('deux arrêts : seul l\'arrêt en panne est signalé', async () => {
      const AUTRE = { id: 'stop_area:IDFM:99999', nom: 'Bourg-la-Reine', lignesSelectionnees: [] }
      const c = loadTrafic(ko(503))
      await c.fetch([ARRET, AUTRE]); await c.fetch([ARRET, AUTRE])
      const inc = c.incidents.filter(i => i.type === 'TRAFIC_INDISPONIBLE')
      assert.deepStrictEqual(inc.map(i => i.contexte.arretId), [ARRET.id])
    })

    it('template mal configuré (sans clé ou sans arrêt) : signalé une seule fois', async () => {
      const c = loadTrafic(ok)
      c.tr.container = { style: {}, set innerHTML(v) {} }
      c.tr._hideOtherContainers = () => {}
      c.tr.renderTrafic = () => ''
      for (let i = 0; i < 3; i++) c.tr._showTrafic({ type: 'trafic', arrets: [ARRET], apiKey: '' }, 1)
      await new Promise(r => setImmediate(r))
      const inc = c.incidents.filter(i => i.type === 'TRAFIC_INDISPONIBLE')
      assert.strictEqual(inc.length, 1)
      assert.strictEqual(inc[0].contexte.cause, 'clé API IDFM absente')
    })
  })
})
