/**
 * Tests DisplayState.js
 * Exécuter: npm test -- test/DisplayState.test.js
 */

const { DisplayState } = require('../js/DisplayState.js');
const assert = require('assert');

describe('DisplayState', () => {
  let state;

  beforeEach(() => {
    state = new DisplayState();
  });

  describe('initialization', () => {
    it('should initialize in stopped state', () => {
      assert.strictEqual(state.loopState, 'stopped');
      assert.strictEqual(state.currentIndex, 0);
      assert.strictEqual(state.activePlayer, 1);
    });

    it('should have empty media list', () => {
      assert.strictEqual(state.mediaList.length, 0);
    });
  });

  describe('setMediaList', () => {
    it('should set media list', () => {
      const mediaList = [
        { id: 1, url: 'image1.jpg' },
        { id: 2, url: 'video1.mp4' },
        { id: 3, url: 'image2.jpg' },
      ];
      
      state.setMediaList(mediaList);
      
      assert.strictEqual(state.mediaList.length, 3);
      assert.strictEqual(state.currentIndex, 0);
    });

    it('should reset index to 0', () => {
      state.currentIndex = 5;
      state.setMediaList([{}, {}, {}]);
      
      assert.strictEqual(state.currentIndex, 0);
    });
  });

  describe('loop control', () => {
    beforeEach(() => {
      state.setMediaList([{}, {}, {}]);
    });

    it('should start loop', () => {
      state.startLoop();
      assert.strictEqual(state.loopState, 'running');
    });

    it('should stop loop', () => {
      state.startLoop();
      state.stopLoop();
      
      assert.strictEqual(state.loopState, 'stopped');
      assert.strictEqual(state.currentIndex, 0);
    });

    it('should pause loop', () => {
      state.startLoop();
      state.pauseLoop();
      
      assert.strictEqual(state.loopState, 'paused');
    });

    it('should resume from pause', () => {
      state.startLoop();
      state.pauseLoop();
      state.resumeLoop();
      
      assert.strictEqual(state.loopState, 'running');
    });

    it('should not allow invalid state transitions', () => {
      state.pauseLoop(); // Cannot pause from stopped
      assert.strictEqual(state.loopState, 'stopped');
      
      state.resumeLoop(); // Cannot resume from stopped
      assert.strictEqual(state.loopState, 'stopped');
    });
  });

  describe('media navigation', () => {
    beforeEach(() => {
      state.setMediaList([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);
    });

    it('should get current media', () => {
      const current = state.getCurrentMedia();
      assert.strictEqual(current.id, 1);
    });

    it('should advance to next media', () => {
      state.nextMedia();
      assert.strictEqual(state.currentIndex, 1);
      assert.strictEqual(state.getCurrentMedia().id, 2);
    });

    it('should wrap around at end', () => {
      state.currentIndex = 2;
      state.nextMedia();
      
      assert.strictEqual(state.currentIndex, 0);
    });

    it('should go to previous media', () => {
      state.currentIndex = 1;
      state.previousMedia();
      
      assert.strictEqual(state.currentIndex, 0);
    });

    it('should wrap around at start', () => {
      state.currentIndex = 0;
      state.previousMedia();
      
      assert.strictEqual(state.currentIndex, 2);
    });

    it('should go to specific index', () => {
      state.goToIndex(2);
      assert.strictEqual(state.currentIndex, 2);
    });

    it('should not allow invalid index', () => {
      state.goToIndex(2); // Set to 2 first
      state.goToIndex(10); // Try invalid
      assert.strictEqual(state.currentIndex, 2); // Should stay at 2
    });

    it('should get next media for preload', () => {
      const next = state.getNextMedia();
      assert.strictEqual(next.id, 2);
    });

    it('should wrap next media at end', () => {
      state.currentIndex = 2;
      const next = state.getNextMedia();
      assert.strictEqual(next.id, 1);
    });
  });

  describe('player control', () => {
    it('should toggle player', () => {
      assert.strictEqual(state.activePlayer, 1);
      
      state.togglePlayer();
      assert.strictEqual(state.activePlayer, 2);
      
      state.togglePlayer();
      assert.strictEqual(state.activePlayer, 1);
    });

    it('should get inactive player', () => {
      assert.strictEqual(state.getInactivePlayer(), 2);
      
      state.togglePlayer();
      assert.strictEqual(state.getInactivePlayer(), 1);
    });
  });

  describe('event listeners', () => {
    it('should register listener', (done) => {
      state.on('testEvent', (data) => {
        assert.strictEqual(data.value, 42);
        done();
      });
      
      state.emit('testEvent', { value: 42 });
    });

    it('should unregister listener', () => {
      let callCount = 0;
      const unsubscribe = state.on('testEvent', () => {
        callCount++;
      });
      
      state.emit('testEvent');
      assert.strictEqual(callCount, 1);
      
      unsubscribe();
      state.emit('testEvent');
      assert.strictEqual(callCount, 1); // No change
    });

    it('should emit mediaChanged event on next', (done) => {
      state.setMediaList([{ id: 1 }, { id: 2 }]);
      
      state.on('mediaChanged', (data) => {
        assert.strictEqual(data.index, 1);
        done();
      });
      
      state.nextMedia();
    });

    it('should emit loopStarted event', (done) => {
      state.setMediaList([{}]);
      
      state.on('loopStarted', () => {
        assert.strictEqual(state.loopState, 'running');
        done();
      });
      
      state.startLoop();
    });
  });

  describe('snapshot', () => {
    it('should create snapshot', () => {
      state.setMediaList([{ id: 1 }, { id: 2 }, { id: 3 }]);
      state.currentIndex = 1;
      state.activePlayer = 2;
      
      const snapshot = state.getSnapshot();
      
      assert.strictEqual(snapshot.currentIndex, 1);
      assert.strictEqual(snapshot.activePlayer, 2);
      assert.strictEqual(snapshot.mediaCount, 3);
    });

    it('should restore from snapshot', () => {
      const snapshot = {
        loopState: 'running',
        currentIndex: 2,
        activePlayer: 2,
        currentMediaEndTime: 5000,
      };
      
      state.restoreSnapshot(snapshot);
      
      assert.strictEqual(state.loopState, 'running');
      assert.strictEqual(state.currentIndex, 2);
      assert.strictEqual(state.activePlayer, 2);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      state.setMediaList([{}, {}]);
      state.startLoop();
      state.currentIndex = 1;
      state.activePlayer = 2;
      
      state.reset();
      
      assert.strictEqual(state.loopState, 'stopped');
      assert.strictEqual(state.currentIndex, 0);
      assert.strictEqual(state.activePlayer, 1);
      assert.strictEqual(state.mediaList.length, 0);
    });
  });
});
