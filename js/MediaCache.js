/**
 * MediaCache.js - Système de cache intelligent pour médias
 * 
 * Fonctionnalités:
 * - Cache LRU (Least Recently Used)
 * - Gestion ETags / Last-Modified
 * - Invalidation automatique
 * - Versioning de fichiers
 * - Fallback local en cas d'erreur réseau
 */

class MediaCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 500 * 1024 * 1024; // 500 MB
    this.maxAge = options.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 jours
    this.basePath = options.basePath || 'C:/SEE/media/';
    
    this.cache = new Map();
    this.metadata = new Map(); // ETag, Last-Modified, timestamp
    this.currentSize = 0;
    
    this.logger = options.logger || console;
  }

  /**
   * Récupère un média avec gestion du cache
   */
  async get(url, options = {}) {
    const cacheKey = this.getCacheKey(url);
    
    try {
      // Vérifier cache mémoire
      if (this.cache.has(cacheKey) && !this.isExpired(cacheKey)) {
        this.logger.info('cache', `HIT: ${url}`);
        this.touchFile(cacheKey); // Marquer comme utilisé (LRU)
        return this.cache.get(cacheKey);
      }

      // Vérifier fichier local
      const localPath = this.basePath + cacheKey;
      if (this.fileExists(localPath) && !this.isExpired(cacheKey)) {
        this.logger.info('cache', `HIT (disk): ${url}`);
        const data = this.readFile(localPath);
        this.cache.set(cacheKey, data); // Charger en mémoire
        this.touchFile(cacheKey);
        return data;
      }

      // Télécharger avec vérification ETag
      const data = await this.fetchWithETag(url);
      
      // Stocker en cache
      this.set(cacheKey, data, { url });
      return data;
      
    } catch (error) {
      this.logger.error('cache', `MISS + ERROR: ${url}`, error.message);
      
      // Fallback : essayer le disque même expiré
      const localPath = this.basePath + cacheKey;
      if (this.fileExists(localPath)) {
        this.logger.warn('cache', `Fallback to expired cache: ${url}`);
        return this.readFile(localPath);
      }
      
      throw error;
    }
  }

  /**
   * Télécharger avec gestion ETag
   */
  async fetchWithETag(url) {
    const cacheKey = this.getCacheKey(url);
    const metadata = this.metadata.get(cacheKey) || {};
    
    const headers = {};
    if (metadata.etag) {
      headers['If-None-Match'] = metadata.etag;
    }
    if (metadata.lastModified) {
      headers['If-Modified-Since'] = metadata.lastModified;
    }

    try {
      const response = await fetch(url, { headers });
      
      if (response.status === 304) {
        // Non modifié - utiliser cache existant
        this.logger.debug('cache', `304 Not Modified: ${url}`);
        this.touchFile(cacheKey);
        return this.cache.get(cacheKey);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.blob();
      
      // Sauvegarder métadonnées
      this.metadata.set(cacheKey, {
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
        timestamp: Date.now(),
      });

      this.logger.info('cache', `FETCH OK: ${url} (${(data.size / 1024).toFixed(1)}KB)`);
      return data;
      
    } catch (error) {
      this.logger.error('cache', `Fetch failed: ${url}`, error.message);
      throw error;
    }
  }

  /**
   * Stocker en cache (mémoire + disque)
   */
  set(key, data, options = {}) {
    const size = this.getDataSize(data);
    
    // Vérifier limite
    while (this.currentSize + size > this.maxSize) {
      this.evictLRU();
    }

    // Mémoire
    this.cache.set(key, data);
    this.currentSize += size;

    // Disque
    try {
      const localPath = this.basePath + key;
      this.writeFile(localPath, data);
      this.logger.debug('cache', `Cached to disk: ${key}`);
    } catch (e) {
      this.logger.warn('cache', `Failed to write disk cache: ${key}`, e.message);
    }

    // Métadonnées
    if (!this.metadata.has(key)) {
      this.metadata.set(key, {
        timestamp: Date.now(),
        url: options.url,
      });
    }
  }

  /**
   * Calculer taille de données
   */
  getDataSize(data) {
    if (data.size !== undefined) return data.size; // Blob/File
    if (data.length !== undefined) return data.length; // String/Buffer
    if (data.byteLength !== undefined) return data.byteLength; // ArrayBuffer
    return 1024; // Estimation par défaut
  }

  /**
   * Expulser l'élément le moins récemment utilisé (LRU)
   */
  evictLRU() {
    let lruKey = null;
    let lruTime = Infinity;

    for (const [key, meta] of this.metadata.entries()) {
      if (meta.timestamp < lruTime) {
        lruTime = meta.timestamp;
        lruKey = key;
      }
    }

    if (lruKey) {
      const data = this.cache.get(lruKey);
      this.currentSize -= this.getDataSize(data);
      
      this.cache.delete(lruKey);
      this.metadata.delete(lruKey);
      
      this.logger.debug('cache', `Evicted LRU: ${lruKey}`);
    }
  }

  /**
   * Marquer un fichier comme utilisé (pour LRU)
   */
  touchFile(key) {
    const meta = this.metadata.get(key);
    if (meta) {
      meta.timestamp = Date.now();
    }
  }

  /**
   * Vérifier si un cache est expiré
   */
  isExpired(key) {
    const meta = this.metadata.get(key);
    if (!meta) return true;
    return Date.now() - meta.timestamp > this.maxAge;
  }

  /**
   * Clé de cache (normaliser URL)
   */
  getCacheKey(url) {
    const hash = this.hashCode(url);
    const ext = url.split('.').pop() || 'bin';
    return `${hash}.${ext}`;
  }

  /**
   * Simple hash pour URL
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Statistiques du cache
   */
  getStats() {
    return {
      itemsMemory: this.cache.size,
      sizeMemoryMB: (this.currentSize / 1024 / 1024).toFixed(2),
      maxSizeMB: (this.maxSize / 1024 / 1024).toFixed(2),
      utilizationPercent: ((this.currentSize / this.maxSize) * 100).toFixed(1),
      maxAge: this.maxAge,
    };
  }

  /**
   * Vider le cache
   */
  clear() {
    this.cache.clear();
    this.metadata.clear();
    this.currentSize = 0;
    this.logger.info('cache', 'Cache cleared');
  }

  /**
   * Pré-charger des médias
   */
  async preload(urls) {
    this.logger.info('cache', `Preloading ${urls.length} items...`);
    
    for (const url of urls) {
      try {
        await this.get(url);
      } catch (error) {
        this.logger.warn('cache', `Preload failed: ${url}`, error.message);
      }
    }
    
    this.logger.info('cache', 'Preload complete');
  }

  // Stubs pour fichier I/O (implémenter avec electron/fs)
  fileExists(path) {
    // À implémenter
    return false;
  }

  readFile(path) {
    // À implémenter
    return null;
  }

  writeFile(path, data) {
    // À implémenter
  }
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MediaCache };
}
