/**
 * MediaCacheManager.js - Intégration MediaCache pour loopDiapo
 * 
 * Gère le téléchargement et le cache des médias pour loopDiapo
 * - Précharge le média suivant en arrière-plan
 * - Utilise ETag pour éviter les retéléchargements
 * - Limite la taille du disque cache
 * - Supprime automatiquement les fichiers LRU
 */

class MediaCacheManager {
  constructor(options = {}) {
    this.cache = options.cache || null; // Référence à window.apiManager ou similaire
    this.logger = (typeof window !== 'undefined' && window.logger) ? window.logger : console;
    this.mediaDir = 'media/'; // Sous BASE_PATH
    this.maxCacheBytes = options.maxCacheBytes || 500 * 1024 * 1024; // 500 MB
    this.preloadQueue = [];
    this.isPreloading = false;
  }

  /**
   * Initialiser avec référence au cache
   */
  init(cache) {
    this.cache = cache;
    _log('info', 'media-cache-manager', 'MediaCacheManager initialized');
  }

  /**
   * Télécharger et cacher un média avec fallback
   */
  async downloadMedia(url, filename) {
    if (!url || !filename) {
      _log('warn', 'media-cache-manager', 'downloadMedia: invalid url or filename');
      return false;
    }

    const relativePath = this.mediaDir + filename;
    _log('debug', 'media-cache-manager', `downloadMedia: ${filename} from ${url}`);

    try {
      // Utiliser API preload avec cache support
      if (typeof window !== 'undefined' && window.api && typeof window.api.saveBinaryWithCache === 'function') {
        const result = await window.api.saveBinaryWithCache(relativePath, url);
        if (result.success) {
          _log('info', 'media-cache-manager', `downloadMedia success: ${filename} (${result.size} bytes, cached=${result.cached})`);
          return true;
        } else {
          _log('error', 'media-cache-manager', `downloadMedia failed: ${filename} - ${result.error}`);
          return false;
        }
      }

      // Fallback: ancien API saveBinary (sans cache)
      if (typeof window !== 'undefined' && window.api && typeof window.api.saveBinary === 'function') {
        const result = await window.api.saveBinary(relativePath, url);
        _log('info', 'media-cache-manager', `downloadMedia (fallback): ${filename}`);
        return result;
      }

      _log('error', 'media-cache-manager', 'downloadMedia: no API available');
      return false;

    } catch (error) {
      _log('error', 'media-cache-manager', `downloadMedia exception: ${filename}`, error.message);
      return false;
    }
  }

  /**
   * Précharger le prochain média en arrière-plan
   */
  async preloadNext(nextUrl, nextFilename) {
    if (!nextUrl || !nextFilename) return;

    _log('debug', 'media-cache-manager', `preloadNext: queuing ${nextFilename}`);

    // Ajouter à la queue si pas déjà en cours
    this.preloadQueue.push({ url: nextUrl, filename: nextFilename });

    // Démarrer préchargement si pas déjà actif
    if (!this.isPreloading) {
      this._processPreloadQueue();
    }
  }

  /**
   * Traiter la queue de préchargement
   */
  async _processPreloadQueue() {
    if (this.isPreloading || this.preloadQueue.length === 0) return;

    this.isPreloading = true;

    while (this.preloadQueue.length > 0) {
      const { url, filename } = this.preloadQueue.shift();

      try {
        _log('debug', 'media-cache-manager', `preload processing: ${filename}`);
        await this.downloadMedia(url, filename);
      } catch (error) {
        _log('warn', 'media-cache-manager', `preload failed for ${filename}: ${error.message}`);
      }

      // Petit délai pour ne pas surcharger le réseau
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isPreloading = false;
    _log('debug', 'media-cache-manager', 'preload queue empty');
  }

  /**
   * Vider la queue de préchargement
   */
  clearPreloadQueue() {
    this.preloadQueue = [];
    _log('debug', 'media-cache-manager', 'preload queue cleared');
  }

  /**
   * Obtenir les infos du cache
   */
  async getCacheInfo() {
    try {
      if (typeof window !== 'undefined' && window.api && typeof window.api.getMediaCacheInfo === 'function') {
        const info = await window.api.getMediaCacheInfo();
        _log('debug', 'media-cache-manager', `cache info: ${info.files} files, ${Math.round(info.totalBytes / 1024 / 1024)} MB`);
        return info;
      }
    } catch (error) {
      _log('error', 'media-cache-manager', 'getCacheInfo failed', error.message);
    }
    return { totalBytes: 0, files: 0 };
  }

  /**
   * Définir la limite du cache
   */
  setCacheLimit(bytes) {
    try {
      if (typeof window !== 'undefined' && window.api && typeof window.api.setMediaCacheLimit === 'function') {
        const result = window.api.setMediaCacheLimit(bytes);
        _log('info', 'media-cache-manager', `cache limit set to ${Math.round(bytes / 1024 / 1024)} MB`);
        return result;
      }
    } catch (error) {
      _log('error', 'media-cache-manager', 'setCacheLimit failed', error.message);
    }
    return false;
  }

  /**
   * Pruner le cache (supprimé les fichiers LRU)
   */
  async pruneCache() {
    try {
      if (typeof window !== 'undefined' && window.api && typeof window.api.pruneMedia === 'function') {
        const result = await window.api.pruneMedia();
        _log('info', 'media-cache-manager', 'cache pruned');
        return result;
      }
    } catch (error) {
      _log('error', 'media-cache-manager', 'pruneCache failed', error.message);
    }
    return false;
  }

  /**
   * Obtenir les stats du cache
   */
  getStats() {
    return {
      preloadQueueLength: this.preloadQueue.length,
      isPreloading: this.isPreloading,
      maxCacheBytes: this.maxCacheBytes,
    };
  }
}

// Safe logger for this module
var _log = (function(){
  try {
    if (typeof window !== 'undefined' && window.logger) return function(level, tag, ...args){ try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); } catch(e){} }
  } catch(e) {}
  return function(level, tag, ...args){ try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} }
  }
})()

// Export for testability
try { module.exports = { MediaCacheManager } } catch (e) { }

// Global instance
if (typeof window !== 'undefined') {
  window.mediaCacheManager = new MediaCacheManager();
}
