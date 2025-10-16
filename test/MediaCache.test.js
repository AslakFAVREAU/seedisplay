/**
 * Tests du système de cache - MediaCache.test.js
 * Exécuter: npm test -- test/MediaCache.test.js
 */

const { MediaCache } = require('../js/MediaCache.js');
const assert = require('assert');

describe('MediaCache', () => {
  let cache;

  beforeEach(() => {
    cache = new MediaCache({
      maxSize: 100 * 1024 * 1024, // 100 MB
      maxAge: 60 * 60 * 1000, // 1 heure
      logger: { 
        info: () => {}, 
        warn: () => {}, 
        error: () => {}, 
        debug: () => {} 
      }
    });
  });

  describe('getCacheKey', () => {
    it('should generate consistent keys for same URL', () => {
      const url = 'https://example.com/image.jpg';
      const key1 = cache.getCacheKey(url);
      const key2 = cache.getCacheKey(url);
      
      assert.strictEqual(key1, key2);
    });

    it('should generate different keys for different URLs', () => {
      const key1 = cache.getCacheKey('https://example.com/image1.jpg');
      const key2 = cache.getCacheKey('https://example.com/image2.jpg');
      
      assert.notStrictEqual(key1, key2);
    });

    it('should preserve file extension', () => {
      const key = cache.getCacheKey('https://example.com/photo.png');
      assert(key.endsWith('.png'));
    });
  });

  describe('set/get', () => {
    it('should store and retrieve data', () => {
      const key = 'test-key';
      const data = new Blob(['test data']);
      
      cache.set(key, data);
      const retrieved = cache.cache.get(key);
      
      assert.strictEqual(retrieved, data);
    });

    it('should update currentSize', () => {
      const initialSize = cache.currentSize;
      const data = new Blob(['x'.repeat(1000)]);
      
      cache.set('test-key', data);
      
      assert(cache.currentSize > initialSize);
    });
  });

  describe('isExpired', () => {
    it('should return false for fresh data', () => {
      const key = 'fresh-key';
      cache.metadata.set(key, { timestamp: Date.now() });
      
      assert.strictEqual(cache.isExpired(key), false);
    });

    it('should return true for expired data', () => {
      const key = 'old-key';
      cache.metadata.set(key, { timestamp: Date.now() - 2 * 60 * 60 * 1000 }); // 2 heures
      
      assert.strictEqual(cache.isExpired(key), true);
    });

    it('should return true for missing data', () => {
      assert.strictEqual(cache.isExpired('nonexistent'), true);
    });
  });

  describe('touchFile (LRU)', () => {
    it('should update timestamp on access', () => {
      const key = 'test-key';
      const oldTime = Date.now() - 1000;
      cache.metadata.set(key, { timestamp: oldTime });
      
      cache.touchFile(key);
      
      assert(cache.metadata.get(key).timestamp > oldTime);
    });
  });

  describe('evictLRU', () => {
    it('should evict least recently used item', () => {
      cache.cache.set('key1', new Blob(['data1']));
      cache.cache.set('key2', new Blob(['data2']));
      cache.cache.set('key3', new Blob(['data3']));
      
      cache.metadata.set('key1', { timestamp: Date.now() - 3000 });
      cache.metadata.set('key2', { timestamp: Date.now() - 2000 });
      cache.metadata.set('key3', { timestamp: Date.now() - 1000 });
      
      cache.evictLRU();
      
      assert.strictEqual(cache.cache.has('key1'), false);
      assert.strictEqual(cache.cache.has('key2'), true);
      assert.strictEqual(cache.cache.has('key3'), true);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      // Create a buffer of at least 1MB
      const data = Buffer.alloc(1024 * 1024);
      cache.set('key1', data);
      
      const stats = cache.getStats();
      
      assert.strictEqual(stats.itemsMemory, 1);
      assert.strictEqual(parseFloat(stats.sizeMemoryMB) > 0.9, true, 'sizeMemoryMB should be ~1.0');
      assert(stats.maxSizeMB > 0, 'maxSizeMB should be > 0');
    });
  });

  describe('clear', () => {
    it('should clear all cache', () => {
      cache.set('key1', new Blob(['data1']));
      cache.set('key2', new Blob(['data2']));
      
      cache.clear();
      
      assert.strictEqual(cache.cache.size, 0);
      assert.strictEqual(cache.metadata.size, 0);
      assert.strictEqual(cache.currentSize, 0);
    });
  });

  describe('hashCode', () => {
    it('should produce consistent hashes', () => {
      const url = 'https://example.com/media.jpg';
      const hash1 = cache.hashCode(url);
      const hash2 = cache.hashCode(url);
      
      assert.strictEqual(hash1, hash2);
    });
  });
});
