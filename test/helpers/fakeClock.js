/**
 * Horloge simulée : setTimeout / setInterval / Date pilotés par tick(ms).
 * Les microtâches (promesses, async/await) sont vidées entre chaque timer,
 * ce qui permet de simuler des heures de fonctionnement en quelques secondes.
 */
const flushMicrotasks = () => new Promise(r => setImmediate(r))

class FakeClock {
  constructor(start = Date.UTC(2026, 10, 3, 10, 0, 0)) {
    this._now = start
    this._timers = new Map()
    this._nextId = 1
    const clock = this

    this.setTimeout = (fn, ms = 0, ...args) => clock._add(fn, ms, args, false)
    this.setInterval = (fn, ms = 0, ...args) => clock._add(fn, ms, args, true)
    this.clearTimeout = (id) => { if (id != null) clock._timers.delete(typeof id === 'object' ? id.id : id) }
    this.clearInterval = this.clearTimeout

    const RealDate = Date
    class FakeDate extends RealDate {
      constructor(...a) { if (a.length === 0) super(clock._now); else super(...a) }
      static now() { return clock._now }
    }
    this.Date = FakeDate
  }

  now() { return this._now }

  _add(fn, ms, args, repeat) {
    const id = this._nextId++
    const delay = Math.max(0, Number(ms) || 0)
    this._timers.set(id, { id, fn, args, at: this._now + delay, delay: Math.max(1, delay), repeat })
    return id
  }

  /** Nombre de timers en attente (détection de fuite). */
  pending() { return this._timers.size }

  /** Avance l'horloge de `ms`, en exécutant les timers échus dans l'ordre. */
  async tick(ms) {
    const target = this._now + ms
    await flushMicrotasks()
    for (;;) {
      let next = null
      for (const t of this._timers.values()) {
        if (t.at <= target && (!next || t.at < next.at || (t.at === next.at && t.id < next.id))) next = t
      }
      if (!next) break
      this._now = Math.max(this._now, next.at)
      if (next.repeat) next.at += next.delay
      else this._timers.delete(next.id)
      next.fn(...next.args)
      await flushMicrotasks()
    }
    this._now = target
    await flushMicrotasks()
  }
}

module.exports = { FakeClock, flushMicrotasks }
