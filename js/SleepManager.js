/**
 * SleepManager - Sleep mode, luminosity and wakeup management
 * 
 * Responsibilities:
 * - Check if screen should be sleeping based on schedule
 * - Apply luminosity changes progressively
 * - Handle wakeup on schedule or event
 * - Integrate with DiapoManager for screen config
 */

class SleepManager {
  constructor() {
    this._isSleeping = false
    this._isNightMode = false
    this._currentLuminosity = 100
    this._sleepConfig = null
    this._nightModeConfig = null
    this._checkInterval = null
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
   * Initialize with screen config from DiapoManager
   */
  init(ecranConfig) {
    this._log.info('sleep-manager', 'Initializing...')
    
    if (ecranConfig?.sleepMode) {
      this._sleepConfig = ecranConfig.sleepMode
      this._log.info('sleep-manager', 'Sleep mode config:', JSON.stringify(this._sleepConfig))
    }

    // Night mode config from API response
    this._updateNightModeConfig()

    if (ecranConfig?.luminosite !== undefined) {
      this._currentLuminosity = ecranConfig.luminosite
    }

    // Start periodic check
    this._startCheckInterval()
    
    // Initial check
    this._checkSleepStatus()
    this._checkNightModeStatus()
    
    // Apply initial luminosity if not sleeping and not in night mode
    // This ensures day-time luminosity is applied at startup
    if (!this._isSleeping && !this._isNightMode) {
      this.applyLuminosity(this._currentLuminosity, false)
    }

    return this
  }

  /**
   * Update night mode config from API response
   */
  _updateNightModeConfig() {
    const apiResponse = window.apiV2Response
    if (apiResponse?.modeNuit) {
      this._nightModeConfig = apiResponse.modeNuit
      this._log.info('sleep-manager', 'Night mode config:', JSON.stringify(this._nightModeConfig))
    }
  }

  /**
   * Update config (called when DiapoManager refreshes)
   */
  updateConfig(ecranConfig) {
    if (ecranConfig?.sleepMode) {
      this._sleepConfig = ecranConfig.sleepMode
    }
    
    // Update day luminosity from config
    const newLuminosity = ecranConfig?.luminosite
    const luminosityChanged = newLuminosity !== undefined && newLuminosity !== this._currentLuminosity
    
    if (newLuminosity !== undefined) {
      this._currentLuminosity = newLuminosity
    }
    
    // Refresh night mode config
    this._updateNightModeConfig()
    
    this._checkSleepStatus()
    this._checkNightModeStatus()
    
    // Apply updated day luminosity if we're in normal mode (not sleeping, not night)
    if (luminosityChanged && !this._isSleeping && !this._isNightMode) {
      this._log.info('sleep-manager', `Applying updated day luminosity: ${this._currentLuminosity}%`)
      this.applyLuminosity(this._currentLuminosity, true)
    }
  }

  /**
   * Start periodic sleep check (every minute)
   */
  _startCheckInterval() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval)
    }
    
    this._checkInterval = setInterval(() => {
      this._checkSleepStatus()
      this._checkNightModeStatus()
    }, 60000)  // Check every minute
  }

  /**
   * Check if screen should be sleeping
   */
  _checkSleepStatus() {
    const shouldSleep = this.shouldSleep()
    
    if (shouldSleep && !this._isSleeping) {
      this.enterSleepMode()
    } else if (!shouldSleep && this._isSleeping) {
      this.exitSleepMode()
    }
  }

  /**
   * Check and apply night mode luminosity
   */
  _checkNightModeStatus() {
    if (this._isSleeping) return // Don't apply night mode if sleeping
    
    const shouldBeNight = this._shouldBeInNightMode()
    
    if (shouldBeNight && !this._isNightMode) {
      this._enterNightMode()
    } else if (!shouldBeNight && this._isNightMode) {
      this._exitNightMode()
    }
  }

  /**
   * Check if current time is within night mode schedule
   */
  _shouldBeInNightMode() {
    if (!this._nightModeConfig || !this._nightModeConfig.actif) {
      return false
    }

    const { heureDebut, heureFin } = this._nightModeConfig
    if (!heureDebut || !heureFin) return false

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    
    const [startH, startM] = heureDebut.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    
    const [endH, endM] = heureFin.split(':').map(Number)
    const endMinutes = endH * 60 + endM

    // Handle overnight (e.g., 16:45 to 02:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes
    } else {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes
    }
  }

  /**
   * Enter night mode - apply reduced luminosity
   */
  _enterNightMode() {
    const nightLuminosity = this._nightModeConfig?.luminositeNuit ?? 25
    this._log.info('sleep-manager', `Entering night mode, luminosity: ${nightLuminosity}%`)
    this._isNightMode = true
    this.applyLuminosity(nightLuminosity, true)
  }

  /**
   * Exit night mode - restore normal luminosity
   */
  _exitNightMode() {
    const normalLuminosity = window.diapoManager?.ecranConfig?.luminosite || 100
    this._log.info('sleep-manager', `Exiting night mode, luminosity: ${normalLuminosity}%`)
    this._isNightMode = false
    this.applyLuminosity(normalLuminosity, true)
  }

  /**
   * Check if current time is within sleep schedule
   */
  shouldSleep(now = new Date()) {
    if (!this._sleepConfig) return false

    const { heureDebut, heureFin, jours } = this._sleepConfig

    // Check if today is a sleep day
    if (jours && Array.isArray(jours) && jours.length > 0) {
      const dayOfWeek = now.getDay()
      if (!jours.includes(dayOfWeek)) {
        return false  // Not a sleep day
      }
    }

    // Check time range
    if (heureDebut && heureFin) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      
      const [startH, startM] = heureDebut.split(':').map(Number)
      const startMinutes = startH * 60 + startM
      
      const [endH, endM] = heureFin.split(':').map(Number)
      const endMinutes = endH * 60 + endM

      // Handle overnight sleep (e.g., 22:00 to 06:00)
      if (startMinutes > endMinutes) {
        // Sleep spans midnight
        return currentMinutes >= startMinutes || currentMinutes < endMinutes
      } else {
        // Sleep within same day
        return currentMinutes >= startMinutes && currentMinutes < endMinutes
      }
    }

    return false
  }

  /**
   * Enter sleep mode
   */
  enterSleepMode() {
    this._log.info('sleep-manager', 'Entering sleep mode')
    this._isSleeping = true

    // Fade to black
    this.applyLuminosity(0, true)

    // Stop media playback
    if (window.mediaPlayer) {
      window.mediaPlayer.stop()
    }

    // Hide content, show sleep indicator if desired
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.style.opacity = '0'
    }
  }

  /**
   * Exit sleep mode
   */
  exitSleepMode() {
    this._log.info('sleep-manager', 'Exiting sleep mode')
    this._isSleeping = false

    // Restore luminosity
    const targetLuminosity = window.diapoManager?.ecranConfig?.luminosite || 100
    this.applyLuminosity(targetLuminosity, true)

    // Show content
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.style.opacity = '1'
    }

    // Resume media playback
    if (window.mediaPlayer) {
      window.mediaPlayer.start()
    }
  }

  /**
   * Apply luminosity to screen
   * @param {number} value - Luminosity value (0-100)
   * @param {boolean} animate - Whether to animate the change
   */
  applyLuminosity(value, animate = false) {
    this._log.debug('sleep-manager', 'Applying luminosity:', value)
    this._currentLuminosity = value

    // Create or get overlay
    let overlay = document.getElementById('luminosity-overlay')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.id = 'luminosity-overlay'
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: black;
        pointer-events: none;
        z-index: 9999;
      `
      document.body.appendChild(overlay)
    }

    // Calculate opacity (inverse of luminosity)
    const opacity = 1 - (value / 100)
    
    if (animate) {
      overlay.style.transition = 'opacity 1s ease-in-out'
    } else {
      overlay.style.transition = 'none'
    }
    
    overlay.style.opacity = opacity.toString()
  }

  /**
   * Get current sleep state
   */
  get isSleeping() {
    return this._isSleeping
  }

  /**
   * Get current night mode state
   */
  get isNightMode() {
    return this._isNightMode
  }

  /**
   * Get current luminosity
   */
  get luminosity() {
    return this._currentLuminosity
  }

  /**
   * Force wakeup (e.g., on user interaction)
   */
  forceWakeup() {
    if (this._isSleeping) {
      this._log.info('sleep-manager', 'Forced wakeup')
      this.exitSleepMode()
    }
  }

  /**
   * Force night mode check (useful after config update)
   */
  checkNightMode() {
    this._updateNightModeConfig()
    this._checkNightModeStatus()
  }

  /**
   * Stop the manager
   */
  stop() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval)
      this._checkInterval = null
    }
  }
}

// Singleton instance
window.sleepManager = new SleepManager()
