/**
 * lib/mediaProtocol.js — handler see-media:// : streaming, plages d'octets,
 * garde anti path-traversal, robustesse.
 */
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { createSeeMediaHandler } = require('../lib/mediaProtocol')

const silent = { warn() {}, info() {}, debug() {} }

describe('see-media:// (lib/mediaProtocol.js)', function () {
  this.timeout(20000)
  let base, handler, file

  before(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'see-proto-'))
    fs.mkdirSync(path.join(base, 'media', 'sous dossier'), { recursive: true })
    file = crypto.randomBytes(1000000)
    fs.writeFileSync(path.join(base, 'media', 'v.mp4'), file)
    fs.writeFileSync(path.join(base, 'media', 'sous dossier', 'é t.jpg'), 'IMG')
    fs.writeFileSync(path.join(path.dirname(base), 'secret-' + path.basename(base) + '.txt'), 'SECRET')
    handler = createSeeMediaHandler({ basePath: base, log: silent })
  })

  const req = (url, range) => ({ url, headers: new Headers(range ? { Range: range } : {}) })
  const get = async (url, range) => {
    const res = await handler(req(url, range))
    const body = res.body ? Buffer.from(await res.arrayBuffer()) : null
    return { res, body }
  }

  it('fichier complet : 200, Content-Length, Content-Type', async () => {
    const { res, body } = await get('see-media://media/v.mp4')
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.headers.get('content-length'), String(file.length))
    assert.strictEqual(res.headers.get('content-type'), 'video/mp4')
    assert.ok(body.equals(file))
  })

  it('Range ouvert bytes=0- : 206 sur tout le fichier', async () => {
    const { res, body } = await get('see-media://media/v.mp4', 'bytes=0-')
    assert.strictEqual(res.status, 206)
    assert.strictEqual(res.headers.get('content-range'), `bytes 0-${file.length - 1}/${file.length}`)
    assert.ok(body.equals(file))
  })

  it('Range au milieu', async () => {
    const { res, body } = await get('see-media://media/v.mp4', 'bytes=100-199')
    assert.strictEqual(res.status, 206)
    assert.ok(body.equals(file.slice(100, 200)))
  })

  it('Range suffixe bytes=-N', async () => {
    const { body } = await get('see-media://media/v.mp4', 'bytes=-50')
    assert.ok(body.equals(file.slice(-50)))
  })

  it('suffixe plus grand que le fichier : tout le fichier', async () => {
    const { res, body } = await get('see-media://media/v.mp4', 'bytes=-99999999')
    assert.strictEqual(res.status, 206)
    assert.ok(body.equals(file))
  })

  it('fin au-delà de la taille : tronquée à la taille', async () => {
    const { body } = await get('see-media://media/v.mp4', `bytes=${file.length - 10}-${file.length + 500}`)
    assert.ok(body.equals(file.slice(-10)))
  })

  it('début au-delà de la taille : 416', async () => {
    const { res } = await get('see-media://media/v.mp4', 'bytes=2000000-')
    assert.strictEqual(res.status, 416)
    assert.strictEqual(res.headers.get('content-range'), `bytes */${file.length}`)
  })

  it('début > fin : 416', async () => {
    const { res } = await get('see-media://media/v.mp4', 'bytes=500-100')
    assert.strictEqual(res.status, 416)
  })

  it('Range illisible : ignoré, fichier complet', async () => {
    const { res } = await get('see-media://media/v.mp4', 'items=1-2')
    assert.strictEqual(res.status, 200)
  })

  it('fragment #nocache et query ignorés', async () => {
    assert.strictEqual((await get('see-media://media/v.mp4#nocache=123')).res.status, 200)
    assert.strictEqual((await get('see-media://media/v.mp4?x=1')).res.status, 200)
  })

  it('triple slash et nom encodé avec espace et accent', async () => {
    const { res, body } = await get('see-media:///media/sous%20dossier/%C3%A9%20t.jpg')
    assert.strictEqual(res.status, 200)
    assert.strictEqual(body.toString(), 'IMG')
  })

  it('fichier absent : 404', async () => {
    assert.strictEqual((await get('see-media://media/nope.mp4')).res.status, 404)
  })

  it('dossier : 404', async () => {
    assert.strictEqual((await get('see-media://media/sous%20dossier')).res.status, 404)
  })

  it('URL mal encodée : 400 (pas d\'exception)', async () => {
    assert.strictEqual((await get('see-media://media/%E0%A4%A')).res.status, 400)
  })

  const secretName = () => 'secret-' + path.basename(base) + '.txt'
  for (const [label, url] of [
    ['../ en clair', () => 'see-media://media/../../' + secretName()],
    ['%2e%2e encodé', () => 'see-media://media/%2e%2e/%2e%2e/' + secretName()],
    ['..%2F encodé', () => 'see-media://media/..%2F..%2F' + secretName()],
    ['chemin absolu', () => 'see-media://' + encodeURIComponent(path.join(path.dirname(base), secretName()))],
    ['antislash Windows', () => 'see-media://media/..%5C..%5C' + secretName()]
  ]) {
    it('path traversal (' + label + ') : jamais servi', async () => {
      const { res, body } = await get(url())
      assert.ok([403, 404].includes(res.status), 'statut ' + res.status)
      assert.ok(!body || !body.toString().includes('SECRET'))
    })
  }

  it('stress : 200 requêtes Range en parallèle, contenu exact', async () => {
    const jobs = Array.from({ length: 200 }, (_, i) => {
      const start = (i * 4999) % (file.length - 5000)
      return get('see-media://media/v.mp4', `bytes=${start}-${start + 4999}`)
        .then(({ body }) => assert.ok(body.equals(file.slice(start, start + 5000)), 'plage ' + start))
    })
    await Promise.all(jobs)
  })

  it('fichier remplacé (rename atomique) pendant un stream : l\'ancien flux se termine proprement', async () => {
    const p = path.join(base, 'media', 'swap.mp4')
    const oldContent = crypto.randomBytes(3 * 1024 * 1024)
    fs.writeFileSync(p, oldContent)
    const res = await handler(req('see-media://media/swap.mp4'))
    const reader = res.body.getReader()
    const first = await reader.read()
    // Remplacement atomique comme le fait lib/download.js
    fs.writeFileSync(p + '.part', 'NEW')
    try { fs.renameSync(p + '.part', p) } catch (e) {
      // Windows : renommage impossible tant que le fichier est ouvert → c'est le cas couvert par les retries de download.js
      assert.ok(['EPERM', 'EBUSY', 'EACCES'].includes(e.code), e.code)
    }
    const chunks = [Buffer.from(first.value)]
    for (;;) { const r = await reader.read(); if (r.done) break; chunks.push(Buffer.from(r.value)) }
    assert.ok(Buffer.concat(chunks).equals(oldContent), 'le flux en cours doit livrer l\'ancien contenu complet')
    try { fs.unlinkSync(p + '.part') } catch (_) { /* ignore */ }
  })
})
