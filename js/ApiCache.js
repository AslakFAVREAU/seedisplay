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
        this.cacheFile = 'cache_diapo.json'; // Fichier persistant sous BASE_PATH
        this.maxAge = 24 * 60 * 60 * 1000; // 24 heures max
        this._fileSaveDebounce = null;
        
        // Charger le cache existant (localStorage d'abord, puis fichier)
        this.cache = this._loadCache();
        // Charger aussi depuis le fichier disque (async, plus fiable après redémarrage)
        this._loadFromFile();
    }
    
    /**
     * Charger le cache depuis localStorage
     */
    _loadCache() {
        try {
            const stored = localStorage.getItem(this.cacheKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                this._log('debug', 'api-cache', 'Loaded cache from localStorage with ' + Object.keys(parsed).length + ' entries');
                return parsed;
            }
        } catch(e) {
            this._log('warn', 'api-cache', 'Failed to load cache from localStorage: ' + e.message);
        }
        return {};
    }
    
    /**
     * Charger le cache depuis le fichier disque (async)
     * Fusionne avec le cache localStorage existant, en gardant les données les plus récentes
     */
    async _loadFromFile() {
        try {
            if (!window.api || !window.api.readFile) {
                if (window._sl) window._sl('ApiCache._loadFromFile: SKIP (no window.api.readFile)')
                return;
            }
            if (window._sl) window._sl('ApiCache._loadFromFile: reading ' + this.cacheFile + '...')
            const content = await window.api.readFile(this.cacheFile);
            if (!content) {
                if (window._sl) window._sl('ApiCache._loadFromFile: file NOT FOUND or empty')
                return;
            }
            
            const fileCache = JSON.parse(content);
            if (!fileCache || typeof fileCache !== 'object') return;
            
            let merged = 0;
            for (const key of Object.keys(fileCache)) {
                const fileEntry = fileCache[key];
                const memEntry = this.cache[key];
                
                // Garder l'entrée la plus récente
                if (!memEntry || (fileEntry.timestamp && fileEntry.timestamp > (memEntry.timestamp || 0))) {
                    this.cache[key] = fileEntry;
                    merged++;
                }
            }
            
            if (merged > 0) {
                if (window._sl) window._sl('ApiCache._loadFromFile: merged ' + merged + ' entries from disk (keys: ' + Object.keys(fileCache).join(',') + ')')
                this._log('info', 'api-cache', 'Loaded ' + merged + ' entries from disk file (' + this.cacheFile + ')');
                // Mettre à jour localStorage avec les données fusionnées
                this._saveToLocalStorage();
            } else {
                if (window._sl) window._sl('ApiCache._loadFromFile: disk loaded but no newer entries (keys: ' + Object.keys(fileCache).join(',') + ')')
                this._log('debug', 'api-cache', 'Disk cache loaded, no newer entries');
            }
        } catch(e) {
            if (window._sl) window._sl('ApiCache._loadFromFile: FAILED: ' + e.message)
            this._log('warn', 'api-cache', 'Failed to load cache from file: ' + e.message);
        }
    }
    
    /**
     * Sauvegarder dans localStorage uniquement
     */
    _saveToLocalStorage() {
        try {
            localStorage.setItem(this.cacheKey, JSON.stringify(this.cache));
        } catch(e) {
            this._log('warn', 'api-cache', 'Failed to save cache to localStorage: ' + e.message);
        }
    }
    
    /**
     * Sauvegarder le cache dans localStorage ET sur fichier disque
     */
    _saveCache() {
        this._saveToLocalStorage();
        this._saveToFile();
    }
    
    /**
     * Sauvegarder le cache sur fichier disque (debounced pour éviter les écritures multiples)
     */
    _saveToFile() {
        // Debounce: attendre 2s après le dernier appel avant d'écrire
        if (this._fileSaveDebounce) clearTimeout(this._fileSaveDebounce);
        this._fileSaveDebounce = setTimeout(() => {
            this._doSaveToFile();
        }, 2000);
    }
    
    async _doSaveToFile() {
        try {
            if (!window.api || !window.api.writeFile) return;
            const content = JSON.stringify(this.cache, null, 2);
            await window.api.writeFile(this.cacheFile, content);
            this._log('info', 'api-cache', 'Cache saved to disk (' + this.cacheFile + ', ' + Math.round(content.length / 1024) + ' KB)');
        } catch(e) {
            this._log('warn', 'api-cache', 'Failed to save cache to file: ' + e.message);
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

    /**
     * Retourne le nombre d'entrées dans le cache
     */
    getEntryCount() {
        return Object.keys(this.cache).length;
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
