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
        this.mediaListVisible = false;
        this.mediaPanel = null;
        this.activeTab = 'trame'; // 'files', 'trame' or 'diapos'
        this.trameRefreshInterval = null;
        
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
                if (this.mediaListVisible) this.hideMediaList();
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
            
            // L = lister les médias
            if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.altKey) {
                this.toggleMediaList();
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
     * Toggle la liste des médias
     */
    toggleMediaList() {
        if (this.mediaListVisible) {
            this.hideMediaList();
        } else {
            this.showMediaList();
        }
    }
    
    /**
     * Affiche la modal avec la liste des médias
     */
    async showMediaList() {
        if (!this.mediaPanel) {
            this._createMediaPanel();
        }
        this.mediaPanel.style.display = 'flex';
        this.mediaListVisible = true;
        document.body.style.cursor = 'default';
        this._log('info', 'debug', 'Media list shown');
        
        // Charger selon l'onglet actif
        if (this.activeTab === 'files') {
            this._loadFilesTab();
        } else if (this.activeTab === 'diapos') {
            this._loadDiaposTab();
        } else {
            this._loadTrameTab();
        }
        this._startTrameRefresh();
    }
    
    /**
     * Change d'onglet dans la modal médias
     */
    switchTab(tab) {
        this.activeTab = tab;
        // Mettre à jour les boutons
        const tabs = this.mediaPanel.querySelectorAll('.media-tab');
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        // Afficher/cacher les contenus
        const filesEl = document.getElementById('tab-files');
        const trameEl = document.getElementById('tab-trame');
        const diaposEl = document.getElementById('tab-diapos');
        const startupEl = document.getElementById('tab-startup');
        if (filesEl) filesEl.style.display = tab === 'files' ? '' : 'none';
        if (trameEl) trameEl.style.display = tab === 'trame' ? '' : 'none';
        if (diaposEl) diaposEl.style.display = tab === 'diapos' ? '' : 'none';
        if (startupEl) startupEl.style.display = tab === 'startup' ? '' : 'none';
        // Charger les données de l'onglet
        if (tab === 'files') {
            this._loadFilesTab();
        } else if (tab === 'diapos') {
            this._loadDiaposTab();
        } else if (tab === 'startup') {
            this._loadStartupTab();
        } else {
            this._loadTrameTab();
        }
    }
    
    /**
     * Charge l'onglet Fichiers (liste des médias sur disque)
     */
    async _loadFilesTab() {
        const listEl = document.getElementById('media-list-body');
        if (listEl) listEl.innerHTML = '<div style="color:#888;padding:20px;text-align:center;">Chargement...</div>';
        
        // Afficher le chemin du cache média
        try {
            const pathEl = document.getElementById('media-cache-path');
            if (pathEl) {
                const basePath = (typeof pathSEE !== 'undefined' && pathSEE) ? pathSEE : null;
                if (basePath) {
                    pathEl.textContent = basePath + 'media/';
                } else if (window.api && window.api.getConfig) {
                    const cfg = await window.api.getConfig();
                    pathEl.textContent = (cfg && cfg._basePath ? cfg._basePath : '?') + 'media/';
                } else {
                    pathEl.textContent = '(inconnu)';
                }
            }
        } catch(e) { /* ignore */ }
        
        try {
            let files = [];
            if (window.api && window.api.listMediaFiles) {
                files = await window.api.listMediaFiles();
            }
            
            if (!files || files.length === 0) {
                listEl.innerHTML = '<div style="color:#888;padding:20px;text-align:center;">Aucun média trouvé</div>';
                document.getElementById('media-list-count').textContent = '0 fichiers';
                document.getElementById('media-list-total').textContent = '0 Mo';
                return;
            }
            
            const totalSize = files.reduce((s, f) => s + f.size, 0);
            document.getElementById('media-list-count').textContent = files.length + ' fichier' + (files.length > 1 ? 's' : '');
            document.getElementById('media-list-total').textContent = this._formatSize(totalSize);
            
            let html = '';
            for (const f of files) {
                const ext = f.name.split('.').pop().toLowerCase();
                const icon = this._getMediaIcon(ext);
                const date = new Date(f.mtime);
                const dateStr = date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                html += `<div class="media-item">
                    <span class="media-icon">${icon}</span>
                    <span class="media-name" title="${f.name}">${f.name}</span>
                    <span class="media-size">${this._formatSize(f.size)}</span>
                    <span class="media-date">${dateStr}</span>
                </div>`;
            }
            listEl.innerHTML = html;
        } catch (err) {
            listEl.innerHTML = `<div style="color:#f44;padding:20px;text-align:center;">Erreur: ${err.message}</div>`;
            this._log('error', 'debug', 'Failed to list media: ' + err.message);
        }
    }
    
    /**
     * Charge l'onglet Trame de lecture (séquence de diffusion en cours)
     */
    _loadTrameTab() {
        const listEl = document.getElementById('trame-list-body');
        if (!listEl) return;
        
        // Récupérer la trame depuis loopDiapo
        const mediaLoop = (typeof window._getMediaLoop === 'function') ? window._getMediaLoop() : (window.ArrayDiapo || []);
        const currentIdx = (typeof window._getCurrentMediaIndex === 'function') ? window._getCurrentMediaIndex() : -1;
        const isOnPageDefault = (typeof window._isOnPageDefault === 'function') ? window._isOnPageDefault() : false;
        
        if (!mediaLoop || mediaLoop.length === 0) {
            listEl.innerHTML = '<div style="color:#888;padding:20px;text-align:center;">Aucune trame de lecture active</div>';
            document.getElementById('trame-count').textContent = '0 médias';
            document.getElementById('trame-duration').textContent = '-';
            return;
        }
        
        // Calculer la durée totale et vérifier les fichiers
        let totalDuration = 0;
        let missingCount = 0;
        const hasExistsSync = window.api && typeof window.api.existsSync === 'function';
        
        const items = [];
        for (let i = 0; i < mediaLoop.length; i++) {
            const m = mediaLoop[i];
            const type = m[0] || '?';
            const rawFile = m[1] || '';
            const dur = (m[2] && Number(m[2]) > 0) ? Number(m[2]) : 5;
            const meta = m[3] || {};
            totalDuration += dur;
            
            // Déterminer le nom affiché selon le type
            let displayName = '?';
            let fileStatus = 'na';
            
            if (type === 'template') {
                // rawFile est un objet templateData
                const td = rawFile;
                const templateType = (td && td.type) ? td.type : '?';
                const templateTitle = (td && td.titre) ? td.titre : 'Sans titre';
                displayName = templateTitle + ' (' + templateType + ')';
            } else if (type === 'planning') {
                displayName = 'Planning du jour';
            } else {
                // Image ou vidéo : décoder le nom de fichier
                displayName = rawFile ? decodeURIComponent(rawFile) : '?';
                if (hasExistsSync && rawFile) {
                    try {
                        const decoded = decodeURIComponent(rawFile);
                        const exists = window.api.existsSync('media/' + decoded);
                        fileStatus = exists ? 'ok' : 'missing';
                        if (!exists) missingCount++;
                    } catch (e) {
                        fileStatus = 'na';
                    }
                }
            }
            
            items.push({ type, rawFile, displayName, dur, meta, fileStatus, index: i });
        }
        
        // Ajouter 10s pour la page par défaut (entre les cycles)
        if (!window.masquerPageDefault) {
            totalDuration += 10;
        }
        
        // Stats
        const countText = mediaLoop.length + ' média' + (mediaLoop.length > 1 ? 's' : '');
        const missingText = missingCount > 0 ? ' — ❌ ' + missingCount + ' manquant' + (missingCount > 1 ? 's' : '') : '';
        document.getElementById('trame-count').textContent = countText + missingText;
        document.getElementById('trame-duration').textContent = this._formatTrameDuration(totalDuration);
        
        let html = '';
        
        // Ligne "Page par défaut" en haut (sauf si masquerPageDefault)
        if (!window.masquerPageDefault) {
            html += `<div class="trame-item${isOnPageDefault ? ' trame-current' : ''} trame-pagedefault">
                <span class="trame-idx">—</span>
                <span class="trame-status">🏠</span>
                <span class="trame-type-icon">📺</span>
                <span class="trame-type">Défaut</span>
                <span class="trame-name">Page par défaut</span>
                <span class="trame-dur">10s</span>
                <span class="trame-diapo">—</span>
            </div>`;
        }
        
        for (const item of items) {
            const isCurrent = (!isOnPageDefault && item.index === currentIdx);
            const typeIcon = this._getTrameTypeIcon(item.type);
            const typeLabel = this._getTrameTypeLabel(item.type);
            
            // Diapo name from meta (varies by type)
            let diapoName = '-';
            if (item.type === 'template' || item.type === 'planning') {
                // meta peut être un objet {templateId, ordre} ou un diapoId number
                diapoName = (item.meta && item.meta.templateId) ? 'T#' + item.meta.templateId : (typeof item.meta === 'number' ? 'D#' + item.meta : '-');
            } else {
                diapoName = (item.meta && item.meta.diapoNom) ? item.meta.diapoNom : '-';
            }
            const transition = (item.meta && item.meta.transition) ? item.meta.transition : '';
            const shortName = item.displayName.split('/').pop();
            
            // Indicateur de statut fichier
            let statusIcon = '';
            let statusClass = '';
            if (item.fileStatus === 'missing') {
                statusIcon = '❌';
                statusClass = ' trame-missing';
            } else if (item.fileStatus === 'ok') {
                statusIcon = '✅';
            }
            
            html += `<div class="trame-item${isCurrent ? ' trame-current' : ''}${statusClass}">
                <span class="trame-idx">${item.index + 1}</span>
                <span class="trame-status" title="${item.fileStatus === 'missing' ? 'Fichier absent du disque' : 'OK'}">${statusIcon}</span>
                <span class="trame-type-icon">${typeIcon}</span>
                <span class="trame-type">${typeLabel}</span>
                <span class="trame-name" title="${shortName}">${shortName}</span>
                <span class="trame-dur">${item.dur}s</span>
                <span class="trame-diapo" title="${diapoName}${transition ? ' (' + transition + ')' : ''}">${diapoName}</span>
            </div>`;
        }
        listEl.innerHTML = html;
        
        // Scroll to current item
        const currentEl = listEl.querySelector('.trame-current');
        if (currentEl) {
            currentEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }
    
    /**
     * Icône pour le type de média dans la trame
     */
    _getTrameTypeIcon(type) {
        const icons = { img: '🖼️', video: '🎬', template: '📐', planning: '📅' };
        return icons[type] || '📎';
    }
    
    /**
     * Label pour le type de média dans la trame
     */
    _getTrameTypeLabel(type) {
        const labels = { img: 'Image', video: 'Vidéo', template: 'Template', planning: 'Planning' };
        return labels[type] || type;
    }
    
    /**
     * Charge l'onglet Startup Log (timeline de démarrage)
     */
    _loadStartupTab() {
        const listEl = document.getElementById('startup-list-body');
        const countEl = document.getElementById('startup-count');
        const uptimeEl = document.getElementById('startup-uptime');
        
        if (!listEl) return;
        
        const logs = window._startupLog || [];
        if (countEl) countEl.textContent = logs.length + ' événements';
        if (uptimeEl) {
            const uptime = window._startupTime ? ((Date.now() - window._startupTime) / 1000).toFixed(0) : '?';
            uptimeEl.textContent = uptime + 's';
        }
        
        if (logs.length === 0) {
            listEl.innerHTML = '<div style="color:#888;padding:20px;text-align:center;">Aucun log de démarrage disponible</div>';
            return;
        }
        
        // Color-code log entries
        let html = '';
        for (const entry of logs) {
            let color = '#aef'; // default blue
            if (entry.includes('FAILED') || entry.includes('FAILURE') || entry.includes('ERROR') || entry.includes('THREW') || entry.includes('NO DATA') || entry.includes('EXHAUSTED')) {
                color = '#ff6b6b'; // red
            } else if (entry.includes('SUCCESS') || entry.includes('HIT') || entry.includes('OK')) {
                color = '#6bff6b'; // green
            } else if (entry.includes('SKIP') || entry.includes('EMPTY') || entry.includes('NOT FOUND') || entry.includes('stuck')) {
                color = '#ffaa33'; // orange
            }
            html += '<div style="color:' + color + ';border-bottom:1px solid rgba(255,255,255,0.05);padding:2px 0;">' + this._escapeHtml(entry) + '</div>';
        }
        
        // Add current state summary
        html += '<div style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.2);color:#fff;font-weight:bold;">--- État actuel ---</div>';
        html += '<div style="color:#aef;">apiCache keys: ' + (window.apiCache ? Object.keys(window.apiCache.cache || {}).join(', ') || '(vide)' : 'N/A') + '</div>';
        html += '<div style="color:#aef;">apiConsecutiveErrors: ' + (window.apiConsecutiveErrors || 0) + '</div>';
        html += '<div style="color:#aef;">ArrayDiapo: ' + (typeof ArrayDiapo !== 'undefined' && ArrayDiapo ? ArrayDiapo.length + ' items' : 'null/undefined') + '</div>';
        html += '<div style="color:#aef;">init: ' + (typeof init !== 'undefined' ? init : 'undefined') + '</div>';
        html += '<div style="color:#aef;">urlAPI: ' + (typeof urlAPI !== 'undefined' ? urlAPI : 'undefined') + '</div>';
        html += '<div style="color:#aef;">localStorage cache: ' + (function() { try { var s = localStorage.getItem('seedisplay_api_cache'); return s ? (s.length + ' bytes') : 'vide'; } catch(e) { return 'error'; } })() + '</div>';
        
        listEl.innerHTML = html;
    }
    
    /**
     * Charge l'onglet Diapos API (metadata des diapos depuis la réponse API)
     */
    _loadDiaposTab() {
        const listEl = document.getElementById('diapos-list-body');
        const countEl = document.getElementById('diapos-count');
        const statusEl = document.getElementById('diapos-status');
        
        if (!listEl) return;
        
        // Récupérer la réponse API stockée
        const apiResponse = window.apiV2Response;
        if (!apiResponse) {
            listEl.innerHTML = '<div style="color:#888;padding:20px;text-align:center;">Aucune réponse API disponible</div>';
            if (countEl) countEl.textContent = '0 diapos';
            if (statusEl) statusEl.textContent = '—';
            return;
        }
        
        // Status écran
        if (statusEl) {
            const status = apiResponse.status || '—';
            const statusIcons = { active: '🟢 Active', sleep: '😴 Sleep', offline: '🔴 Offline' };
            statusEl.textContent = statusIcons[status] || status;
        }
        
        const diapos = apiResponse.diapos;
        if (!diapos || !Array.isArray(diapos) || diapos.length === 0) {
            listEl.innerHTML = '<div style="color:#888;padding:20px;text-align:center;">Aucune diapo dans la réponse API</div>';
            if (countEl) countEl.textContent = '0 diapos';
            return;
        }
        
        // Compter les médias par diapo depuis la timeline
        const mediaCountByDiapo = {};
        if (apiResponse.timeline && Array.isArray(apiResponse.timeline)) {
            for (const item of apiResponse.timeline) {
                if (item && item.diapoId != null) {
                    mediaCountByDiapo[item.diapoId] = (mediaCountByDiapo[item.diapoId] || 0) + 1;
                }
            }
        }
        
        // Compter les actives
        const actives = diapos.filter(d => d && d.actif).length;
        if (countEl) countEl.textContent = `${diapos.length} diapos (${actives} actives)`;
        
        let html = '';
        for (let i = 0; i < diapos.length; i++) {
            const d = diapos[i];
            if (!d) continue;
            
            const isActive = d.actif;
            const statusIcon = isActive ? '✅' : '⏸️';
            
            // Type icon
            let typeIcon = '📄';
            if (d.isEventTemplate) typeIcon = '🎪';
            else if (d.templateData) typeIcon = '📐';
            else if (d.type === 'prioritaire' || d.diapoType === 'prioritaire') typeIcon = '⚡';
            
            // ID
            const diapoId = d.id || d._id || '—';
            
            // Nom
            const nom = d.nom || d.name || 'Sans nom';
            
            // Nombre de médias : d'abord depuis la timeline, puis champs directs
            let mediaInfo = '—';
            const tlCount = mediaCountByDiapo[diapoId];
            if (tlCount !== undefined) {
                mediaInfo = tlCount + ' média' + (tlCount > 1 ? 's' : '');
            } else if (d.ligneMedia && Array.isArray(d.ligneMedia)) {
                mediaInfo = d.ligneMedia.length + ' média' + (d.ligneMedia.length > 1 ? 's' : '');
            } else if (d.mediaCount !== undefined) {
                mediaInfo = d.mediaCount + ' média' + (d.mediaCount > 1 ? 's' : '');
            } else if (d.nbMedias !== undefined) {
                mediaInfo = d.nbMedias + ' média' + (d.nbMedias > 1 ? 's' : '');
            }
            
            // Dates
            let dateInfo = '—';
            const debut = d.DateDebutDiapo || d.dateDebut || d.startDate || '';
            const fin = d.DateFinDiapo || d.dateFin || d.endDate || '';
            if (debut || fin) {
                const fmtDate = (str) => {
                    if (!str) return '…';
                    try {
                        const dt = new Date(str);
                        return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                    } catch (e) { return str.substring(0, 10); }
                };
                dateInfo = fmtDate(debut) + ' → ' + fmtDate(fin);
            }
            
            const rowClass = isActive ? '' : ' trame-missing';
            
            html += `<div class="trame-item${rowClass}">
                <span class="trame-idx">${i + 1}</span>
                <span class="trame-status" title="${isActive ? 'Active' : 'Inactive'}">${statusIcon}</span>
                <span class="trame-type-icon">${typeIcon}</span>
                <span class="trame-type" title="ID: ${diapoId}">${diapoId}</span>
                <span class="trame-name" title="${nom}">${nom}</span>
                <span class="trame-dur">${mediaInfo}</span>
                <span class="trame-diapo" title="${dateInfo}">${dateInfo}</span>
            </div>`;
        }
        
        listEl.innerHTML = html;
    }
    
    /**
     * Démarre le refresh auto de l'onglet trame (toutes les 1s)
     */
    _startTrameRefresh() {
        this._stopTrameRefresh();
        this.trameRefreshInterval = setInterval(() => {
            if (this.mediaListVisible && this.activeTab === 'trame') {
                this._loadTrameTab();
            }
        }, 1000);
    }
    
    /**
     * Arrête le refresh auto de la trame
     */
    _stopTrameRefresh() {
        if (this.trameRefreshInterval) {
            clearInterval(this.trameRefreshInterval);
            this.trameRefreshInterval = null;
        }
    }
    
    /**
     * Formate une durée totale de trame (en secondes)
     */
    _formatTrameDuration(seconds) {
        if (seconds < 60) return seconds + 's';
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        if (m < 60) return m + 'min ' + (s > 0 ? s + 's' : '');
        const h = Math.floor(m / 60);
        const rm = m % 60;
        return h + 'h ' + rm + 'min';
    }
    
    /**
     * Cache la modal de liste des médias
     */
    hideMediaList() {
        this._stopTrameRefresh();
        if (this.mediaPanel) {
            this.mediaPanel.style.display = 'none';
        }
        this.mediaListVisible = false;
        if (!this.configMode && !this.visible) {
            document.body.style.cursor = 'none';
        }
        this._log('info', 'debug', 'Media list hidden');
    }
    
    /**
     * Crée le panneau de liste des médias (avec onglets Fichiers / Trame)
     */
    _createMediaPanel() {
        this.mediaPanel = document.createElement('div');
        this.mediaPanel.id = 'media-list-panel';
        this.mediaPanel.innerHTML = `
            <div class="media-dialog">
                <div class="media-header">
                    <div class="media-tabs">
                        <button class="media-tab" data-tab="files" onclick="window.debugOverlay.switchTab('files')">📁 Fichiers</button>
                        <button class="media-tab active" data-tab="trame" onclick="window.debugOverlay.switchTab('trame')">🎬 Trame de lecture</button>
                        <button class="media-tab" data-tab="diapos" onclick="window.debugOverlay.switchTab('diapos')">🗂️ Diapos API</button>
                        <button class="media-tab" data-tab="startup" onclick="window.debugOverlay.switchTab('startup')">🚀 Startup</button>
                    </div>
                    <span class="media-close" onclick="window.debugOverlay.hideMediaList()">×</span>
                </div>
                <!-- TAB: Fichiers -->
                <div class="media-tab-content" id="tab-files" style="display:none;">
                    <div class="media-path-info" id="media-path-info" style="padding:6px 12px;background:rgba(0,0,0,0.3);border-radius:4px;margin:8px 12px 4px;font-family:monospace;font-size:12px;color:#aef;word-break:break-all;">
                        📂 <span id="media-cache-path">-</span>
                    </div>
                    <div class="media-stats">
                        <span id="media-list-count">-</span>
                        <span class="media-stats-sep">•</span>
                        <span id="media-list-total">-</span>
                    </div>
                    <div class="media-list-header">
                        <span class="media-col-icon"></span>
                        <span class="media-col-name">Nom</span>
                        <span class="media-col-size">Taille</span>
                        <span class="media-col-date">Modifié</span>
                    </div>
                    <div class="media-list-body" id="media-list-body">
                    </div>
                </div>
                <!-- TAB: Trame de lecture -->
                <div class="media-tab-content" id="tab-trame">
                    <div class="media-stats">
                        <span id="trame-count">-</span>
                        <span class="media-stats-sep">•</span>
                        <span>Durée totale: <span id="trame-duration">-</span></span>
                    </div>
                    <div class="trame-list-header">
                        <span class="trame-col-idx">#</span>
                        <span class="trame-col-status"></span>
                        <span class="trame-col-icon"></span>
                        <span class="trame-col-type">Type</span>
                        <span class="trame-col-name">Fichier</span>
                        <span class="trame-col-dur">Durée</span>
                        <span class="trame-col-diapo">Diapo</span>
                    </div>
                    <div class="media-list-body" id="trame-list-body">
                    </div>
                </div>
                <!-- TAB: Diapos API -->
                <div class="media-tab-content" id="tab-diapos" style="display:none;">
                    <div class="media-stats">
                        <span id="diapos-count">-</span>
                        <span class="media-stats-sep">•</span>
                        <span>Status écran: <span id="diapos-status">-</span></span>
                    </div>
                    <div class="trame-list-header">
                        <span class="trame-col-idx">#</span>
                        <span class="trame-col-status"></span>
                        <span class="trame-col-icon"></span>
                        <span class="trame-col-type">ID</span>
                        <span class="trame-col-name">Nom</span>
                        <span class="trame-col-dur">Médias</span>
                        <span class="trame-col-diapo">Dates</span>
                    </div>
                    <div class="media-list-body" id="diapos-list-body">
                    </div>
                </div>
                <!-- TAB: Startup Log -->
                <div class="media-tab-content" id="tab-startup" style="display:none;">
                    <div class="media-stats">
                        <span id="startup-count">-</span>
                        <span class="media-stats-sep">•</span>
                        <span>Uptime: <span id="startup-uptime">-</span></span>
                    </div>
                    <div class="media-list-body" id="startup-list-body" style="font-family:monospace;font-size:11px;line-height:1.6;padding:8px 12px;">
                    </div>
                </div>
                <div class="media-footer">
                    Appuyez sur <kbd>L</kbd> ou <kbd>Esc</kbd> pour fermer
                </div>
            </div>
        `;
        document.body.appendChild(this.mediaPanel);
    }
    
    /**
     * Échappe les caractères HTML
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    /**
     * Retourne une icône selon l'extension du fichier
     */
    _getMediaIcon(ext) {
        const icons = {
            jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', bmp: '🖼️', webp: '🖼️', svg: '🖼️',
            mp4: '🎬', avi: '🎬', mkv: '🎬', mov: '🎬', webm: '🎬', wmv: '🎬',
            mp3: '🎵', wav: '🎵', ogg: '🎵', flac: '🎵',
            pdf: '📄', html: '📄', htm: '📄',
        };
        return icons[ext] || '📎';
    }
    
    /**
     * Formate une taille en octets en format lisible
     */
    _formatSize(bytes) {
        if (bytes === 0) return '0 o';
        if (bytes < 1024) return bytes + ' o';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' Go';
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
                    <div class="debug-label">Canal MAJ</div>
                    <div class="debug-value" id="debug-update-channel">-</div>
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
                    <div class="debug-label">Échelle Windows</div>
                    <div class="debug-value" id="debug-dpi-scale">-</div>
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
                <div class="debug-section">
                    <div class="debug-label">Résolution</div>
                    <div class="debug-value" id="debug-resolution">-</div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Fréquence</div>
                    <div class="debug-value" id="debug-refresh-rate">-</div>
                </div>
            </div>
            <div class="debug-footer">
                <span>Appuyez sur <kbd>D</kbd> pour fermer</span>
                <span><kbd>C</kbd> configurer</span>
                <span><kbd>L</kbd> médias</span>
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
                        <label for="config-update-channel">Canal de mise à jour</label>
                        <select id="config-update-channel">
                            <option value="stable">Stable</option>
                            <option value="beta">Beta</option>
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
                        <label>Échelle Windows</label>
                        <span class="config-value" id="config-dpi-scale">-</span>
                    </div>
                    <div id="config-dpi-warning" class="config-warning" style="display: none;">
                        ⚠️ <strong>Attention :</strong> Une mise à l'échelle Windows est détectée. En mode custom, cela peut causer des problèmes d'affichage. Réglez l'échelle à 100% dans les paramètres Windows.
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
                        <label>Type</label>
                        <span class="config-value" id="config-server-night-type">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Horaires</label>
                        <span class="config-value" id="config-server-night-hours">-</span>
                    </div>
                    <div class="config-group config-readonly">
                        <label>Luminosité Nuit</label>
                        <span class="config-value" id="config-server-night-brightness">-</span>
                    </div>
                    <div class="config-group config-readonly" id="config-server-night-solaire-group" style="display:none">
                        <label>Solaire</label>
                        <span class="config-value" id="config-server-night-solaire">-</span>
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
        document.getElementById('config-update-channel').value = config.updateChannel || 'stable';
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
        
        // Échelle Windows (DPI)
        const dpiScale = window.devicePixelRatio || 1;
        const dpiPercent = Math.round(dpiScale * 100);
        const isCustomMode = document.body.classList.contains('custom-mode') || window.IS_CUSTOM_MODE;
        const dpiEl = document.getElementById('config-dpi-scale');
        const dpiWarningEl = document.getElementById('config-dpi-warning');
        
        if (dpiScale === 1) {
            dpiEl.textContent = `${dpiPercent}% ✅`;
            dpiEl.style.color = '#4caf50';
            dpiWarningEl.style.display = 'none';
        } else if (isCustomMode) {
            dpiEl.textContent = `${dpiPercent}% ⚠️`;
            dpiEl.style.color = '#f44336';
            dpiWarningEl.style.display = 'block';
        } else {
            dpiEl.textContent = `${dpiPercent}%`;
            dpiEl.style.color = '#ff9800';
            dpiWarningEl.style.display = 'none';
        }
        
        document.getElementById('config-server-brightness').textContent = 
            apiResponse.luminosite !== undefined ? `${apiResponse.luminosite}%` : '-';
        
        // Section Mode Nuit
        const modeNuit = apiResponse.modeNuit || {};
        document.getElementById('config-server-night-mode').textContent = 
            modeNuit.actif ? '✅ Actif' : '❌ Inactif';
        
        // Type de mode nuit (fixe / auto)
        const nightType = modeNuit.type || 'fixe';
        document.getElementById('config-server-night-type').textContent = 
            nightType === 'auto' ? '☀️ Auto (solaire)' : '🕐 Fixe';
        
        document.getElementById('config-server-night-hours').textContent = 
            modeNuit.heureDebut && modeNuit.heureFin 
                ? `${modeNuit.heureDebut} - ${modeNuit.heureFin}` 
                : '-';
        
        document.getElementById('config-server-night-brightness').textContent = 
            modeNuit.luminositeNuit !== undefined ? `${modeNuit.luminositeNuit}%` : '-';
        
        // Infos solaires (uniquement en mode auto)
        const solaireGroup = document.getElementById('config-server-night-solaire-group');
        const solaireEl = document.getElementById('config-server-night-solaire');
        if (nightType === 'auto' && modeNuit.solaire) {
            const s = modeNuit.solaire;
            solaireGroup.style.display = '';
            const decalageInfo = (s.decalageDebut || s.decalageFin) 
                ? ` (décalage: +${s.decalageDebut || 0}/-${s.decalageFin || 0} min)` 
                : '';
            solaireEl.textContent = `🌅 ${s.lever || '-'} / 🌇 ${s.coucher || '-'}${decalageInfo}${s.ville ? ' — ' + s.ville : ''}`;
        } else {
            solaireGroup.style.display = 'none';
            solaireEl.textContent = '-';
        }
        
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
            updateChannel: document.getElementById('config-update-channel').value,
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
            
            /* En mode custom, positionner dans la zone visible */
            body.custom-mode #debug-overlay {
                right: auto;
                left: calc(var(--custom-width, 100vw) - 340px);
                bottom: auto;
                max-height: calc(var(--custom-height, 100vh) - 40px);
                overflow-y: auto;
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
            
            /* En mode custom, limiter à la zone visible */
            body.custom-mode #config-panel {
                width: var(--custom-width, 100%);
                height: var(--custom-height, 100%);
            }
            
            .config-dialog {
                background: #1a1a1a;
                border-radius: 12px;
                width: 420px;
                max-width: 90vw;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            /* En mode custom, adapter la taille du dialog */
            body.custom-mode .config-dialog {
                max-width: calc(var(--custom-width, 100vw) - 40px);
                max-height: calc(var(--custom-height, 100vh) - 40px);
                overflow-y: auto;
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
            
            .config-warning {
                background: rgba(255, 100, 100, 0.15);
                border: 1px solid rgba(255, 100, 100, 0.4);
                border-radius: 6px;
                padding: 10px 12px;
                margin: 10px 0;
                font-size: 11px;
                color: #ff8888;
                line-height: 1.4;
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
            
            /* Media List Panel */
            #media-list-panel {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.92);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 100001;
            }
            
            body.custom-mode #media-list-panel {
                width: var(--custom-width, 100%);
                height: var(--custom-height, 100%);
            }
            
            .media-dialog {
                background: #1a1a1a;
                border-radius: 12px;
                width: 700px;
                max-width: 90vw;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            body.custom-mode .media-dialog {
                max-width: calc(var(--custom-width, 100vw) - 40px);
                max-height: calc(var(--custom-height, 100vh) - 40px);
            }
            
            .media-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 20px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px 12px 0 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .media-close {
                cursor: pointer;
                font-size: 24px;
                color: #888;
                padding: 0 5px;
            }
            
            .media-close:hover {
                color: #fff;
            }
            
            .media-stats {
                padding: 8px 20px;
                color: #4fc3f7;
                font-size: 13px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            .media-stats-sep {
                margin: 0 8px;
                color: #555;
            }
            
            .media-list-header {
                display: grid;
                grid-template-columns: 30px 1fr 80px 130px;
                gap: 8px;
                padding: 8px 20px;
                color: #888;
                font-size: 11px;
                text-transform: uppercase;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .media-list-body {
                overflow-y: auto;
                max-height: 50vh;
                padding: 4px 0;
            }
            
            .media-item {
                display: grid;
                grid-template-columns: 30px 1fr 80px 130px;
                gap: 8px;
                padding: 6px 20px;
                color: #ddd;
                font-size: 13px;
                align-items: center;
                transition: background 0.15s;
            }
            
            .media-item:hover {
                background: rgba(255, 255, 255, 0.05);
            }
            
            .media-icon {
                text-align: center;
                font-size: 14px;
            }
            
            .media-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 12px;
            }
            
            .media-size {
                text-align: right;
                color: #aaa;
                font-size: 12px;
            }
            
            .media-date {
                text-align: right;
                color: #888;
                font-size: 11px;
            }
            
            .media-footer {
                padding: 10px 20px;
                text-align: center;
                color: #666;
                font-size: 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .media-footer kbd {
                background: rgba(255, 255, 255, 0.1);
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 11px;
                color: #aaa;
            }
            
            .media-list-body::-webkit-scrollbar {
                width: 6px;
            }
            
            .media-list-body::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .media-list-body::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
            }
            
            /* Tabs */
            .media-tabs {
                display: flex;
                gap: 4px;
            }
            
            .media-tab {
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #888;
                padding: 6px 14px;
                border-radius: 6px 6px 0 0;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
            }
            
            .media-tab:hover {
                color: #ccc;
                background: rgba(255, 255, 255, 0.05);
            }
            
            .media-tab.active {
                background: rgba(79, 195, 247, 0.15);
                color: #4fc3f7;
                border-color: rgba(79, 195, 247, 0.3);
                border-bottom-color: transparent;
            }
            
            .media-tab-content {
                display: flex;
                flex-direction: column;
                flex: 1;
                min-height: 0;
            }
            
            /* Trame de lecture */
            .trame-list-header {
                display: grid;
                grid-template-columns: 32px 24px 26px 60px 1fr 50px 120px;
                gap: 6px;
                padding: 8px 20px;
                color: #888;
                font-size: 11px;
                text-transform: uppercase;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .trame-item {
                display: grid;
                grid-template-columns: 32px 24px 26px 60px 1fr 50px 120px;
                gap: 6px;
                padding: 6px 20px;
                color: #ddd;
                font-size: 13px;
                align-items: center;
                transition: background 0.15s;
                border-left: 3px solid transparent;
            }
            
            .trame-item:hover {
                background: rgba(255, 255, 255, 0.05);
            }
            
            .trame-item.trame-current {
                background: rgba(76, 175, 80, 0.15);
                border-left-color: #4caf50;
            }
            
            .trame-item.trame-missing {
                background: rgba(244, 67, 54, 0.1);
            }
            
            .trame-item.trame-missing .trame-name {
                color: #f44336;
                text-decoration: line-through;
            }
            
            .trame-status {
                text-align: center;
                font-size: 12px;
            }
            
            .trame-pagedefault {
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }
            
            .trame-pagedefault .trame-name {
                color: #90caf9;
                font-style: italic;
            }
            
            .trame-idx {
                text-align: center;
                color: #666;
                font-size: 11px;
                font-family: 'Consolas', 'Courier New', monospace;
            }
            
            .trame-current .trame-idx {
                color: #4caf50;
                font-weight: bold;
            }
            
            .trame-type-icon {
                text-align: center;
                font-size: 14px;
            }
            
            .trame-type {
                font-size: 11px;
                color: #aaa;
                text-transform: uppercase;
            }
            
            .trame-item.trame-current .trame-type {
                color: #81c784;
            }
            
            .trame-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 12px;
            }
            
            .trame-dur {
                text-align: right;
                color: #ffb74d;
                font-size: 12px;
                font-family: 'Consolas', 'Courier New', monospace;
                white-space: nowrap;
            }
            
            .trame-diapo {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: #888;
                font-size: 11px;
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
        this._setValue('debug-env', env === 'local' ? 'Local' : env === 'beta' ? 'Beta' : 'Production', env === 'local' ? 'warning' : 'ok');
        
        // Canal de mise à jour
        const channel = config.updateChannel || 'stable';
        this._setValue('debug-update-channel', channel === 'beta' ? '⚠️ Beta' : 'Stable', channel === 'beta' ? 'warning' : 'ok');
        
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
        
        // Statut API (avec compteur d'erreurs consécutives)
        const consecutiveErrors = window.apiConsecutiveErrors || 0;
        if (consecutiveErrors > 0) {
            const lastErrAgo = window.lastApiError ? Math.round((Date.now() - window.lastApiError) / 1000) + 's' : '?';
            this._setValue('debug-api-status', `❌ ${consecutiveErrors} erreur${consecutiveErrors > 1 ? 's' : ''} (il y a ${lastErrAgo})`, 'error');
        } else if (window.apiManager) {
            this._setValue('debug-api-status', '✅ OK', 'ok');
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
        
        // Échelle Windows (DPI scaling)
        const dpiScale = window.devicePixelRatio || 1;
        const dpiPercent = Math.round(dpiScale * 100);
        const isCustomMode = document.body.classList.contains('custom-mode') || window.IS_CUSTOM_MODE;
        
        if (dpiScale === 1) {
            this._setValue('debug-dpi-scale', `${dpiPercent}% ✅`, 'ok');
        } else if (isCustomMode) {
            // Warning en mode custom avec scaling
            this._setValue('debug-dpi-scale', `${dpiPercent}% ⚠️ Custom!`, 'error');
        } else {
            this._setValue('debug-dpi-scale', `${dpiPercent}%`, 'warning');
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
            const nightType = apiResponse.modeNuit.type || 'fixe';
            const isNight = this._isInNightMode(debut, fin, now);
            const typeLabel = nightType === 'auto' ? '☀️auto' : 'fixe';
            const solaireVille = (nightType === 'auto' && apiResponse.modeNuit.solaire?.ville) ? ' — ' + apiResponse.modeNuit.solaire.ville : '';
            if (isNight) {
                this._setValue('debug-night-mode', `Actif [${typeLabel}]${solaireVille}`, 'warning');
            } else {
                this._setValue('debug-night-mode', `Inactif [${typeLabel}] (${debut}-${fin})${solaireVille}`, 'ok');
            }
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
                    
                    // Résolution et fréquence écran
                    if (info.screen) {
                        const s = info.screen;
                        const res = s.width + ' × ' + s.height + (s.scaleFactor && s.scaleFactor !== 1 ? ' (@' + s.scaleFactor + 'x)' : '');
                        this._setValue('debug-resolution', res);
                        if (s.refreshRate && s.refreshRate > 0) {
                            this._setValue('debug-refresh-rate', s.refreshRate + ' Hz');
                        } else {
                            this._setValue('debug-refresh-rate', 'N/A');
                        }
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
