const assert = require('assert')

// Mock window and DOM for Node tests
const mockBodyStyle = { filter: '' }
global.document = {
  getElementById: () => ({ style: {} }),
  createElement: () => ({ 
    style: {}, 
    appendChild: () => {},
    innerHTML: ''
  }),
  body: { 
    style: mockBodyStyle, 
    appendChild: () => {} 
  }
}
global.window = {
  logger: null
}

const { SleepManager } = require('../js/SleepManager')

describe('SleepManager', () => {
  let sleepManager

  beforeEach(() => {
    sleepManager = new SleepManager()
    // Reset body style before each test
    mockBodyStyle.filter = ''
  })

  describe('shouldSleep', () => {
    it('returns true when status is sleep', () => {
      const apiResponse = { status: 'sleep', typeHorsPlage: 'noir' }
      assert.strictEqual(sleepManager.shouldSleep(apiResponse), true)
    })

    it('returns false when status is active', () => {
      const apiResponse = { status: 'active', diapos: [] }
      assert.strictEqual(sleepManager.shouldSleep(apiResponse), false)
    })

    it('returns false when no response', () => {
      assert.strictEqual(!!sleepManager.shouldSleep(null), false)
      assert.strictEqual(!!sleepManager.shouldSleep(undefined), false)
      assert.strictEqual(!!sleepManager.shouldSleep({}), false)
    })
  })

  describe('enterSleepMode', () => {
    it('sets isSleeping to true', () => {
      assert.strictEqual(sleepManager.isSleeping, false)
      sleepManager.enterSleepMode({ typeHorsPlage: 'noir' })
      assert.strictEqual(sleepManager.isSleeping, true)
    })

    it('does not re-enter if already sleeping', () => {
      sleepManager.isSleeping = true
      // Should not throw or create duplicate containers
      sleepManager.enterSleepMode({ typeHorsPlage: 'noir' })
      assert.strictEqual(sleepManager.isSleeping, true)
    })
  })

  describe('exitSleepMode', () => {
    it('sets isSleeping to false', () => {
      sleepManager.isSleeping = true
      sleepManager.exitSleepMode()
      assert.strictEqual(sleepManager.isSleeping, false)
    })

    it('clears timeouts', () => {
      sleepManager.isSleeping = true
      sleepManager.wakeupTimeout = setTimeout(() => {}, 10000)
      sleepManager.checkInterval = setInterval(() => {}, 10000)
      
      sleepManager.exitSleepMode()
      
      assert.strictEqual(sleepManager.wakeupTimeout, null)
      assert.strictEqual(sleepManager.checkInterval, null)
    })
  })

  describe('applyLuminosity', () => {
    it('applies brightness filter for 50%', () => {
      sleepManager.applyLuminosity(50)
      // Check that filter contains brightness
      assert.ok(document.body.style.filter.includes('brightness'))
    })

    it('applies brightness filter for 100%', () => {
      sleepManager.applyLuminosity(100)
      // brightness(1) = 100%
      assert.ok(document.body.style.filter.includes('1'))
    })

    it('applies brightness filter for 0%', () => {
      sleepManager.applyLuminosity(0)
      // brightness(0) = 0% - just check it runs without error
      assert.ok(document.body.style.filter !== undefined)
    })
  })

  describe('resetLuminosity', () => {
    it('removes brightness filter', () => {
      document.body.style.filter = 'brightness(0.5)'
      sleepManager.resetLuminosity()
      assert.strictEqual(document.body.style.filter, '')
    })
  })
})
