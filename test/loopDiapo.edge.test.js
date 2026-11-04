/**
 * js/loopDiapo.js — cas limites de la boucle d'affichage, exécutée hors
 * navigateur (vm + horloge simulée + faux DOM). Chaque panne doit être
 * franchie sans bloquer l'écran, et remonter l'incident attendu.
 */
const assert = require('assert')
const { loadLoop, chainViolations } = require('./helpers/loadLoop')

const IMG = (f, d = 5) => ['img', f, d, { mediaId: f }]
const VID = (f, d = 5) => ['video', f, d, { mediaId: f }]
const TPL = (type, d = 5) => ['template', { type }, d, {}]

describe('loopDiapo — cas limites', function () {
  this.timeout(20000)

  const shown = (h) => h.calls.map(c => c.index)

  describe('vidéo', () => {
    it('jamais prête (pas de canplaythrough) : passe au suivant après 10s', async () => {
      const h = loadLoop({ media: [VID('v.mp4'), IMG('a.jpg')] })
      h.dom.videoScenario['v.mp4'] = 'noCanPlay'
      h.start()
      await h.clock.tick(9500)
      assert.deepStrictEqual(shown(h), [0])
      await h.clock.tick(1000)
      assert.deepStrictEqual(shown(h), [0, 1])
      const inc = h.incidentsOf('VIDEO_SAUTEE')
      assert.strictEqual(inc.length, 1)
      assert.strictEqual(inc[0].contexte.code, 'LOAD_TIMEOUT')
      assert.strictEqual(inc[0].contexte.fichier, 'v.mp4')
    })

    it('DECODE persistant : un seul re-téléchargement, puis saut', async () => {
      const h = loadLoop({ media: [VID('v.mp4'), IMG('a.jpg')] })
      h.dom.videoScenario['v.mp4'] = 'decode'
      h.start()
      await h.clock.tick(3000)
      assert.strictEqual(h.counters.saveBinary, 1)
      assert.deepStrictEqual(shown(h), [0, 1])
      assert.strictEqual(h.incidentsOf('VIDEO_SAUTEE')[0].contexte.code, 'DECODE')
    })

    it('DECODE au cycle suivant (< 30 min) : pas de nouveau re-téléchargement', async () => {
      const h = loadLoop({ media: [VID('v.mp4'), IMG('a.jpg')] })
      h.dom.videoScenario['v.mp4'] = 'decode'
      h.start()
      await h.clock.tick(5 * 60 * 1000)
      assert.ok(h.calls.filter(c => c.index === 0).length >= 5, 'plusieurs cycles')
      assert.strictEqual(h.counters.saveBinary, 1)
    })

    it('DECODE une fois puis OK après re-téléchargement : la vidéo est lue jusqu\'au bout', async () => {
      const h = loadLoop({ media: [VID('v.mp4'), IMG('a.jpg')] })
      h.dom.videoScenario['v.mp4'] = 'decodeOnce'
      h.start()
      await h.clock.tick(6000)
      assert.strictEqual(h.dom.stats.videoEnded, 1)
      assert.strictEqual(h.incidentsOf('VIDEO_SAUTEE').length, 0)
      assert.strictEqual(h.run('window._videoHealth.redownloadCount'), 1)
    })

    it('DECODE en pleine lecture : le retry redémarre la vidéo (canplaythrough réécouté)', async () => {
      const h = loadLoop({ media: [VID('v.mp4'), IMG('a.jpg')] })
      h.dom.videoScenario['v.mp4'] = 'decodeMidPlay'
      h.start()
      await h.clock.tick(8000)
      assert.strictEqual(h.dom.stats.videoEnded, 1)
      assert.strictEqual(h.incidentsOf('VIDEO_SAUTEE').length, 0)
      assert.deepStrictEqual(shown(h).slice(0, 2), [0, 1])
    })

    it('erreur ABORTED puis silence : le timeout de chargement joue quand même', async () => {
      const h = loadLoop({ media: [VID('v.mp4'), IMG('a.jpg')] })
      h.dom.videoScenario['v.mp4'] = 'abortedThenSilent'
      h.start()
      await h.clock.tick(11000)
      assert.deepStrictEqual(shown(h), [0, 1])
    })

    it('lecture figée en cours : VIDEO_FIGEE et saut en ~10s', async () => {
      const h = loadLoop({ media: [VID('v.mp4', 30), IMG('a.jpg')] })
      h.dom.videoScenario['v.mp4'] = 'stall'
      h.dom.videoDuration['v.mp4'] = 30
      h.start()
      await h.clock.tick(10000)
      assert.deepStrictEqual(shown(h), [0])
      await h.clock.tick(5000)
      assert.deepStrictEqual(shown(h), [0, 1])
      const inc = h.incidentsOf('VIDEO_FIGEE')
      assert.strictEqual(inc.length, 1)
      assert.strictEqual(inc[0].contexte.position, 1)
    })

    it('play() refusé : VIDEO_SAUTEE PLAY_FAILED et suivant', async () => {
      const h = loadLoop({ media: [VID('v.mp4'), IMG('a.jpg')] })
      h.dom.videoScenario['v.mp4'] = 'playReject'
      h.start()
      await h.clock.tick(2000)
      assert.deepStrictEqual(shown(h), [0, 1])
      assert.strictEqual(h.incidentsOf('VIDEO_SAUTEE')[0].contexte.code, 'PLAY_FAILED')
    })

    it('vidéo longue (5 min) bien plus longue que sa durée déclarée : pas de watchdog', async () => {
      const h = loadLoop({ media: [VID('long.mp4', 5), IMG('a.jpg')] })
      h.dom.videoDuration['long.mp4'] = 300
      h.start()
      await h.clock.tick(299000)
      assert.deepStrictEqual(shown(h), [0])
      assert.strictEqual(h.incidentsOf('BOUCLE_BLOQUEE').length, 0)
      await h.clock.tick(3000)
      assert.deepStrictEqual(shown(h), [0, 1])
    })

    it('enchaînement vidéo → vidéo : les écouteurs de l\'ancien lecteur sont retirés', async () => {
      const h = loadLoop({ media: [VID('v1.mp4'), VID('v2.mp4'), VID('v3.mp4')] })
      h.start()
      await h.clock.tick(10 * 60 * 1000)
      assert.ok(h.dom.elements.video1.listenerCount() <= 6, 'video1: ' + h.dom.elements.video1.listenerCount())
      assert.ok(h.dom.elements.video2.listenerCount() <= 6, 'video2: ' + h.dom.elements.video2.listenerCount())
      assert.deepStrictEqual(chainViolations(h.calls, 3), [])
    })
  })

  describe('image', () => {
    it('erreur : un re-téléchargement, puis IMAGE_SAUTEE et suivant', async () => {
      const h = loadLoop({ media: [IMG('bad.jpg'), IMG('a.jpg')] })
      h.dom.imageScenario['bad.jpg'] = 'error'
      h.start()
      await h.clock.tick(2000)
      assert.deepStrictEqual(shown(h), [0, 1])
      assert.strictEqual(h.counters.saveBinary, 1)
      assert.strictEqual(h.incidentsOf('IMAGE_SAUTEE').length, 1)
    })

    it('jamais chargée : saut après 8s', async () => {
      const h = loadLoop({ media: [IMG('slow.jpg'), IMG('a.jpg')] })
      h.dom.imageScenario['slow.jpg'] = 'never'
      h.start()
      await h.clock.tick(7500)
      assert.deepStrictEqual(shown(h), [0])
      await h.clock.tick(1000)
      assert.deepStrictEqual(shown(h), [0, 1])
      assert.strictEqual(h.incidentsOf('IMAGE_SAUTEE')[0].contexte.code, 'LOAD_TIMEOUT')
    })

    it('respecte la durée : une image de 7s reste 7s', async () => {
      const h = loadLoop({ media: [IMG('a.jpg', 7), IMG('b.jpg', 7)] })
      h.start()
      await h.clock.tick(7000)
      assert.deepStrictEqual(shown(h), [0])
      await h.clock.tick(100)
      assert.deepStrictEqual(shown(h), [0, 1])
    })
  })

  describe('template et planning', () => {
    it('template qui ne se termine jamais : TEMPLATE_TIMEOUT après durée + 20s', async () => {
      const h = loadLoop({ media: [TPL('trafic', 10), IMG('a.jpg')] })
      h.templateRenderer.scenario = 'hang'
      h.start()
      await h.clock.tick(29000)
      assert.deepStrictEqual(shown(h), [0])
      await h.clock.tick(2000)
      assert.deepStrictEqual(shown(h), [0, 1])
      assert.strictEqual(h.incidentsOf('TEMPLATE_TIMEOUT')[0].contexte.typeTemplate, 'trafic')
      assert.ok(h.counters.templateHide >= 1)
    })

    it('template qui lève une exception synchrone : suivant immédiatement', async () => {
      const h = loadLoop({ media: [TPL('menu'), IMG('a.jpg')] })
      h.templateRenderer.scenario = 'throw'
      h.start()
      await h.clock.tick(100)
      assert.deepStrictEqual(shown(h), [0, 1])
    })

    it('template rejeté : suivant', async () => {
      const h = loadLoop({ media: [TPL('menu'), IMG('a.jpg')] })
      h.templateRenderer.scenario = 'reject'
      h.start()
      await h.clock.tick(100)
      assert.deepStrictEqual(shown(h), [0, 1])
    })

    it('planning qui lève une exception : suivant après 2s', async () => {
      const h = loadLoop({ media: [['planning', { type: 'planning' }, 20, 'p'], IMG('a.jpg')] })
      h.planningManager.throwOnShow = true
      h.start()
      await h.clock.tick(2100)
      assert.deepStrictEqual(shown(h), [0, 1])
    })
  })

  describe('liste de médias', () => {
    it('type inconnu, entrées null et mal formées : ignorées sans bloquer', async () => {
      const h = loadLoop({ media: [null, ['gif'], ['pdf', 'x.pdf', 5], 'chaine', IMG('a.jpg')] })
      h.start()
      await h.clock.tick(3000)
      assert.deepStrictEqual(shown(h), [0, 1, 2, 3, 4])
      assert.strictEqual(h.dom.visible()[0], 'divImg1')
    })

    it('liste vide : écran par défaut, aucune boucle', async () => {
      const h = loadLoop({ media: [] })
      h.start()
      await h.clock.tick(60000)
      assert.strictEqual(h.counters.defaultScreen, 1)
      assert.deepStrictEqual(shown(h), [])
    })

    it('tous les médias en échec : backoff 10s → 30s → 60s et TOUS_MEDIAS_EN_ECHEC', async () => {
      const h = loadLoop({ media: [IMG('x.jpg'), IMG('y.jpg')] })
      h.dom.imageScenario['x.jpg'] = 'error'
      h.dom.imageScenario['y.jpg'] = 'error'
      h.start()
      await h.clock.tick(10 * 60 * 1000)
      const fails = h.incidentsOf('TOUS_MEDIAS_EN_ECHEC')
      assert.ok(fails.length >= 3 && fails.length <= 12, 'cycles en échec: ' + fails.length)
      assert.deepStrictEqual(fails.slice(0, 3).map(f => f.contexte.backoffS), [10, 30, 60])
      assert.strictEqual(fails[0].niveau, 'critique')
      const restarts = h.calls.filter(c => c.index === 0).map(c => c.t)
      for (let i = 2; i < restarts.length; i++) assert.ok(restarts[i] - restarts[i - 1] >= 30000, 'cycle trop rapproché')
      assert.strictEqual(h.dom.elements.pageDefault.style.display, 'flex')
    })

    it('un média revient : le backoff est remis à zéro', async () => {
      const h = loadLoop({ media: [IMG('x.jpg'), IMG('y.jpg')] })
      h.dom.imageScenario['x.jpg'] = 'error'
      h.dom.imageScenario['y.jpg'] = 'error'
      h.start()
      await h.clock.tick(3 * 60 * 1000)
      h.dom.imageScenario['y.jpg'] = 'ok'
      await h.clock.tick(3 * 60 * 1000)
      const before = h.incidentsOf('TOUS_MEDIAS_EN_ECHEC').length
      await h.clock.tick(5 * 60 * 1000)
      assert.strictEqual(h.incidentsOf('TOUS_MEDIAS_EN_ECHEC').length, before)
      assert.strictEqual(h.run('failedCycles'), 0)
    })

    it('applyDiapoUpdate : liste identique → pas de relance ; liste vide → arrêt sur pageDefault', async () => {
      const list = [IMG('a.jpg'), IMG('b.jpg')]
      const h = loadLoop({ media: list })
      assert.strictEqual(await h.ctx.applyDiapoUpdate(list), true)
      await h.clock.tick(3000)
      const gen = h.run('loopGeneration')
      assert.strictEqual(await h.ctx.applyDiapoUpdate(JSON.parse(JSON.stringify(list))), false)
      assert.strictEqual(h.run('loopGeneration'), gen)
      assert.strictEqual(await h.ctx.applyDiapoUpdate([]), false)
      assert.strictEqual(h.dom.elements.pageDefault.style.display, 'flex')
      const n = h.calls.length
      await h.clock.tick(60000)
      assert.strictEqual(h.calls.length, n, 'plus aucune diapo après une liste vide')
    })
  })

  describe('concurrence', () => {
    it('LoopDiapo() appelé 20 fois pendant des chargements : une seule chaîne', async () => {
      const h = loadLoop({ media: [IMG('a.jpg'), VID('v.mp4'), TPL('menu', 4), IMG('b.jpg')] })
      h.start()
      for (let i = 0; i < 20; i++) {
        await h.clock.tick(1300 + (i * 977) % 4000)
        h.ctx.LoopDiapo()
      }
      await h.clock.tick(5 * 60 * 1000)
      assert.deepStrictEqual(chainViolations(h.calls, 4), [])
    })

    it('LoopDiapo() pendant le chargement d\'une image : l\'ancienne chaîne est abandonnée', async () => {
      const h = loadLoop({ media: [IMG('lent.jpg'), IMG('b.jpg'), IMG('c.jpg')] })
      h.dom.imageDelay['lent.jpg'] = 3000
      h.start()
      await h.clock.tick(1000)
      h.ctx.LoopDiapo()            // l'image de la 1re génération charge encore
      await h.clock.tick(2 * 60 * 1000)
      assert.deepStrictEqual(chainViolations(h.calls, 3), [])
    })

    it('LoopDiapo() pendant le téléchargement d\'un média absent du cache : une seule chaîne', async () => {
      const h = loadLoop({ media: [IMG('neuf.jpg'), VID('neuve.mp4'), IMG('c.jpg')] })
      h.notCached.set('neuf.jpg', 20000)
      h.notCached.set('neuve.mp4', 20000)
      h.start()
      await h.clock.tick(5000)
      h.ctx.LoopDiapo()
      await h.clock.tick(5000)
      h.ctx.LoopDiapo()
      await h.clock.tick(3 * 60 * 1000)
      assert.deepStrictEqual(chainViolations(h.calls, 3), [])
    })

    it('template terminé après un LoopDiapo() : pas de seconde chaîne', async () => {
      const h = loadLoop({ media: [TPL('menu', 10), IMG('b.jpg')] })
      h.start()
      await h.clock.tick(4000)
      h.ctx.LoopDiapo()
      await h.clock.tick(2 * 60 * 1000)
      assert.deepStrictEqual(chainViolations(h.calls, 2), [])
    })

    it('stopLoopDiapo pendant une vidéo : plus aucun showMedia', async () => {
      const h = loadLoop({ media: [VID('v.mp4'), IMG('a.jpg')] })
      h.start()
      await h.clock.tick(1000)
      h.ctx.stopLoopDiapo()
      const n = h.calls.length
      await h.clock.tick(5 * 60 * 1000)
      assert.strictEqual(h.calls.length, n)
      assert.strictEqual(h.incidentsOf('BOUCLE_BLOQUEE').length, 0)
    })

    it('boucle arrêtée hors veille plus de 15 min avec des diapos : relancée (réveil raté)', async () => {
      const h = loadLoop({ media: [IMG('a.jpg'), IMG('b.jpg')] })
      h.start()
      await h.clock.tick(3000)
      h.ctx.stopLoopDiapo()
      await h.clock.tick(17 * 60 * 1000)
      const inc = h.incidentsOf('BOUCLE_BLOQUEE')
      assert.strictEqual(inc.length, 1)
      assert.strictEqual(inc[0].contexte.niveau, 'arret')
      assert.ok(h.calls[h.calls.length - 1].t > h.clock.now() - 2 * 60 * 1000, 'la boucle tourne de nouveau')
    })

    it('boucle arrêtée en veille : jamais relancée par le watchdog', async () => {
      const h = loadLoop({ media: [IMG('a.jpg')] })
      h.start()
      await h.clock.tick(3000)
      h.ctx.screenStatus = 'sleep'
      h.ctx.stopLoopDiapo()
      const n = h.calls.length
      await h.clock.tick(8 * 60 * 60 * 1000)
      assert.strictEqual(h.calls.length, n)
    })
  })

  describe('mode sûr et signe de vie', () => {
    it('ping toutes les 10s avec l\'état de la boucle', async () => {
      const h = loadLoop({ media: [IMG('a.jpg')] })
      h.start()
      await h.clock.tick(60000)
      assert.ok(h.pings.length >= 6)
      const last = h.pings[h.pings.length - 1]
      assert.strictEqual(last.loopActive, true)
      assert.strictEqual(last.screenStatus, 'active')
      assert.ok(last.secondsSinceLastMedia <= 15)
    })

    it('mode sûr : boucle arrêtée sur pageDefault, LoopDiapo refusé, reprise à la sortie', async () => {
      const h = loadLoop({ media: [IMG('a.jpg'), IMG('b.jpg')] })
      h.start()
      await h.clock.tick(12000)
      h.setSafeMode(true)
      const n = h.calls.length
      h.ctx.LoopDiapo()
      await h.clock.tick(10 * 60 * 1000)
      assert.strictEqual(h.calls.length, n)
      assert.strictEqual(h.dom.elements.pageDefault.style.display, 'flex')
      assert.strictEqual(h.pings[h.pings.length - 1].loopActive, false)
      assert.strictEqual(h.incidentsOf('BOUCLE_BLOQUEE').length, 0, 'pas d\'escalade en mode sûr')
      h.setSafeMode(false)
      await h.clock.tick(6000)
      assert.ok(h.calls.length > n)
    })
  })
})
