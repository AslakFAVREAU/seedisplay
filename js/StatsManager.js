/**
 * StatsManager.js - Collecte et envoi de statistiques d'utilisation
 * 
 * Fonctionnalités :
 * - Collecte des temps d'affichage par média
 * - Comptage des erreurs
 * - Envoi quotidien au serveur
 * - Stockage local en attendant l'envoi
 */

class StatsManager {
    constructor() {
        this.stats = {
            sessionStart: new Date().toISOString(),
            ecranId: null,
            mediaStats: {},     // { mediaId: { displayCount, totalDuration, errors } }
            apiStats: {
                successCount: 0,
                errorCount: 0,
                avgResponseTime: 0,
                responseTimes: []
            },
            errors: [],         // Liste des erreurs
            uptime: 0
        };
        
        this.currentMedia = null;
        this.currentMediaStart = null;
        this.lastSendDate = null;
        this.sendHour = 3; // Envoyer à 3h du matin
        
        this._log = window.logger 
            ? (level, tag, msg) => window.logger[level](tag, msg)
            : (level, tag, msg) => console[level](`[${tag}] ${msg}`);
        
        this._loadFromStorage();
        this._startDailySendCheck();
        
        this._log('info', 'stats', 'StatsManager initialized');
    }
    
    /**
     * Définit l'ID de l'écran
     */
    setEcranId(id) {
        this.stats.ecranId = id;
    }
    
    /**
     * Enregistre le début d'affichage d'un média
     */
    startMedia(mediaId, mediaName, mediaType) {
        // Terminer le média précédent si nécessaire
        if (this.currentMedia) {
            this.endMedia();
        }
        
        this.currentMedia = {
            id: mediaId,
            name: mediaName,
            type: mediaType
        };
        this.currentMediaStart = Date.now();
        
        // Initialiser les stats si nouveau média
        if (!this.stats.mediaStats[mediaId]) {
            this.stats.mediaStats[mediaId] = {
                name: mediaName,
                type: mediaType,
                displayCount: 0,
                totalDuration: 0,
                lastDisplayed: null,
                errors: 0
            };
        }
        
        this.stats.mediaStats[mediaId].displayCount++;
        this.stats.mediaStats[mediaId].lastDisplayed = new Date().toISOString();
    }
    
    /**
     * Enregistre la fin d'affichage d'un média
     */
    endMedia() {
        if (!this.currentMedia || !this.currentMediaStart) return;
        
        const duration = Math.floor((Date.now() - this.currentMediaStart) / 1000);
        const mediaId = this.currentMedia.id;
        
        if (this.stats.mediaStats[mediaId]) {
            this.stats.mediaStats[mediaId].totalDuration += duration;
        }
        
        this.currentMedia = null;
        this.currentMediaStart = null;
        
        // Sauvegarder périodiquement
        this._saveToStorage();
    }
    
    /**
     * Enregistre une erreur de média
     */
    logMediaError(mediaId, errorType, errorMessage) {
        if (this.stats.mediaStats[mediaId]) {
            this.stats.mediaStats[mediaId].errors++;
        }
        
        this.stats.errors.push({
            timestamp: new Date().toISOString(),
            type: 'media',
            mediaId: mediaId,
            errorType: errorType,
            message: errorMessage
        });
        
        // Limiter à 100 erreurs
        if (this.stats.errors.length > 100) {
            this.stats.errors = this.stats.errors.slice(-100);
        }
        
        this._saveToStorage();
    }
    
    /**
     * Enregistre une requête API
     */
    logApiRequest(url, success, responseTime) {
        if (success) {
            this.stats.apiStats.successCount++;
        } else {
            this.stats.apiStats.errorCount++;
        }
        
        // Garder les 50 derniers temps de réponse
        this.stats.apiStats.responseTimes.push(responseTime);
        if (this.stats.apiStats.responseTimes.length > 50) {
            this.stats.apiStats.responseTimes.shift();
        }
        
        // Calculer la moyenne
        const times = this.stats.apiStats.responseTimes;
        this.stats.apiStats.avgResponseTime = Math.round(
            times.reduce((a, b) => a + b, 0) / times.length
        );
    }
    
    /**
     * Enregistre une erreur générale
     */
    logError(errorType, message, details = null) {
        this.stats.errors.push({
            timestamp: new Date().toISOString(),
            type: errorType,
            message: message,
            details: details
        });
        
        // Limiter à 100 erreurs
        if (this.stats.errors.length > 100) {
            this.stats.errors = this.stats.errors.slice(-100);
        }
        
        this._saveToStorage();
    }
    
    /**
     * Obtient un résumé des statistiques
     */
    getSummary() {
        const mediaCount = Object.keys(this.stats.mediaStats).length;
        let totalDisplays = 0;
        let totalDuration = 0;
        let totalErrors = 0;
        
        for (const mediaId in this.stats.mediaStats) {
            const m = this.stats.mediaStats[mediaId];
            totalDisplays += m.displayCount;
            totalDuration += m.totalDuration;
            totalErrors += m.errors;
        }
        
        return {
            sessionStart: this.stats.sessionStart,
            ecranId: this.stats.ecranId,
            mediaCount: mediaCount,
            totalDisplays: totalDisplays,
            totalDuration: totalDuration,
            totalErrors: totalErrors,
            apiSuccess: this.stats.apiStats.successCount,
            apiErrors: this.stats.apiStats.errorCount,
            avgApiResponseTime: this.stats.apiStats.avgResponseTime
        };
    }
    
    /**
     * Envoie les statistiques au serveur
     */
    async sendToServer() {
        const ecranId = this.stats.ecranId || window.configSEE?.idEcran || 1;
        const env = window.configSEE?.env || 'prod';
        
        const baseUrl = env === 'local' 
            ? 'http://localhost:8000' 
            : 'https://soek.fr';
        
        const url = `${baseUrl}/see/API/stats/${ecranId}`;
        
        // Préparer les données
        const payload = {
            ...this.stats,
            uptime: Math.floor((Date.now() - new Date(this.stats.sessionStart).getTime()) / 1000),
            sentAt: new Date().toISOString()
        };
        
        this._log('info', 'stats', 'Sending stats to server: ' + url);
        
        try {
            let response;
            
            if (window.api && window.api.fetchJson) {
                // Utiliser l'API preload pour POST
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                // Fallback axios
                response = await window.axios.post(url, payload);
            }
            
            this._log('info', 'stats', 'Stats sent successfully');
            this.lastSendDate = new Date().toDateString();
            localStorage.setItem('stats_lastSend', this.lastSendDate);
            
            // Réinitialiser les stats après envoi réussi
            this._resetStats();
            
            return true;
            
        } catch (error) {
            this._log('error', 'stats', 'Failed to send stats: ' + error.message);
            return false;
        }
    }
    
    /**
     * Vérifie si on doit envoyer les stats (une fois par jour à 3h)
     */
    _startDailySendCheck() {
        // Vérifier toutes les heures
        setInterval(() => {
            this._checkAndSend();
        }, 60 * 60 * 1000); // 1 heure
        
        // Vérifier aussi au démarrage (après 1 minute)
        setTimeout(() => {
            this._checkAndSend();
        }, 60 * 1000);
    }
    
    /**
     * Vérifie et envoie si nécessaire
     */
    _checkAndSend() {
        const now = new Date();
        const currentHour = now.getHours();
        const today = now.toDateString();
        
        // Envoyer si on est à l'heure d'envoi et pas encore envoyé aujourd'hui
        if (currentHour === this.sendHour && this.lastSendDate !== today) {
            this._log('info', 'stats', 'Daily stats send triggered');
            this.sendToServer();
        }
    }
    
    /**
     * Réinitialise les statistiques après envoi
     */
    _resetStats() {
        this.stats = {
            sessionStart: new Date().toISOString(),
            ecranId: this.stats.ecranId,
            mediaStats: {},
            apiStats: {
                successCount: 0,
                errorCount: 0,
                avgResponseTime: 0,
                responseTimes: []
            },
            errors: [],
            uptime: 0
        };
        
        this._saveToStorage();
    }
    
    /**
     * Sauvegarde les stats dans localStorage
     */
    _saveToStorage() {
        try {
            localStorage.setItem('stats_data', JSON.stringify(this.stats));
        } catch (e) {
            // Ignorer les erreurs de quota
        }
    }
    
    /**
     * Charge les stats depuis localStorage
     */
    _loadFromStorage() {
        try {
            const saved = localStorage.getItem('stats_data');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Fusionner avec les stats actuelles
                this.stats.mediaStats = parsed.mediaStats || {};
                this.stats.apiStats = parsed.apiStats || this.stats.apiStats;
                this.stats.errors = parsed.errors || [];
            }
            
            this.lastSendDate = localStorage.getItem('stats_lastSend') || null;
            
        } catch (e) {
            this._log('warn', 'stats', 'Failed to load stats from storage');
        }
    }
    
    /**
     * Force l'envoi des statistiques (pour debug)
     */
    forceSync() {
        return this.sendToServer();
    }
}

// Initialisation globale
window.statsManager = new StatsManager();
