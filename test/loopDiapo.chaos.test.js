/**
 * Test chaos : 24h simulées de la boucle d'affichage avec pannes aléatoires
 * (graine fixe → reproductible). Vidéos et images qui échouent, figent ou ne
 * chargent jamais, templates pendus, LoopDiapo() concurrents, listes qui
 * changent, chaînes de timers perdues, veilles, phases où tout échoue.
 *
 * Invariants vérifiés :
 *   (a) une seule chaîne active à tout moment
 *   (b) hors veille, jamais plus de 160s sans tentative d'affichage
 *       (tolérance du watchdog 90s + intervalle de contrôle 60s + marge)
 *   (c) nombre de timers en attente borné (pas de fuite)
 *   (d) aucune exception ni promesse rejetée non rattrapée
 *   (e) phase "tout échoue" : au moins 10s entre deux cycles
 *   (f) incidents dédoublonnés : volume raisonnable sur 24h
 */
const assert = require('assert')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { loadLoop, chainViolations } = require('./helpers/loadLoop')
const { IncidentLog } = require('../lib/IncidentLog')

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const VIDEO_SCENARIOS = ['ok', 'ok', 'ok', 'ok', 'noCanPlay', 'decode', 'decodeOnce', 'decodeMidPlay', 'stall', 'playReject', 'abortedThenSilent']
const IMAGE_SCENARIOS = ['ok', 'ok', 'ok', 'ok', 'error', 'never']
const TEMPLATE_SCENARIOS = ['ok', 'ok', 'ok', 'hang', 'reject', 'throw']

function runChaos(seed, hours) {
  const rnd = mulberry32(seed)
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const between = (a, b) => a + Math.floor(rnd() * (b - a))

  const videos = ['v1.mp4', 'v2.mp4', 'v3.mp4']
  const images = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']
  const variants = [
    [['img', 'a.jpg', 5], ['video', 'v1.mp4', 5], ['template', { type: 'menu' }, 8], ['img', 'b.jpg', 7], ['video', 'v2.mp4', 5]],
    [['video', 'v3.mp4', 5], ['img', 'c.jpg', 5], ['img', 'd.jpg', 10], ['template', { type: 'trafic' }, 10]],
    [['img', 'a.jpg', 6], ['img', 'b.jpg', 6], ['planning', { type: 'planning' }, 10, 'p'], ['video', 'v1.mp4', 5], ['video', 'v2.mp4', 5], ['img', 'c.jpg', 4]]
  ]

  return (async () => {
    const h = loadLoop({ media: variants[0] })
    images.forEach(f => { h.dom.imageScenario[f] = 'ok' })
    videos.forEach(f => { h.dom.videoDuration[f] = between(3, 20) })

    // Incidents → vrai IncidentLog (sans envoi) pour mesurer le dédoublonnage
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'see-chaos-'))
    const log = new IncidentLog({ filePath: path.join(dir, 'incidents.json'), axios: null, now: () => h.clock.now(), log: { info() {}, warn() {}, error() {} } })
    log.persistSync = () => {}
    const reportIncident = h.api.reportIncident
    h.api.reportIncident = (type, niveau, message, contexte) => {
      reportIncident(type, niveau, message, contexte)
      log.record(type, niveau, message, contexte, 'renderer')
    }

    const unhandled = []
    const onUnhandled = (e) => unhandled.push(e)
    process.on('unhandledRejection', onUnhandled)

    const end = h.clock.now() + hours * 3600 * 1000
    let sleepingUntil = 0
    let allFailUntil = 0
    let saved = null
    let currentList = variants[0]
    const sleepPeriods = []
    const allFailPeriods = []
    let maxPending = 0

    h.start()
    try {
      while (h.clock.now() < end) {
        await h.clock.tick(between(20, 120) * 1000)
        maxPending = Math.max(maxPending, h.clock.pending())
        const now = h.clock.now()

        if (sleepingUntil && now >= sleepingUntil) {
          sleepingUntil = 0
          h.ctx.screenStatus = 'active'
          h.ctx.LoopDiapo()
          sleepPeriods[sleepPeriods.length - 1].to = now
        }
        if (allFailUntil && now >= allFailUntil) {
          allFailUntil = 0
          Object.assign(h.dom.imageScenario, saved.images)
          Object.assign(h.dom.videoScenario, saved.videos)
          h.templateRenderer.scenario = saved.template
          allFailPeriods[allFailPeriods.length - 1].to = now
        }
        if (sleepingUntil || allFailUntil) continue

        const r = rnd()
        if (r < 0.25) {
          if (rnd() < 0.5) h.dom.videoScenario[pick(videos)] = pick(VIDEO_SCENARIOS)
          else h.dom.imageScenario[pick(images)] = pick(IMAGE_SCENARIOS)
          // Chargements lents et fichiers absents du cache (téléchargés avant affichage)
          h.dom.imageDelay[pick(images)] = between(10, 4000)
          if (rnd() < 0.2) h.notCached.set(pick(rnd() < 0.5 ? images : videos), between(1000, 30000))
        } else if (r < 0.33) {
          // Relance concurrente, à un instant quelconque (souvent en plein chargement)
          await h.clock.tick(between(0, 5000))
          h.ctx.LoopDiapo()
        } else if (r < 0.38) {
          currentList = pick(variants)
          h.setMedia(currentList)
          await h.ctx.applyDiapoUpdate(currentList)
        } else if (r < 0.41) {
          h.templateRenderer.scenario = pick(TEMPLATE_SCENARIOS)
        } else if (r < 0.44) {
          h.run('_abortAllVideoControllers(); if (loopTimeout) clearTimeout(loopTimeout); loopGeneration++;')
        } else if (r < 0.46) {
          sleepingUntil = now + between(10, 60) * 60 * 1000
          sleepPeriods.push({ from: now, to: sleepingUntil })
          h.ctx.screenStatus = 'sleep'
          h.ctx.stopLoopDiapo()
        } else if (r < 0.47) {
          allFailUntil = now + 10 * 60 * 1000
          allFailPeriods.push({ from: now, to: allFailUntil })
          saved = { images: Object.assign({}, h.dom.imageScenario), videos: Object.assign({}, h.dom.videoScenario), template: h.templateRenderer.scenario }
          images.forEach(f => { h.dom.imageScenario[f] = 'error' })
          videos.forEach(f => { h.dom.videoScenario[f] = 'decode' })
          h.templateRenderer.scenario = 'throw'
          // Le planning ne peut pas échouer dans ce harnais : liste sans planning
          currentList = variants[1]
          h.setMedia(currentList)
          await h.ctx.applyDiapoUpdate(currentList)
        }
      }
    } finally {
      process.removeListener('unhandledRejection', onUnhandled)
    }
    return { h, log, unhandled, sleepPeriods, allFailPeriods, maxPending, end }
  })()
}

describe('loopDiapo — chaos 24h simulées', function () {
  this.timeout(120000)

  for (const seed of [1, 42, 2026]) {
    it('graine ' + seed + ' : invariants respectés', async () => {
      const { h, log, unhandled, sleepPeriods, allFailPeriods, maxPending } = await runChaos(seed, 24)
      const inSleep = (t) => sleepPeriods.some(p => t >= p.from && t <= p.to + 1000)

      // (a) une seule chaîne active
      const violations = chainViolations(h.calls, 4)
      assert.deepStrictEqual(violations.slice(0, 3), [], violations.length + ' violation(s)')

      // (b) jamais plus de 160s sans tentative d'affichage hors veille
      let maxGap = 0
      let worst = null
      for (let i = 1; i < h.calls.length; i++) {
        const a = h.calls[i - 1].t
        const b = h.calls[i].t
        if (inSleep(a) || inSleep(b) || sleepPeriods.some(p => p.from >= a && p.from <= b)) continue
        if (b - a > maxGap) { maxGap = b - a; worst = { a, b } }
      }
      assert.ok(maxGap <= 160000, 'trou de ' + Math.round(maxGap / 1000) + 's à t=' + (worst && new Date(worst.a).toISOString()))

      // (c) pas de fuite de timers
      assert.ok(maxPending <= 40, 'timers en attente : ' + maxPending)

      // (d) aucune promesse rejetée non rattrapée
      assert.deepStrictEqual(unhandled.map(String), [])

      // (e) phase "tout échoue" : cycles espacés d'au moins 10s
      for (const p of allFailPeriods) {
        const starts = h.calls.filter(c => c.index === 0 && c.t > p.from + 60000 && c.t < p.to).map(c => c.t)
        for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 10000, 'cycles trop rapprochés en phase d\'échec')
      }

      // (f) incidents dédoublonnés : volume raisonnable (la file est envoyée chaque minute en prod)
      const created = log.pending() + log.stats().dropped
      assert.ok(created / 24 < 60, created + ' incidents distincts en 24h')

      // La boucle a vraiment tourné
      assert.ok(h.calls.length > 2000, 'seulement ' + h.calls.length + ' affichages')
    })
  }
})
