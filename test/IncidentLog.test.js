/**
 * lib/IncidentLog.js — file persistante d'incidents remontée à SOEK.
 * Serveur HTTP local qui applique le contrat SOEK (accepted / rejected).
 */
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const axios = require('axios')
const { IncidentLog, baseUrlForEnv } = require('../lib/IncidentLog')

const silent = { info() {}, warn() {}, error() {}, debug() {} }

describe('IncidentLog (lib/IncidentLog.js)', function () {
  this.timeout(10000)
  let server, port, mode, received, requests, dir, now

  before(done => {
    server = http.createServer((req, res) => {
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', () => {
        requests.push({ url: req.url, token: req.headers['x-api-token'], body })
        if (mode === '500') { res.writeHead(500); return res.end() }
        if (mode === '401') { res.writeHead(401); return res.end('{"error":"Invalid token"}') }
        if (mode === 'hang') return
        const data = JSON.parse(body)
        const accepted = []
        const rejected = []
        for (const i of data.incidents) {
          if (mode === 'reject-first' && i === data.incidents[0]) { rejected.push({ clientId: i.clientId, raison: 'invalide' }); continue }
          if (mode === 'accept-none') continue
          accepted.push(i.clientId)
          received.push(i)
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, accepted, rejected }))
      })
    }).listen(0, () => { port = server.address().port; done() })
  })

  after(done => { server.closeAllConnections && server.closeAllConnections(); server.close(done) })

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'see-inc-'))
    mode = 'ok'; received = []; requests = []; now = Date.UTC(2026, 10, 3, 10)
  })

  const make = (extra = {}) => new IncidentLog(Object.assign({
    filePath: path.join(dir, 'cache', 'incidents.json'),
    getConfig: () => ({ ecranUuid: 'ecran-1', apiToken: 'tok', env: 'local' }),
    axios: axios.create({ baseURL: undefined }),
    log: silent,
    now: () => now,
    appVersion: '9.9.9',
    options: { criticalFlushDelayMs: 60 * 60 * 1000, requestTimeoutMs: 500 }
  }, extra))

  // Rediriger http://localhost:8000 vers le serveur de test
  const withPort = (log) => { log._axios = axios.create(); const post = log._axios.post.bind(log._axios); log._axios.post = (url, ...a) => post(url.replace('http://localhost:8000', 'http://127.0.0.1:' + port), ...a); return log }

  it('enregistre un incident complet et le persiste sur disque', () => {
    const log = make()
    const inc = log.record('RENDERER_CRASH', 'critique', 'boom', { reason: 'oom' })
    assert.match(inc.clientId, /^[0-9a-f-]{36}$/)
    assert.strictEqual(inc.versionApp, '9.9.9')
    assert.strictEqual(inc.source, 'main')
    const disk = JSON.parse(fs.readFileSync(path.join(dir, 'cache', 'incidents.json'), 'utf8'))
    assert.strictEqual(disk.length, 1)
    assert.strictEqual(disk[0].type, 'RENDERER_CRASH')
  })

  it('recharge la file au redémarrage (incident écrit juste avant un relaunch)', () => {
    make().record('APP_RELANCEE', 'critique', 'relance', {})
    const log2 = make()
    assert.strictEqual(log2.pending(), 1)
    assert.strictEqual(log2.list()[0].type, 'APP_RELANCEE')
  })

  it('fichier corrompu : repart d\'une file vide sans planter', () => {
    fs.mkdirSync(path.join(dir, 'cache'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'cache', 'incidents.json'), '{pas du json')
    const log = make()
    assert.strictEqual(log.pending(), 0)
    log.record('DEMARRAGE', 'info', 'ok')
    assert.strictEqual(log.pending(), 1)
  })

  it('normalise type, niveau, message et contexte', () => {
    const log = make()
    const inc = log.record('video sautée!', 'grave', 'x'.repeat(2000), 'pas un objet')
    assert.strictEqual(inc.type, 'VIDEO_SAUT_E_')
    assert.strictEqual(inc.niveau, 'warn')
    assert.strictEqual(inc.message.length, 500)
    assert.deepStrictEqual(inc.contexte, { valeur: 'pas un objet' })
  })

  it('dédoublonne même type + même fichier dans les 10 min (occurrences)', () => {
    const log = make()
    log.record('VIDEO_SAUTEE', 'warn', 'e1', { fichier: 'a.mp4' })
    now += 60000
    log.record('VIDEO_SAUTEE', 'warn', 'e2', { fichier: 'a.mp4' })
    log.record('VIDEO_SAUTEE', 'warn', 'e3', { fichier: 'b.mp4' })
    assert.strictEqual(log.pending(), 2)
    const a = log.list().find(i => i.contexte.fichier === 'a.mp4')
    assert.strictEqual(a.occurrences, 2)
    assert.strictEqual(a.message, 'e2')
    assert.strictEqual(a._derniere, undefined, 'champ interne non exposé')
  })

  it('dédoublonne sur contexte.cle quand il n\'y a pas de fichier (un incident par arrêt)', () => {
    const log = make()
    log.record('TRAFIC_INDISPONIBLE', 'warn', 'x', { cle: 'trafic:A' })
    log.record('TRAFIC_INDISPONIBLE', 'warn', 'x', { cle: 'trafic:A' })
    log.record('TRAFIC_INDISPONIBLE', 'warn', 'x', { cle: 'trafic:B' })
    log.record('METEO_INDISPONIBLE', 'warn', 'x', {})
    assert.strictEqual(log.pending(), 3)
    assert.strictEqual(log.list().find(i => i.contexte.cle === 'trafic:A').occurrences, 2)
  })

  it('la fenêtre de dédoublonnage glisse avec la dernière occurrence', () => {
    const log = make()
    for (let i = 0; i < 30; i++) { log.record('VIDEO_FIGEE', 'warn', 'x', { fichier: 'a.mp4' }); now += 5 * 60 * 1000 }
    assert.strictEqual(log.pending(), 1)
    assert.strictEqual(log.list()[0].occurrences, 30)
    now += 11 * 60 * 1000
    log.record('VIDEO_FIGEE', 'warn', 'x', { fichier: 'a.mp4' })
    assert.strictEqual(log.pending(), 2)
  })

  it('un doublon plus grave remonte le niveau', () => {
    const log = make()
    log.record('BOUCLE_BLOQUEE', 'warn', 'n1')
    log.record('BOUCLE_BLOQUEE', 'critique', 'n2')
    assert.strictEqual(log.list()[0].niveau, 'critique')
  })

  it('limite à 300 entrées en supprimant d\'abord les plus anciens info', () => {
    const log = make()
    log.record('APP_RELANCEE', 'critique', 'garder', { fichier: 'c' })
    for (let i = 0; i < 320; i++) log.record('DEMARRAGE', 'info', 'i' + i, { fichier: 'f' + i })
    assert.strictEqual(log.pending(), 300)
    assert.ok(log.list().some(i => i.type === 'APP_RELANCEE'), 'le critique doit survivre')
    assert.strictEqual(log.list().find(i => i.type === 'DEMARRAGE').message, 'i21')
  })

  it('envoie à SOEK avec le token et vide la file des incidents acceptés', async () => {
    const log = withPort(make())
    log.record('RENDERER_FIGE', 'critique', 'a')
    log.record('PAGE_RECHARGEE', 'warn', 'b')
    const r = await log.flush()
    assert.strictEqual(r.sent, 2)
    assert.strictEqual(log.pending(), 0)
    assert.strictEqual(requests[0].url, '/see/API/heartbeat/ecran-1/incidents')
    assert.strictEqual(requests[0].token, 'tok')
    assert.strictEqual(received[0].type, 'RENDERER_FIGE')
    assert.strictEqual(received[0]._derniere, undefined)
  })

  it('un doublon arrivé pendant l\'envoi n\'est pas perdu', async () => {
    const log = withPort(make())
    log.record('VIDEO_SAUTEE', 'warn', 'a', { fichier: 'a.mp4' })
    const p = log.flush()
    log.record('VIDEO_SAUTEE', 'warn', 'a', { fichier: 'a.mp4' })
    log.record('VIDEO_SAUTEE', 'warn', 'a', { fichier: 'a.mp4' })
    await p
    assert.strictEqual(received[0].occurrences, 1)
    assert.strictEqual(log.pending(), 1)
    assert.strictEqual(log.list()[0].occurrences, 2)
    assert.notStrictEqual(log.list()[0].clientId, received[0].clientId)
  })

  it('lots de 50 maximum', async () => {
    const log = withPort(make())
    for (let i = 0; i < 120; i++) log.record('X', 'info', 'm', { fichier: String(i) })
    await log.flush()
    assert.strictEqual(JSON.parse(requests[0].body).incidents.length, 50)
    assert.strictEqual(log.pending(), 70)
  })

  it('ne retire que les incidents acceptés ; les rejetés sont abandonnés', async () => {
    const log = withPort(make())
    log.record('A', 'warn', '1', { fichier: '1' })
    log.record('B', 'warn', '2', { fichier: '2' })
    mode = 'accept-none'
    await log.flush()
    assert.strictEqual(log.pending(), 2)
    mode = 'reject-first'
    await log.flush()
    assert.strictEqual(log.pending(), 0)
  })

  it('500 : garde la file et applique un backoff exponentiel', async () => {
    const log = withPort(make())
    log.record('A', 'critique', 'x')
    mode = '500'
    const r1 = await log.flush()
    assert.ok(r1.error)
    assert.strictEqual(log.pending(), 1)
    assert.strictEqual(log.stats().nextAttemptAt, now + 60000)
    assert.strictEqual((await log.flush()).skipped, 'backoff')
    now += 61000
    await log.flush()
    assert.strictEqual(log.stats().nextAttemptAt, now + 120000)
    for (let i = 0; i < 10; i++) { now += 11 * 60 * 1000; await log.flush() }
    assert.ok(log.stats().nextAttemptAt - now <= 10 * 60 * 1000, 'backoff plafonné à 10 min')
    mode = 'ok'
    now += 11 * 60 * 1000
    await log.flush()
    assert.strictEqual(log.pending(), 0)
    assert.strictEqual(log.stats().failures, 0)
  })

  it('401 (token invalide) : garde la file', async () => {
    const log = withPort(make())
    log.record('A', 'critique', 'x')
    mode = '401'
    const r = await log.flush()
    assert.strictEqual(r.error, 'HTTP 401')
    assert.strictEqual(log.pending(), 1)
  })

  it('serveur pendu : timeout de requête, file conservée', async () => {
    const log = withPort(make())
    log.record('A', 'critique', 'x')
    mode = 'hang'
    const t0 = Date.now()
    await log.flush()
    assert.ok(Date.now() - t0 < 3000)
    assert.strictEqual(log.pending(), 1)
  })

  it('pas de config (écran non associé) ou mode offline : rien n\'est envoyé', async () => {
    const a = withPort(make({ getConfig: () => ({}) }))
    a.record('A', 'info', 'x')
    assert.strictEqual((await a.flush()).skipped, 'no-config')
    const b = withPort(make({ isOffline: () => true }))
    assert.strictEqual((await b.flush()).skipped, 'offline')
    assert.strictEqual(requests.length, 0)
  })

  it('un seul envoi à la fois (appels concurrents)', async () => {
    const log = withPort(make())
    log.record('A', 'info', 'x')
    await Promise.all([log.flush(), log.flush(), log.flush()])
    assert.strictEqual(requests.length, 1)
  })

  it('un incident critique déclenche un envoi rapide', async () => {
    const log = withPort(make({ options: { criticalFlushDelayMs: 20, requestTimeoutMs: 500 } }))
    log.record('RENDERER_CRASH', 'critique', 'x')
    await new Promise(r => setTimeout(r, 300))
    assert.strictEqual(received.length, 1)
    log.stop()
  })

  it('URL de base selon env (même mapping que HeartbeatManager)', () => {
    assert.strictEqual(baseUrlForEnv('prod'), 'https://soek.fr')
    assert.strictEqual(baseUrlForEnv('BETA'), 'https://beta.soek.fr')
    assert.strictEqual(baseUrlForEnv('local'), 'http://localhost:8000')
    assert.strictEqual(baseUrlForEnv(undefined), 'https://soek.fr')
  })
})
