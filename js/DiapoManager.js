/**
 * DiapoManager - Slideshow data management with offline resilience
 * 
 * Responsibilities:
 * - Fetch diapo data from API
 * - Cache API responses for offline use
 * - Use timeline if available (API v2) or compute locally
 * - Recalculate timeline locally if offline
 * - Download and cache media files
 */

class DiapoManager {
  constructor() {
    this._cache = {
      response: null,      // Last API response
      timeline: [],        // Computed timeline (list of media to display)
      lastFetch: null,     // Timestamp of last successful fetch
      offline: false       // Are we in offline mode?
    }
    
    this._refreshInterval = 60000  // 1 minute default refresh
    this._refreshTimer = null
    this._log = this._createLogger()
    this._onUpdateCallbacks = []
  }

  _createLogger() {
    return {
      info: (tag, ...args) => {
        if (window.logger?.info) window.logger.info(tag, ...args)
        else console.log(`[${tag}]`, ...args)
      },
      warn: (tag, ...args) => {
        if (window.logger?.warn) window.logger.warn(tag, ...args)
        else console.warn(`[${tag}]`, ...args)
      },
      error: (tag, ...args) => {
        if (window.logger?.error) window.logger.error(tag, ...args)
        else console.error(`[${tag}]`, ...args)
      },
      debug: (tag, ...args) => {
        if (window.logger?.debug) window.logger.debug(tag, ...args)
        else console.debug(`[${tag}]`, ...args)
      }
    }
  }

  /**
   * Initialize the manager - must be called after ConfigManager is loaded
   */
  async init() {
    this._log.info('diapo-manager', 'Initializing...')
    
    // Load cached data from disk
    await this._loadCacheFromDisk()
    
    // Fetch fresh data
    await this.refresh()
    
    // Start periodic refresh
    this._startRefreshTimer()
    
    this._log.info('diapo-manager', 'Initialized with', this._cache.timeline.length, 'media items')
    return this._cache.timeline
  }

  /**
   * Load cached API response from disk
   */
  async _loadCacheFromDisk() {
    try {
      if (!window.api?.readFile) return
      
      const raw = await window.api.readFile('cache/lastDiapoResponse.json')
      if (raw) {
        const cached = JSON.parse(raw)
        this._cache.response = cached.response
        this._cache.lastFetch = cached.lastFetch
        this._log.info('diapo-manager', 'Loaded cache from disk, age:', 
          Math.round((Date.now() - cached.lastFetch) / 1000 / 60), 'minutes')
        
        // Recompute timeline from cached data
        this._cache.timeline = this._computeTimeline(cached.response)
      }
    } catch (e) {
      this._log.debug('diapo-manager', 'No disk cache available:', e.message)
    }
  }

  /**
   * Save cache to disk for offline use
   */
  async _saveCacheToDisk() {
    try {
      if (!window.api?.writeFile) return
      
      const cacheData = JSON.stringify({
        response: this._cache.response,
        lastFetch: this._cache.lastFetch
      }, null, 2)
      
      await window.api.writeFile('cache/lastDiapoResponse.json', cacheData)
      this._log.debug('diapo-manager', 'Cache saved to disk')
    } catch (e) {
      this._log.warn('diapo-manager', 'Failed to save cache:', e.message)
    }
  }

  /**
   * Fetch fresh data from API
   */
  async refresh() {
    this._log.info('diapo-manager', 'Refreshing diapo data...')
    
    try {
      const url = window.configManager.diapoApiUrl
      this._log.debug('diapo-manager', 'Fetching:', url)
      
      let response
      
      // Use ApiManager if available for error handling
      if (window.apiManager?.getDiapoWithErrorHandling) {
        response = await window.apiManager.getDiapoWithErrorHandling(url)
      } else if (window.api?.fetchJson) {
        response = await window.api.fetchJson(url)
      } else {
        throw new Error('No fetch method available')
      }

      // Validate response
      if (!response) {
        throw new Error('Empty response from API')
      }

      // Store raw response
      this._cache.response = response
      this._cache.lastFetch = Date.now()
      this._cache.offline = false

      // Compute timeline
      this._cache.timeline = this._computeTimeline(response)

      // Save to disk for offline use
      await this._saveCacheToDisk()

      // Download media files
      await this._downloadMedia()

      // Notify listeners
      this._notifyUpdate()

      this._log.info('diapo-manager', 'Refresh complete:', this._cache.timeline.length, 'items')
      return this._cache.timeline

    } catch (error) {
      this._log.error('diapo-manager', 'Refresh failed:', error.message)
      this._cache.offline = true

      // If we have cached data, recompute timeline (may need date filtering update)
      if (this._cache.response) {
        this._log.info('diapo-manager', 'Using cached data (offline mode)')
        this._cache.timeline = this._computeTimeline(this._cache.response)
        return this._cache.timeline
      }

      return []
    }
  }

  /**
   * Compute timeline from API response
   * Uses timeline field if available (API v2), otherwise computes locally
   */
  _computeTimeline(response) {
    if (!response) return []

    // API v2: Use pre-computed timeline if available
    if (response.timeline && Array.isArray(response.timeline) && response.timeline.length > 0) {
      this._log.debug('diapo-manager', 'Using API timeline:', response.timeline.length, 'items')
      return response.timeline.map(item => this._normalizeMedia(item))
    }

    // Fallback: Compute timeline from diapos
    const diapos = response.diapos || response.Diapos || []
    if (!Array.isArray(diapos) || diapos.length === 0) {
      this._log.warn('diapo-manager', 'No diapos in response')
      return []
    }

    this._log.debug('diapo-manager', 'Computing timeline from', diapos.length, 'diapos')

    // Filter active diapos
    const now = new Date()
    const activeDiapos = diapos.filter(d => this._isDiapoActive(d, now))

    // Sort by priority
    activeDiapos.sort((a, b) => {
      const prioA = a.priorite ?? a.Priorite ?? 0
      const prioB = b.priorite ?? b.Priorite ?? 0
      return prioB - prioA  // Higher priority first
    })

    // Extract media list
    const timeline = []
    for (const diapo of activeDiapos) {
      const medias = diapo.medias || diapo.Medias || []
      for (const media of medias) {
        timeline.push(this._normalizeMedia(media, diapo))
      }
    }

    this._log.debug('diapo-manager', 'Computed timeline:', timeline.length, 'items')
    return timeline
  }

  /**
   * Check if a diapo is currently active
   */
  _isDiapoActive(diapo, now = new Date()) {
    // Check date range
    const dateDebut = diapo.dateDebut || diapo.DateDebut
    const dateFin = diapo.dateFin || diapo.DateFin

    if (dateDebut) {
      const start = new Date(dateDebut)
      if (now < start) return false
    }

    if (dateFin) {
      const end = new Date(dateFin)
      if (now > end) return false
    }

    // Check schedule (jours de la semaine, heures)
    const prog = diapo.programmation || diapo.Programmation
    if (prog) {
      // Check days of week
      const jours = prog.joursSemaine || prog.JoursSemaine
      if (jours && Array.isArray(jours) && jours.length > 0) {
        const dayOfWeek = now.getDay() // 0=Sunday, 1=Monday, ...
        if (!jours.includes(dayOfWeek)) return false
      }

      // Check time range
      const heureDebut = prog.heureDebut || prog.HeureDebut
      const heureFin = prog.heureFin || prog.HeureFin
      
      if (heureDebut || heureFin) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes()
        
        if (heureDebut) {
          const [h, m] = heureDebut.split(':').map(Number)
          const startMinutes = h * 60 + m
          if (currentMinutes < startMinutes) return false
        }
        
        if (heureFin) {
          const [h, m] = heureFin.split(':').map(Number)
          const endMinutes = h * 60 + m
          if (currentMinutes > endMinutes) return false
        }
      }
    }

    return true
  }

  /**
   * Normalize media item to consistent format
   */
  _normalizeMedia(media, parentDiapo = null) {
    const type = media.type || media.Type || this._guessMediaType(media.nom || media.Nom || '')
    
    return {
      id: media.id || media.Id || null,
      nom: media.nom || media.Nom || '',
      type: type,
      duree: media.duree || media.Duree || 10,
      priorite: media.priorite ?? parentDiapo?.priorite ?? parentDiapo?.Priorite ?? 0,
      url: this._getMediaUrl(media.nom || media.Nom || '')
    }
  }

  /**
   * Guess media type from filename
   */
  _guessMediaType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv']
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
    
    if (videoExts.includes(ext)) return 'video'
    if (imageExts.includes(ext)) return 'image'
    return 'image'  // Default to image
  }

  /**
   * Get media URL (local cache or remote)
   */
  _getMediaUrl(filename) {
    // Check if local file exists
    // For now, return remote URL - MediaPlayer will handle caching
    return window.configManager.mediaBaseUrl + filename
  }

  /**
   * Download and cache media files
   * Uses ETag/Last-Modified to detect changes on remote server
   */
  async _downloadMedia() {
    const timeline = this._cache.timeline
    if (!timeline.length) return

    this._log.info('diapo-manager', 'Checking/downloading', timeline.length, 'media files...')

    for (const media of timeline) {
      try {
        if (!media.nom) continue
        
        const url = window.configManager.mediaBaseUrl + media.nom
        const relativePath = 'media/' + media.nom

        // Use saveBinaryWithCache (with ETag support) to detect remote changes
        if (window.api?.saveBinaryWithCache) {
          const result = await window.api.saveBinaryWithCache(relativePath, url)
          if (result.success) {
            if (result.cached) {
              this._log.debug('diapo-manager', 'Up to date (304):', media.nom)
            } else {
              this._log.info('diapo-manager', 'Downloaded new/updated:', media.nom, `(${result.size} bytes)`)
            }
          } else {
            this._log.warn('diapo-manager', 'Download failed:', media.nom, result.error)
          }
          continue
        }

        // Fallback: saveBinary without cache (skip if file exists)
        if (window.api?.saveBinary) {
          if (window.api?.existsSync && window.api.existsSync(relativePath)) {
            this._log.debug('diapo-manager', 'Already cached (fallback):', media.nom)
            continue
          }
          await window.api.saveBinary(relativePath, url)
          this._log.debug('diapo-manager', 'Downloaded (fallback):', media.nom)
        }
      } catch (e) {
        this._log.warn('diapo-manager', 'Failed to download:', media.nom, e.message)
      }
    }
  }

  /**
   * Start periodic refresh timer
   */
  _startRefreshTimer() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer)
    }
    
    this._refreshTimer = setInterval(() => {
      this.refresh().catch(e => {
        this._log.warn('diapo-manager', 'Periodic refresh failed:', e.message)
      })
    }, this._refreshInterval)
  }

  /**
   * Stop refresh timer
   */
  stopRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer)
      this._refreshTimer = null
    }
  }

  /**
   * Register callback for timeline updates
   */
  onUpdate(callback) {
    this._onUpdateCallbacks.push(callback)
  }

  /**
   * Notify all listeners of timeline update
   */
  _notifyUpdate() {
    for (const callback of this._onUpdateCallbacks) {
      try {
        callback(this._cache.timeline)
      } catch (e) {
        this._log.error('diapo-manager', 'Update callback error:', e.message)
      }
    }
  }

  /**
   * Get current timeline
   */
  get timeline() {
    return this._cache.timeline
  }

  /**
   * Get screen configuration from last response
   */
  get ecranConfig() {
    const response = this._cache.response
    if (!response) return null
    
    return {
      id: response.ecran?.id || response.Ecran?.Id || null,
      nom: response.ecran?.nom || response.Ecran?.Nom || '',
      // luminosite is at root level in API v2, not inside ecran
      luminosite: response.luminosite ?? response.ecran?.luminosite ?? response.Ecran?.Luminosite ?? 100,
      sleepMode: response.ecran?.sleepMode || response.Ecran?.SleepMode || null
    }
  }

  /**
   * Check if in offline mode
   */
  get isOffline() {
    return this._cache.offline
  }

  /**
   * Get cache age in milliseconds
   */
  get cacheAge() {
    return this._cache.lastFetch ? Date.now() - this._cache.lastFetch : Infinity
  }
}

// Singleton instance
window.diapoManager = new DiapoManager()
