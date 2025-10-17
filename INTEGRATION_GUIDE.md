# 🚀 Phase 2: Integration Guide

## Quick Start

### 1. DisplayState Integration (Fondation)

**Goal**: Replace globals in `loopDiapo.js` with DisplayState

**Steps**:

```bash
# 1. Import in index.html BEFORE modules
<script src="js/DisplayState.js"></script>

# 2. Initialize in index.html <script>
window.displayState = new DisplayState();
window.displayState.setMediaList([]); // Empty initially

# 3. In loopDiapo.js, replace:
# OLD: let imgShow = 1, imgLoad = 2, player = 1;
# NEW: const state = window.displayState;
```

**Replace these patterns**:

| Old Pattern | New Pattern |
|-------------|-------------|
| `imgShow = 1` | `state.togglePlayer()` |
| `imgLoad = 2` | `state.getInactivePlayer()` |
| `player` | `state.activePlayer` |
| Direct index updates | `state.nextMedia()` |
| Manual div hiding | Listen to `mediaChanged` event |

**Key Points**:
- State.js works in browser (window.logger) and Node.js (console)
- No breaking changes to existing loopDiapo logic
- Gradually migrate one method at a time

---

### 2. MediaCache Integration (Data Layer)

**Goal**: Cache all image/video downloads

**Steps**:

```javascript
// In preload.js, add IPC handler:
ipcMain.handle('cache-get', async (event, url) => {
  const cache = // get or create cache instance
  return await cache.get(url);
});

// In loopDiapo.js:
const mediaBlob = await window.api.cacheGet(mediaUrl);
```

**Cache Strategy**:
- Preload next 2 media while current playing
- Disk fallback for 24h after download
- Auto-evict if >500MB

**Files to modify**:
1. `preload.js` - Add `cacheGet()` IPC handler
2. `main.js` - Add persistence layer
3. `loopDiapo.js` - Use cache.get() instead of direct fetch
4. `API/listeDiapo.js` - Parse ETag from responses

---

### 3. ErrorHandler Integration (Resilience)

**Goal**: Survive API failures gracefully

**Steps**:

```javascript
// In loopDiapo.js:
const errorHandler = new window.ErrorHandler();

// Wrap all API calls:
const mediaList = await errorHandler.executeWithRetry(
  'fetchMediaList',
  async () => {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
);

// Show fallback if API down:
errorHandler.setFallback('fetchMediaList', cachedMediaList);
```

**Circuit Breaker Thresholds**:
- Threshold: 3 consecutive failures
- Recovery: 30s timeout
- Retry delay: 1s → 2s → 4s → 10s

---

## Integration Checklist

### Week 1: DisplayState

- [ ] Copy `js/DisplayState.js` to project
- [ ] Import in `index.html` before `loopDiapo.js`
- [ ] Initialize `window.displayState = new DisplayState()`
- [ ] Replace `let imgShow, imgLoad, player` with state calls
- [ ] Update `showMedia()` to use `state.activePlayer`
- [ ] Update `nextMedia()` to call `state.nextMedia()`
- [ ] Test: `npm test` - ensure 60 tests still pass
- [ ] Test: `npm start` - verify 5 media cycle works
- [ ] Commit: "feat(state): migrate loopDiapo to DisplayState"

### Week 2: ErrorHandler (Safety)

- [ ] Copy `js/ErrorHandler.js` to project
- [ ] Create error handler instance in `loopDiapo.js`
- [ ] Wrap `fetch(apiUrl)` calls
- [ ] Set fallback content for API failures
- [ ] Add circuit breaker monitoring
- [ ] Test: Network disconnect → fallback works
- [ ] Test: API 500 error → circuit opens → recovers
- [ ] Commit: "feat(error): add circuit breaker resilience"

### Week 3: MediaCache (Performance)

- [ ] Copy `js/MediaCache.js` to project
- [ ] Add IPC handlers in `preload.js`
- [ ] Implement disk persistence in `main.js`
- [ ] Wrap media downloads in `cache.get()`
- [ ] Add preload for next 2 media
- [ ] Monitor cache stats in DevTools
- [ ] Test: Cache hit/miss rates
- [ ] Test: Disk fallback on network error
- [ ] Commit: "feat(cache): LRU media cache with ETag support"

### Week 4: Integration Tests + Release

- [ ] Write integration tests for all 3 modules together
- [ ] Test: Full cycle with all features
- [ ] Performance testing: Memory, CPU, bandwidth
- [ ] User acceptance testing
- [ ] Build `v1.9.0`
- [ ] Deploy and monitor

---

## Testing During Integration

### Run Tests After Each Change

```bash
# Unit tests
npm test

# Specific test file
npx mocha test/DisplayState.test.js

# Watch mode (auto-rerun on file change)
npx mocha test/**/*.test.js --watch
```

### Manual Testing Checklist

```bash
# Start app
npm start

# Check browser console (Ctrl+Shift+I)
# Verify logs for:
# ✅ DisplayState initialized
# ✅ Media list loaded
# ✅ Cache preloading
# ✅ Error recovery working

# Test scenarios:
1. Disconnect network → See fallback content
2. Close and reopen app → Cache persists
3. Cycle through media → No flash, smooth transitions
4. Run for 1+ hour → Memory stable at ~110MB
```

---

## Architecture After Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    index.html                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ <script>                                             │   │
│  │   window.displayState = new DisplayState()           │   │
│  │   window.errorHandler = new ErrorHandler()           │   │
│  │ </script>                                            │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │   loopDiapo.js      │
          ├────────────────────┤
          │ startLoop()         │ ◄──── Uses DisplayState
          │ nextMedia()         │ ◄──── Uses ErrorHandler
          │ showMedia(index)    │ ◄──── Uses MediaCache
          │ preloadNext()       │
          └────────┬────────────┘
                   │
        ┌──────────┼──────────┬────────────┐
        │          │          │            │
    ┌───▼───┐  ┌──▼────┐  ┌──▼─────┐  ┌──▼─────────┐
    │ State │  │ Errors│  │ Cache  │  │ Media      │
    │ Mgmt  │  │Circuit│  │  LRU   │  │ Container  │
    │Events │  │Breaker│  │ Disk   │  │ (div)      │
    └───────┘  └───────┘  └────────┘  └────────────┘
```

---

## Common Issues & Solutions

### Issue 1: "DisplayState is not defined"
**Solution**: Make sure `js/DisplayState.js` is included in `index.html` BEFORE `loopDiapo.js`

### Issue 2: Media not displaying after migration
**Solution**: Check that `showMedia()` still works with new state. Verify event listeners are connected.

### Issue 3: Cache not persisting
**Solution**: Verify `preload.js` IPC handlers are registered. Check that `C:/SEE/media/` directory is writable.

### Issue 4: Circuit breaker keeps opening
**Solution**: Check network connectivity. Verify API endpoint is returning valid JSON. Increase retry count.

### Issue 5: Memory usage increasing
**Solution**: Monitor `cache.getStats()`. If cache size >450MB, adjust `maxSize` or increase eviction frequency.

---

## Performance Monitoring

Add this to DevTools console (Ctrl+Shift+I):

```javascript
// Monitor state
setInterval(() => {
  console.log('STATE:', window.displayState.getSnapshot());
}, 5000);

// Monitor cache
setInterval(() => {
  console.log('CACHE:', window.cache?.getStats());
}, 5000);

// Monitor errors
setInterval(() => {
  console.log('ERRORS:', window.errorHandler?.getErrorStats());
}, 5000);
```

---

## Success Criteria

✅ **All 60 tests still passing**  
✅ **5 media cycle smoothly without flash**  
✅ **App survives 10+ consecutive API failures**  
✅ **Cache hit rate >50% after first cycle**  
✅ **Memory stable <150MB for 24+ hours**  
✅ **No console errors on start**  

---

## Support & Debugging

### Enable Verbose Logging

In `loopDiapo.js`:
```javascript
window.logger.debug = console.debug; // Capture all logs
```

### Monitor Live Logs

```bash
# Get logs from running app
npm run logs  # Custom script to tail electron-log

# Or manually in DevTools
console.log(...) // All go to electron-log on IPC
```

### Common Debug Commands

```javascript
// In DevTools console:

// Check current state
displayState.getSnapshot()

// Manually trigger next media
displayState.nextMedia()

// Check cache size
cache.getStats()

// Force clear cache
cache.clear()

// Check error handler state
errorHandler.getCircuitBreakerStatus('fetchMediaList')

// Reset circuit breaker
errorHandler.resetCircuitBreaker('fetchMediaList')
```

---

## Timeline & Milestones

| Week | Task | Status |
|------|------|--------|
| Oct 17-18 | Integrate DisplayState | 📅 |
| Oct 19-20 | Integrate ErrorHandler | 📅 |
| Oct 23-24 | Integrate MediaCache | 📅 |
| Oct 25-27 | Integration tests + fixes | 📅 |
| Oct 28-29 | Performance baseline | 📅 |
| Oct 30-31 | Build v1.9.0 + deploy | 📅 |

---

**Phase 2 Start Date**: October 17, 2025  
**Target Completion**: October 31, 2025  
**Success Criteria**: All 60 tests + 3 integrations working  

*See PHASE2.md for detailed roadmap and PHASE1_SUMMARY.md for reference implementation.*
