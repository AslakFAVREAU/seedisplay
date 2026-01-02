/**
 * DebugOverlay.js - Affichage des informations de diagnostic
 * 
 * Fonctionnalités :
 * - Overlay semi-transparent avec infos système
 * - Raccourci clavier D pour toggle
 * - Raccourci clavier C pour écran de configuration
 * - Mise à jour en temps réel
 */

class DebugOverlay {
    constructor() {
        this.visible = false;
        this.configMode = false;
        this.overlay = null;
        this.configPanel = null;
        this.updateInterval = null;
        this.startTime = Date.now();
        
        this._log = window.logger 
            ? (level, tag, msg) => window.logger[level](tag, msg)
            : (level, tag, msg) => console[level](`[${tag}] ${msg}`);
        
        this._initKeyboardShortcuts();
        this._log('info', 'debug', 'DebugOverlay initialized - Press D to toggle, C for config');
    }
    
    /**
     * Initialise les raccourcis clavier
     */
    _initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignorer si on est dans un input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.altKey) {
                this.toggle();
            }
            
            if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.altKey) {
                this.toggleConfig();
            }
            
            // Escape ferme tout
            if (e.key === 'Escape') {
                if (this.configMode) this.hideConfig();
                if (this.visible) this.hide();
            }
        });
    }
    
    /**
     * Toggle l'overlay debug
     */
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    /**
     * Affiche l'overlay debug
     */
    show() {
        if (!this.overlay) {
            this._createOverlay();
        }
        this.overlay.style.display = 'block';
        this.visible = true;
        this._startUpdates();
        this._log('info', 'debug', 'Debug overlay shown');
    }
    
    /**
     * Cache l'overlay debug
     */
    hide() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
        this.visible = false;
        this._stopUpdates();
        this._log('info', 'debug', 'Debug overlay hidden');
    }
    
    /**
     * Toggle le panneau de configuration
     */
    toggleConfig() {
        if (this.configMode) {
            this.hideConfig();
        } else {
            this.showConfig();
        }
    }
    
    /**
     * Affiche le panneau de configuration
     */
    showConfig() {
        if (!this.configPanel) {
            this._createConfigPanel();
        }
        this._populateConfigForm();
        this.configPanel.style.display = 'flex';
        this.configMode = true;
        this._log('info', 'debug', 'Config panel shown');
    }
    
    /**
     * Cache le panneau de configuration
     */
    hideConfig() {
        if (this.configPanel) {
            this.configPanel.style.display = 'none';
        }
        this.configMode = false;
        this._log('info', 'debug', 'Config panel hidden');
    }
    
    /**
     * Crée l'overlay HTML
     */
    _createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'debug-overlay';
        this.overlay.innerHTML = `
            <div class="debug-header">
                <span class="debug-title">🔧 Debug Mode</span>
                <span class="debug-close" onclick="window.debugOverlay.hide()">×</span>
            </div>
            <div class="debug-content">
                <div class="debug-section">
                    <div class="debug-label">Version</div>
                    <div class="debug-value" id="debug-version">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">ID Écran</div>
                    <div class="debug-value" id="debug-ecran-id">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Environnement</div>
                    <div class="debug-value" id="debug-env">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Heure Locale</div>
                    <div class="debug-value" id="debug-local-time">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Heure Serveur</div>
                    <div class="debug-value" id="debug-server-time">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Uptime</div>
                    <div class="debug-value" id="debug-uptime">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Statut API</div>
                    <div class="debug-value" id="debug-api-status">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Mode Écran</div>
                    <div class="debug-value" id="debug-screen-mode">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Prochain Réveil</div>
                    <div class="debug-value" id="debug-next-wakeup">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Prochain Refresh</div>
                    <div class="debug-value" id="debug-next-refresh">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Cache Offline</div>
                    <div class="debug-value" id="debug-cache-status">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Médias</div>
                    <div class="debug-value" id="debug-media-count">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Planning</div>
                    <div class="debug-value" id="debug-planning">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Mode Nuit</div>
                    <div class="debug-value" id="debug-night-mode">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Programmation</div>
                    <div class="debug-value" id="debug-schedule">-</div>
                </div>
            </div>
            <div class="debug-footer">
                <span>Appuyez sur <kbd>D</kbd> pour fermer</span>
                <span>Appuyez sur <kbd>C</kbd> pour configurer</span>
            </div>
        `;
        
        this._injectStyles();
        document.body.appendChild(this.overlay);
    }
    
    /**
     * Crée le panneau de configuration
     */
    _createConfigPanel() {
        this.configPanel = document.createElement('div');
        this.configPanel.id = 'config-panel';
        this.configPanel.innerHTML = `
            <div class="config-dialog">
                <div class="config-header">
                    <span class="config-title">⚙️ Configuration Écran</span>
                    <span class="config-close" onclick="window.debugOverlay.hideConfig()">×</span>
                </div>
                <div class="config-content">
                    <div class="config-group">
                        <label for="config-id-ecran">ID Écran</label>
                        <input type="number" id="config-id-ecran" min="1" />
                    </div>
                    <div class="config-group">
                        <label for="config-env">Environnement</label>
                        <select id="config-env">
                            <option value="prod">Production (soek.fr)</option>
                            <option value="local">Local (localhost:8000)</option>
                        </select>
                    </div>
                    <div class="config-group">
                        <label for="config-meteo">Météo</label>
                        <input type="checkbox" id="config-meteo" />
                    </div>
                    <div class="config-group">
                        <label for="config-meteo-lat">Latitude</label>
                        <input type="number" id="config-meteo-lat" step="0.0001" />
                    </div>
                    <div class="config-group">
                        <label for="config-meteo-lon">Longitude</label>
                        <input type="number" id="config-meteo-lon" step="0.0001" />
                    </div>
                    <div class="config-group">
                        <label for="config-logo">Logo SOE</label>
                        <input type="checkbox" id="config-logo" />
                    </div>
                    <div class="config-group">
                        <label for="config-week-no">Numéro Semaine</label>
                        <input type="checkbox" id="config-week-no" />
                    </div>
                </div>
                <div class="config-footer">
                    <button class="config-btn config-btn-cancel" onclick="window.debugOverlay.hideConfig()">Annuler</button>
                    <button class="config-btn config-btn-save" onclick="window.debugOverlay.saveConfig()">Sauvegarder & Redémarrer</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.configPanel);
    }
    
    /**
     * Remplit le formulaire de configuration avec les valeurs actuelles
     */
    _populateConfigForm() {
        const config = window.configSEE || {};
        
        document.getElementById('config-id-ecran').value = config.idEcran || 1;
        document.getElementById('config-env').value = config.env || 'prod';
        document.getElementById('config-meteo').checked = config.meteo !== false;
        document.getElementById('config-meteo-lat').value = config.meteoLat || 48.8566;
        document.getElementById('config-meteo-lon').value = config.meteoLon || 2.3522;
        document.getElementById('config-logo').checked = config.logoSOE !== false;
        document.getElementById('config-week-no').checked = config.weekNo !== false;
    }
    
    /**
     * Sauvegarde la configuration
     */
    async saveConfig() {
        const newConfig = {
            idEcran: parseInt(document.getElementById('config-id-ecran').value) || 1,
            env: document.getElementById('config-env').value,
            meteo: document.getElementById('config-meteo').checked,
            meteoLat: parseFloat(document.getElementById('config-meteo-lat').value) || 48.8566,
            meteoLon: parseFloat(document.getElementById('config-meteo-lon').value) || 2.3522,
            meteoUnits: 'metric',
            logoSOE: document.getElementById('config-logo').checked,
            weekNo: document.getElementById('config-week-no').checked,
            weekType: window.configSEE?.weekType || false,
            weekDisplay: window.configSEE?.weekDisplay !== false
        };
        
        this._log('info', 'debug', 'Saving config: ' + JSON.stringify(newConfig));
        
        try {
            // Sauvegarder via preload API
            if (window.api && window.api.writeFile) {
                const configJson = JSON.stringify(newConfig, null, 2);
                await window.api.writeFile('configSEE.json', configJson);
                this._log('info', 'debug', 'Config saved successfully');
                
                // Recharger l'application
                alert('Configuration sauvegardée ! L\'application va redémarrer.');
                window.location.reload();
            } else {
                throw new Error('writeFile API not available');
            }
        } catch (error) {
            this._log('error', 'debug', 'Failed to save config: ' + error.message);
            alert('Erreur lors de la sauvegarde : ' + error.message);
        }
    }
    
    /**
     * Injecte les styles CSS
     */
    _injectStyles() {
        if (document.getElementById('debug-overlay-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'debug-overlay-styles';
        style.textContent = `
            #debug-overlay {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 320px;
                background: rgba(0, 0, 0, 0.85);
                color: #fff;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 12px;
                border-radius: 8px;
                z-index: 99999;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                display: none;
            }
            
            .debug-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 15px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 8px 8px 0 0;
            }
            
            .debug-title {
                font-weight: bold;
                font-size: 14px;
            }
            
            .debug-close {
                cursor: pointer;
                font-size: 20px;
                opacity: 0.7;
            }
            
            .debug-close:hover {
                opacity: 1;
            }
            
            .debug-content {
                padding: 10px 15px;
                max-height: 400px;
                overflow-y: auto;
            }
            
            .debug-section {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .debug-section:last-child {
                border-bottom: none;
            }
            
            .debug-label {
                color: #888;
            }
            
            .debug-value {
                font-weight: 600;
                text-align: right;
            }
            
            .debug-value.ok { color: #4caf50; }
            .debug-value.warning { color: #ff9800; }
            .debug-value.error { color: #f44336; }
            
            .debug-footer {
                display: flex;
                justify-content: space-between;
                padding: 8px 15px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 0 0 8px 8px;
                font-size: 10px;
                color: #666;
            }
            
            .debug-footer kbd {
                background: rgba(255, 255, 255, 0.2);
                padding: 2px 6px;
                border-radius: 3px;
            }
            
            /* Config Panel */
            #config-panel {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 100000;
            }
            
            .config-dialog {
                background: #fff;
                border-radius: 12px;
                width: 400px;
                max-width: 90vw;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            }
            
            .config-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background: #f5f5f5;
                border-radius: 12px 12px 0 0;
            }
            
            .config-title {
                font-weight: bold;
                font-size: 18px;
                color: #333;
            }
            
            .config-close {
                cursor: pointer;
                font-size: 24px;
                color: #999;
            }
            
            .config-close:hover {
                color: #333;
            }
            
            .config-content {
                padding: 20px;
            }
            
            .config-group {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            
            .config-group label {
                font-weight: 500;
                color: #333;
            }
            
            .config-group input[type="number"],
            .config-group select {
                width: 150px;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
            }
            
            .config-group input[type="checkbox"] {
                width: 20px;
                height: 20px;
            }
            
            .config-footer {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 15px 20px;
                background: #f5f5f5;
                border-radius: 0 0 12px 12px;
            }
            
            .config-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                font-weight: 500;
            }
            
            .config-btn-cancel {
                background: #e0e0e0;
                color: #333;
            }
            
            .config-btn-save {
                background: #0866C6;
                color: #fff;
            }
            
            .config-btn:hover {
                opacity: 0.9;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Démarre les mises à jour périodiques
     */
    _startUpdates() {
        this._updateValues();
        this.updateInterval = setInterval(() => this._updateValues(), 1000);
    }
    
    /**
     * Arrête les mises à jour
     */
    _stopUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    /**
     * Met à jour toutes les valeurs affichées
     */
    _updateValues() {
        const config = window.configSEE || {};
        const apiResponse = window.apiV2Response || {};
        
        // Version
        this._setValue('debug-version', 'v1.9.3');
        
        // ID Écran
        this._setValue('debug-ecran-id', '#' + (config.idEcran || window.idEcran || '?'));
        
        // Environnement
        const env = config.env || 'prod';
        this._setValue('debug-env', env === 'local' ? 'Local' : 'Production', env === 'local' ? 'warning' : 'ok');
        
        // Heure locale
        this._setValue('debug-local-time', new Date().toLocaleTimeString('fr-FR'));
        
        // Heure serveur
        if (apiResponse.serverTime) {
            const serverTime = new Date(apiResponse.serverTime).toLocaleTimeString('fr-FR');
            this._setValue('debug-server-time', serverTime);
        } else {
            this._setValue('debug-server-time', '-', 'warning');
        }
        
        // Uptime
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        this._setValue('debug-uptime', this._formatDuration(uptime));
        
        // Statut API
        if (window.apiManager) {
            const lastError = window.apiManager.lastError;
            if (lastError) {
                this._setValue('debug-api-status', 'Erreur', 'error');
            } else {
                this._setValue('debug-api-status', 'OK', 'ok');
            }
        } else {
            this._setValue('debug-api-status', '-');
        }
        
        // Mode Écran (sleep ou active)
        const screenStatus = window.screenStatus || apiResponse.status || 'active';
        if (screenStatus === 'sleep') {
            this._setValue('debug-screen-mode', '😴 Sleep', 'warning');
        } else {
            this._setValue('debug-screen-mode', '✅ Actif', 'ok');
        }
        
        // Prochain réveil (si en mode sleep)
        if (screenStatus === 'sleep' && window.prochainDemarrage) {
            this._setValue('debug-next-wakeup', window.prochainDemarrage, 'warning');
        } else if (apiResponse.prochainDemarrage) {
            this._setValue('debug-next-wakeup', apiResponse.prochainDemarrage);
        } else {
            this._setValue('debug-next-wakeup', '-');
        }
        
        // Prochain refresh
        const refreshInterval = window.refreshInterval || 300;
        if (screenStatus === 'sleep') {
            // En mode sleep: refresh toutes les 5 min
            this._setValue('debug-next-refresh', '5 min (sleep)');
        } else {
            this._setValue('debug-next-refresh', this._formatDuration(refreshInterval));
        }
        
        // Cache offline
        if (window.apiCache) {
            const cacheCount = window.apiCache.getEntryCount ? window.apiCache.getEntryCount() : '?';
            this._setValue('debug-cache-status', cacheCount + ' entrées', 'ok');
        } else {
            this._setValue('debug-cache-status', 'Non disponible', 'warning');
        }
        
        // Médias
        if (window.ArrayDiapo && window.ArrayDiapo.length > 0) {
            this._setValue('debug-media-count', window.ArrayDiapo.length + ' médias');
        } else if (window.ArrayImg && window.ArrayImg.length > 0) {
            this._setValue('debug-media-count', window.ArrayImg.length + ' médias');
        } else {
            this._setValue('debug-media-count', '0 médias', 'warning');
        }
        
        // Planning
        const planningConfig = window.planningConfig || (apiResponse.config && apiResponse.config.planning) || apiResponse.planning;
        if (planningConfig && planningConfig.actif) {
            const position = planningConfig.position || 'footer';
            this._setValue('debug-planning', '✅ ' + position, 'ok');
        } else {
            this._setValue('debug-planning', 'Désactivé');
        }
        
        // Mode nuit
        if (apiResponse.modeNuit && apiResponse.modeNuit.actif) {
            const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const debut = apiResponse.modeNuit.heureDebut;
            const fin = apiResponse.modeNuit.heureFin;
            const isNight = this._isInNightMode(debut, fin, now);
            this._setValue('debug-night-mode', isNight ? 'Actif' : 'Inactif (' + debut + '-' + fin + ')', isNight ? 'warning' : 'ok');
        } else {
            this._setValue('debug-night-mode', 'Désactivé');
        }
        
        // Programmation
        if (apiResponse.programmation && apiResponse.programmation.active) {
            const prog = apiResponse.programmation;
            this._setValue('debug-schedule', prog.heureDemarrage + ' - ' + prog.heureExtinction);
        } else {
            this._setValue('debug-schedule', 'Désactivée');
        }
    }
    
    /**
     * Met à jour une valeur dans l'overlay
     */
    _setValue(id, value, className = '') {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
            el.className = 'debug-value' + (className ? ' ' + className : '');
        }
    }
    
    /**
     * Formate une durée en secondes
     */
    _formatDuration(seconds) {
        if (seconds < 60) return seconds + 's';
        if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h + 'h ' + m + 'm';
    }
    
    /**
     * Vérifie si on est en mode nuit
     */
    _isInNightMode(debut, fin, now) {
        if (debut > fin) {
            // Nuit chevauche minuit
            return now >= debut || now < fin;
        }
        return now >= debut && now < fin;
    }
}

// Initialisation globale
window.debugOverlay = new DebugOverlay();
