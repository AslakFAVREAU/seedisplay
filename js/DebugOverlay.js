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
        this.updateStatus = { checking: false, available: false, downloading: false, progress: 0, error: null, version: null };
        
        // Auto-close timers (1 minute = 60000ms)
        this.autoCloseDelay = 60000;
        this.debugAutoCloseTimer = null;
        this.configAutoCloseTimer = null;
        this.debugPinned = false;
        this.configPinned = false;
        
        this._log = window.logger 
            ? (level, tag, msg) => window.logger[level](tag, msg)
            : (level, tag, msg) => console[level](`[${tag}] ${msg}`);
        
        this._initKeyboardShortcuts();
        this._initUpdateListener();
        this._log('info', 'debug', 'DebugOverlay initialized - Press D to toggle, C for config');
    }
    
    /**
     * Initialise le listener pour les statuts de mise à jour
     */
    _initUpdateListener() {
        if (window.api && window.api.onUpdateStatus) {
            window.api.onUpdateStatus((status) => {
                this._log('info', 'debug', 'Update status received: ' + JSON.stringify(status));
                this.updateStatus = status;
                this._updateUpdateStatusDisplay();
            });
        }
    }
    
    /**
     * Met à jour l'affichage du statut de mise à jour
     */
    _updateUpdateStatusDisplay() {
        const statusEl = document.getElementById('config-update-status');
        const btnEl = document.getElementById('config-check-update');
        if (!statusEl) return;
        
        if (this.updateStatus.checking) {
            statusEl.textContent = '🔍 Vérification en cours...';
            if (btnEl) btnEl.disabled = true;
        } else if (this.updateStatus.downloading) {
            statusEl.textContent = `⬇️ Téléchargement ${this.updateStatus.progress}%`;
            if (btnEl) btnEl.disabled = true;
        } else if (this.updateStatus.error) {
            statusEl.textContent = `❌ ${this.updateStatus.error}`;
            if (btnEl) btnEl.disabled = false;
        } else if (this.updateStatus.available) {
            statusEl.textContent = `✅ v${this.updateStatus.version} disponible`;
            if (btnEl) btnEl.disabled = false;
        } else {
            statusEl.textContent = '✅ À jour';
            if (btnEl) btnEl.disabled = false;
        }
    }
    
    /**
     * Vérifie manuellement les mises à jour
     */
    async checkForUpdates() {
        this._log('info', 'debug', 'Manual update check requested');
        const statusEl = document.getElementById('config-update-status');
        const btnEl = document.getElementById('config-check-update');
        
        if (statusEl) statusEl.textContent = '🔍 Vérification en cours...';
        if (btnEl) btnEl.disabled = true;
        
        try {
            this._log('info', 'debug', 'Checking if window.api.checkForUpdates exists: ' + (window.api && typeof window.api.checkForUpdates));
            if (window.api && window.api.checkForUpdates) {
                // Récupérer la version actuelle pour comparaison
                const currentVersion = await window.api?.getAppVersion?.() || '0.0.0';
                this._log('info', 'debug', 'Current app version: ' + currentVersion);
                
                this._log('info', 'debug', 'Calling window.api.checkForUpdates()...');
                const result = await window.api.checkForUpdates();
                this._log('info', 'debug', 'Update check result: ' + JSON.stringify(result));
                
                if (result && result.success) {
                    if (result.updateInfo && result.updateInfo.version) {
                        const serverVersion = result.updateInfo.version;
                        // Comparer les versions - si identiques, on est à jour
                        if (serverVersion === currentVersion) {
                            if (statusEl) statusEl.textContent = '✅ Vous êtes à jour (v' + currentVersion + ')';
                            this._log('info', 'debug', 'Already on latest version: ' + currentVersion);
                        } else {
                            if (statusEl) statusEl.textContent = `✅ v${serverVersion} disponible - téléchargement...`;
                            this._log('info', 'debug', 'Update available: ' + serverVersion + ' (current: ' + currentVersion + ')');
                        }
                    } else {
                        if (statusEl) statusEl.textContent = '✅ Vous êtes à jour';
                    }
                } else {
                    if (statusEl) statusEl.textContent = `❌ ${result?.error || 'Erreur inconnue'}`;
                }
            } else {
                this._log('error', 'debug', 'window.api.checkForUpdates not available');
                if (statusEl) statusEl.textContent = '❌ API non disponible';
            }
        } catch (e) {
            this._log('error', 'debug', 'Update check failed: ' + e.message);
            if (statusEl) statusEl.textContent = `❌ ${e.message}`;
        } finally {
            if (btnEl) btnEl.disabled = false;
        }
    }
    
    /**
     * Force un refresh API immédiat (raccourci R)
     */
    async _forceApiRefresh() {
        this._log('info', 'debug', '🔄 Forcing API refresh...');
        
        try {
            // Appeler requestJsonDiapo si disponible (défini dans listeDiapo.js)
            if (typeof window.requestJsonDiapo === 'function') {
                await window.requestJsonDiapo();
                this._log('info', 'debug', '✅ API refresh completed via requestJsonDiapo');
            } else if (window.startDiapoRefreshTimer) {
                // Alternative: stopper et redémarrer le timer (ce qui force un refresh)
                if (window.stopDiapoRefreshTimer) window.stopDiapoRefreshTimer();
                window.startDiapoRefreshTimer();
                this._log('info', 'debug', '✅ API refresh timer restarted');
            } else {
                this._log('warn', 'debug', '⚠️ No refresh function available');
            }
            
            // Feedback visuel si l'overlay est visible
            if (this.visible && this.overlay) {
                const flashEl = document.createElement('div');
                flashEl.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#4CAF50;color:white;padding:10px 20px;border-radius:5px;z-index:99999;font-weight:bold;';
                flashEl.textContent = '🔄 API Refresh OK';
                document.body.appendChild(flashEl);
                setTimeout(() => flashEl.remove(), 2000);
            }
        } catch (e) {
            this._log('error', 'debug', '❌ API refresh failed: ' + e.message);
        }
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
            
            // X = quitter l'application
            if (e.key.toLowerCase() === 'x' && !e.ctrlKey && !e.altKey) {
                window.logger?.info('DebugOverlay', 'Quit shortcut pressed (X)');
                if (window.api?.quitApp) {
                    window.api.quitApp();
                }
            }
            
            // R = forcer un refresh API immédiat
            if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.altKey) {
                window.logger?.info('DebugOverlay', '🔄 Manual API refresh triggered (R)');
                this._forceApiRefresh();
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
        // Afficher le curseur en mode debug
        document.body.style.cursor = 'default';
        this._startUpdates();
        
        // Auto-close après 1 minute si non épinglé
        this._startDebugAutoClose();
        
        this._log('info', 'debug', 'Debug overlay shown');
    }
    
    /**
     * Démarre le timer d'auto-close pour debug
     */
    _startDebugAutoClose() {
        this._clearDebugAutoClose();
        if (!this.debugPinned) {
            this.debugAutoCloseTimer = setTimeout(() => {
                this._log('info', 'debug', 'Debug overlay auto-closed after 1 minute');
                this.hide();
            }, this.autoCloseDelay);
            this._updateDebugPinButton();
        }
    }
    
    /**
     * Annule le timer d'auto-close pour debug
     */
    _clearDebugAutoClose() {
        if (this.debugAutoCloseTimer) {
            clearTimeout(this.debugAutoCloseTimer);
            this.debugAutoCloseTimer = null;
        }
    }
    
    /**
     * Toggle l'épinglage du panneau debug
     */
    toggleDebugPin() {
        this.debugPinned = !this.debugPinned;
        if (this.debugPinned) {
            this._clearDebugAutoClose();
            this._log('info', 'debug', 'Debug overlay pinned');
        } else {
            this._startDebugAutoClose();
            this._log('info', 'debug', 'Debug overlay unpinned');
        }
        this._updateDebugPinButton();
    }
    
    /**
     * Met à jour l'apparence du bouton épingler debug
     */
    _updateDebugPinButton() {
        const pinBtn = document.getElementById('debug-pin-btn');
        if (pinBtn) {
            pinBtn.textContent = this.debugPinned ? '📌' : '📍';
            pinBtn.title = this.debugPinned ? 'Désépingler (fermeture auto désactivée)' : 'Épingler (empêche fermeture auto)';
            pinBtn.classList.toggle('pinned', this.debugPinned);
        }
    }
    
    /**
     * Cache l'overlay debug
     */
    hide() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
        this.visible = false;
        // Cacher le curseur seulement si pas en mode config
        if (!this.configMode) {
            document.body.style.cursor = 'none';
        }
        this._stopUpdates();
        this._clearDebugAutoClose();
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
        // Afficher le curseur en mode config
        document.body.style.cursor = 'default';
        
        // Auto-close après 1 minute si non épinglé
        this._startConfigAutoClose();
        
        this._log('info', 'debug', 'Config panel shown');
    }
    
    /**
     * Démarre le timer d'auto-close pour config
     */
    _startConfigAutoClose() {
        this._clearConfigAutoClose();
        if (!this.configPinned) {
            this.configAutoCloseTimer = setTimeout(() => {
                this._log('info', 'debug', 'Config panel auto-closed after 1 minute');
                this.hideConfig();
            }, this.autoCloseDelay);
            this._updateConfigPinButton();
        }
    }
    
    /**
     * Annule le timer d'auto-close pour config
     */
    _clearConfigAutoClose() {
        if (this.configAutoCloseTimer) {
            clearTimeout(this.configAutoCloseTimer);
            this.configAutoCloseTimer = null;
        }
    }
    
    /**
     * Toggle l'épinglage du panneau config
     */
    toggleConfigPin() {
        this.configPinned = !this.configPinned;
        if (this.configPinned) {
            this._clearConfigAutoClose();
            this._log('info', 'debug', 'Config panel pinned');
        } else {
            this._startConfigAutoClose();
            this._log('info', 'debug', 'Config panel unpinned');
        }
        this._updateConfigPinButton();
    }
    
    /**
     * Met à jour l'apparence du bouton épingler config
     */
    _updateConfigPinButton() {
        const pinBtn = document.getElementById('config-pin-btn');
        if (pinBtn) {
            pinBtn.textContent = this.configPinned ? '📌' : '📍';
            pinBtn.title = this.configPinned ? 'Désépingler (fermeture auto désactivée)' : 'Épingler (empêche fermeture auto)';
            pinBtn.classList.toggle('pinned', this.configPinned);
        }
    }
    
    /**
     * Cache le panneau de configuration
     */
    hideConfig() {
        if (this.configPanel) {
            this.configPanel.style.display = 'none';
        }
        this.configMode = false;
        // Cacher le curseur quand on sort du mode config
        document.body.style.cursor = 'none';
        this._clearConfigAutoClose();
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
                <span class="debug-header-actions">
                    <span id="debug-pin-btn" class="debug-pin" onclick="window.debugOverlay.toggleDebugPin()" title="Épingler (empêche fermeture auto)">📍</span>
                    <span class="debug-close" onclick="window.debugOverlay.hide()">×</span>
                </span>
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
                    <div class="debug-label">Dernier Pull</div>
                    <div class="debug-value" id="debug-server-time">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Nb Pulls</div>
                    <div class="debug-value" id="debug-pull-count">0</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Démarré à</div>
                    <div class="debug-value" id="debug-start-time">-</div>
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
                    <div class="debug-label">Son Vidéos</div>
                    <div class="debug-value" id="debug-son-actif">-</div>
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
                <div class="debug-separator"></div>
                <div class="debug-section">
                    <div class="debug-label">IP Locale</div>
                    <div class="debug-value" id="debug-local-ip">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">IP Publique</div>
                    <div class="debug-value" id="debug-public-ip">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Mémoire (RSS)</div>
                    <div class="debug-value" id="debug-memory">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Hostname</div>
                    <div class="debug-value" id="debug-hostname">-</div>
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
                    <span class="config-header-actions">
                        <span id="config-pin-btn" class="config-pin" onclick="window.debugOverlay.toggleConfigPin()" title="Épingler (empêche fermeture auto)">📍</span>
                        <span class="config-close" onclick="window.debugOverlay.hideConfig()">×</span>
                    </span>
                </div>
                <div class="config-content">
                    <div class="config-section-title">🔗 Connexion API</div>
                    <div class="config-group">
                        <label for="config-id-ecran">UUID Écran</label>
                        <input type="text" id="config-id-ecran" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                    </div>
                    <div class="config-group">
                        <label for="config-env">Environnement</label>
                        <select id="config-env">
                            <option value="prod">Production (soek.fr)</option>
                            <option value="beta">Beta (beta.soek.fr)</option>
                            <option value="local">Local (localhost:8000)</option>
                        </select>
                    </div>
                    <div class="config-group">
                        <label for="config-api-token">Token API</label>
                        <input type="password" id="config-api-token" placeholder="Token d'authentification" />
                    </div>
                    
                    <div class="config-section-title">📡 Paramètres Serveur <span class="config-readonly-badge">lecture seule</span></div>
                    <div class="config-info-text">Ces paramètres sont configurés sur le serveur et synchronisés automatiquement.</div>
                    
                    <div class="config-subsection">📺 Écran</div>
                    <div class="config-group config-readonly">
                        <label>Nom</label>
                        <span class="config-value" id="config-server-name">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Orientation</label>
                        <span class="config-value" id="config-server-orientation">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Résolution</label>
                        <span class="config-value" id="config-server-resolution">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Dimensions appliquées</label>
                        <span class="config-value" id="config-applied-dimensions">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Luminosité</label>
                        <span class="config-value" id="config-server-brightness">-</span>
                    </div>
                    
                    <div class="config-subsection">🌙 Mode Nuit</div>
                    <div class="config-group config-readonly">
                        <label>Actif</label>
                        <span class="config-value" id="config-server-night-mode">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Horaires</label>
                        <span class="config-value" id="config-server-night-hours">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Luminosité Nuit</label>
                        <span class="config-value" id="config-server-night-brightness">-</span>
                    </div>
                    
                    <div class="config-subsection">⏰ Programmation</div>
                    <div class="config-group config-readonly">
                        <label>Active</label>
                        <span class="config-value" id="config-server-schedule-active">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Horaires</label>
                        <span class="config-value" id="config-server-schedule-hours">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Jours</label>
                        <span class="config-value" id="config-server-schedule-days">-</span>
                    </div>
                    
                    <div class="config-subsection">🎨 Affichage</div>
                    <div class="config-group config-readonly">
                        <label>Météo</label>
                        <span class="config-value" id="config-server-meteo">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Coordonnées</label>
                        <span class="config-value" id="config-server-coords">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Logo SOE</label>
                        <span class="config-value" id="config-server-logo">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Numéro Semaine</label>
                        <span class="config-value" id="config-server-week">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Son Vidéos</label>
                        <span class="config-value" id="config-server-son">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Planning</label>
                        <span class="config-value" id="config-server-planning">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Fond d'écran</label>
                        <span class="config-value" id="config-server-background">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Refresh API</label>
                        <span class="config-value" id="config-server-refresh">-</span>
                    </div>
                    
                    <div class="config-section-title">🔄 Mises à jour</div>
                    <div class="config-group config-readonly">
                        <label>Version actuelle</label>
                        <span class="config-value" id="config-app-version">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Statut</label>
                        <span class="config-value" id="config-update-status">-</span>
                    </div>
                    <div class="config-group">
                        <button class="config-btn config-btn-update" id="config-check-update" onclick="window.debugOverlay.checkForUpdates()">Vérifier les mises à jour</button>
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
        const apiResponse = window.apiV2Response || {};
        const serverConfig = apiResponse.config || {};
        
        // Champs locaux éditables
        document.getElementById('config-id-ecran').value = config.ecranUuid || '';
        document.getElementById('config-env').value = config.env || 'prod';
        document.getElementById('config-api-token').value = config.apiToken || '';
        
        // === Infos serveur (lecture seule) ===
        
        // Section Écran
        document.getElementById('config-server-name').textContent = 
            apiResponse.ecranNom || '-';
        
        const orientation = apiResponse.orientation || '-';
        const ratio = apiResponse.ratio || '-';
        document.getElementById('config-server-orientation').textContent = 
            `${orientation} (${ratio})`;
        
        const dims = apiResponse.dimensions || {};
        document.getElementById('config-server-resolution').textContent = 
            typeof dims === 'string' ? dims : (dims.width && dims.height ? `${dims.width}x${dims.height}` : '-');
        
        // Show applied dimensions
        const applied = window.appliedDimensions || {};
        if (applied.width && applied.height) {
            document.getElementById('config-applied-dimensions').textContent = 
                `${applied.width}x${applied.height}`;
        } else {
            document.getElementById('config-applied-dimensions').textContent = 'Plein écran';
        }
        
        document.getElementById('config-server-brightness').textContent = 
            apiResponse.luminosite !== undefined ? `${apiResponse.luminosite}%` : '-';
        
        // Section Mode Nuit
        const modeNuit = apiResponse.modeNuit || {};
        document.getElementById('config-server-night-mode').textContent = 
            modeNuit.actif ? '✅ Actif' : '❌ Inactif';
        
        document.getElementById('config-server-night-hours').textContent = 
            modeNuit.heureDebut && modeNuit.heureFin 
                ? `${modeNuit.heureDebut} - ${modeNuit.heureFin}` 
                : '-';
        
        document.getElementById('config-server-night-brightness').textContent = 
            modeNuit.luminositeNuit !== undefined ? `${modeNuit.luminositeNuit}%` : '-';
        
        // Section Programmation
        const prog = apiResponse.programmation || {};
        document.getElementById('config-server-schedule-active').textContent = 
            prog.active ? '✅ Active' : '❌ Inactive';
        
        document.getElementById('config-server-schedule-hours').textContent = 
            prog.heureDemarrage && prog.heureExtinction 
                ? `${prog.heureDemarrage} - ${prog.heureExtinction}` 
                : '-';
        
        const jours = prog.joursFonctionnement || [];
        const jourNoms = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        const joursStr = jours.length === 7 
            ? 'Tous les jours' 
            : jours.map(j => jourNoms[j] || j).join(', ');
        document.getElementById('config-server-schedule-days').textContent = joursStr || '-';
        
        // Section Affichage
        const meteoConfig = serverConfig.meteo || {};
        const affichageConfig = serverConfig.affichage || {};
        const planningConfig = serverConfig.planning || {};
        
        document.getElementById('config-server-meteo').textContent = 
            meteoConfig.actif ? '✅ Activée' : '❌ Désactivée';
        
        const lat = meteoConfig.latitude || config.meteoLat || null;
        const lon = meteoConfig.longitude || config.meteoLon || null;
        document.getElementById('config-server-coords').textContent = 
            (lat && lon) ? `${lat}, ${lon}` : 'Non définies';
        
        document.getElementById('config-server-logo').textContent = 
            affichageConfig.logoSOE ? '✅ Visible' : '❌ Masqué';
        
        document.getElementById('config-server-week').textContent = 
            affichageConfig.weekNo ? '✅ Visible' : '❌ Masqué';
        
        document.getElementById('config-server-son').textContent = 
            apiResponse.sonActif ? '🔊 Activé' : '🔇 Muet';
        
        document.getElementById('config-server-planning').textContent = 
            planningConfig.actif ? `✅ ${planningConfig.position || 'footer'}` : '❌ Désactivé';
        
        // Fond d'écran
        const fond = apiResponse.fondEcran || '-';
        const fondName = fond !== '-' ? fond.split('/').pop() : '-';
        document.getElementById('config-server-background').textContent = 
            fondName.length > 25 ? fondName.substring(0, 22) + '...' : fondName;
        
        // Refresh interval
        const refresh = apiResponse.refreshInterval || '-';
        document.getElementById('config-server-refresh').textContent = 
            refresh !== '-' ? `${refresh}s` : '-';
        
        // Section Mises à jour
        this._populateUpdateSection();
    }
    
    /**
     * Remplit la section mise à jour
     */
    async _populateUpdateSection() {
        // Version de l'application
        const versionEl = document.getElementById('config-app-version');
        if (versionEl) {
            try {
                if (window.api && window.api.getAppVersion) {
                    const version = await window.api.getAppVersion();
                    versionEl.textContent = `v${version}`;
                } else {
                    versionEl.textContent = '-';
                }
            } catch (e) {
                versionEl.textContent = '-';
            }
        }
        
        // Statut de mise à jour
        this._updateUpdateStatusDisplay();
    }
    
    /**
     * Sauvegarde la configuration
     */
    async saveConfig() {
        // Charger la config existante pour ne pas perdre les autres valeurs (dimensions, etc.)
        const existingConfig = window.configSEE || {};
        
        // Mettre à jour avec les nouvelles valeurs du formulaire
        const newConfig = {
            ...existingConfig, // Garder toutes les propriétés existantes (screenWidth, screenHeight, etc.)
            ecranUuid: document.getElementById('config-id-ecran').value.trim() || '',
            env: document.getElementById('config-env').value,
            apiToken: document.getElementById('config-api-token').value.trim() || ''
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
                top: 20px;
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
            
            .debug-header-actions {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .debug-pin {
                cursor: pointer;
                font-size: 16px;
                opacity: 0.5;
                transition: opacity 0.2s, transform 0.2s, filter 0.2s;
                filter: grayscale(100%);
            }
            
            .debug-pin:hover {
                opacity: 0.8;
            }
            
            .debug-pin.pinned {
                opacity: 1;
                transform: rotate(45deg);
                filter: grayscale(0%) drop-shadow(0 0 2px #ff4444);
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
            
            .debug-separator {
                height: 1px;
                background: rgba(255, 255, 255, 0.3);
                margin: 8px 0;
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
            
            /* Config Panel - Dark Mode */
            #config-panel {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 100000;
            }
            
            .config-dialog {
                background: #1a1a1a;
                border-radius: 12px;
                width: 420px;
                max-width: 90vw;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .config-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px 12px 0 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .config-title {
                font-weight: bold;
                font-size: 18px;
                color: #fff;
            }
            
            .config-header-actions {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .config-pin {
                cursor: pointer;
                font-size: 18px;
                opacity: 0.5;
                transition: opacity 0.2s, transform 0.2s, filter 0.2s;
                filter: grayscale(100%);
            }
            
            .config-pin:hover {
                opacity: 0.8;
            }
            
            .config-pin.pinned {
                opacity: 1;
                transform: rotate(45deg);
                filter: grayscale(0%) drop-shadow(0 0 2px #ff4444);
            }
            
            .config-close {
                cursor: pointer;
                font-size: 24px;
                color: #666;
            }
            
            .config-close:hover {
                color: #fff;
            }
            
            .config-content {
                padding: 20px;
                max-height: 70vh;
                overflow-y: auto;
            }
            
            .config-content::-webkit-scrollbar {
                width: 6px;
            }
            
            .config-content::-webkit-scrollbar-track {
                background: #1a1a1a;
            }
            
            .config-content::-webkit-scrollbar-thumb {
                background: #444;
                border-radius: 3px;
            }
            
            .config-content::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
            
            .config-section-title {
                font-size: 12px;
                font-weight: 600;
                color: #0866C6;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 12px;
                margin-top: 8px;
                padding-bottom: 6px;
                border-bottom: 1px solid rgba(8, 102, 198, 0.3);
            }
            
            .config-section-title:first-child {
                margin-top: 0;
            }
            
            .config-readonly-badge {
                font-size: 10px;
                font-weight: normal;
                background: rgba(255, 255, 255, 0.1);
                padding: 2px 6px;
                border-radius: 4px;
                margin-left: 8px;
                text-transform: none;
                letter-spacing: normal;
                color: #888;
            }
            
            .config-info-text {
                font-size: 11px;
                color: #666;
                margin-bottom: 12px;
                font-style: italic;
            }
            
            .config-subsection {
                font-size: 11px;
                font-weight: 600;
                color: #888;
                margin-top: 14px;
                margin-bottom: 8px;
                padding-left: 4px;
            }
            
            .config-group.config-readonly {
                background: rgba(255, 255, 255, 0.03);
                padding: 8px 10px;
                border-radius: 6px;
                margin-bottom: 6px;
            }
            
            .config-group.config-readonly label {
                color: #777;
                font-size: 12px;
            }
            
            .config-value {
                font-weight: 500;
                color: #bbb;
                font-size: 12px;
                text-align: right;
                max-width: 180px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .config-group {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .config-group label {
                font-weight: 500;
                color: #ccc;
                font-size: 14px;
            }
            
            .config-group input[type="number"],
            .config-group input[type="password"],
            .config-group input[type="text"],
            .config-group select {
                width: 180px;
                padding: 10px 12px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                font-size: 14px;
                background: #2a2a2a;
                color: #fff;
            }
            
            .config-group input:focus,
            .config-group select:focus {
                outline: none;
                border-color: #0866C6;
                box-shadow: 0 0 0 2px rgba(8, 102, 198, 0.2);
            }
            
            .config-group input::placeholder {
                color: #666;
            }
            
            .config-group select option {
                background: #2a2a2a;
                color: #fff;
            }
            
            .config-group input[type="checkbox"] {
                width: 20px;
                height: 20px;
                accent-color: #0866C6;
            }
            
            .config-footer {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 15px 20px;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 0 0 12px 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .config-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
            }
            
            .config-btn-cancel {
                background: #333;
                color: #999;
                border: 1px solid #444;
            }
            
            .config-btn-cancel:hover {
                background: #444;
                color: #fff;
            }
            
            .config-btn-save {
                background: #0866C6;
                color: #fff;
            }
            
            .config-btn-save:hover {
                background: #0a7ae6;
            }
            
            .config-btn-update {
                width: 100%;
                background: #28a745;
                color: #fff;
                padding: 10px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: background 0.2s;
            }
            
            .config-btn-update:hover {
                background: #218838;
            }
            
            .config-btn-update:disabled {
                background: #6c757d;
                cursor: not-allowed;
                opacity: 0.7;
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
    async _updateValues() {
        const config = window.configSEE || {};
        const apiResponse = window.apiV2Response || {};
        
        // Version (récupérée dynamiquement depuis le main process)
        try {
            const version = await window.api?.getAppVersion?.() || '?';
            this._setValue('debug-version', `v${version}`);
        } catch (e) {
            this._setValue('debug-version', 'v?');
        }
        
        // UUID Écran
        const uuid = config.ecranUuid || window.ecranUuid || '?';
        const displayUuid = uuid.length > 8 ? uuid.substring(0, 8) + '...' : uuid;
        this._setValue('debug-ecran-id', displayUuid);
        
        // Environnement
        const env = config.env || 'prod';
        this._setValue('debug-env', env === 'local' ? 'Local' : 'Production', env === 'local' ? 'warning' : 'ok');
        
        // Heure locale
        this._setValue('debug-local-time', new Date().toLocaleTimeString('fr-FR'));
        
        // Dernier Pull (heure du dernier appel API)
        if (window.lastApiPullTime) {
            const lastPull = new Date(window.lastApiPullTime).toLocaleTimeString('fr-FR');
            const ago = Math.floor((Date.now() - window.lastApiPullTime) / 1000);
            this._setValue('debug-server-time', lastPull + ' (il y a ' + this._formatDuration(ago) + ')');
        } else if (apiResponse.serverTime) {
            // Fallback sur serverTime si lastApiPullTime pas dispo
            const serverTime = new Date(apiResponse.serverTime).toLocaleTimeString('fr-FR');
            this._setValue('debug-server-time', serverTime);
        } else {
            this._setValue('debug-server-time', '-', 'warning');
        }
        
        // Nombre de pulls depuis l'uptime
        const pullCount = window.apiPullCount || 0;
        this._setValue('debug-pull-count', pullCount + ' pulls');
        
        // Heure de démarrage
        const startTimeStr = new Date(this.startTime).toLocaleTimeString('fr-FR');
        this._setValue('debug-start-time', startTimeStr);
        
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
        
        // Prochain refresh (compteur réel)
        const refreshInterval = window.refreshInterval || 300;
        if (window.lastApiPullTime) {
            const elapsed = Math.floor((Date.now() - window.lastApiPullTime) / 1000);
            const remaining = Math.max(0, refreshInterval - elapsed);
            if (remaining === 0) {
                this._setValue('debug-next-refresh', '⏳ imminent...', 'warning');
            } else {
                this._setValue('debug-next-refresh', 'dans ' + this._formatDuration(remaining), 'ok');
            }
        } else if (screenStatus === 'sleep') {
            this._setValue('debug-next-refresh', '5 min (sleep)');
        } else {
            this._setValue('debug-next-refresh', 'toutes les ' + this._formatDuration(refreshInterval));
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
        
        // Son vidéos
        if (window.sonActif === true) {
            this._setValue('debug-son-actif', '🔊 Activé', 'ok');
        } else {
            this._setValue('debug-son-actif', '🔇 Muet');
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
        
        // Infos système (CPU, mémoire, IPs) - mise à jour moins fréquente
        this._updateSystemInfo();
    }
    
    /**
     * Met à jour les infos système (appelé moins fréquemment)
     */
    async _updateSystemInfo() {
        // Éviter les appels trop fréquents (toutes les 5 secondes max)
        const now = Date.now();
        if (this._lastSystemInfoUpdate && (now - this._lastSystemInfoUpdate) < 5000) {
            return;
        }
        this._lastSystemInfoUpdate = now;
        
        if (window.api && window.api.getSystemInfo) {
            try {
                const info = await window.api.getSystemInfo();
                if (info) {
                    this._setValue('debug-local-ip', info.localIP || '-');
                    this._setValue('debug-public-ip', info.publicIP || '-');
                    
                    if (info.memory && info.memory.rssMB) {
                        this._setValue('debug-memory', info.memory.rssMB + ' MB');
                    }
                    
                    if (info.hostname) {
                        this._setValue('debug-hostname', info.hostname);
                    }
                }
            } catch (e) {
                this._log('warn', 'debug', 'Failed to get system info: ' + e.message);
            }
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
