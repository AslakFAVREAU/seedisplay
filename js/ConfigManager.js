/**
 * ConfigManager - Centralized configuration management
 * 
 * Responsibilities:
 * - Load config once at startup via preload API
 * - Cache config in memory
 * - Provide sync access after initial load
 * - Build API URLs based on environment
 */

class ConfigManager {
  constructor() {
    this._config = null
    this._loaded = false
    this._loadPromise = null
    this._log = this._createLogger()
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
   * Default configuration values
   */
  static get DEFAULTS() {
    return {
      env: 'prod',
      idEcran: 1,
      meteo: true,
      meteoLat: 48.75,
      meteoLon: 2.3,
      meteoUnits: 'metric',
      weekDisplay: true,
      weekNo: true,
      weekType: true,
      logoSOE: true
    }
  }

  /**
   * API base URLs per environment
   */
  static get API_URLS() {
    return {
      prod: 'https://soek.fr',
      local: 'http://127.0.0.1:8000'
    }
  }

  /**
   * Load configuration from disk (via preload API)
   * Returns a promise that resolves when config is ready
   * Can be called multiple times - subsequent calls return cached promise
   */
  async load() {
    if (this._loadPromise) {
      return this._loadPromise
    }

    this._loadPromise = this._doLoad()
    return this._loadPromise
  }

  async _doLoad() {
    this._log.info('config-manager', 'Loading configuration...')
    
    try {
      if (!window.api?.getConfig) {
        throw new Error('window.api.getConfig not available')
      }

      const config = await window.api.getConfig()
      this._log.info('config-manager', 'Raw config from API:', JSON.stringify(config))

      // Merge with defaults
      this._config = { ...ConfigManager.DEFAULTS, ...config }
      this._loaded = true

      this._log.info('config-manager', 'Configuration loaded:', {
        env: this._config.env,
        idEcran: this._config.idEcran,
        meteo: this._config.meteo
      })

      return this._config
    } catch (error) {
      this._log.error('config-manager', 'Failed to load config:', error.message)
      this._config = { ...ConfigManager.DEFAULTS }
      this._loaded = true
      return this._config
    }
  }

  /**
   * Check if config is loaded
   */
  get isLoaded() {
    return this._loaded
  }

  /**
   * Get the full config object (throws if not loaded)
   */
  get config() {
    if (!this._loaded) {
      throw new Error('ConfigManager: config not loaded. Call load() first.')
    }
    return this._config
  }

  /**
   * Get a specific config value
   */
  get(key) {
    return this.config[key]
  }

  /**
   * Get the screen ID
   */
  get idEcran() {
    return this.config.idEcran
  }

  /**
   * Get current environment
   */
  get env() {
    return this.config.env
  }

  /**
   * Check if running in production
   */
  get isProduction() {
    return this.config.env === 'prod'
  }

  /**
   * Get the base API URL for current environment
   */
  get apiBaseUrl() {
    const env = this.config.env
    return ConfigManager.API_URLS[env] || ConfigManager.API_URLS.prod
  }

  /**
   * Build the diapo API URL
   */
  get diapoApiUrl() {
    return `${this.apiBaseUrl}/see/API/diapo/${this.idEcran}`
  }

  /**
   * Get media base URL
   */
  get mediaBaseUrl() {
    return `${this.apiBaseUrl}/uploads/see/media/`
  }

  /**
   * Weather configuration
   */
  get meteoConfig() {
    return {
      enabled: this.config.meteo,
      lat: this.config.meteoLat,
      lon: this.config.meteoLon,
      units: this.config.meteoUnits
    }
  }

  /**
   * UI display configuration
   */
  get displayConfig() {
    return {
      weekDisplay: this.config.weekDisplay,
      weekNo: this.config.weekNo,
      weekType: this.config.weekType,
      logoSOE: this.config.logoSOE
    }
  }
}

// Singleton instance
window.configManager = new ConfigManager()
