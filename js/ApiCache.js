/**
 * ApiCache.js - Cache pour les réponses API (mode offline)
 * 
 * Permet de stocker les dernières réponses API valides
 * et de les utiliser en fallback si le serveur est inaccessible.
 * 
 * Stockage en localStorage + fichier local pour persistance.
 */

// Safe logger
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { 
        try { 
            if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); 
            if (console && typeof console[level] === 'function') return console[level](tag, ...args); 
            return console.log(tag, ...args) 
        } catch(e){ try{ console.log(tag, ...args) }catch(_){} } 
    }
}

class ApiCache {
    constructor() {
        this._log = window.__log || console.log;
        this.cacheKey = 'seedisplay_api_cache';
        this.maxAge = 24 * 60 * 60 * 1000; // 24 heures max
        
        // Charger le cache existant
        this.cache = this._loadCache();
    }
    
    /**
     * Charger le cache depuis localStorage
     */
    _loadCache() {
        try {
            const stored = localStorage.getItem(this.cacheKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                this._log('debug', 'api-cache', 'Loaded cache with ' + Object.keys(parsed).length + ' entries');
                return parsed;
            }
        } catch(e) {
            this._log('warn', 'api-cache', 'Failed to load cache: ' + e.message);
        }
        return {};
    }
    
    /**
     * Sauvegarder le cache dans localStorage
     */
    _saveCache() {
        try {
            localStorage.setItem(this.cacheKey, JSON.stringify(this.cache));
        } catch(e) {
            this._log('warn', 'api-cache', 'Failed to save cache: ' + e.message);
        }
    }
    
    /**
     * Stocker une réponse API
     * @param {string} key - Clé unique (ex: 'diapo_1', 'planning_1')
     * @param {Object} data - Données à stocker
     */
    set(key, data) {
        const entry = {
            data: data,
            timestamp: Date.now(),
            version: '1.0'
        };
        
        this.cache[key] = entry;
        this._saveCache();
        this._log('info', 'api-cache', 'Cached: ' + key);
    }
    
    /**
     * Récupérer une réponse API depuis le cache
     * @param {string} key - Clé unique
     * @param {boolean} allowExpired - Autoriser les données expirées (mode offline)
     * @returns {Object|null}
     */
    get(key, allowExpired = false) {
        const entry = this.cache[key];
        
        if (!entry) {
            this._log('debug', 'api-cache', 'Miss: ' + key);
            return null;
        }
        
        const age = Date.now() - entry.timestamp;
        const isExpired = age > this.maxAge;
        
        if (isExpired && !allowExpired) {
            this._log('debug', 'api-cache', 'Expired: ' + key + ' (age: ' + Math.round(age/1000/60) + 'min)');
            return null;
        }
        
        if (isExpired) {
            this._log('warn', 'api-cache', 'Using expired cache (offline mode): ' + key);
        } else {
            this._log('info', 'api-cache', 'Hit: ' + key + ' (age: ' + Math.round(age/1000/60) + 'min)');
        }
        
        return entry.data;
    }
    
    /**
     * Vérifie si une clé existe dans le cache (même expirée)
     */
    has(key) {
        return !!this.cache[key];
    }
    
    /**
     * Récupère l'âge d'une entrée en minutes
     */
    getAge(key) {
        const entry = this.cache[key];
        if (!entry) return -1;
        return Math.round((Date.now() - entry.timestamp) / 1000 / 60);
    }
    
    /**
     * Nettoie les entrées trop vieilles (> 7 jours)
     */
    cleanup() {
        const maxOldAge = 7 * 24 * 60 * 60 * 1000; // 7 jours
        let cleaned = 0;
        
        for (const key of Object.keys(this.cache)) {
            const entry = this.cache[key];
            if (Date.now() - entry.timestamp > maxOldAge) {
                delete this.cache[key];
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            this._saveCache();
            this._log('info', 'api-cache', 'Cleaned ' + cleaned + ' old entries');
        }
    }
    
    /**
     * Vide tout le cache
     */
    clear() {
        this.cache = {};
        this._saveCache();
        this._log('info', 'api-cache', 'Cache cleared');
    }
}

// Export global pour le navigateur
if (typeof window !== 'undefined') {
    window.ApiCache = ApiCache;
    window.apiCache = new ApiCache();
}

// Export pour Node.js (tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiCache;
}
