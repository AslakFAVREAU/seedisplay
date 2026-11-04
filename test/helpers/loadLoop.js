/**
 * Charge js/loopDiapo.js dans un contexte vm avec horloge simulée, faux DOM
 * et faux window.api — sans Electron ni navigateur.
 *
 *   const h = loadLoop({ media: [['img','a.jpg',5], ...] })
 *   h.start()                  // LoopDiapo()
 *   await h.clock.tick(60000)
 *   h.incidents                // incidents remontés via api.reportIncident
 *   h.calls                    // appels showMedia { gen, index, t }
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { FakeClock } = require('./fakeClock')
const { createFakeDom } = require('./fakeDom')

const LOOP_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'loopDiapo.js'), 'utf8')

function loadLoop(opts = {}) {
  const clock = opts.clock || new FakeClock()
  const dom = createFakeDom(clock)
  const incidents = []
  const pings = []
  const logs = []
  const calls = []
  const counters = { defaultScreen: 0, restartRequests: 0, saveBinary: 0, requestJsonDiapo: 0, templateShow: 0, templateHide: 0 }
  let safeModeCb = null

  // Fichiers absents du cache local : téléchargés (lentement) avant affichage
  const notCached = new Map()   // fichier → durée du téléchargement (ms)
  const api = {
    getEnv: () => null,
    existsSync: (rel) => !notCached.has(rel.replace(/^media\//, '')),
    saveBinaryWithCache: (rel) => new Promise(r => {
      const f = rel.replace(/^media\//, '')
      clock.setTimeout(() => { notCached.delete(f); r({ success: true, cached: false }) }, notCached.get(f) || 0)
    }),
    saveBinary: async () => { counters.saveBinary++; return true },
    checkForUpdates: async () => null,
    reportIncident: (type, niveau, message, contexte) => incidents.push({ type, niveau, message, contexte, t: clock.now() }),
    watchdogPing: (p) => pings.push(Object.assign({ t: clock.now() }, p)),
    watchdogRequestRestart: (cause) => { counters.restartRequests++; incidents.push({ type: '__RESTART_REQUEST__', message: cause, t: clock.now() }) },
    onWatchdogSafeMode: (cb) => { safeModeCb = cb }
  }

  const templateRenderer = {
    scenario: 'ok',   // 'ok' | 'hang' | 'reject' | 'throw'
    show(data, durationS) {
      counters.templateShow++
      if (this.scenario === 'throw') throw new Error('template boom')
      if (this.scenario === 'hang') return new Promise(() => {})
      if (this.scenario === 'reject') return Promise.reject(new Error('template rejected'))
      return new Promise(r => clock.setTimeout(r, durationS * 1000))
    },
    hide() { counters.templateHide++ },
    prefetchTrafic() {}
  }

  const planningManager = {
    container: { style: {} },
    throwOnShow: false,
    init() {},
    show() { if (this.throwOnShow) throw new Error('planning boom') },
    hide() {}
  }

  const win = {
    console: opts.verbose ? console : { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    logger: {
      info: (...a) => logs.push(['info', ...a]),
      warn: (...a) => logs.push(['warn', ...a]),
      error: (...a) => logs.push(['error', ...a]),
      debug: () => {}
    },
    document: dom.document,
    Image: dom.Image,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    Date: clock.Date,
    Promise, Map, Set, Math, JSON, Error, Number, String, Array, Object,
    AbortController,
    encodeURIComponent, decodeURIComponent,
    getComputedStyle: (el) => el.style,
    api,
    templateRenderer,
    planningManager,
    // Globals déclarés dans index.html / defaultScreen.js
    player: 1,
    imgShow: 1,
    imgLoad: 2,
    pathMedia: 'see-media://media/',
    ArrayMedia: [],
    ArrayDiapo: [],
    screenStatus: 'active',
    masquerPageDefault: false,
    getMediaUrl: (f) => 'see-media://media/' + f,
    getMediaBaseUrl: () => 'http://fake/uploads/see/media/',
    defaultScreen: () => { counters.defaultScreen++ },
    requestJsonDiapo: async () => { counters.requestJsonDiapo++ },
    location: { reload() { counters.locationReload = (counters.locationReload || 0) + 1 } }
  }
  win.window = win
  win.globalThis = win

  const ctx = vm.createContext(win)
  vm.runInContext(LOOP_SRC, ctx, { filename: 'loopDiapo.js' })

  // Instrumentation : chaque appel de showMedia (y compris les appels internes,
  // qui passent par la liaison globale) est tracé avec sa génération.
  const realShowMedia = ctx.showMedia
  ctx.showMedia = function (index) {
    calls.push({ gen: vm.runInContext('loopGeneration', ctx), index, t: clock.now() })
    return realShowMedia.apply(this, arguments)
  }

  const h = {
    ctx, clock, dom, api, incidents, pings, logs, calls, counters, templateRenderer, planningManager, notCached,
    run: (code) => vm.runInContext(code, ctx),
    setMedia(list) { win.ArrayMedia = list; win.ArrayDiapo = list },
    start() { ctx.LoopDiapo() },
    setSafeMode(on) { if (safeModeCb) safeModeCb(on) },
    incidentsOf: (type) => incidents.filter(i => i.type === type)
  }
  if (opts.media) h.setMedia(opts.media)
  return h
}

/**
 * Vérifie qu'il n'y a jamais deux chaînes actives : dans une même génération,
 * chaque appel de showMedia doit être le successeur du précédent (index + 1,
 * ou 0 après le wrap-around). Deux chaînes entrelacées violent cette règle.
 * `mediaCount` : longueur de la liste (la plus petite si elle change en cours de route).
 * @returns {Array} violations
 */
function chainViolations(calls, mediaCount) {
  const byGen = new Map()
  const violations = []
  for (const c of calls) {
    const prev = byGen.get(c.gen)
    if (prev !== undefined) {
      const ok = c.index === prev + 1 || (c.index === 0 && prev >= mediaCount)
      if (!ok) violations.push({ gen: c.gen, prev, got: c.index, t: c.t })
    }
    byGen.set(c.gen, c.index)
  }
  return violations
}

module.exports = { loadLoop, chainViolations }
