/**
 * ErrorHandler.js - Gestion des erreurs avec circuit breaker
 * 
 * Patterns:
 * - Circuit Breaker (fail-fast après N erreurs)
 * - Retry avec backoff exponentiel
 * - Fallback content
 * - Error logging & reporting
 */

class ErrorHandler {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // ms
    this.maxRetryDelay = options.maxRetryDelay || 10000;
    
    // Circuit breaker
    this.circuitBreakers = new Map();
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 30000; // 30s
    
    // Erreurs globales
    this.errorLog = [];
    this.maxErrorLogSize = options.maxErrorLogSize || 100;
    
    // Fallback content
    this.fallbacks = new Map();
  }

  /**
   * Créer ou obtenir un circuit breaker
   */
  getCircuitBreaker(name, options = {}) {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, {
        name,
        state: 'closed', // closed | open | half-open
        failureCount: 0,
        successCount: 0,
        lastFailTime: null,
        threshold: options.failureThreshold || this.failureThreshold,
        recoveryTimeout: options.recoveryTimeout || this.recoveryTimeout,
      });
    }
    return this.circuitBreakers.get(name);
  }

  /**
   * Exécuter une fonction avec retry + circuit breaker
   */
  async executeWithRetry(name, fn, options = {}) {
    const cb = this.getCircuitBreaker(name, options);
    
    // Vérifier circuit breaker
    if (!this.canExecute(cb)) {
      const error = new Error(`Circuit breaker OPEN for ${name}`);
      this.logError(error, { operation: name, reason: 'circuit-breaker' });
      
      // Retourner fallback
      const fallback = this.getFallback(name);
      if (fallback) {
        this.logger.warn('error', `Using fallback for ${name}`);
        return fallback;
      }
      
      throw error;
    }

    let lastError;
    const delay = options.delay || this.retryDelay;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await fn();
        
        // Succès - reset circuit breaker
        this.recordSuccess(cb);
        return result;
        
      } catch (error) {
        lastError = error;
        
        this.logger.warn('error', 
          `Attempt ${attempt + 1}/${this.maxRetries + 1} failed for ${name}: ${error.message}`
        );
        
        if (attempt < this.maxRetries) {
          const backoffDelay = Math.min(
            delay * Math.pow(2, attempt),
            this.maxRetryDelay
          );
          
          await this.sleep(backoffDelay);
        }
      }
    }

    // Toutes les tentatives ont échoué
    this.recordFailure(cb);
    this.logError(lastError, { operation: name, attempts: this.maxRetries + 1 });
    
    // Retourner fallback si disponible
    const fallback = this.getFallback(name);
    if (fallback) {
      this.logger.warn('error', `Using fallback for ${name} after exhausted retries`);
      return fallback;
    }
    
    throw lastError;
  }

  /**
   * Vérifier si le circuit breaker autorise l'exécution
   */
  canExecute(cb) {
    if (cb.state === 'closed') {
      return true;
    }
    
    if (cb.state === 'open') {
      const elapsed = Date.now() - cb.lastFailTime;
      if (elapsed > cb.recoveryTimeout) {
        cb.state = 'half-open';
        cb.successCount = 0;
        this.logger.info('error', `Circuit breaker ${cb.name} entering HALF-OPEN state`);
        return true;
      }
      return false;
    }
    
    if (cb.state === 'half-open') {
      return true;
    }
    
    return false;
  }

  /**
   * Enregistrer succès
   */
  recordSuccess(cb) {
    if (cb.state === 'half-open') {
      cb.successCount++;
      if (cb.successCount >= 2) {
        cb.state = 'closed';
        cb.failureCount = 0;
        this.logger.info('error', `Circuit breaker ${cb.name} recovered to CLOSED`);
      }
    } else if (cb.state === 'closed') {
      cb.failureCount = 0;
    }
  }

  /**
   * Enregistrer échec
   */
  recordFailure(cb) {
    cb.failureCount++;
    cb.successCount = 0; // Reset success count on failure
    cb.lastFailTime = Date.now();
    
    if (cb.failureCount >= cb.threshold && cb.state === 'closed') {
      cb.state = 'open';
      this.logger.error('error', 
        `Circuit breaker ${cb.name} OPENED after ${cb.failureCount} failures`
      );
    } else if (cb.state === 'half-open') {
      cb.state = 'open'; // Reopen if half-open fails
    }
  }

  /**
   * Enregistrer une erreur
   */
  logError(error, metadata = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      metadata,
    };
    
    this.errorLog.push(entry);
    
    // Limite la taille du log
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog.shift();
    }
    
    this.logger.error('error', `[${metadata.operation}] ${error.message}`);
  }

  /**
   * Définir fallback pour une opération
   */
  setFallback(name, fallbackData) {
    this.fallbacks.set(name, fallbackData);
  }

  /**
   * Obtenir fallback
   */
  getFallback(name) {
    return this.fallbacks.get(name);
  }

  /**
   * Obtenir l'état d'un circuit breaker
   */
  getCircuitBreakerStatus(name) {
    const cb = this.circuitBreakers.get(name);
    if (!cb) return null;
    
    return {
      name: cb.name,
      state: cb.state,
      failureCount: cb.failureCount,
      successCount: cb.successCount,
      threshold: cb.threshold,
    };
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(name) {
    const cb = this.getCircuitBreaker(name);
    cb.state = 'closed';
    cb.failureCount = 0;
    cb.successCount = 0;
    this.logger.info('error', `Circuit breaker ${name} reset to CLOSED`);
  }

  /**
   * Obtenir historique des erreurs
   */
  getErrorHistory() {
    return this.errorLog;
  }

  /**
   * Obtenir statistiques d'erreurs
   */
  getErrorStats() {
    const stats = {};
    
    for (const entry of this.errorLog) {
      const op = entry.metadata.operation || 'unknown';
      if (!stats[op]) {
        stats[op] = { count: 0, lastError: null };
      }
      stats[op].count++;
      stats[op].lastError = entry.timestamp;
    }
    
    return stats;
  }

  /**
   * Nettoyer les erreurs
   */
  clearErrorLog() {
    this.errorLog = [];
  }

  /**
   * Installe les handlers globaux window.onerror et unhandledrejection.
   * Appelé une seule fois au démarrage pour capturer toutes les erreurs JS non-gérées.
   */
  installGlobalHandlers() {
    window.addEventListener('error', (event) => {
      this.logError(new Error(event.message || 'Unknown JS error'), {
        operation: 'global-js-error',
        source: event.filename ? (event.filename.split('/').pop() + ':' + event.lineno) : 'unknown',
        type: 'uncaught'
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      const msg = event.reason instanceof Error
        ? event.reason.message
        : (typeof event.reason === 'string' ? event.reason : 'Unhandled promise rejection')
      this.logError(new Error(msg), {
        operation: 'unhandled-rejection',
        type: 'promise'
      })
    })

    if (this.logger.info) this.logger.info('error', 'Global error handlers installed')
  }

  /**
   * Retourne les N erreurs les plus récentes en format compact (sans stack).
   * Utilisé par HeartbeatManager pour remonter les erreurs vers SOEK.
   */
  getRecentErrors(n = 10) {
    return this.errorLog.slice(-n).map(e => ({
      ts: e.timestamp,
      msg: e.message,
      op: (e.metadata && e.metadata.operation) || 'unknown',
      type: (e.metadata && e.metadata.type) || null,
      source: (e.metadata && e.metadata.source) || null
    }))
  }

  /**
   * Retourne l'état de tous les circuit breakers.
   * Utilisé par HeartbeatManager pour détecter les API en échec.
   */
  getCircuitBreakersStatus() {
    const result = {}
    for (const [name, cb] of this.circuitBreakers) {
      result[name] = {
        state: cb.state,
        failures: cb.failureCount,
        lastFail: cb.lastFailTime ? new Date(cb.lastFailTime).toISOString() : null
      }
    }
    return result
  }

  /**
   * Attendre (utility)
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export
if (typeof window !== 'undefined') {
  window.ErrorHandler = ErrorHandler;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ErrorHandler };
}
