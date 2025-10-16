#!/usr/bin/env node

/**
 * EXAMPLE: How to use DisplayState + MediaCache + ErrorHandler together
 * 
 * This file shows a practical example of integrating all 3 modules
 * for a production media display loop.
 * 
 * Run this as: node examples/integrated-example.js
 */

// Mock window/logger for Node.js environment
const mockLogger = {
  info: (tag, ...args) => console.log(`[${tag}] INFO:`, ...args),
  warn: (tag, ...args) => console.warn(`[${tag}] WARN:`, ...args),
  error: (tag, ...args) => console.error(`[${tag}] ERROR:`, ...args),
  debug: (tag, ...args) => console.debug(`[${tag}] DEBUG:`, ...args),
};

// Import the 3 modules (in production, use <script> tags in HTML)
const { DisplayState } = require('../js/DisplayState.js');
const { MediaCache } = require('../js/MediaCache.js');
const { ErrorHandler } = require('../js/ErrorHandler.js');

// Example: Production Setup
class MediaDisplayLoop {
  constructor(apiUrl, cacheBasePath) {
    this.apiUrl = apiUrl;
    
    // Initialize all 3 modules
    this.state = new DisplayState();
    this.cache = new MediaCache({
      basePath: cacheBasePath,
      maxSize: 500 * 1024 * 1024, // 500MB
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      logger: mockLogger,
    });
    
    this.errorHandler = new ErrorHandler({
      maxRetries: 3,
      retryDelay: 1000,
      failureThreshold: 3,
      recoveryTimeout: 30000,
      logger: mockLogger,
    });
    
    // Setup event listeners
    this.setupListeners();
  }

  /**
   * Setup event listeners between modules
   */
  setupListeners() {
    // When media changes, show it
    this.state.on('mediaChanged', ({ index, media, isCycleComplete }) => {
      console.log(`\n✨ Media changed: ${index + 1}/${this.state.mediaList.length}`);
      console.log(`   File: ${media.fichier}`);
      console.log(`   Duration: ${media.duree}s`);
      
      // Preload next media in background
      this.preloadNextMedia();
      
      // Reset cycle complete flag
      if (isCycleComplete) {
        console.log('\n🔄 CYCLE COMPLETE - Starting new cycle\n');
      }
    });

    // When loop starts/stops
    this.state.on('loopStarted', () => {
      console.log('▶️  Loop STARTED');
    });

    this.state.on('loopStopped', () => {
      console.log('⏹️  Loop STOPPED');
    });
  }

  /**
   * Initialize the display loop
   */
  async initialize() {
    console.log('🚀 Initializing media display loop...\n');
    
    try {
      // Fetch media list with error handling
      const mediaList = await this.errorHandler.executeWithRetry(
        'fetchMediaList',
        async () => {
          console.log('📡 Fetching media list from API...');
          // In real code, this would use fetch()
          // For this example, we'll return mock data
          return [
            { id: 1, fichier: 'image1.jpg', duree: 5, type: 'img' },
            { id: 2, fichier: 'video1.mp4', duree: 10, type: 'video' },
            { id: 3, fichier: 'image2.jpg', duree: 5, type: 'img' },
            { id: 4, fichier: 'video2.mp4', duree: 8, type: 'video' },
            { id: 5, fichier: 'image3.jpg', duree: 5, type: 'img' },
          ];
        },
        { delay: 1000 }
      );
      
      // Set fallback in case API fails later
      this.errorHandler.setFallback('fetchMediaList', [
        { id: 1, fichier: 'fallback.jpg', duree: 5, type: 'img' },
      ]);
      
      console.log(`✅ Media list loaded: ${mediaList.length} items\n`);
      
      // Set media in state
      this.state.setMediaList(mediaList);
      
      // Preload all media
      const urls = mediaList.map(m => m.fichier);
      await this.preloadMedia(urls);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize:', error.message);
      return false;
    }
  }

  /**
   * Preload media in background
   */
  async preloadMedia(urls) {
    console.log(`📦 Preloading ${urls.length} media files...`);
    
    try {
      await this.errorHandler.executeWithRetry(
        'preloadMedia',
        async () => {
          // In real code, this would use cache.preload()
          // For example: await this.cache.preload(urls);
          console.log(`   Cached ${urls.length} items`);
        }
      );
    } catch (error) {
      // Preload failure isn't critical, log and continue
      console.warn('⚠️  Preload partial failure:', error.message);
    }
  }

  /**
   * Preload next media for smooth transitions
   */
  async preloadNextMedia() {
    const next = this.state.getNextMedia();
    if (!next) return;
    
    try {
      // In real code:
      // await this.cache.get(next.fichier);
      console.log(`   → Preloaded next: ${next.fichier}`);
    } catch (error) {
      // Network error on preload is not critical
      console.debug('Preload failed (non-critical):', error.message);
    }
  }

  /**
   * Start the display loop
   */
  async start() {
    // Initialize first
    const initialized = await this.initialize();
    if (!initialized) {
      console.error('Cannot start: initialization failed');
      return;
    }
    
    // Start the loop
    this.state.startLoop();
    
    // Simulate the display loop
    this.simulateDisplayCycle();
  }

  /**
   * Simulate media display cycling
   */
  simulateDisplayCycle() {
    let cycleCount = 0;
    
    const showMediaSequence = async () => {
      if (this.state.loopState !== 'running') return;
      
      cycleCount++;
      const media = this.state.getCurrentMedia();
      
      // Show for duration
      const duration = media.duree * 1000;
      console.log(`⏱️  Showing: ${media.fichier} (${media.duree}s)`);
      
      await new Promise(resolve => setTimeout(resolve, duration));
      
      // Move to next
      if (this.state.loopState === 'running') {
        this.state.nextMedia();
        
        // Show stats after each cycle
        if (this.state.currentIndex === 0) {
          this.printStats();
        }
        
        // Stop after 3 cycles for demo
        if (cycleCount >= this.state.mediaList.length * 3) {
          this.state.stopLoop();
          console.log('✅ Demo complete');
          return;
        }
        
        // Continue loop
        showMediaSequence();
      }
    };
    
    showMediaSequence();
  }

  /**
   * Print performance stats
   */
  printStats() {
    console.log('\n📊 Performance Stats:');
    console.log('─'.repeat(50));
    
    // State stats
    const stateSnapshot = this.state.getSnapshot();
    console.log(`State: ${this.state.loopState} | Index: ${stateSnapshot.currentIndex + 1}/${stateSnapshot.mediaCount}`);
    
    // Cache stats
    const cacheStats = this.cache.getStats();
    console.log(`Cache: ${cacheStats.itemsMemory} items | ${cacheStats.sizeMemoryMB}MB / ${cacheStats.maxSizeMB}MB`);
    
    // Error handler stats
    const errorStats = this.errorHandler.getErrorStats();
    const errorCount = Object.values(errorStats).reduce((sum, s) => sum + s.count, 0);
    console.log(`Errors: ${errorCount} total | Circuit status: ${this.getCircuitStatus()}`);
    
    console.log('─'.repeat(50) + '\n');
  }

  /**
   * Get circuit breaker status
   */
  getCircuitStatus() {
    const status = this.errorHandler.getCircuitBreakerStatus('fetchMediaList');
    if (!status) return 'no-circuit';
    return `${status.state} (${status.failureCount}/${status.threshold} failures)`;
  }

  /**
   * Pause the loop
   */
  pause() {
    this.state.pauseLoop();
    console.log('⏸️  Loop paused');
  }

  /**
   * Resume the loop
   */
  resume() {
    this.state.resumeLoop();
    console.log('▶️  Loop resumed');
  }

  /**
   * Stop the loop
   */
  stop() {
    this.state.stopLoop();
    console.log('⏹️  Loop stopped');
  }

  /**
   * Simulate network failure to test resilience
   */
  async simulateNetworkFailure() {
    console.log('\n🔴 Simulating network failure...');
    
    // This would normally be caught by the circuit breaker
    try {
      await this.errorHandler.executeWithRetry(
        'testApiCall',
        async () => {
          throw new Error('Network timeout');
        }
      );
    } catch (error) {
      console.log(`Circuit breaker status: ${this.getCircuitStatus()}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// DEMO EXECUTION
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('   SEE Display - Integrated Module Example');
  console.log('═'.repeat(60));
  
  const display = new MediaDisplayLoop(
    'https://soek.fr/see/API/diapo/1',
    'C:/SEE/media/'
  );

  // Start the loop (runs for demo)
  await display.start();

  // Simulate network failure after a bit
  setTimeout(() => {
    display.simulateNetworkFailure();
  }, 3000);
}

// Run only if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MediaDisplayLoop };
