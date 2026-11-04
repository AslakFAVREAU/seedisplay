/**
 * lib/download.js — téléchargement streaming, .part + rename atomique,
 * timeouts, déduplication. Serveur HTTP local réel.
 */
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const axios = require('axios')
const { createDownloader } = require('../lib/download')

const BODY = Buffer.alloc(512 * 1024, 7)

describe('download (lib/download.js)', function () {
  this.timeout(10000)
  let server, base, dir, hits

  before(done => {
    hits = {}
    server = http.createServer((req, res) => {
      hits[req.url] = (hits[req.url] || 0) + 1
      switch (req.url) {
        case '/ok':
          if (req.headers['if-none-match'] === '"v1"') { res.writeHead(304); return res.end() }
          res.writeHead(200, { 'Content-Length': BODY.length, ETag: '"v1"' })
          return res.end(BODY)
        case '/slow-ok':
          res.writeHead(200, { 'Content-Length': BODY.length })
          return setTimeout(() => res.end(BODY), 150)
        case '/500': res.writeHead(500); return res.end('boom')
        case '/trunc':
          res.writeHead(200, { 'Content-Length': BODY.length })
          res.write(BODY.slice(0, 1000))
          return setTimeout(() => res.destroy(), 50)
        case '/hang':
          res.writeHead(200, { 'Content-Length': BODY.length })
          return res.write('x')
        case '/no-headers': return   // ne répond jamais
        case '/chunked':
          res.writeHead(200)   // pas de Content-Length
          res.write(BODY.slice(0, 1000))
          return setTimeout(() => res.end(BODY.slice(1000)), 20)
        case '/empty':
          res.writeHead(200, { 'Content-Length': 0 })
          return res.end()
        default: res.writeHead(404); res.end()
      }
    }).listen(0, () => { base = 'http://127.0.0.1:' + server.address().port; done() })
  })

  after(done => { server.closeAllConnections && server.closeAllConnections(); server.close(done) })

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'see-dl-'))
    hits = {}
  })

  const make = (options = {}, fsp) => createDownloader({ axios, fsp, options: Object.assign({ connectTimeoutMs: 1000, idleTimeoutMs: 400, renameRetryDelayMs: 10 }, options) })
  const dest = () => path.join(dir, 'media', 'v.mp4')
  const writeOld = () => { fs.mkdirSync(path.dirname(dest()), { recursive: true }); fs.writeFileSync(dest(), 'OLD') }
  const noPart = () => assert.strictEqual(fs.existsSync(dest() + '.part'), false, 'un .part est resté sur le disque')

  it('200 : écrit le fichier complet, renvoie l\'ETag, ne laisse pas de .part', async () => {
    const r = await make().downloadToFile(base + '/ok', dest())
    assert.deepStrictEqual(r, { status: 200, size: BODY.length, etag: '"v1"' })
    assert.ok(fs.readFileSync(dest()).equals(BODY))
    noPart()
  })

  it('304 : ne touche pas au fichier local', async () => {
    writeOld()
    const r = await make().downloadToFile(base + '/ok', dest(), { 'If-None-Match': '"v1"' })
    assert.strictEqual(r.status, 304)
    assert.strictEqual(fs.readFileSync(dest(), 'utf8'), 'OLD')
  })

  it('500 : échoue sans abîmer l\'ancien fichier', async () => {
    writeOld()
    await assert.rejects(make().downloadToFile(base + '/500', dest()))
    assert.strictEqual(fs.readFileSync(dest(), 'utf8'), 'OLD')
    noPart()
  })

  it('transfert tronqué : échoue, ancien fichier intact, .part supprimé', async () => {
    writeOld()
    await assert.rejects(make().downloadToFile(base + '/trunc', dest()))
    assert.strictEqual(fs.readFileSync(dest(), 'utf8'), 'OLD')
    noPart()
  })

  it('serveur muet en plein transfert : abandon après le délai d\'inactivité', async () => {
    writeOld()
    const t0 = Date.now()
    await assert.rejects(make({ idleTimeoutMs: 300 }).downloadToFile(base + '/hang', dest()))
    assert.ok(Date.now() - t0 < 3000, 'le timeout d\'inactivité n\'a pas joué')
    assert.strictEqual(fs.readFileSync(dest(), 'utf8'), 'OLD')
    noPart()
  })

  it('serveur qui n\'envoie jamais les headers : abandon après le timeout de connexion', async () => {
    const t0 = Date.now()
    await assert.rejects(make({ connectTimeoutMs: 300 }).downloadToFile(base + '/no-headers', dest()))
    assert.ok(Date.now() - t0 < 3000)
  })

  it('réponse sans Content-Length (chunked) : acceptée', async () => {
    const r = await make().downloadToFile(base + '/chunked', dest())
    assert.strictEqual(r.size, BODY.length)
    assert.ok(fs.readFileSync(dest()).equals(BODY))
  })

  it('réponse vide : refusée, ancien fichier intact', async () => {
    writeOld()
    await assert.rejects(make().downloadToFile(base + '/empty', dest()), /empty/)
    assert.strictEqual(fs.readFileSync(dest(), 'utf8'), 'OLD')
    noPart()
  })

  it('10 appels simultanés sur le même fichier : un seul GET', async () => {
    const d = make()
    const results = await Promise.all(Array.from({ length: 10 }, () => d.downloadToFileOnce(base + '/slow-ok', dest())))
    assert.strictEqual(hits['/slow-ok'], 1)
    results.forEach(r => assert.strictEqual(r.size, BODY.length))
    assert.strictEqual(d.inFlightCount(), 0)
  })

  it('après un échec, un nouvel appel retente vraiment (pas de promesse en cache)', async () => {
    const d = make()
    await assert.rejects(d.downloadToFileOnce(base + '/500', dest()))
    await assert.rejects(d.downloadToFileOnce(base + '/500', dest()))
    assert.strictEqual(hits['/500'], 2)
  })

  it('rename en EBUSY (fichier ouvert sous Windows) puis OK : réessaie', async () => {
    let fails = 2
    const fsp = Object.assign({}, fs.promises, {
      rename: async (a, b) => {
        if (fails-- > 0) { const e = new Error('busy'); e.code = 'EBUSY'; throw e }
        return fs.promises.rename(a, b)
      }
    })
    const r = await make({}, fsp).downloadToFile(base + '/ok', dest())
    assert.strictEqual(r.status, 200)
    assert.ok(fs.readFileSync(dest()).equals(BODY))
  })

  it('rename en EPERM permanent : échoue et nettoie le .part', async () => {
    writeOld()
    const fsp = Object.assign({}, fs.promises, {
      rename: async () => { const e = new Error('perm'); e.code = 'EPERM'; throw e }
    })
    await assert.rejects(make({ renameRetries: 3 }, fsp).downloadToFile(base + '/ok', dest()), /perm/)
    assert.strictEqual(fs.readFileSync(dest(), 'utf8'), 'OLD')
    noPart()
  })
})
