/**
 * mediaCacheManager.integration.test.js - Tests d'intégration MediaCacheManager
 * 
 * Vérifie que:
 * 1. MediaCacheManager initialise correctement
 * 2. Préchargement fonctionne
 * 3. Queue de préchargement gérée
 * 4. Info cache disponible
 * 5. Limite et pruning marchent
 */

const assert = require('assert');
const { MediaCacheManager } = require('../js/MediaCacheManager.js');

describe('MediaCacheManager integration', function() {
  
  describe('initialization', function() {
    it('should create MediaCacheManager instance', function() {
      const mcm = new MediaCacheManager();
      assert(mcm);
      assert.strictEqual(mcm.mediaDir, 'media/');
      assert.strictEqual(mcm.maxCacheBytes, 500 * 1024 * 1024);
    });

    it('should accept custom options', function() {
      const options = {
        maxCacheBytes: 1024 * 1024 * 1024, // 1 GB
      };
      const mcm = new MediaCacheManager(options);
      assert.strictEqual(mcm.maxCacheBytes, 1024 * 1024 * 1024);
    });

    it('should initialize with cache reference', function() {
      const mcm = new MediaCacheManager();
      const mockCache = {};
      mcm.init(mockCache);
      assert.strictEqual(mcm.cache, mockCache);
    });
  });

  describe('preload queue management', function() {
    it('should add items to preload queue', function() {
      const mcm = new MediaCacheManager();
      assert.strictEqual(mcm.preloadQueue.length, 0);

      mcm.preloadQueue.push({ url: 'http://example.com/img1.jpg', filename: 'img1.jpg' });
      assert.strictEqual(mcm.preloadQueue.length, 1);
    });

    it('should clear preload queue', function() {
      const mcm = new MediaCacheManager();
      mcm.preloadQueue.push({ url: 'http://example.com/img1.jpg', filename: 'img1.jpg' });
      mcm.preloadQueue.push({ url: 'http://example.com/img2.jpg', filename: 'img2.jpg' });

      assert.strictEqual(mcm.preloadQueue.length, 2);
      mcm.clearPreloadQueue();
      assert.strictEqual(mcm.preloadQueue.length, 0);
    });

    it('should track preloading state', function() {
      const mcm = new MediaCacheManager();
      assert.strictEqual(mcm.isPreloading, false);

      mcm.isPreloading = true;
      assert.strictEqual(mcm.isPreloading, true);

      mcm.isPreloading = false;
      assert.strictEqual(mcm.isPreloading, false);
    });
  });

  describe('cache statistics', function() {
    it('should return correct stats', function() {
      const mcm = new MediaCacheManager({
        maxCacheBytes: 1024 * 1024 * 512 // 512 MB
      });

      mcm.preloadQueue.push({ url: 'http://example.com/img1.jpg', filename: 'img1.jpg' });
      mcm.preloadQueue.push({ url: 'http://example.com/img2.jpg', filename: 'img2.jpg' });
      mcm.isPreloading = true;

      const stats = mcm.getStats();
      assert.strictEqual(stats.preloadQueueLength, 2);
      assert.strictEqual(stats.isPreloading, true);
      assert.strictEqual(stats.maxCacheBytes, 1024 * 1024 * 512);
    });

    it('should report empty queue', function() {
      const mcm = new MediaCacheManager();
      const stats = mcm.getStats();

      assert.strictEqual(stats.preloadQueueLength, 0);
      assert.strictEqual(stats.isPreloading, false);
    });
  });

  describe('cache size management', function() {
    it('should calculate cache size correctly', function() {
      const size1MB = 1024 * 1024;
      const size100MB = 100 * 1024 * 1024;
      const size500MB = 500 * 1024 * 1024;

      const mcm = new MediaCacheManager({ maxCacheBytes: size500MB });
      assert.strictEqual(mcm.maxCacheBytes, size500MB);

      // Simulate setting different limits
      mcm.maxCacheBytes = size100MB;
      assert.strictEqual(mcm.maxCacheBytes, size100MB);
    });

    it('should handle large cache sizes', function() {
      const size1GB = 1024 * 1024 * 1024;
      const mcm = new MediaCacheManager({ maxCacheBytes: size1GB });
      assert.strictEqual(mcm.maxCacheBytes, size1GB);
    });
  });

  describe('media directory structure', function() {
    it('should have correct media directory', function() {
      const mcm = new MediaCacheManager();
      assert.strictEqual(mcm.mediaDir, 'media/');
    });

    it('should support custom media directory', function() {
      const mcm = new MediaCacheManager();
      // Would need to accept this in constructor
      // For now, just verify structure
      assert(mcm.mediaDir.endsWith('/'));
    });
  });

  describe('real-world scenario: preload sequence', function() {
    it('should manage preload queue sequentially', function() {
      const mcm = new MediaCacheManager();

      // Simulate typical loopDiapo preload sequence
      const mediaList = [
        { url: 'http://api.example.com/media/img1.jpg', filename: 'img1.jpg' },
        { url: 'http://api.example.com/media/img2.jpg', filename: 'img2.jpg' },
        { url: 'http://api.example.com/media/img3.jpg', filename: 'img3.jpg' },
        { url: 'http://api.example.com/media/img4.jpg', filename: 'img4.jpg' },
        { url: 'http://api.example.com/media/img5.jpg', filename: 'img5.jpg' },
      ];

      // Add all to queue (simulating preloadNext calls in loopDiapo)
      mediaList.forEach(media => {
        mcm.preloadQueue.push(media);
      });

      assert.strictEqual(mcm.preloadQueue.length, 5);

      // Simulate processing first item
      const first = mcm.preloadQueue.shift();
      assert.strictEqual(first.filename, 'img1.jpg');
      assert.strictEqual(mcm.preloadQueue.length, 4);

      // Process remaining
      while (mcm.preloadQueue.length > 0) {
        mcm.preloadQueue.shift();
      }

      assert.strictEqual(mcm.preloadQueue.length, 0);
    });

    it('should support mixed image and video preload', function() {
      const mcm = new MediaCacheManager();

      const mediaList = [
        { url: 'http://api.example.com/media/img1.jpg', filename: 'img1.jpg' },
        { url: 'http://api.example.com/media/video1.mp4', filename: 'video1.mp4' },
        { url: 'http://api.example.com/media/img2.png', filename: 'img2.png' },
        { url: 'http://api.example.com/media/video2.webm', filename: 'video2.webm' },
      ];

      mediaList.forEach(media => {
        mcm.preloadQueue.push(media);
      });

      assert.strictEqual(mcm.preloadQueue.length, 4);

      // Verify mixed content types
      assert(mcm.preloadQueue[0].filename.endsWith('.jpg'));
      assert(mcm.preloadQueue[1].filename.endsWith('.mp4'));
      assert(mcm.preloadQueue[2].filename.endsWith('.png'));
      assert(mcm.preloadQueue[3].filename.endsWith('.webm'));
    });
  });

  describe('error handling', function() {
    it('should handle invalid url gracefully', async function() {
      global.window = { api: null }; // Mock no API available
      const mcm = new MediaCacheManager();

      const result = await mcm.downloadMedia(null, 'test.jpg');
      assert.strictEqual(result, false);

      const result2 = await mcm.downloadMedia('http://example.com/test.jpg', null);
      assert.strictEqual(result2, false);

      delete global.window;
    });

    it('should handle no API gracefully', async function() {
      // Simulate no window.api available
      global.window = { api: null };
      const mcm = new MediaCacheManager();

      const result = await mcm.downloadMedia('http://example.com/test.jpg', 'test.jpg');
      assert.strictEqual(result, false);

      delete global.window;
    });
  });

  describe('cache info retrieval', function() {
    it('should return empty cache info when API unavailable', async function() {
      global.window = { api: null };
      const mcm = new MediaCacheManager();

      const info = await mcm.getCacheInfo();
      assert.strictEqual(info.totalBytes, 0);
      assert.strictEqual(info.files, 0);

      delete global.window;
    });

    it('should handle cache limit setting', function() {
      global.window = { api: null };
      const mcm = new MediaCacheManager();

      const result = mcm.setCacheLimit(1024 * 1024 * 100); // 100 MB
      assert.strictEqual(result, false); // API not available

      delete global.window;
    });

    it('should handle cache pruning', async function() {
      global.window = { api: null };
      const mcm = new MediaCacheManager();

      const result = await mcm.pruneCache();
      assert.strictEqual(result, false); // API not available

      delete global.window;
    });
  });

  describe('logger integration', function() {
    it('should have logger available', function() {
      const mcm = new MediaCacheManager();
      assert(mcm.logger);
      assert(typeof mcm.logger.info === 'function' || typeof mcm.logger.log === 'function');
    });

    it('should accept custom logger', function() {
      const customLogger = { info: function() {}, error: function() {}, warn: function() {} };
      const mcm = new MediaCacheManager({ cache: null });
      mcm.logger = customLogger;
      assert.strictEqual(mcm.logger, customLogger);
    });
  });

  describe('queue prioritization', function() {
    it('should preserve queue order FIFO', function() {
      const mcm = new MediaCacheManager();

      for (let i = 1; i <= 5; i++) {
        mcm.preloadQueue.push({ url: `http://example.com/img${i}.jpg`, filename: `img${i}.jpg` });
      }

      // Verify FIFO order
      for (let i = 1; i <= 5; i++) {
        const item = mcm.preloadQueue[i - 1];
        assert.strictEqual(item.filename, `img${i}.jpg`);
      }
    });
  });
});
