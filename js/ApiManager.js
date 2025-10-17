/**
 * ApiManager.js - Gestion des appels API avec ErrorHandler
 * 
 * Cette couche enveloppe les appels à:
 * - Diapo API (https://soek.fr/see/API/diapo/{idEcran})
 * - Open-Meteo API (gratuit, pas de clé)
 * 
 * Pattern: Circuit Breaker + Retry + Fallback
 */

// Safe logger for this module (works in renderer or Node tests)
var _log = (function(){
  try {
    if (typeof window !== 'undefined' && window.logger) return function(level, tag, ...args){ try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); } catch(e){} }
  } catch(e) {}
  return function(level, tag, ...args){ try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} }
  }
})()

class ApiManager {
  constructor() {
    this.logger = (typeof window !== 'undefined' && window.logger) ? window.logger : console;
    this.errorHandler = null; // Sera initialisé avec window.errorHandler
    
    // Configuration par API
    this.apis = {
      diapo: {
        name: 'diapo-api',
        maxRetries: 3,
        retryDelay: 1000,
        failureThreshold: 5,
        recoveryTimeout: 30000,
        timeout: 10000,
      },
      meteo: {
        name: 'meteo-api',
        maxRetries: 2,
        retryDelay: 800,
        failureThreshold: 8,
        recoveryTimeout: 60000,
        timeout: 8000,
      }
    };
  }

  /**
   * Initialiser ApiManager avec ErrorHandler
   */
  init(errorHandler) {
    this.errorHandler = errorHandler;
    _log('info', 'api-manager', 'ApiManager initialized with ErrorHandler');
  }

  /**
   * Wrapper pour GET axios avec timeout et retry
   */
  async _axiosGetWithTimeout(url, timeoutMs) {
    // Créer une promesse de timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    );

    try {
      // Race axios contre timeout
      const response = await Promise.race([
        axios.get(url),
        timeoutPromise
      ]);
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Récupérer les diapos avec ErrorHandler
   */
  async getDiapoWithErrorHandling(urlAPI) {
    _log('info', 'api-manager', `getDiapoWithErrorHandling: ${urlAPI}`);

    if (!this.errorHandler) {
      _log('warn', 'api-manager', 'ErrorHandler not initialized, falling back to direct call');
      try {
        const res = await this._axiosGetWithTimeout(urlAPI, this.apis.diapo.timeout);
        return res;
      } catch (error) {
        _log('error', 'api-manager', 'Direct diapo call failed', error.message);
        throw error;
      }
    }

    // Utiliser ErrorHandler pour gestion robuste
    try {
      const result = await this.errorHandler.executeWithRetry(
        this.apis.diapo.name,
        async () => {
          return await this._axiosGetWithTimeout(urlAPI, this.apis.diapo.timeout);
        },
        {
          maxRetries: this.apis.diapo.maxRetries,
          retryDelay: this.apis.diapo.retryDelay,
          backoffMultiplier: 2,
        }
      );

      _log('info', 'api-manager', 'getDiapoWithErrorHandling: success', result.status);
      return result;

    } catch (error) {
      _log('error', 'api-manager', 'getDiapoWithErrorHandling: all retries failed', error.message);
      
      // Tenter fallback basique
      try {
        if (window && window.ArrayDiapo && window.ArrayDiapo.length > 0) {
          _log('info', 'api-manager', 'Using cached diapo array');
        }
      } catch (e) {}

      throw error;
    }
  }

  /**
   * Récupérer la météo avec ErrorHandler
   */
  async getMeteoWithErrorHandling(url) {
    _log('info', 'api-manager', `getMeteoWithErrorHandling: ${url}`);

    if (!this.errorHandler) {
      _log('warn', 'api-manager', 'ErrorHandler not initialized, falling back to direct call');
      try {
        const res = await this._axiosGetWithTimeout(url, this.apis.meteo.timeout);
        return res.data;
      } catch (error) {
        _log('error', 'api-manager', 'Direct meteo call failed', error.message);
        return null;
      }
    }

    // Utiliser ErrorHandler pour gestion robuste
    try {
      const result = await this.errorHandler.executeWithRetry(
        this.apis.meteo.name,
        async () => {
          const res = await this._axiosGetWithTimeout(url, this.apis.meteo.timeout);
          return res.data;
        },
        {
          maxRetries: this.apis.meteo.maxRetries,
          retryDelay: this.apis.meteo.retryDelay,
          backoffMultiplier: 1.5,
        }
      );

      _log('info', 'api-manager', 'getMeteoWithErrorHandling: success');
      return result;

    } catch (error) {
      _log('error', 'api-manager', 'getMeteoWithErrorHandling: all retries failed', error.message);
      return null; // Fallback silencieux pour meteo
    }
  }

  /**
   * Obtenir l'état du circuit breaker (pour le monitoring)
   */
  getCircuitBreakerStatus() {
    if (!this.errorHandler) {
      return { diapo: 'unavailable', meteo: 'unavailable' };
    }

    return {
      diapo: this.errorHandler.getCircuitBreakerStatus(this.apis.diapo.name),
      meteo: this.errorHandler.getCircuitBreakerStatus(this.apis.meteo.name),
    };
  }

  /**
   * Réinitialiser les circuit breakers après incident critique
   */
  resetCircuitBreakers() {
    _log('info', 'api-manager', 'Resetting all circuit breakers');
    if (this.errorHandler) {
      this.errorHandler.resetCircuitBreaker(this.apis.diapo.name);
      this.errorHandler.resetCircuitBreaker(this.apis.meteo.name);
    }
  }
}

// Export pour testabilité Node
try { module.exports = { ApiManager } } catch (e) { }

// Global instance
if (typeof window !== 'undefined') {
  window.apiManager = new ApiManager();
}
