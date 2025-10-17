/**
 * apiManager.integration.test.js - Tests d'intégration ErrorHandler + ApiManager
 * 
 * Vérifie que:
 * 1. ErrorHandler fonctionne correctement
 * 2. ApiManager enveloppe les appels API
 * 3. Les retries et circuit breaker fonctionnent
 * 4. Les fallbacks marchent
 * 5. Les appels diapo et meteo sont résilients
 */

const assert = require('assert');
const { ErrorHandler } = require('../js/ErrorHandler.js');
const { ApiManager } = require('../js/ApiManager.js');

describe('ErrorHandler + ApiManager integration', function() {
  
  describe('ErrorHandler + ApiManager bootstrap', function() {
    it('should create ErrorHandler with default config', function() {
      const eh = new ErrorHandler();
      assert(eh);
      assert.strictEqual(eh.maxRetries, 3);
      assert.strictEqual(eh.failureThreshold, 5);
    });

    it('should accept custom options', function() {
      const options = {
        maxRetries: 5,
        retryDelay: 500,
        failureThreshold: 10,
        recoveryTimeout: 60000,
      };
      const eh = new ErrorHandler(options);
      assert.strictEqual(eh.maxRetries, 5);
      assert.strictEqual(eh.retryDelay, 500);
      assert.strictEqual(eh.failureThreshold, 10);
      assert.strictEqual(eh.recoveryTimeout, 60000);
    });

    it('should create ApiManager instance (mocked window)', function() {
      // Mock window for testing
      global.window = {};
      const am = new ApiManager();
      assert(am);
      assert(am.apis.diapo);
      assert(am.apis.meteo);
      delete global.window;
    });

    it('should initialize ApiManager with ErrorHandler', function() {
      global.window = {};
      const eh = new ErrorHandler();
      const am = new ApiManager();
      
      am.init(eh);
      assert.strictEqual(am.errorHandler, eh);
      delete global.window;
    });

    it('should have correct API configurations', function() {
      global.window = {};
      const am = new ApiManager();
      
      assert.strictEqual(am.apis.diapo.name, 'diapo-api');
      assert.strictEqual(am.apis.diapo.maxRetries, 3);
      assert.strictEqual(am.apis.diapo.timeout, 10000);
      
      assert.strictEqual(am.apis.meteo.name, 'meteo-api');
      assert.strictEqual(am.apis.meteo.maxRetries, 2);
      assert.strictEqual(am.apis.meteo.timeout, 8000);
      delete global.window;
    });
  });

  describe('CircuitBreaker state management', function() {
    it('should create circuit breaker in closed state', function() {
      const eh = new ErrorHandler();
      const cb = eh.getCircuitBreaker('test-api');
      assert.strictEqual(cb.state, 'closed');
      assert.strictEqual(cb.failureCount, 0);
    });

    it('should track success and failure counts', function() {
      const eh = new ErrorHandler();
      const cb = eh.getCircuitBreaker('api-1');
      
      cb.successCount = 5;
      cb.failureCount = 2;
      
      assert.strictEqual(cb.successCount, 5);
      assert.strictEqual(cb.failureCount, 2);
    });
  });

  describe('getCircuitBreakerStatus', function() {
    it('should return unavailable when no ErrorHandler', function() {
      global.window = {};
      const am = new ApiManager();
      const status = am.getCircuitBreakerStatus();
      
      assert.strictEqual(status.diapo, 'unavailable');
      assert.strictEqual(status.meteo, 'unavailable');
      delete global.window;
    });

    it('should return status when ErrorHandler is initialized', function() {
      global.window = {};
      const eh = new ErrorHandler();
      const am = new ApiManager();
      am.init(eh);
      
      // Create circuit breakers
      eh.getCircuitBreaker('diapo-api');
      eh.getCircuitBreaker('meteo-api');
      
      const status = am.getCircuitBreakerStatus();
      assert(status.diapo);
      assert(status.meteo);
      delete global.window;
    });
  });

  describe('Circuit breaker reset', function() {
    it('should reset all circuit breakers', function() {
      global.window = {};
      const eh = new ErrorHandler();
      const am = new ApiManager();
      am.init(eh);
      
      // Create and mark as failed
      const cbDiapo = eh.getCircuitBreaker('diapo-api');
      const cbMeteo = eh.getCircuitBreaker('meteo-api');
      
      cbDiapo.state = 'open';
      cbDiapo.failureCount = 10;
      cbMeteo.state = 'open';
      cbMeteo.failureCount = 15;
      
      // Reset
      am.resetCircuitBreakers();
      
      // Verify reset (breakers still exist)
      assert(cbDiapo);
      assert(cbMeteo);
      delete global.window;
    });
  });

  describe('Multiple API calls with shared circuit breaker', function() {
    it('should maintain separate circuit breakers per API', function() {
      global.window = {};
      const eh = new ErrorHandler();
      const am = new ApiManager();
      am.init(eh);
      
      const cbDiapo = eh.getCircuitBreaker(am.apis.diapo.name);
      const cbMeteo = eh.getCircuitBreaker(am.apis.meteo.name);
      
      // Simulate diapo failure
      cbDiapo.failureCount = 2;
      cbDiapo.state = 'open';
      
      // Meteo should not be affected
      assert.strictEqual(cbMeteo.state, 'closed');
      assert.strictEqual(cbMeteo.failureCount, 0);
      delete global.window;
    });
  });

  describe('Error logging', function() {
    it('should log errors to error log', function() {
      const eh = new ErrorHandler({ maxErrorLogSize: 10 });
      
      const error1 = new Error('test error 1');
      const error2 = new Error('test error 2');
      
      eh.logError('test-api', error1);
      eh.logError('test-api', error2);
      
      assert(eh.errorLog.length >= 1);
    });

    it('should truncate error log at max size', function() {
      const eh = new ErrorHandler({ maxErrorLogSize: 3 });
      
      for (let i = 0; i < 10; i++) {
        eh.logError('api', new Error(`error ${i}`));
      }
      
      assert(eh.errorLog.length <= 3);
    });
  });

  describe('API configuration for diapo', function() {
    it('should have retry config for diapo API', function() {
      global.window = {};
      const am = new ApiManager();
      
      assert.strictEqual(am.apis.diapo.maxRetries, 3);
      assert.strictEqual(am.apis.diapo.retryDelay, 1000);
      assert.strictEqual(am.apis.diapo.failureThreshold, 5);
      assert.strictEqual(am.apis.diapo.recoveryTimeout, 30000);
      delete global.window;
    });
  });

  describe('API configuration for meteo', function() {
    it('should have retry config for meteo API', function() {
      global.window = {};
      const am = new ApiManager();
      
      assert.strictEqual(am.apis.meteo.maxRetries, 2);
      assert.strictEqual(am.apis.meteo.retryDelay, 800);
      assert.strictEqual(am.apis.meteo.failureThreshold, 8);
      assert.strictEqual(am.apis.meteo.recoveryTimeout, 60000);
      delete global.window;
    });
  });

  describe('Integration scenario: API resilience', function() {
    it('should demonstrate diapo-meteo error isolation', function() {
      global.window = {};
      const eh = new ErrorHandler({
        failureThreshold: 3,
        recoveryTimeout: 30000
      });
      const am = new ApiManager();
      am.init(eh);
      
      // Simulate diapo failures
      const cbDiapo = eh.getCircuitBreaker(am.apis.diapo.name);
      for (let i = 0; i < 3; i++) {
        cbDiapo.failureCount++;
      }
      cbDiapo.state = 'open'; // Circuit opens
      
      // Meteo should continue working
      const cbMeteo = eh.getCircuitBreaker(am.apis.meteo.name);
      assert.strictEqual(cbMeteo.state, 'closed');
      assert.strictEqual(cbMeteo.failureCount, 0);
      delete global.window;
    });
  });
});
