#!/usr/bin/env node
/**
 * Faux serveur SOEK pour tester SEE Display en local (config "env": "local").
 *
 *   node scripts/fake-soek.js [options]
 *
 * Options :
 *   --port=8000              port d'écoute (env local = http://localhost:8000)
 *   --media=<dossier>        médias réels à servir (vidéos .mp4…) en plus des
 *                            images PNG générées
 *   --faults=<liste>         pannes sur les médias : none (défaut), random, slow,
 *                            truncate, 500, hang, corrupt, etag
 *   --rate=0.3               probabilité d'une panne par requête (mode random)
 *   --api=ok|down|slow|hang  comportement de /see/API/diapo
 *   --incidents=ok|down|500  comportement de l'endpoint incidents
 *   --timeline-change=<s>    change la timeline toutes les N secondes
 *   --duree=<s>              durée des images (défaut 5)
 *   --corrupt-video          ajoute une vidéo corrompue (octets aléatoires) à la timeline
 *
 * Le serveur affiche chaque heartbeat (résumé watchdog) et chaque incident reçu,
 * en appliquant les mêmes règles de validation que SOEK (contrat documenté dans
 * docs/HEARTBEAT_SYSTEM.md § Incidents).
 */
const http = require('http')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const crypto = require('crypto')

// ─── Options ─────────────────────────────────────────────────────────────────
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/)
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]
}))
const PORT = parseInt(args.port || '8000', 10)
const FAULTS = String(args.faults || 'none').split(',')
const RATE = parseFloat(args.rate || '0.3')
const API_MODE = args.api || 'ok'
const INCIDENTS_MODE = args.incidents || 'ok'
const DUREE = parseInt(args.duree || '5', 10)
const TIMELINE_CHANGE_S = parseInt(args['timeline-change'] || '0', 10)

// ─── Médias ──────────────────────────────────────────────────────────────────
/** PNG plein, couleur unie, avec un bandeau — sans dépendance. */
function makePng(w, h, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    const band = y > h * 0.45 && y < h * 0.55
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3
      raw[o] = band ? 255 : r; raw[o + 1] = band ? 255 : g; raw[o + 2] = band ? 255 : b
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ])
}

const media = new Map()   // nom → { buf, type }
;[['fake-rouge.png', [200, 40, 40]], ['fake-vert.png', [40, 160, 60]], ['fake-bleu.png', [40, 70, 200]]]
  .forEach(([name, color]) => media.set(name, { buf: makePng(1920, 1080, color), type: 'img' }))

if (args.media) {
  for (const f of fs.readdirSync(args.media)) {
    const ext = path.extname(f).toLowerCase()
    const type = ['.mp4', '.webm'].includes(ext) ? 'video' : ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? 'img' : null
    if (type) media.set(f, { buf: fs.readFileSync(path.join(args.media, f)), type })
  }
}
if (args['corrupt-video']) media.set('fake-corrompue.mp4', { buf: crypto.randomBytes(512 * 1024), type: 'video' })

let timelineVersion = 1
if (TIMELINE_CHANGE_S > 0) setInterval(() => { timelineVersion++; console.log(`[timeline] version ${timelineVersion}`) }, TIMELINE_CHANGE_S * 1000)

function timeline() {
  let i = 0
  return [...media.entries()].map(([name, m]) => ({
    mediaType: m.type,
    mediaFichier: name,
    duree: DUREE + (timelineVersion % 2),     // change la signature à chaque version
    mediaId: ++i,
    mediaNom: name,
    mediaUpdatedAt: 'v1',
    diapoId: 1,
    diapoNom: 'Fake SOEK'
  }))
}

// ─── Pannes ──────────────────────────────────────────────────────────────────
function pickFault() {
  const active = FAULTS.filter(f => f !== 'none' && f !== 'random')
  if (FAULTS.includes('random')) {
    if (Math.random() > RATE) return null
    const all = ['slow', 'truncate', '500', 'hang', 'corrupt', 'etag']
    return all[Math.floor(Math.random() * all.length)]
  }
  return active.length ? active[Math.floor(Math.random() * active.length)] : null
}

function serveMedia(req, res, name) {
  const m = media.get(name)
  if (!m) { res.writeHead(404); return res.end('Not Found') }
  const fault = pickFault()
  let etag = '"' + crypto.createHash('md5').update(m.buf).digest('hex') + '"'
  if (fault === 'etag') etag = '"' + Date.now() + '"'
  if (fault) console.log(`[media] ${name} → panne ${fault}`)

  if (!fault && req.headers['if-none-match'] === etag) { res.writeHead(304); return res.end() }

  switch (fault) {
    case '500': res.writeHead(500); return res.end('Internal Server Error')
    case 'hang': res.writeHead(200, { 'Content-Length': m.buf.length }); res.write(m.buf.slice(0, 1024)); return   // jamais terminé
    case 'truncate':
      res.writeHead(200, { 'Content-Length': m.buf.length, ETag: etag })
      res.write(m.buf.slice(0, Math.floor(m.buf.length / 3)))
      return setTimeout(() => res.destroy(), 200)
    case 'corrupt': {
      const bad = crypto.randomBytes(m.buf.length)
      res.writeHead(200, { 'Content-Length': bad.length, ETag: '"corrupt-' + Date.now() + '"' })
      return res.end(bad)
    }
    case 'slow': {
      res.writeHead(200, { 'Content-Length': m.buf.length, ETag: etag })
      let off = 0
      const t = setInterval(() => {
        if (off >= m.buf.length) { clearInterval(t); return res.end() }
        res.write(m.buf.slice(off, off + 64 * 1024)); off += 64 * 1024
      }, 500)
      res.on('close', () => clearInterval(t))
      return
    }
    default:
      res.writeHead(200, { 'Content-Length': m.buf.length, ETag: etag })
      return res.end(m.buf)
  }
}

// ─── Contrat incidents (mêmes règles que SOEK) ───────────────────────────────
const seenIncidents = new Set()
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLORS = { critique: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[90m' }

function handleIncidents(body, res) {
  if (INCIDENTS_MODE === 'down') { res.socket.destroy(); return }
  if (INCIDENTS_MODE === '500') { res.writeHead(500); return res.end() }
  if (body.length > 256 * 1024) { res.writeHead(413); return res.end('{"error":"Payload too large"}') }
  let data
  try { data = JSON.parse(body) } catch (e) { res.writeHead(400); return res.end('{"error":"Invalid JSON payload"}') }
  const list = Array.isArray(data && data.incidents) ? data.incidents : null
  if (!list) { res.writeHead(400); return res.end('{"error":"incidents manquant"}') }
  if (list.length > 50) { res.writeHead(400); return res.end('{"error":"50 incidents maximum par lot"}') }

  const accepted = []
  const rejected = []
  for (const inc of list) {
    if (!inc || !UUID_RX.test(inc.clientId || '')) { rejected.push({ clientId: inc && inc.clientId || null, raison: 'clientId invalide' }); continue }
    if (!inc.ts || isNaN(Date.parse(inc.ts))) { rejected.push({ clientId: inc.clientId, raison: 'ts invalide' }); continue }
    accepted.push(inc.clientId)
    if (seenIncidents.has(inc.clientId)) continue
    seenIncidents.add(inc.clientId)
    const c = COLORS[inc.niveau] || ''
    console.log(`${c}[incident] ${inc.ts} ${String(inc.niveau).padEnd(8)} ${inc.type}${inc.occurrences > 1 ? ' ×' + inc.occurrences : ''} — ${inc.message}\x1b[0m`)
  }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ success: true, accepted, rejected, serverTime: new Date().toISOString() }))
}

// ─── Serveur ─────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  let body = ''
  req.on('data', c => { body += c })
  req.on('end', () => {
    const p = decodeURIComponent(url.pathname)

    if (req.method === 'POST' && /^\/see\/API\/heartbeat\/[^/]+\/incidents$/.test(p)) return handleIncidents(body, res)

    if (req.method === 'POST' && /^\/see\/API\/heartbeat\/[^/]+$/.test(p)) {
      try {
        const d = JSON.parse(body)
        const wd = d.debug && d.debug.watchdog
        console.log(`[heartbeat] v${d.version} uptime=${d.uptime}s média=${d.debug && d.debug.currentMedia}` +
          (wd ? ` watchdog: reloads=${wd.reloads} relaunches=${wd.relaunches} modeSûr=${wd.safeMode} niveau=${wd.niveauBoucle} incidentsEnAttente=${wd.incidentsEnAttente}` : ''))
      } catch (e) { /* ignore */ }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: true, serverTime: new Date().toISOString() }))
    }

    if (/^\/see\/API\/diapo\//.test(p)) {
      if (API_MODE === 'down') { res.writeHead(503); return res.end() }
      if (API_MODE === 'hang') return
      const send = () => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'active', ecranId: 1, refreshInterval: 60, masquerPageDefault: false, timeline: timeline(), diapos: [] }))
      }
      return API_MODE === 'slow' ? setTimeout(send, 20000) : send()
    }

    const mediaMatch = p.match(/^\/uploads\/see\/media\/(.+)$/)
    if (mediaMatch) return serveMedia(req, res, mediaMatch[1])

    if (/^\/see\/API\/(planning|stats)\//.test(p)) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end('{}')
    }

    res.writeHead(404)
    res.end('Not Found')
  })
})

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Fake SOEK sur http://localhost:${PORT} — ${media.size} médias, pannes=${FAULTS.join(',')}${FAULTS.includes('random') ? ' (taux ' + RATE + ')' : ''}, api=${API_MODE}, incidents=${INCIDENTS_MODE}`)
  })
}

module.exports = { server, makePng }
