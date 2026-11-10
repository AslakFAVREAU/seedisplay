/**
 * Journal d'incidents (process main) — remonté au monitoring SOEK.
 *
 * Vit dans le process main pour rester opérationnel quand le renderer est figé
 * ou a crashé. La file est persistée sur disque : un incident enregistré juste
 * avant un relaunch part au démarrage suivant.
 *
 * Contrat SOEK : POST {base}/see/API/heartbeat/{ecranUuid}/incidents
 *   body     { ecranUuid, incidents: [Incident] }   (50 max)
 *   réponse  { success, accepted: [clientId], rejected: [{clientId, raison}] }
 * Voir docs/HEARTBEAT_SYSTEM.md § Incidents.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const NIVEAUX = ['info', 'warn', 'critique']

const DEFAULTS = {
  maxEntries: 300,
  batchSize: 50,
  dedupeWindowMs: 10 * 60 * 1000,
  flushIntervalMs: 60 * 1000,
  backoffBaseMs: 60 * 1000,
  backoffMaxMs: 10 * 60 * 1000,
  criticalFlushDelayMs: 2000,
  requestTimeoutMs: 15000,
  maxMessageLength: 500
}

const BASE_URLS = {
  prod: 'https://soek.fr',
  soek: 'https://soek.fr',
  beta: 'https://beta.soek.fr',
  local: 'http://localhost:8000',
  localhost: 'http://localhost:8000'
}

function baseUrlForEnv(env) {
  return BASE_URLS[String(env || 'prod').toLowerCase()] || BASE_URLS.prod
}

class IncidentLog {
  /**
   * @param {object} deps
   * @param {string} deps.filePath - fichier de persistance de la file
   * @param {function} deps.getConfig - () => { ecranUuid, apiToken, env } | null
   * @param {object} deps.axios
   * @param {object} [deps.log]
   * @param {function} [deps.now]
   * @param {string} [deps.appVersion]
   * @param {function} [deps.getUptimeS]
   * @param {function} [deps.isOffline]
   * @param {object} [deps.timers] - { setTimeout, clearTimeout, setInterval, clearInterval }
   * @param {object} [deps.options]
   */
  constructor(deps) {
    this._filePath = deps.filePath
    this._getConfig = deps.getConfig || (() => null)
    this._axios = deps.axios
    this._log = deps.log || console
    this._now = deps.now || (() => Date.now())
    this._appVersion = deps.appVersion || 'unknown'
    this._getUptimeS = deps.getUptimeS || (() => 0)
    this._isOffline = deps.isOffline || (() => false)
    this._timers = Object.assign({ setTimeout, clearTimeout, setInterval, clearInterval }, deps.timers || {})
    this._opts = Object.assign({}, DEFAULTS, deps.options || {})

    this._queue = []
    this._flushing = null
    this._failures = 0
    this._nextAttemptAt = 0
    this._interval = null
    this._criticalTimer = null
    this._stats = { recorded: 0, sent: 0, dropped: 0, lastSentAt: null, lastError: null }

    this._load()
  }

  // ─── File ──────────────────────────────────────────────────────────────────

  _load() {
    try {
      const raw = fs.readFileSync(this._filePath, 'utf8')
      const data = JSON.parse(raw)
      if (Array.isArray(data)) this._queue = data.filter(i => i && i.clientId && i.type)
    } catch (e) {
      // Fichier absent ou corrompu → on repart d'une file vide
      this._queue = []
    }
  }

  /** Écriture synchrone et atomique : doit survivre à un app.exit() immédiat. */
  persistSync() {
    try {
      fs.mkdirSync(path.dirname(this._filePath), { recursive: true })
      const tmp = this._filePath + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(this._queue))
      fs.renameSync(tmp, this._filePath)
    } catch (e) {
      this._log.warn('[incidents] persist failed: ' + e.message)
    }
  }

  /**
   * Enregistre un incident. Même type + même clé (`contexte.cle`, sinon
   * `contexte.fichier`) dans la fenêtre de dédoublonnage → incrémente
   * `occurrences` au lieu d'ajouter une ligne.
   * @returns {object} l'incident (nouveau ou fusionné)
   */
  record(type, niveau, message, contexte = {}, source = 'main') {
    const now = this._now()
    niveau = NIVEAUX.includes(niveau) ? niveau : 'warn'
    type = String(type || 'AUTRE').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 64) || 'AUTRE'
    message = String(message || '').slice(0, this._opts.maxMessageLength)
    contexte = (contexte && typeof contexte === 'object') ? contexte : { valeur: contexte }

    const cleDe = c => (c && (c.cle || c.fichier)) || ''
    const cle = cleDe(contexte)
    const existing = this._queue.find(i =>
      i.type === type && cleDe(i.contexte) === cle &&
      now - (i._derniere || Date.parse(i.ts)) < this._opts.dedupeWindowMs)

    let incident
    if (existing) {
      existing.occurrences = (existing.occurrences || 1) + 1
      existing._derniere = now
      existing.message = message
      if (NIVEAUX.indexOf(niveau) > NIVEAUX.indexOf(existing.niveau)) existing.niveau = niveau
      incident = existing
    } else {
      incident = {
        clientId: crypto.randomUUID(),
        ts: new Date(now).toISOString(),
        type,
        niveau,
        source,
        message,
        contexte,
        versionApp: this._appVersion,
        uptimeS: Math.round(this._getUptimeS()),
        occurrences: 1,
        _derniere: now
      }
      this._queue.push(incident)
      this._evict()
    }

    this._stats.recorded++
    this.persistSync()
    const logLevel = niveau === 'critique' ? 'error' : niveau === 'warn' ? 'warn' : 'info'
    try { this._log[logLevel](`[incident] ${type} (${niveau}) ${message}`) } catch (_) { /* ignore */ }

    if (niveau === 'critique') this._scheduleCriticalFlush()
    return incident
  }

  /** Limite la taille : supprime d'abord les plus anciens `info`, puis `warn`, puis le reste. */
  _evict() {
    while (this._queue.length > this._opts.maxEntries) {
      let idx = -1
      for (const niveau of NIVEAUX) {
        idx = this._queue.findIndex(i => i.niveau === niveau)
        if (idx !== -1) break
      }
      this._queue.splice(idx === -1 ? 0 : idx, 1)
      this._stats.dropped++
    }
  }

  pending() { return this._queue.length }
  list() { return this._queue.map(i => this._serialize(i)) }

  _serialize(i) {
    const { _derniere, ...rest } = i
    return rest
  }

  // ─── Envoi ─────────────────────────────────────────────────────────────────

  start() {
    if (this._interval) return
    this._interval = this._timers.setInterval(() => { this.flush().catch(() => {}) }, this._opts.flushIntervalMs)
    // Vider la file accumulée avant un redémarrage
    this.flush().catch(() => {})
  }

  stop() {
    if (this._interval) this._timers.clearInterval(this._interval)
    if (this._criticalTimer) this._timers.clearTimeout(this._criticalTimer)
    this._interval = null
    this._criticalTimer = null
  }

  _scheduleCriticalFlush() {
    if (this._criticalTimer) return
    this._criticalTimer = this._timers.setTimeout(() => {
      this._criticalTimer = null
      this.flush().catch(() => {})
    }, this._opts.criticalFlushDelayMs)
  }

  /**
   * Envoie un lot à SOEK. Un seul envoi à la fois.
   * @returns {Promise<{sent: number, skipped?: string}>}
   */
  flush() {
    if (this._flushing) return this._flushing
    this._flushing = this._doFlush().finally(() => { this._flushing = null })
    return this._flushing
  }

  async _doFlush() {
    if (!this._queue.length) return { sent: 0, skipped: 'empty' }
    if (this._isOffline()) return { sent: 0, skipped: 'offline' }
    if (this._now() < this._nextAttemptAt) return { sent: 0, skipped: 'backoff' }

    const cfg = this._getConfig() || {}
    if (!cfg.ecranUuid || !cfg.apiToken) return { sent: 0, skipped: 'no-config' }

    const batch = this._queue.slice(0, this._opts.batchSize)
    const sentOccurrences = new Map(batch.map(i => [i.clientId, i.occurrences || 1]))
    const url = `${baseUrlForEnv(cfg.env)}/see/API/heartbeat/${encodeURIComponent(cfg.ecranUuid)}/incidents`

    try {
      const res = await this._axios.post(url, {
        ecranUuid: cfg.ecranUuid,
        incidents: batch.map(i => this._serialize(i))
      }, {
        timeout: this._opts.requestTimeoutMs,
        headers: { 'Content-Type': 'application/json', 'X-API-Token': cfg.apiToken }
      })

      const data = res && res.data || {}
      const accepted = new Set(Array.isArray(data.accepted) ? data.accepted : [])
      // Les rejets définitifs (incident invalide) sont retirés aussi : les renvoyer ne servirait à rien
      for (const r of Array.isArray(data.rejected) ? data.rejected : []) {
        if (r && r.clientId) accepted.add(r.clientId)
      }
      const before = this._queue.length
      const remaining = []
      for (const i of this._queue) {
        if (!accepted.has(i.clientId)) { remaining.push(i); continue }
        // Doublon arrivé pendant l'envoi : ne pas perdre ces occurrences,
        // elles repartent sous un nouvel identifiant au lot suivant
        const extra = (i.occurrences || 1) - (sentOccurrences.get(i.clientId) || 0)
        if (extra > 0) remaining.push(Object.assign({}, i, { clientId: crypto.randomUUID(), occurrences: extra }))
      }
      this._queue = remaining
      const sent = before - this._queue.length
      this.persistSync()

      this._failures = 0
      this._nextAttemptAt = 0
      this._stats.sent += sent
      this._stats.lastSentAt = this._now()
      this._stats.lastError = null

      // Encore des incidents en attente → lot suivant au prochain tick rapide
      if (sent > 0 && this._queue.length) this._scheduleCriticalFlush()
      return { sent }
    } catch (e) {
      this._failures++
      const delay = Math.min(this._opts.backoffMaxMs, this._opts.backoffBaseMs * Math.pow(2, this._failures - 1))
      this._nextAttemptAt = this._now() + delay
      const status = e && e.response && e.response.status
      this._stats.lastError = (status ? 'HTTP ' + status : (e && e.message)) || 'unknown'
      this._log.warn(`[incidents] envoi échoué (${this._stats.lastError}), ${this._queue.length} en attente, prochain essai dans ${Math.round(delay / 1000)}s`)
      return { sent: 0, error: this._stats.lastError }
    }
  }

  stats() {
    return Object.assign({ pending: this._queue.length, failures: this._failures, nextAttemptAt: this._nextAttemptAt || null }, this._stats)
  }
}

module.exports = { IncidentLog, baseUrlForEnv, NIVEAUX }
