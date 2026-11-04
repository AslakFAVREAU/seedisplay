/**
 * Watchdog du process main.
 *
 * Le watchdog de boucle du renderer (js/loopDiapo.js) ne peut rien si le JS du
 * renderer est figé ou si le process a crashé. Celui-ci surveille le renderer
 * depuis le main et escalade : reload de la page → relaunch de l'app → mode sûr.
 *
 * Logique pure (sans Electron) : horloge, timers, actions et persistance sont
 * injectés, ce qui la rend testable unitairement.
 *
 * Chaque action est journalisée dans l'IncidentLog AVANT d'être exécutée.
 */

const DEFAULTS = {
  tickMs: 5000,
  startupGraceMs: 90000,        // boot de la page (config, API) avant le 1er ping attendu
  reloadGraceMs: 60000,         // après un reload, délai avant de réévaluer les pings
  pingTimeoutMs: 45000,         // aucun ping depuis ce délai → renderer figé
  unresponsiveLimitMs: 30000,   // 'unresponsive' sans 'responsive' → crash forcé
  crashWindowMs: 10 * 60 * 1000,
  maxCrashesInWindow: 3,        // au-delà → relaunch
  didFailLoadReloadMs: 5000,
  stuckMediaLimitS: 300,        // pings OK mais aucun média depuis 5 min hors veille
  memoryLimitMB: 1500,
  memoryCheckMs: 60000,
  actionCooldownMs: 20000,      // pas deux reload rapprochés (crash + ping manquant)
  stuckCooldownMs: 10 * 60 * 1000,
  relaunchWindowMs: 60 * 60 * 1000,
  maxRelaunchesInWindow: 3,     // au-delà → mode sûr
  safeModeExitMs: 60 * 60 * 1000
}

class MainWatchdog {
  /**
   * @param {object} deps
   * @param {object} deps.actions - { reload(), relaunch(), forceCrash(), setSafeMode(bool) }
   * @param {object} deps.incidentLog - { record(type, niveau, message, contexte), persistSync() }
   * @param {object} deps.stateStore - { read(): object|null, write(obj) }
   * @param {function} [deps.getRendererMemoryMB]
   * @param {function} [deps.isPaused] - true → surveillance suspendue (ex: DevTools ouverts)
   * @param {function} [deps.now]
   * @param {object} [deps.timers]
   * @param {object} [deps.log]
   * @param {object} [deps.options]
   */
  constructor(deps) {
    this._actions = deps.actions
    this._incidents = deps.incidentLog
    this._store = deps.stateStore
    this._getMemMB = deps.getRendererMemoryMB || (() => 0)
    this._isPaused = deps.isPaused || (() => false)
    this._now = deps.now || (() => Date.now())
    this._timers = Object.assign({ setTimeout, clearTimeout, setInterval, clearInterval }, deps.timers || {})
    this._log = deps.log || console
    this._o = Object.assign({}, DEFAULTS, deps.options || {})

    const now = this._now()
    this._lastPingAt = null
    this._lastPing = null
    this._pageLoadedAt = now          // départ du délai de grâce
    this._graceMs = this._o.startupGraceMs
    this._noPingReloads = 0
    this._unresponsiveSince = null
    this._crashTimes = []
    this._lastActionAt = 0
    this._lastStuckActionAt = 0
    this._lastMemCheckAt = now
    this._lastCriticalAt = 0
    this._pendingFailReload = null
    this._interval = null
    this._counters = { reloads: 0, relaunches: 0, forcedCrashes: 0 }
    this._lastAction = null

    // État persisté : relaunch récents, mode sûr, détection d'arrêt inattendu
    const st = (this._store && this._store.read()) || {}
    this._persisted = {
      relaunches: Array.isArray(st.relaunches) ? st.relaunches : [],
      safeModeSince: st.safeModeSince || null,
      running: !!st.running,
      lastExit: st.lastExit || null
    }
  }

  // ─── Cycle de vie ──────────────────────────────────────────────────────────

  /**
   * Démarre la surveillance et journalise le démarrage (avec la cause de
   * l'arrêt précédent : relaunch du watchdog, quit, ou arrêt inattendu).
   */
  start(appVersion) {
    const prev = this._persisted
    let causePrecedente = 'premier démarrage'
    if (prev.lastExit && prev.lastExit.cause) causePrecedente = prev.lastExit.cause
    else if (prev.running) causePrecedente = 'arret_inattendu'   // crash du main, coupure de courant…

    this._incidents.record('DEMARRAGE',
      causePrecedente === 'arret_inattendu' ? 'warn' : 'info',
      'Démarrage v' + (appVersion || '?') + ' (arrêt précédent : ' + causePrecedente + ')',
      { version: appVersion, arretPrecedent: causePrecedente, modeSur: this.isSafeMode() })

    this._persisted.running = true
    this._persisted.lastExit = null
    this._save()

    if (this.isSafeMode()) this._actions.setSafeMode(true)
    this._interval = this._timers.setInterval(() => this.tick(), this._o.tickMs)
  }

  stop() {
    if (this._interval) this._timers.clearInterval(this._interval)
    if (this._pendingFailReload) this._timers.clearTimeout(this._pendingFailReload)
    this._interval = null
  }

  /** Arrêt volontaire de l'app (quit, mise à jour…) : pas un arrêt inattendu. */
  markCleanExit(cause) {
    this._persisted.running = false
    this._persisted.lastExit = { cause: cause || 'quit', ts: this._now() }
    this._save()
  }

  isSafeMode() { return !!this._persisted.safeModeSince }

  // ─── Signaux ───────────────────────────────────────────────────────────────

  /** Ping du renderer : { secondsSinceLastMedia, screenStatus, loopActive } */
  onPing(payload) {
    this._lastPingAt = this._now()
    this._lastPing = payload || {}
    this._noPingReloads = 0
  }

  /** Nouvelle page chargée (did-finish-load) : redémarre le délai de grâce. */
  onPageLoaded() {
    this._pageLoadedAt = this._now()
    this._lastPingAt = null
    if (this.isSafeMode()) this._actions.setSafeMode(true)
  }

  onUnresponsive() {
    if (!this._unresponsiveSince) this._unresponsiveSince = this._now()
  }

  onResponsive() {
    this._unresponsiveSince = null
  }

  /** webContents 'render-process-gone' : details = { reason, exitCode } */
  onRenderProcessGone(details = {}) {
    if (details.reason === 'clean-exit') return
    const now = this._now()
    this._crashTimes = this._crashTimes.filter(t => now - t < this._o.crashWindowMs)
    this._crashTimes.push(now)
    this._unresponsiveSince = null

    this._critical()
    this._incidents.record('RENDERER_CRASH', 'critique',
      'Process renderer arrêté (' + (details.reason || '?') + ', code ' + (details.exitCode ?? '?') + ')',
      { reason: details.reason, exitCode: details.exitCode, crashsFenetre: this._crashTimes.length })

    if (this._crashTimes.length > this._o.maxCrashesInWindow) {
      this._crashTimes = []
      this.relaunch('crashs répétés du renderer')
    } else {
      this._reload('crash du renderer', true)
    }
  }

  /** webContents 'did-fail-load' (frame principale uniquement). */
  onDidFailLoad(errorCode, errorDescription, url, isMainFrame = true) {
    if (!isMainFrame || errorCode === -3) return   // -3 = ERR_ABORTED (navigation annulée)
    this._incidents.record('CHARGEMENT_ECHOUE', 'warn',
      'Échec de chargement de la page (' + errorCode + ' ' + (errorDescription || '') + ')',
      { errorCode, errorDescription, url })
    if (this._pendingFailReload) return
    this._pendingFailReload = this._timers.setTimeout(() => {
      this._pendingFailReload = null
      this._reload('échec de chargement', true)
    }, this._o.didFailLoadReloadMs)
  }

  /** app 'child-process-gone' : on journalise les crashs GPU (Chromium relance le GPU). */
  onChildProcessGone(details = {}) {
    if (details.type !== 'GPU' || details.reason === 'clean-exit') return
    this._incidents.record('GPU_CRASH', 'warn',
      'Process GPU arrêté (' + (details.reason || '?') + ')',
      { reason: details.reason, exitCode: details.exitCode })
  }

  // ─── Évaluation périodique ─────────────────────────────────────────────────

  tick() {
    const now = this._now()

    // Débogage (DevTools ouverts, point d'arrêt) : ne pas prendre une pause pour un blocage
    if (this._isPaused()) {
      this._lastPingAt = now
      this._unresponsiveSince = null
      return
    }

    // 1. Renderer qui ne répond plus (JS bloqué côté Chromium)
    if (this._unresponsiveSince && now - this._unresponsiveSince > this._o.unresponsiveLimitMs) {
      const secs = Math.round((now - this._unresponsiveSince) / 1000)
      this._unresponsiveSince = null
      this._critical()
      this._incidents.record('RENDERER_NE_REPOND_PLUS', 'critique',
        'La page ne répond plus depuis ' + secs + 's, crash forcé du renderer', { secondes: secs })
      this._counters.forcedCrashes++
      this._lastAction = { action: 'forceCrash', ts: now }
      // → 'render-process-gone' → reload
      this._actions.forceCrash()
      return
    }

    // 2. Plus de ping : le JS du renderer est figé (ou la page ne s'est jamais initialisée)
    const reference = Math.max(this._lastPingAt || 0, this._pageLoadedAt + this._graceMs - this._o.pingTimeoutMs)
    if (now - reference > this._o.pingTimeoutMs) {
      // Une action vient d'être lancée (ex: reload après crash) : lui laisser le temps d'aboutir
      if (now - this._lastActionAt < this._o.actionCooldownMs) return
      const silence = this._lastPingAt ? Math.round((now - this._lastPingAt) / 1000) : null
      this._critical()
      this._incidents.record('RENDERER_FIGE', 'critique',
        silence !== null ? 'Aucun signe de vie de la page depuis ' + silence + 's' : 'La page ne s\'est jamais signalée après chargement',
        { secondesSansPing: silence, tentative: this._noPingReloads + 1 })
      if (this._noPingReloads === 0) {
        this._noPingReloads = 1
        this._reload('renderer figé', true)
      } else {
        this._noPingReloads = 0
        this.relaunch('renderer toujours figé après reload')
      }
      return
    }

    // 3. Pings OK mais boucle bloquée (le watchdog du renderer n'a pas su la débloquer)
    const p = this._lastPing
    if (p && p.loopActive && p.screenStatus !== 'sleep' &&
        typeof p.secondsSinceLastMedia === 'number' && p.secondsSinceLastMedia > this._o.stuckMediaLimitS &&
        now - this._lastStuckActionAt > this._o.stuckCooldownMs) {
      this._lastStuckActionAt = now
      this._incidents.record('BOUCLE_BLOQUEE', 'critique',
        'Aucun média affiché depuis ' + p.secondsSinceLastMedia + 's malgré le watchdog de la page',
        { niveau: 'main', secondesSansMedia: p.secondsSinceLastMedia })
      this._reload('boucle bloquée', true)
      return
    }

    // 4. Mémoire du renderer
    if (now - this._lastMemCheckAt >= this._o.memoryCheckMs) {
      this._lastMemCheckAt = now
      let mb = 0
      try { mb = Math.round(this._getMemMB() || 0) } catch (_) { mb = 0 }
      if (mb > this._o.memoryLimitMB) {
        this._incidents.record('MEMOIRE_ELEVEE', 'warn',
          'Mémoire du renderer ' + mb + ' Mo (limite ' + this._o.memoryLimitMB + ' Mo)', { memoireMo: mb })
        this._reload('mémoire élevée', false)
        return
      }
    }

    // 5. Sortie du mode sûr après une période calme
    if (this.isSafeMode() && now - Math.max(this._persisted.safeModeSince, this._lastCriticalAt) > this._o.safeModeExitMs) {
      this._persisted.safeModeSince = null
      this._persisted.relaunches = []
      this._save()
      this._incidents.record('MODE_SUR_DESACTIVE', 'info', 'Sortie du mode sûr après 1h sans incident critique', {})
      this._actions.setSafeMode(false)
    }
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  _critical() { this._lastCriticalAt = this._now() }

  _reload(cause, critique) {
    const now = this._now()
    if (now - this._lastActionAt < this._o.actionCooldownMs) {
      this._log.warn('[watchdog] reload ignoré (cooldown) : ' + cause)
      return false
    }
    this._lastActionAt = now
    this._incidents.record('PAGE_RECHARGEE', critique ? 'warn' : 'info', 'Rechargement de la page : ' + cause, { cause })
    this._counters.reloads++
    this._lastAction = { action: 'reload', cause, ts: now }
    this._pageLoadedAt = now
    this._graceMs = this._o.reloadGraceMs
    this._lastPingAt = null
    this._lastPing = null
    this._actions.reload()
    return true
  }

  /**
   * Relance complète de l'app, sauf si trop de relaunch récents : passage en
   * mode sûr (pageDefault, polling API maintenu) et simple reload.
   * Utilisé aussi pour les demandes de restart du watchdog du renderer (niveau 3).
   */
  relaunch(cause) {
    const now = this._now()
    this._critical()
    this._persisted.relaunches = this._persisted.relaunches.filter(t => now - t < this._o.relaunchWindowMs)

    if (this._persisted.relaunches.length >= this._o.maxRelaunchesInWindow) {
      if (!this.isSafeMode()) {
        this._persisted.safeModeSince = now
        this._save()
        this._incidents.record('MODE_SUR_ACTIVE', 'critique',
          this._persisted.relaunches.length + ' relances en moins d\'1h : mode sûr (pageDefault) au lieu d\'une nouvelle relance',
          { cause, relancesFenetre: this._persisted.relaunches.length })
        this._actions.setSafeMode(true)
      }
      this._lastActionAt = 0   // le reload du mode sûr ne doit pas être bloqué par le cooldown
      return this._reload('mode sûr (' + cause + ')', true)
    }

    this._persisted.relaunches.push(now)
    this._persisted.running = false
    this._persisted.lastExit = { cause: 'watchdog: ' + cause, ts: now }
    this._save()
    this._incidents.record('APP_RELANCEE', 'critique', 'Relance de l\'application : ' + cause,
      { cause, relancesFenetre: this._persisted.relaunches.length })
    this._incidents.persistSync()
    this._counters.relaunches++
    this._lastAction = { action: 'relaunch', cause, ts: now }
    this.stop()   // plus aucune action tant que le process se termine
    this._actions.relaunch()
    return true
  }

  _save() {
    try { this._store && this._store.write(this._persisted) } catch (e) { this._log.warn('[watchdog] save failed: ' + e.message) }
  }

  stats() {
    return Object.assign({
      safeMode: this.isSafeMode(),
      lastAction: this._lastAction,
      lastPingAgeS: this._lastPingAt ? Math.round((this._now() - this._lastPingAt) / 1000) : null,
      relaunchesLastHour: this._persisted.relaunches.filter(t => this._now() - t < this._o.relaunchWindowMs).length
    }, this._counters)
  }
}

/**
 * Options de app.relaunch(). Une AppImage s'exécute depuis un montage /tmp/.mount_*
 * démonté dès que l'app se ferme : relancer process.execPath échoue et l'écran reste
 * éteint. Il faut relancer le fichier AppImage lui-même.
 */
function relaunchOptions(env = process.env, argv = process.argv) {
  return env.APPIMAGE ? { execPath: env.APPIMAGE, args: argv.slice(1) } : {}
}

module.exports = { MainWatchdog, DEFAULTS, relaunchOptions }
