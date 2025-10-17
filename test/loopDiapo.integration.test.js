/**
 * Integration test: loopDiapo with DisplayState
 * Verify that the display loop works with the new state manager
 */

const { DisplayState } = require('../js/DisplayState.js');
const assert = require('assert');

describe('loopDiapo integration with DisplayState', () => {
  let state;

  beforeEach(() => {
    state = new DisplayState();
  });

  describe('player toggling', () => {
    it('should toggle player via DisplayState', () => {
      assert.strictEqual(state.activePlayer, 1);
      
      state.togglePlayer();
      assert.strictEqual(state.activePlayer, 2);
      
      state.togglePlayer();
      assert.strictEqual(state.activePlayer, 1);
    });

    it('should get inactive player correctly', () => {
      assert.strictEqual(state.getInactivePlayer(), 2);
      
      state.togglePlayer();
      assert.strictEqual(state.getInactivePlayer(), 1);
    });

    // Simulate what loopDiapo does with player variable
    it('should work with loopDiapo pattern', () => {
      let player = state.activePlayer;
      
      // Old pattern: player = (player === 1) ? 2 : 1;
      // New pattern: use DisplayState
      state.togglePlayer();
      player = state.activePlayer;
      
      assert.strictEqual(player, 2);
      
      state.togglePlayer();
      player = state.activePlayer;
      
      assert.strictEqual(player, 1);
    });
  });

  describe('media cycling', () => {
    beforeEach(() => {
      state.setMediaList([
        ['img', 'image1.jpg', 5],
        ['video', 'video1.mp4', 10],
        ['img', 'image2.jpg', 5],
        ['video', 'video2.mp4', 8],
        ['img', 'image3.jpg', 5],
      ]);
    });

    it('should cycle through 5 media items', () => {
      state.startLoop();
      
      for (let i = 0; i < 5; i++) {
        assert.strictEqual(state.currentIndex, i);
        const media = state.getCurrentMedia();
        assert(media[1].includes('.'));
        state.nextMedia();
      }
      
      // Should wrap to 0
      assert.strictEqual(state.currentIndex, 0);
    });

    it('should emit event on media change', (done) => {
      state.startLoop();
      
      let eventCount = 0;
      state.on('mediaChanged', ({ index, media }) => {
        eventCount++;
        assert(index >= 0);
        assert(media[1]); // filename
      });
      
      state.nextMedia();
      state.nextMedia();
      
      assert.strictEqual(eventCount, 2);
      done();
    });

    it('should handle video and image sequences', () => {
      state.startLoop();
      
      const mediaTypes = [];
      for (let i = 0; i < 5; i++) {
        mediaTypes.push(state.getCurrentMedia()[0]);
        state.nextMedia();
      }
      
      assert.deepStrictEqual(mediaTypes, ['img', 'video', 'img', 'video', 'img']);
    });
  });

  describe('state transitions', () => {
    beforeEach(() => {
      state.setMediaList([{}, {}, {}]);
    });

    it('should transition through loop states', () => {
      assert.strictEqual(state.loopState, 'stopped');
      
      state.startLoop();
      assert.strictEqual(state.loopState, 'running');
      
      state.pauseLoop();
      assert.strictEqual(state.loopState, 'paused');
      
      state.resumeLoop();
      assert.strictEqual(state.loopState, 'running');
      
      state.stopLoop();
      assert.strictEqual(state.loopState, 'stopped');
    });
  });

  describe('backward compatibility', () => {
    it('should work with player variable pattern', () => {
      // Simulate old loopDiapo.js pattern
      let player = 1;
      
      // Toggle using DisplayState
      state.togglePlayer();
      player = state.activePlayer;
      
      assert.strictEqual(player, 2);
      
      // Toggle again
      state.togglePlayer();
      player = state.activePlayer;
      
      assert.strictEqual(player, 1);
    });

    it('should support getInactivePlayer for preload', () => {
      // Old pattern might check imgLoad
      // New pattern: getInactivePlayer()
      
      assert.strictEqual(state.activePlayer, 1);
      assert.strictEqual(state.getInactivePlayer(), 2);
      
      state.togglePlayer();
      
      assert.strictEqual(state.activePlayer, 2);
      assert.strictEqual(state.getInactivePlayer(), 1);
    });
  });

  describe('media list management', () => {
    it('should handle 5-item media list (real scenario)', () => {
      const mediaList = [
        ['img', 'a.jpg', 5],
        ['img', 'b.jpg', 5],
        ['img', 'c.jpg', 5],
        ['img', 'd.jpg', 5],
        ['img', 'e.jpg', 5],
      ];
      
      state.setMediaList(mediaList);
      state.startLoop();
      
      // Cycle through once
      for (let i = 0; i < 5; i++) {
        assert.strictEqual(state.currentIndex, i);
        state.nextMedia();
      }
      
      // Should wrap to 0
      assert.strictEqual(state.currentIndex, 0);
    });

    it('should track current and next media for preload', () => {
      state.setMediaList([
        ['img', 'a.jpg', 5],
        ['img', 'b.jpg', 5],
        ['img', 'c.jpg', 5],
      ]);
      
      assert.strictEqual(state.getCurrentMedia()[1], 'a.jpg');
      assert.strictEqual(state.getNextMedia()[1], 'b.jpg');
      
      state.nextMedia();
      
      assert.strictEqual(state.getCurrentMedia()[1], 'b.jpg');
      assert.strictEqual(state.getNextMedia()[1], 'c.jpg');
    });
  });

  describe('snapshots for pause/resume', () => {
    it('should save and restore state during pause', () => {
      state.setMediaList([{}, {}, {}]);
      state.startLoop();
      state.goToIndex(1);
      state.togglePlayer();
      
      const snapshot = state.getSnapshot();
      
      // Pause
      state.pauseLoop();
      state.goToIndex(0);
      
      // Resume
      state.restoreSnapshot(snapshot);
      
      assert.strictEqual(state.currentIndex, 1);
      assert.strictEqual(state.activePlayer, 2);
    });
  });
});
