/**
 * Escalade du watchdog de boucle (js/loopDiapo.js) :
 *   niveau 1 → LoopDiapo(), niveau 2 → remise à zéro de l'état, niveau 3 →
 *   restart demandé au watchdog main. Remise à zéro dès qu'un média s'affiche.
 */
const assert = require('assert')
const { loadLoop } = require('./helpers/loadLoop')

const IMG = (f, d = 5) => ['img', f, d, { mediaId: f }]

/** Casse la chaîne de timers sans rien nettoyer (exception avalée, promesse perdue). */
function breakChain(h) {
  h.run('_abortAllVideoControllers(); if (loopTimeout) clearTimeout(loopTimeout); loopGeneration++;')
}

/** Rend la boucle définitivement inopérante : showMedia ne fait plus rien. */
function deadLoop(h) {
  const real = h.ctx.showMedia
  h.ctx.showMedia = function () { h.calls.push({ gen: -1, index: arguments[0], t: h.clock.now(), dead: true }) }
  return () => { h.ctx.showMedia = real }
}

describe('watchdog de boucle — escalade', function () {
  this.timeout(20000)
  const levels = (h) => h.incidentsOf('BOUCLE_BLOQUEE').map(i => i.contexte.niveau)

  it('chaîne cassée une fois : niveau 1 relance la boucle, puis retour à 0', async () => {
    const h = loadLoop({ media: [IMG('a.jpg'), IMG('b.jpg')] })
    h.start()
    await h.clock.tick(12000)
    breakChain(h)
    const t0 = h.clock.now()
    await h.clock.tick(3 * 60 * 1000)
    assert.deepStrictEqual(levels(h), [1])
    assert.strictEqual(h.incidentsOf('BOUCLE_BLOQUEE')[0].niveau, 'warn')
    const restarted = h.calls.find(c => c.t > t0)
    assert.ok(restarted && restarted.t - t0 <= 150000, 'relance en moins de 150s')
    await h.clock.tick(5 * 60 * 1000)
    assert.strictEqual(h.ctx._loopWatchdogLevel, 0)
    assert.deepStrictEqual(levels(h), [1])
  })

  it('boucle définitivement morte : niveaux 1 → 2 → 3, un restart demandé', async () => {
    const h = loadLoop({ media: [IMG('a.jpg'), IMG('b.jpg')] })
    h.start()
    await h.clock.tick(12000)
    deadLoop(h)
    breakChain(h)
    await h.clock.tick(8 * 60 * 1000)
    assert.deepStrictEqual(levels(h).slice(0, 3), [1, 2, 3])
    assert.deepStrictEqual(h.incidentsOf('BOUCLE_BLOQUEE').slice(0, 3).map(i => i.niveau), ['warn', 'critique', 'critique'])
    assert.ok(h.counters.restartRequests >= 1)
    assert.ok(h.counters.requestJsonDiapo >= 1, 'niveau 2 recharge la liste')
  })

  it('niveau 2 : lecteurs vidés, overlays cachés, verrous abandonnés libérés (pas les récents)', async () => {
    const h = loadLoop({ media: [IMG('a.jpg')] })
    h.start()
    await h.clock.tick(6000)
    const now = h.clock.now()
    Object.assign(h.ctx, {
      _diapoRequestInFlight: true, _diapoRequestInFlightAt: now - 10 * 60 * 1000,
      _mediaSyncInProgress: true, _mediaSyncInProgressAt: now - 60 * 1000,
      _downloadAllInFlight: Promise.resolve(), _downloadAllInFlightAt: now - 20 * 60 * 1000
    })
    h.dom.elements.video1.src = 'see-media://media/x.mp4'
    const freed = h.ctx._forceSafeState('test')
    assert.deepStrictEqual(JSON.parse(JSON.stringify(freed)), ['requestJsonDiapo', 'downloadAllMedia'])
    assert.strictEqual(h.ctx._diapoRequestInFlight, false)
    assert.strictEqual(h.ctx._mediaSyncInProgress, true)
    assert.strictEqual(h.dom.elements.video1.src, '')
    assert.ok(h.counters.templateHide >= 1)
    assert.strictEqual(h.dom.elements.pageDefault.style.display, 'flex')
    await h.clock.tick(6000)
    assert.ok(h.calls.length > 2, 'la boucle repart après la remise à zéro')
  })

  it('niveau 2 avec requestJsonDiapo pendu : relance quand même après 30s', async () => {
    const h = loadLoop({ media: [IMG('a.jpg')] })
    h.ctx.requestJsonDiapo = () => new Promise(() => {})
    h.start()
    await h.clock.tick(3000)
    h.ctx._forceSafeState('test')
    const n = h.calls.length
    await h.clock.tick(29000)
    assert.strictEqual(h.calls.length, n)
    await h.clock.tick(2000)
    assert.ok(h.calls.length > n)
  })

  it('niveau 2 qui tombe pendant la veille : ne relance pas la boucle', async () => {
    const h = loadLoop({ media: [IMG('a.jpg')] })
    h.ctx.requestJsonDiapo = async () => { h.ctx.screenStatus = 'sleep' }
    h.start()
    await h.clock.tick(3000)
    h.ctx._forceSafeState('test')
    const n = h.calls.length
    await h.clock.tick(5 * 60 * 1000)
    assert.strictEqual(h.calls.length, n)
  })

  it('reprise réelle entre deux niveaux : l\'escalade repart de zéro', async () => {
    const h = loadLoop({ media: [IMG('a.jpg'), IMG('b.jpg')] })
    h.start()
    await h.clock.tick(12000)
    breakChain(h)
    await h.clock.tick(3 * 60 * 1000)   // niveau 1, la boucle repart
    breakChain(h)
    await h.clock.tick(3 * 60 * 1000)   // de nouveau cassée : niveau 1 encore, pas 2
    assert.deepStrictEqual(levels(h), [1, 1])
    assert.strictEqual(h.counters.restartRequests, 0)
  })

  it('aucune escalade en veille, en DEBUG_MODE ou avec pauseLoop', async () => {
    for (const setup of [
      (h) => { h.ctx.screenStatus = 'sleep' },
      (h) => { h.ctx.DEBUG_MODE = true },
      (h) => { h.run('pauseLoop = true') }
    ]) {
      const h = loadLoop({ media: [IMG('a.jpg')] })
      h.start()
      await h.clock.tick(6000)
      deadLoop(h)
      breakChain(h)
      setup(h)
      await h.clock.tick(30 * 60 * 1000)
      assert.deepStrictEqual(levels(h), [])
      assert.strictEqual(h.counters.restartRequests, 0)
    }
  })

  it('sans api.watchdogRequestRestart (ancien preload) : repli sur restartApp', async () => {
    const h = loadLoop({ media: [IMG('a.jpg')] })
    let restarted = 0
    delete h.api.watchdogRequestRestart
    h.api.restartApp = () => { restarted++ }
    h.start()
    await h.clock.tick(6000)
    deadLoop(h)
    breakChain(h)
    await h.clock.tick(8 * 60 * 1000)
    assert.ok(restarted >= 1)
  })

  it('le ping signale le niveau d\'escalade et l\'inactivité au watchdog main', async () => {
    const h = loadLoop({ media: [IMG('a.jpg')] })
    h.start()
    await h.clock.tick(6000)
    deadLoop(h)
    breakChain(h)
    await h.clock.tick(130000)
    const last = h.pings[h.pings.length - 1]
    assert.strictEqual(last.watchdogLevel, 1)
    assert.ok(h.pings.some(p => p.secondsSinceLastMedia >= 90))
  })
})
