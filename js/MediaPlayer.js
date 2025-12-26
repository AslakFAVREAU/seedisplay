/**
 * MediaPlayer - Media playback with preloading and smooth transitions
 * 
 * Responsibilities:
 * - Double-buffer display (2 divs for smooth transitions)
 * - Preload next media while current is playing
 * - Handle images, videos, and iframes
 * - CSS-based transitions
 * - Fallback to default screen when no media
 */

class MediaPlayer {
  constructor(options = {}) {
    this._options = {
      containerA: options.containerA || 'imgShow',      // First image container
      containerB: options.containerB || 'imgShowLoad',  // Second image container (preload)
      videoContainerA: options.videoContainerA || 'player1',
      videoContainerB: options.videoContainerB || 'player2',
      transitionDuration: options.transitionDuration || 500,  // ms
      defaultDuration: options.defaultDuration || 10,         // seconds
      ...options
    }

    this._timeline = []
    this._currentIndex = 0
    this._isPlaying = false
    this._currentTimeout = null
    this._preloadedNext = false
    this._activeBuffer = 'A'  // 'A' or 'B'
    
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
   * Initialize the player with a timeline
   */
  init(timeline) {
    this._log.info('media-player', 'Initializing with', timeline?.length || 0, 'items')
    this._timeline = timeline || []
    this._currentIndex = 0
    this._setupContainers()
    return this
  }

  /**
   * Setup container elements and transitions
   */
  _setupContainers() {
    // Add transition styles if not already present
    const containers = [
      this._options.containerA,
      this._options.containerB,
      this._options.videoContainerA,
      this._options.videoContainerB
    ]

    for (const id of containers) {
      const el = document.getElementById(id)
      if (el) {
        el.style.transition = `opacity ${this._options.transitionDuration}ms ease-in-out`
      }
    }
  }

  /**
   * Get DOM element by ID
   */
  _getElement(id) {
    return document.getElementById(id)
  }

  /**
   * Start playback
   */
  start() {
    if (this._timeline.length === 0) {
      this._log.warn('media-player', 'No media to play, showing default screen')
      this._showDefaultScreen()
      return
    }

    this._log.info('media-player', 'Starting playback')
    this._isPlaying = true
    this._showCurrent()
  }

  /**
   * Stop playback
   */
  stop() {
    this._log.info('media-player', 'Stopping playback')
    this._isPlaying = false
    if (this._currentTimeout) {
      clearTimeout(this._currentTimeout)
      this._currentTimeout = null
    }
  }

  /**
   * Update timeline (e.g., after refresh)
   */
  updateTimeline(timeline) {
    const wasPlaying = this._isPlaying
    this._timeline = timeline || []
    
    this._log.info('media-player', 'Timeline updated:', this._timeline.length, 'items')
    
    if (this._timeline.length === 0) {
      this._showDefaultScreen()
      return
    }

    // Keep current index valid
    if (this._currentIndex >= this._timeline.length) {
      this._currentIndex = 0
    }

    // Continue playing if we were playing
    if (wasPlaying && !this._isPlaying) {
      this.start()
    }
  }

  /**
   * Show current media
   */
  _showCurrent() {
    if (!this._isPlaying || this._timeline.length === 0) {
      return
    }

    const media = this._timeline[this._currentIndex]
    this._log.debug('media-player', 'Showing media', this._currentIndex + 1, '/', this._timeline.length, ':', media.nom)

    // Determine media type and show accordingly
    if (media.type === 'video') {
      this._showVideo(media)
    } else {
      this._showImage(media)
    }

    // Preload next
    this._preloadNext()

    // Schedule transition to next
    const duration = (media.duree || this._options.defaultDuration) * 1000
    this._currentTimeout = setTimeout(() => {
      this._transitionToNext()
    }, duration)
  }

  /**
   * Show an image
   */
  _showImage(media) {
    const activeContainer = this._activeBuffer === 'A' 
      ? this._options.containerA 
      : this._options.containerB
    const inactiveContainer = this._activeBuffer === 'A'
      ? this._options.containerB
      : this._options.containerA

    const activeEl = this._getElement(activeContainer)
    const inactiveEl = this._getElement(inactiveContainer)

    if (!activeEl) {
      this._log.error('media-player', 'Container not found:', activeContainer)
      return
    }

    // Get URL (prefer local cache)
    const url = this._getMediaUrl(media)

    // Set image source
    if (activeEl.tagName === 'IMG') {
      activeEl.src = url
    } else {
      activeEl.style.backgroundImage = `url(${url})`
    }

    // Fade in active, fade out inactive
    activeEl.style.opacity = '1'
    activeEl.style.display = 'block'
    
    if (inactiveEl) {
      inactiveEl.style.opacity = '0'
    }

    // Hide video containers
    this._hideVideos()
  }

  /**
   * Show a video
   */
  _showVideo(media) {
    const activeContainer = this._activeBuffer === 'A'
      ? this._options.videoContainerA
      : this._options.videoContainerB
    const inactiveContainer = this._activeBuffer === 'A'
      ? this._options.videoContainerB
      : this._options.videoContainerA

    const activeEl = this._getElement(activeContainer)
    const inactiveEl = this._getElement(inactiveContainer)

    if (!activeEl) {
      this._log.error('media-player', 'Video container not found:', activeContainer)
      // Fallback to image display
      this._showImage(media)
      return
    }

    const url = this._getMediaUrl(media)

    // Set video source
    activeEl.src = url
    activeEl.muted = true  // Required for autoplay
    activeEl.loop = false
    
    // Show and play
    activeEl.style.display = 'block'
    activeEl.style.opacity = '1'
    activeEl.play().catch(e => {
      this._log.warn('media-player', 'Video autoplay failed:', e.message)
    })

    // Hide inactive video
    if (inactiveEl) {
      inactiveEl.style.opacity = '0'
      inactiveEl.pause()
    }

    // Hide image containers
    this._hideImages()
  }

  /**
   * Hide all image containers
   */
  _hideImages() {
    for (const id of [this._options.containerA, this._options.containerB]) {
      const el = this._getElement(id)
      if (el) el.style.opacity = '0'
    }
  }

  /**
   * Hide all video containers
   */
  _hideVideos() {
    for (const id of [this._options.videoContainerA, this._options.videoContainerB]) {
      const el = this._getElement(id)
      if (el) {
        el.style.opacity = '0'
        el.pause?.()
      }
    }
  }

  /**
   * Preload next media
   */
  _preloadNext() {
    const nextIndex = (this._currentIndex + 1) % this._timeline.length
    const nextMedia = this._timeline[nextIndex]
    
    if (!nextMedia) return

    this._log.debug('media-player', 'Preloading next:', nextMedia.nom)

    const nextBuffer = this._activeBuffer === 'A' ? 'B' : 'A'
    const url = this._getMediaUrl(nextMedia)

    if (nextMedia.type === 'video') {
      // Preload video in hidden container
      const container = nextBuffer === 'A'
        ? this._options.videoContainerA
        : this._options.videoContainerB
      const el = this._getElement(container)
      if (el) {
        el.src = url
        el.load()
      }
    } else {
      // Preload image
      const container = nextBuffer === 'A'
        ? this._options.containerA
        : this._options.containerB
      const el = this._getElement(container)
      if (el) {
        if (el.tagName === 'IMG') {
          el.src = url
        } else {
          // Use Image object for background preload
          const img = new Image()
          img.src = url
        }
      }
    }

    this._preloadedNext = true
  }

  /**
   * Transition to next media
   */
  _transitionToNext() {
    if (!this._isPlaying) return

    // Swap buffers
    this._activeBuffer = this._activeBuffer === 'A' ? 'B' : 'A'
    
    // Advance index
    this._currentIndex = (this._currentIndex + 1) % this._timeline.length
    this._preloadedNext = false

    // Show next media
    this._showCurrent()
  }

  /**
   * Get media URL (local cache preferred)
   */
  _getMediaUrl(media) {
    const filename = media.nom
    
    // Check if local file exists
    if (window.api?.existsSync && window.api.existsSync('media/' + filename)) {
      // Return file:// URL for local file
      return 'file:///C:/SEE/media/' + filename
    }
    
    // Fall back to remote URL
    return media.url || (window.configManager?.mediaBaseUrl || 'https://soek.fr/uploads/see/media/') + filename
  }

  /**
   * Show default screen (no media available)
   */
  _showDefaultScreen() {
    this._log.info('media-player', 'Showing default screen')
    
    // Call existing defaultScreen function if available
    if (typeof window.defaultScreen === 'function') {
      window.defaultScreen()
    } else if (typeof defaultScreen === 'function') {
      defaultScreen()
    }
  }

  /**
   * Skip to next media immediately
   */
  next() {
    if (this._currentTimeout) {
      clearTimeout(this._currentTimeout)
    }
    this._transitionToNext()
  }

  /**
   * Skip to previous media
   */
  previous() {
    if (this._currentTimeout) {
      clearTimeout(this._currentTimeout)
    }
    
    this._currentIndex = (this._currentIndex - 1 + this._timeline.length) % this._timeline.length
    this._showCurrent()
  }

  /**
   * Get current media info
   */
  get currentMedia() {
    return this._timeline[this._currentIndex] || null
  }

  /**
   * Get playback state
   */
  get isPlaying() {
    return this._isPlaying
  }

  /**
   * Get timeline length
   */
  get length() {
    return this._timeline.length
  }
}

// Singleton instance
window.mediaPlayer = new MediaPlayer()
