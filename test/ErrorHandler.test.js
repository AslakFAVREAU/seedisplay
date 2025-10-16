/**
 * Tests ErrorHandler.js
 * Exécuter: npm test -- test/ErrorHandler.test.js
 */

const { ErrorHandler } = require('../js/ErrorHandler.js');
const assert = require('assert');

describe('ErrorHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new ErrorHandler({
      maxRetries: 2,
      retryDelay: 100,
      failureThreshold: 3,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      }
    });
  });

  describe('executeWithRetry', () => {
    it('should execute successful function', async () => {
      const fn = async () => 'success';
      const result = await handler.executeWithRetry('test', fn);
      
      assert.strictEqual(result, 'success');
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) throw new Error('Fail');
        return 'success';
      };
      
      const result = await handler.executeWithRetry('test', fn);
      
      assert.strictEqual(result, 'success');
      assert.strictEqual(attempts, 2);
    });

    it('should give up after max retries', async () => {
      const fn = async () => {
        throw new Error('Always fails');
      };
      
      try {
        await handler.executeWithRetry('test', fn);
        assert.fail('Should have thrown');
      } catch (error) {
        assert.strictEqual(error.message, 'Always fails');
      }
    });

    it('should use fallback after exhausted retries', async () => {
      handler.setFallback('test', { fallback: true });
      
      const fn = async () => {
        throw new Error('Fail');
      };
      
      const result = await handler.executeWithRetry('test', fn);
      
      assert.strictEqual(result.fallback, true);
    });
  });

  describe('circuit breaker', () => {
    it('should create circuit breaker', () => {
      const cb = handler.getCircuitBreaker('test');
      
      assert.strictEqual(cb.state, 'closed');
      assert.strictEqual(cb.failureCount, 0);
    });

    it('should open circuit after failures', () => {
      const cb = handler.getCircuitBreaker('test', { failureThreshold: 2 });
      
      handler.recordFailure(cb);
      assert.strictEqual(cb.state, 'closed');
      
      handler.recordFailure(cb);
      assert.strictEqual(cb.state, 'open');
    });

    it('should prevent execution when open', () => {
      const cb = handler.getCircuitBreaker('test', { failureThreshold: 1 });
      handler.recordFailure(cb);
      
      assert.strictEqual(handler.canExecute(cb), false);
    });

    it('should recover to half-open after timeout', async () => {
      const cb = handler.getCircuitBreaker('test', { 
        failureThreshold: 1,
        recoveryTimeout: 100,
      });
      
      handler.recordFailure(cb);
      assert.strictEqual(cb.state, 'open');
      
      await handler.sleep(150);
      
      assert.strictEqual(handler.canExecute(cb), true);
      assert.strictEqual(cb.state, 'half-open');
    });

    it('should close after successful recovery', () => {
      const cb = handler.getCircuitBreaker('test');
      cb.state = 'half-open';
      
      handler.recordSuccess(cb);
      handler.recordSuccess(cb);
      
      assert.strictEqual(cb.state, 'closed');
    });

    it('should reopen if recovery fails', () => {
      const cb = handler.getCircuitBreaker('test');
      cb.state = 'half-open';
      
      handler.recordFailure(cb);
      
      assert.strictEqual(cb.state, 'open');
    });

    it('should get circuit breaker status', () => {
      const cb = handler.getCircuitBreaker('test');
      handler.recordFailure(cb);
      
      const status = handler.getCircuitBreakerStatus('test');
      
      assert.strictEqual(status.name, 'test');
      assert.strictEqual(status.failureCount, 1);
    });

    it('should reset circuit breaker', () => {
      const cb = handler.getCircuitBreaker('test');
      cb.state = 'open';
      
      handler.resetCircuitBreaker('test');
      
      assert.strictEqual(cb.state, 'closed');
      assert.strictEqual(cb.failureCount, 0);
    });
  });

  describe('error logging', () => {
    it('should log errors', () => {
      const error = new Error('Test error');
      handler.logError(error, { operation: 'test' });
      
      const history = handler.getErrorHistory();
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].message, 'Test error');
    });

    it('should limit error log size', () => {
      handler = new ErrorHandler({
        maxErrorLogSize: 5,
        logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }
      });
      
      for (let i = 0; i < 10; i++) {
        handler.logError(new Error(`Error ${i}`), { operation: 'test' });
      }
      
      assert.strictEqual(handler.getErrorHistory().length, 5);
    });

    it('should get error statistics', () => {
      handler.logError(new Error('E1'), { operation: 'op1' });
      handler.logError(new Error('E2'), { operation: 'op1' });
      handler.logError(new Error('E3'), { operation: 'op2' });
      
      const stats = handler.getErrorStats();
      
      assert.strictEqual(stats.op1.count, 2);
      assert.strictEqual(stats.op2.count, 1);
    });

    it('should clear error log', () => {
      handler.logError(new Error('Test'), { operation: 'test' });
      assert.strictEqual(handler.getErrorHistory().length, 1);
      
      handler.clearErrorLog();
      assert.strictEqual(handler.getErrorHistory().length, 0);
    });
  });

  describe('fallback', () => {
    it('should set fallback', () => {
      handler.setFallback('test', { data: 'fallback' });
      const fallback = handler.getFallback('test');
      
      assert.strictEqual(fallback.data, 'fallback');
    });

    it('should return fallback when circuit is open', async () => {
      handler.setFallback('test', { fallback: true });
      
      const cb = handler.getCircuitBreaker('test');
      cb.state = 'open';
      
      const result = await handler.executeWithRetry('test', async () => {
        throw new Error('Fail');
      });
      
      assert.strictEqual(result.fallback, true);
    });
  });
});
