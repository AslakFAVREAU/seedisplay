/**
 * HeartbeatManager - Envoi régulier du statut écran vers SOEK
 * 
 * Envoie toutes les 30 secondes:
 * - Infos écran (version, uptime, statut)
 * - Debug info (médias, cache, luminosité, etc.)
 * - Screenshot miniature adaptatif (1280x720 paysage ou 720x1280 portrait)
 */

class HeartbeatManager {
    constructor(options = {}) {
        this._interval = options.interval || 7000; // 7 secondes par défaut
        this._apiToken = options.apiToken || null;
        this._ecranUuid = options.ecranUuid || null;
        this._env = options.env || 'beta';
        this._updateChannel = options.updateChannel || 'stable';
        this._enabled = true;
        this._timer = null;
        this._startTime = Date.now();
        this._lastSent = null;
        this._screenshotWidth = 1280;  // default landscape
        this._screenshotHeight = 720;
        this._isPortrait = false;
        
        this._log = window.logger || {
            info: (tag, ...args) => console.log(`[${tag}]`, ...args),
            warn: (tag, ...args) => console.warn(`[${tag}]`, ...args),
            error: (tag, ...args) => console.error(`[${tag}]`, ...args),
            debug: (tag, ...args) => console.debug(`[${tag}]`, ...args)
        };
    }

    /**
     * Initialise le manager avec la config
     */
    init(config) {
        this._apiToken = config.apiToken || this._apiToken;
        this._ecranUuid = config.ecranUuid || config.idEcran || this._ecranUuid;
        this._env = config.env || this._env;
        this._updateChannel = config.updateChannel || this._updateChannel || 'stable';
        
        // Detect portrait mode from init config, window state, or persisted config
        this._detectOrientation(config);
        
        if (!this._ecranUuid) {
            this._log.warn('heartbeat', 'No ecranUuid configured, heartbeat disabled');
            return;
        }
        
        this._log.info('heartbeat', `Initialized for ecran ${this._ecranUuid}, interval=${this._interval}ms, screenshot=${this._screenshotWidth}x${this._screenshotHeight} (${this._isPortrait ? 'portrait' : 'landscape'})`);
    }

    /**
     * Détecte l'orientation de l'écran et ajuste les dimensions du screenshot
     * Sources (par priorité) :
     *   1. window.screenDimensions (set par applyScreenDimensions après appel API)
     *   2. configManager (persisté dans configSEE.json)
     *   3. Dimensions custom (width < height → portrait)
     */
    _detectOrientation(initConfig) {
        let orientation = null;
        let w = null;
        let h = null;

        // 0) Config passed directly at init (highest priority — always available)
        if (initConfig) {
            orientation = initConfig.screenOrientation || null;
            w = initConfig.screenWidth || null;
            h = initConfig.screenHeight || null;
        }

        // 1) Live API data (overrides if available)
        if (window.screenDimensions) {
            orientation = window.screenDimensions.orientation || orientation;
            w = window.screenDimensions.width || w;
            h = window.screenDimensions.height || h;
        }

        // 2) Persisted config
        if (!orientation && window.configManager && window.configManager.isLoaded) {
            try {
                const cfg = window.configManager.config;
                orientation = cfg.screenOrientation || null;
                w = w || cfg.screenWidth;
                h = h || cfg.screenHeight;
            } catch (e) {
                // ConfigManager not ready yet, skip
            }
        }

        // If no data found at all, keep existing settings (don't regress)
        if (!orientation && !w && !h) {
            this._log.debug('heartbeat', `Orientation: no new data, keeping current (${this._isPortrait ? 'portrait' : 'landscape'} ${this._screenshotWidth}x${this._screenshotHeight})`);
            return;
        }

        // Determine portrait: explicit orientation string or width < height
        const isPortraitByOrientation = orientation && orientation.toLowerCase() === 'portrait';
        const isPortraitByDimensions = w && h && h > w;
        this._isPortrait = isPortraitByOrientation || isPortraitByDimensions;

        if (this._isPortrait) {
            this._screenshotWidth = 720;
            this._screenshotHeight = 1280;
        } else {
            this._screenshotWidth = 1280;
            this._screenshotHeight = 720;
        }

        this._log.debug('heartbeat', `Orientation detected: ${this._isPortrait ? 'portrait' : 'landscape'} (orientation=${orientation}, dims=${w}x${h}) → screenshot ${this._screenshotWidth}x${this._screenshotHeight}`);
    }

    /**
     * Démarre l'envoi périodique
     */
    start() {
        if (this._timer) {
            this.stop();
        }
        
        if (!this._ecranUuid) {
            this._log.warn('heartbeat', 'Cannot start: no ecranUuid');
            return;
        }
        
        // Re-detect orientation in case API data arrived after init
        this._detectOrientation();
        
        this._log.info('heartbeat', 'Starting heartbeat...');
        
        // Premier envoi après 10 secondes (laisser l'app s'initialiser)
        setTimeout(() => {
            this._sendHeartbeat();
        }, 10000);
        
        // Puis toutes les 30 secondes
        this._timer = setInterval(() => {
            this._sendHeartbeat();
        }, this._interval);
    }

    /**
     * Arrête l'envoi
     */
    stop() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
            this._log.info('heartbeat', 'Stopped');
        }
    }

    /**
     * Active/désactive temporairement
     */
    setEnabled(enabled) {
        this._enabled = enabled;
        this._log.info('heartbeat', `Enabled: ${enabled}`);
    }

    /**
     * Collecte toutes les infos de debug
     */
    _collectDebugInfo() {
        const debug = {
            // Infos médias
            mediaCount: 0,
            currentMedia: null,
            
            // Cache
            cacheStatus: 'unknown',
            cacheEntries: 0,
            
            // Affichage
            screenStatus: 'active',
            luminosite: window.luminosite || 100,
            sonActif: window.sonActif || false,
            
            // Mode nuit/sleep
            nightMode: false,
            nightModeType: null,
            sleepMode: false,
            
            // Planning
            planningActive: false,
            
            // API health
            apiConsecutiveErrors: window.apiConsecutiveErrors || 0,
            
            // Mémoire (si disponible)
            memoryUsage: null
        };
        
        // Médias
        if (window.ArrayDiapo && window.ArrayDiapo.length > 0) {
            debug.mediaCount = window.ArrayDiapo.length;
        } else if (window.ArrayImg && window.ArrayImg.length > 0) {
            debug.mediaCount = window.ArrayImg.length;
        }
        
        // Média courant
        if (typeof window.currentMediaIndex !== 'undefined' && window.ArrayDiapo) {
            const current = window.ArrayDiapo[window.currentMediaIndex];
            if (current) {
                debug.currentMedia = current.file || current.media || 'unknown';
            }
        }
        
        // Cache
        if (window.apiCache) {
            debug.cacheStatus = 'ok';
            debug.cacheEntries = window.apiCache.getEntryCount ? window.apiCache.getEntryCount() : 0;
        }
        
        // Statut écran (getters, pas des fonctions)
        if (window.sleepManager) {
            debug.sleepMode = window.sleepManager.isSleeping || false;
            debug.nightMode = window.sleepManager.isNightMode || false;
            // Night mode type (fixe / auto) from API response
            const modeNuit = window.apiV2Response?.modeNuit;
            if (modeNuit?.actif) {
                debug.nightModeType = modeNuit.type || 'fixe';
            }
        }
        
        // Planning (isVisible est une propriété)
        if (window.planningManager) {
            debug.planningActive = window.planningManager.isVisible || false;
        }
        
        // Mémoire (Electron/Node)
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const mem = process.memoryUsage();
            debug.memoryUsage = Math.round(mem.heapUsed / mem.heapTotal * 100);
        }
        
        // Statut global
        if (debug.sleepMode) {
            debug.screenStatus = 'sleep';
        } else if (debug.nightMode) {
            debug.screenStatus = 'night';
        }
        
        return debug;
    }

    /**
     * Capture un screenshot 720p via Electron
     */
    async _captureScreenshot() {
        try {
            // Utiliser l'API preload si disponible
            if (window.api && window.api.captureScreen) {
                const dataUrl = await window.api.captureScreen(this._screenshotWidth, this._screenshotHeight);
                return dataUrl;
            }
            
            // Fallback: essayer via IPC direct (si dans contexte Electron)
            if (window.electronAPI && window.electronAPI.captureScreen) {
                const dataUrl = await window.electronAPI.captureScreen(this._screenshotWidth, this._screenshotHeight);
                return dataUrl;
            }
            
            this._log.debug('heartbeat', 'Screenshot capture not available');
            return null;
        } catch (e) {
            this._log.error('heartbeat', 'Screenshot capture failed:', e.message);
            return null;
        }
    }

    /**
     * Envoie le heartbeat au serveur
     */
    async _sendHeartbeat() {
        if (!this._enabled || !this._ecranUuid) {
            return;
        }
        
        try {
            // Collecter les infos
            const debug = this._collectDebugInfo();
            
            // Capturer le screenshot
            const screenshot = await this._captureScreenshot();
            
            // Récupérer infos système (IP locale, résolution, fréquence)
            let localIp = null;
            let screenResolution = null;
            let screenRefreshRate = null;
            try {
                if (window.api && typeof window.api.getSystemInfo === 'function') {
                    const sysInfo = await window.api.getSystemInfo();
                    localIp = sysInfo.localIP || null;
                    if (sysInfo.screen) {
                        screenResolution = `${sysInfo.screen.width}x${sysInfo.screen.height}`;
                        screenRefreshRate = sysInfo.screen.refreshRate || null;
                    }
                }
            } catch (e) {
                this._log.debug('heartbeat', 'Could not get system info:', e.message);
            }
            
            // Construire le payload
            const payload = {
                ecranUuid: this._ecranUuid,
                version: window.appVersion || (window.api && window.api.getAppVersion ? await window.api.getAppVersion() : 'unknown'),
                updateChannel: this._updateChannel || 'stable',
                timestamp: new Date().toISOString(),
                uptime: Math.round((Date.now() - this._startTime) / 1000),
                localIp: localIp,
                screenResolution: screenResolution,
                screenRefreshRate: screenRefreshRate,
                debug: debug,
                screenshot: screenshot  // base64 ou null
            };
            
            // Déterminer l'URL selon l'environnement
            const baseUrl = this._getBaseUrl();
            const url = `${baseUrl}/see/API/heartbeat/${this._ecranUuid}`;
            
            // Envoyer
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Token': this._apiToken || ''
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                this._lastSent = Date.now();
                this._log.debug('heartbeat', `Sent successfully (${screenshot ? 'with' : 'without'} screenshot)`);
            } else {
                this._log.warn('heartbeat', `Server responded ${response.status}`);
            }
        } catch (e) {
            this._log.error('heartbeat', 'Send failed:', e.message);
        }
    }

    /**
     * Retourne l'URL de base selon l'environnement
     */
    _getBaseUrl() {
        switch (this._env) {
            case 'prod':
            case 'soek':
                return 'https://soek.fr';
            case 'beta':
                return 'https://beta.soek.fr';
            case 'localhost':
            case 'local':
                return 'http://localhost:8000';
            default:
                return 'https://beta.soek.fr';
        }
    }

    /**
     * Retourne le statut du manager
     */
    getStatus() {
        return {
            enabled: this._enabled,
            running: this._timer !== null,
            interval: this._interval,
            lastSent: this._lastSent,
            uptime: Math.round((Date.now() - this._startTime) / 1000)
        };
    }
}

// Export pour utilisation globale
window.HeartbeatManager = HeartbeatManager;
