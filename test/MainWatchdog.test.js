/**
 * lib/MainWatchdog.js — surveillance du renderer depuis le process main.
 * Horloge simulée : chaque scénario couvre plusieurs minutes en quelques ms.
 */
const assert = require('assert')
const { MainWatchdog, relaunchOptions } = require('../lib/MainWatchdog')
const { FakeClock } = require('./helpers/fakeClock')

function setup({ state = null, mem = 300, options = {}, paused = false } = {}) {
  const clock = new FakeClock()
  const actions = []
  const incidents = []
  let stored = state
  let memMB = mem
  let isPaused = paused
  const wd = new MainWatchdog({
    now: () => clock.now(),
    timers: clock,
    log: { info() {}, warn() {}, error() {} },
    getRendererMemoryMB: () => memMB,
    isPaused: () => isPaused,
    stateStore: { read: () => stored && JSON.parse(JSON.stringify(stored)), write: (o) => { stored = JSON.parse(JSON.stringify(o)) } },
    incidentLog: {
      record: (type, niveau, message, contexte) => incidents.push({ type, niveau, message, contexte, t: clock.now() }),
      persistSync: () => actions.push('persist')
    },
    actions: {
      reload: () => actions.push('reload'),
      relaunch: () => actions.push('relaunch'),
      forceCrash: () => actions.push('forceCrash'),
      setSafeMode: (on) => actions.push('safeMode:' + on)
    },
    options
  })
  const ping = (p = {}) => wd.onPing(Object.assign({ secondsSinceLastMedia: 3, screenStatus: 'active', loopActive: true }, p))
  /** Simule un renderer sain qui pinge toutes les 10s pendant `ms`. */
  const healthy = async (ms) => { for (let t = 0; t < ms; t += 10000) { ping(); await clock.tick(10000) } }
  return {
    wd, clock, actions, incidents, ping, healthy,
    state: () => stored,
    setMem: (v) => { memMB = v },
    setPaused: (v) => { isPaused = v },
    types: () => incidents.map(i => i.type)
  }
}

describe('MainWatchdog (lib/MainWatchdog.js)', () => {
  it('démarrage : journalise DEMARRAGE et marque l\'app comme en cours', () => {
    const s = setup()
    s.wd.start('2.11.0')
    assert.deepStrictEqual(s.types(), ['DEMARRAGE'])
    assert.strictEqual(s.incidents[0].contexte.arretPrecedent, 'premier démarrage')
    assert.strictEqual(s.state().running, true)
  })

  it('arrêt précédent inattendu (coupure, crash du main) : DEMARRAGE en warn', () => {
    const s = setup({ state: { running: true, relaunches: [] } })
    s.wd.start('2.11.0')
    assert.strictEqual(s.incidents[0].niveau, 'warn')
    assert.strictEqual(s.incidents[0].contexte.arretPrecedent, 'arret_inattendu')
  })

  it('arrêt précédent propre : cause reprise dans DEMARRAGE', () => {
    const s = setup({ state: { running: false, lastExit: { cause: 'quit' }, relaunches: [] } })
    s.wd.start('2.11.0')
    assert.strictEqual(s.incidents[0].contexte.arretPrecedent, 'quit')
  })

  it('renderer sain : aucune action sur 1h', async () => {
    const s = setup()
    s.wd.start('x')
    await s.healthy(60 * 60 * 1000)
    assert.deepStrictEqual(s.actions, [])
    assert.deepStrictEqual(s.types(), ['DEMARRAGE'])
  })

  it('délai de grâce au démarrage : pas d\'action avant 90s sans ping', async () => {
    const s = setup()
    s.wd.start('x')
    await s.clock.tick(85000)
    assert.deepStrictEqual(s.actions, [])
    await s.clock.tick(10000)
    assert.deepStrictEqual(s.actions, ['reload'])
    assert.ok(s.types().includes('RENDERER_FIGE'))
  })

  it('plus de ping (JS figé) : reload, puis relaunch si toujours figé après 60s', async () => {
    const s = setup()
    s.wd.start('x')
    await s.healthy(120000)
    await s.clock.tick(50000)   // 45s de silence
    assert.deepStrictEqual(s.actions, ['reload'])
    assert.deepStrictEqual(s.types().slice(-2), ['RENDERER_FIGE', 'PAGE_RECHARGEE'])
    await s.clock.tick(70000)   // toujours rien après le reload
    assert.deepStrictEqual(s.actions, ['reload', 'persist', 'relaunch'])
    assert.ok(s.types().includes('APP_RELANCEE'))
    assert.strictEqual(s.state().running, false)
    assert.match(s.state().lastExit.cause, /watchdog/)
  })

  it('le reload a suffi (pings revenus) : pas de relaunch', async () => {
    const s = setup()
    s.wd.start('x')
    await s.healthy(120000)
    await s.clock.tick(50000)
    assert.deepStrictEqual(s.actions, ['reload'])
    await s.healthy(10 * 60 * 1000)
    assert.deepStrictEqual(s.actions, ['reload'])
  })

  it('incident journalisé AVANT l\'action', async () => {
    const s = setup()
    const order = []
    s.wd._incidents.record = (type) => order.push('incident:' + type)
    s.wd._actions.reload = () => order.push('reload')
    s.wd.start('x')
    await s.clock.tick(100000)
    assert.deepStrictEqual(order.slice(1), ['incident:RENDERER_FIGE', 'incident:PAGE_RECHARGEE', 'reload'])
  })

  it('unresponsive > 30s : crash forcé du renderer', async () => {
    const s = setup()
    s.wd.start('x')
    await s.healthy(100000)
    s.wd.onUnresponsive()
    await s.clock.tick(20000)
    assert.deepStrictEqual(s.actions, [])
    await s.clock.tick(15000)
    assert.deepStrictEqual(s.actions, ['forceCrash'])
    assert.ok(s.types().includes('RENDERER_NE_REPOND_PLUS'))
  })

  it('unresponsive puis responsive : aucune action', async () => {
    const s = setup()
    s.wd.start('x')
    await s.healthy(100000)
    s.wd.onUnresponsive()
    await s.clock.tick(15000)
    s.wd.onResponsive()
    await s.healthy(60000)
    assert.deepStrictEqual(s.actions, [])
  })

  it('crash du renderer : reload ; clean-exit ignoré', async () => {
    const s = setup()
    s.wd.start('x')
    s.wd.onRenderProcessGone({ reason: 'clean-exit', exitCode: 0 })
    assert.deepStrictEqual(s.actions, [])
    s.wd.onRenderProcessGone({ reason: 'oom', exitCode: -536870904 })
    assert.deepStrictEqual(s.actions, ['reload'])
    const crash = s.incidents.find(i => i.type === 'RENDERER_CRASH')
    assert.strictEqual(crash.contexte.reason, 'oom')
  })

  it('plus de 3 crashs en 10 min : relaunch', async () => {
    const s = setup()
    s.wd.start('x')
    for (let i = 0; i < 4; i++) { s.wd.onRenderProcessGone({ reason: 'crashed' }); await s.healthy(60000) }
    assert.deepStrictEqual(s.actions.filter(a => a !== 'persist'), ['reload', 'reload', 'reload', 'relaunch'])
  })

  it('crashs espacés de plus de 10 min : jamais de relaunch (fenêtre glissante)', async () => {
    const s = setup()
    s.wd.start('x')
    for (let i = 0; i < 6; i++) { s.wd.onRenderProcessGone({ reason: 'crashed' }); await s.healthy(4 * 60 * 1000) }
    assert.ok(!s.actions.includes('relaunch'))
  })

  it('crash + ping manquant simultanés : un seul reload (cooldown)', async () => {
    const s = setup()
    s.wd.start('x')
    await s.healthy(100000)
    await s.clock.tick(40000)
    s.wd.onRenderProcessGone({ reason: 'crashed' })
    await s.clock.tick(10000)
    assert.deepStrictEqual(s.actions, ['reload'])
  })

  it('did-fail-load : reload après 5s ; ERR_ABORTED et sous-frames ignorés', async () => {
    const s = setup()
    s.wd.start('x')
    s.wd.onDidFailLoad(-3, 'ERR_ABORTED', 'file://index.html', true)
    s.wd.onDidFailLoad(-105, 'NAME_NOT_RESOLVED', 'https://x', false)
    s.wd.onDidFailLoad(-6, 'FILE_NOT_FOUND', 'file://index.html', true)
    s.wd.onDidFailLoad(-6, 'FILE_NOT_FOUND', 'file://index.html', true)
    await s.clock.tick(4000)
    assert.deepStrictEqual(s.actions, [])
    await s.clock.tick(2000)
    assert.deepStrictEqual(s.actions, ['reload'])
    assert.strictEqual(s.incidents.filter(i => i.type === 'CHARGEMENT_ECHOUE').length, 2)
  })

  it('pings OK mais média figé > 5 min hors veille : reload, au plus une fois / 10 min', async () => {
    const s = setup()
    s.wd.start('x')
    for (let t = 0; t < 20 * 60; t += 10) { s.ping({ secondsSinceLastMedia: t }); await s.clock.tick(10000) }
    assert.deepStrictEqual(s.actions, ['reload', 'reload'])
    const reloads = s.incidents.filter(i => i.type === 'PAGE_RECHARGEE')
    assert.ok(reloads[1].t - reloads[0].t >= 10 * 60 * 1000)
    assert.ok(s.types().includes('BOUCLE_BLOQUEE'))
  })

  it('média figé mais en veille ou boucle inactive : rien', async () => {
    const s = setup()
    s.wd.start('x')
    for (let t = 0; t < 15 * 60; t += 10) {
      s.ping({ secondsSinceLastMedia: t, screenStatus: t < 450 ? 'sleep' : 'active', loopActive: t >= 450 ? false : true })
      await s.clock.tick(10000)
    }
    assert.deepStrictEqual(s.actions, [])
  })

  it('mémoire du renderer > 1,5 Go : reload', async () => {
    const s = setup()
    s.wd.start('x')
    await s.healthy(120000)
    s.setMem(1800)
    await s.healthy(70000)
    assert.deepStrictEqual(s.actions, ['reload'])
    assert.strictEqual(s.incidents.find(i => i.type === 'MEMOIRE_ELEVEE').contexte.memoireMo, 1800)
  })

  it('crash GPU : journalisé sans action', () => {
    const s = setup()
    s.wd.start('x')
    s.wd.onChildProcessGone({ type: 'GPU', reason: 'crashed', exitCode: 1 })
    s.wd.onChildProcessGone({ type: 'Utility', reason: 'crashed' })
    assert.deepStrictEqual(s.actions, [])
    assert.strictEqual(s.incidents.filter(i => i.type === 'GPU_CRASH').length, 1)
  })

  it('DevTools ouverts (pause) : aucun reload même sans ping', async () => {
    const s = setup({ paused: true })
    s.wd.start('x')
    s.wd.onUnresponsive()
    await s.clock.tick(10 * 60 * 1000)
    assert.deepStrictEqual(s.actions, [])
    s.setPaused(false)
    await s.clock.tick(40000)
    assert.deepStrictEqual(s.actions, [])
    await s.clock.tick(10000)
    assert.deepStrictEqual(s.actions, ['reload'])
  })

  describe('anti-boucle de relaunch et mode sûr', () => {
    it('4e relaunch en moins d\'1h : mode sûr + reload au lieu de relaunch', () => {
      const now = Date.UTC(2026, 10, 3, 10)
      const s = setup({ state: { running: false, relaunches: [now - 50 * 60000, now - 30 * 60000, now - 10 * 60000] } })
      s.wd.start('x')
      s.wd.relaunch('test')
      assert.deepStrictEqual(s.actions, ['safeMode:true', 'reload'])
      assert.ok(s.types().includes('MODE_SUR_ACTIVE'))
      assert.ok(s.state().safeModeSince)
    })

    it('le mode sûr est persisté et réappliqué au démarrage suivant et à chaque chargement de page', () => {
      const s1 = setup({ state: { running: false, relaunches: [], safeModeSince: Date.UTC(2026, 10, 3, 9, 50) } })
      s1.wd.start('x')
      assert.deepStrictEqual(s1.actions, ['safeMode:true'])
      s1.wd.onPageLoaded()
      assert.deepStrictEqual(s1.actions, ['safeMode:true', 'safeMode:true'])
      assert.strictEqual(s1.incidents[0].contexte.modeSur, true)
    })

    it('relaunches anciens (> 1h) : relaunch autorisé', () => {
      const now = Date.UTC(2026, 10, 3, 10)
      const s = setup({ state: { running: false, relaunches: [now - 3 * 3600000, now - 2 * 3600000, now - 90 * 60000] } })
      s.wd.start('x')
      s.wd.relaunch('test')
      assert.deepStrictEqual(s.actions, ['persist', 'relaunch'])
      assert.strictEqual(s.state().relaunches.length, 1)
    })

    it('sortie du mode sûr après 1h sans incident critique', async () => {
      const s = setup({ state: { running: false, relaunches: [], safeModeSince: Date.UTC(2026, 10, 3, 10) } })
      s.wd.start('x')
      await s.healthy(30 * 60000)
      assert.ok(s.wd.isSafeMode())
      await s.healthy(35 * 60000)
      assert.ok(!s.wd.isSafeMode())
      assert.ok(s.actions.includes('safeMode:false'))
      assert.ok(s.types().includes('MODE_SUR_DESACTIVE'))
    })

    it('un incident critique repousse la sortie du mode sûr', async () => {
      const s = setup({ state: { running: false, relaunches: [], safeModeSince: Date.UTC(2026, 10, 3, 10) } })
      s.wd.start('x')
      await s.healthy(50 * 60000)
      s.wd.onRenderProcessGone({ reason: 'crashed' })
      await s.healthy(30 * 60000)
      assert.ok(s.wd.isSafeMode())
      await s.healthy(35 * 60000)
      assert.ok(!s.wd.isSafeMode())
    })

    it('markCleanExit : l\'arrêt suivant n\'est pas compté comme inattendu', () => {
      const s = setup()
      s.wd.start('x')
      s.wd.markCleanExit('quit')
      const s2 = setup({ state: s.state() })
      s2.wd.start('x')
      assert.strictEqual(s2.incidents[0].contexte.arretPrecedent, 'quit')
    })
  })
})

describe('relaunchOptions', () => {
  const argv = ['/tmp/.mount_SEE-abc/seedisplay', '--no-sandbox']

  it('sous AppImage : relance le fichier AppImage, pas le montage temporaire', () => {
    const o = relaunchOptions({ APPIMAGE: '/home/see/SEE-Display-x86_64.AppImage' }, argv)
    assert.strictEqual(o.execPath, '/home/see/SEE-Display-x86_64.AppImage')
    assert.deepStrictEqual(o.args, ['--no-sandbox'])
  })

  it('hors AppImage : options par défaut d\'Electron', () => {
    assert.deepStrictEqual(relaunchOptions({}, argv), {})
  })
})
