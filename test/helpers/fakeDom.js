/**
 * Faux DOM minimal pour exécuter js/loopDiapo.js hors navigateur.
 *
 * Les <video> et Image sont pilotés par des "scénarios" par fichier, ce qui
 * permet d'injecter des pannes : vidéo jamais prête, erreur DECODE, lecture
 * figée, play() refusé, image en erreur ou jamais chargée…
 *
 * Scénarios vidéo (dom.videoScenario[fichier]) :
 *   'ok'                 prête en 50ms, dure `duration` s, puis 'ended'
 *   'noCanPlay'          jamais 'canplaythrough'
 *   'decode'             'error' MediaError 3 (DECODE) à chaque chargement
 *   'decodeOnce'         'error' DECODE au 1er chargement, OK au suivant
 *   'decodeMidPlay'      lit 1s puis 'error' DECODE (une seule fois)
 *   'stall'              lit 1s puis currentTime n'avance plus
 *   'playReject'         play() rejette
 *   'abortedThenSilent'  'error' ABORTED puis plus rien
 * Scénarios image (dom.imageScenario[fichier]) : 'ok' | 'error' | 'never'
 * Délai de chargement d'une image : dom.imageDelay[fichier] (ms, défaut 10)
 */

function fileFromUrl(url) {
  const s = String(url || '')
  const i = s.lastIndexOf('/')
  return decodeURIComponent((i >= 0 ? s.slice(i + 1) : s).split('#')[0])
}

class FakeElement {
  constructor(id) {
    this.id = id
    this.style = {}
    this.attributes = {}
  }
  setAttribute(k, v) { this.attributes[k] = String(v) }
  removeAttribute(k) { delete this.attributes[k] }
  getAttribute(k) { return this.attributes[k] }
}

class FakeVideo extends FakeElement {
  constructor(id, dom) {
    super(id)
    this._dom = dom
    this._listeners = {}
    this.currentTime = 0
    this.ended = false
    this.paused = true
    this.readyState = 0
    this.error = null
    this.muted = true
    this.loop = false
    this.playbackRate = 1
    this._src = ''
    this._loads = 0
    this._progress = null
  }

  get src() { return this._src }
  set src(v) { this._src = v; this.attributes.src = v }
  removeAttribute(k) { super.removeAttribute(k); if (k === 'src') this._src = '' }

  canPlayType() { return '' }

  addEventListener(type, fn, opts = {}) {
    if (opts.signal && opts.signal.aborted) return
    const entry = { fn, once: !!opts.once }
    ;(this._listeners[type] = this._listeners[type] || []).push(entry)
    if (opts.signal) opts.signal.addEventListener('abort', () => this._remove(type, entry))
  }
  removeEventListener(type, fn) {
    this._listeners[type] = (this._listeners[type] || []).filter(e => e.fn !== fn)
  }
  _remove(type, entry) {
    this._listeners[type] = (this._listeners[type] || []).filter(e => e !== entry)
  }
  emit(type) {
    for (const e of [...(this._listeners[type] || [])]) {
      if (e.once) this._remove(type, e)
      e.fn({ type, target: this })
    }
  }
  listenerCount() {
    return Object.values(this._listeners).reduce((n, l) => n + l.length, 0)
  }

  _stopProgress() {
    if (this._progress) { this._dom.clock.clearInterval(this._progress); this._progress = null }
  }

  pause() { this.paused = true; this._stopProgress() }

  load() {
    this._stopProgress()
    this.currentTime = 0
    this.ended = false
    this.paused = true
    this.readyState = 0
    this.error = null
    if (!this._src) return
    const file = fileFromUrl(this._src)
    const scenario = this._dom.videoScenario[file] || this._dom.defaultVideoScenario
    const loadNo = ++this._loads
    this._file = file
    this._dom.stats.videoLoads++
    const clock = this._dom.clock
    const fail = (code) => { this.error = { code, message: 'fake error ' + code }; this.emit('error') }

    if (scenario === 'noCanPlay') return
    if (scenario === 'decode') return void clock.setTimeout(() => this._loads === loadNo && fail(3), 30)
    if (scenario === 'abortedThenSilent') return void clock.setTimeout(() => this._loads === loadNo && fail(1), 30)
    if (scenario === 'decodeOnce' && !this._dom._decodedOnce.has(file)) {
      this._dom._decodedOnce.add(file)
      return void clock.setTimeout(() => this._loads === loadNo && fail(3), 30)
    }
    clock.setTimeout(() => {
      if (this._loads !== loadNo) return
      this.readyState = 4
      this.emit('canplaythrough')
    }, 50)
  }

  play() {
    const file = this._file
    const scenario = this._dom.videoScenario[file] || this._dom.defaultVideoScenario
    if (scenario === 'playReject') return Promise.reject(new Error('NotAllowedError: fake'))
    this.paused = false
    this._dom.stats.videoPlays++
    const duration = this._dom.videoDuration[file] || this._dom.defaultVideoDuration
    const clock = this._dom.clock
    const loadNo = this._loads
    this._stopProgress()
    this._progress = clock.setInterval(() => {
      if (this._loads !== loadNo || this.paused) return this._stopProgress()
      if ((scenario === 'stall' || scenario === 'decodeMidPlay') && this.currentTime >= 1) {
        if (scenario === 'decodeMidPlay' && !this._dom._decodedOnce.has(file)) {
          this._dom._decodedOnce.add(file)
          this._stopProgress()
          this.error = { code: 3, message: 'fake mid-play decode' }
          return this.emit('error')
        }
        if (scenario === 'stall') return   // currentTime figé
      }
      this.currentTime = Math.min(duration, this.currentTime + 0.25 * this.playbackRate)
      this.emit('timeupdate')
      if (this.currentTime >= duration) {
        this._stopProgress()
        this.ended = true
        this.paused = true
        this._dom.stats.videoEnded++
        this.emit('ended')
      }
    }, 250)
    return Promise.resolve()
  }
}

function createFakeDom(clock) {
  const dom = {
    clock,
    elements: {},
    videoScenario: {},
    imageScenario: {},
    imageDelay: {},
    videoDuration: {},
    defaultVideoScenario: 'ok',
    defaultVideoDuration: 3,
    _decodedOnce: new Set(),
    stats: { videoLoads: 0, videoPlays: 0, videoEnded: 0, imageLoads: 0, imageErrors: 0 }
  }

  for (const id of ['pageDefault', 'mediaContainer', 'divImg1', 'divImg2', 'divVideo1', 'divVideo2', 'templateContainer']) {
    dom.elements[id] = new FakeElement(id)
  }
  dom.elements.video1 = new FakeVideo('video1', dom)
  dom.elements.video2 = new FakeVideo('video2', dom)
  dom.elements.pageDefault.style.display = 'flex'

  dom.document = {
    getElementById: (id) => dom.elements[id] || null,
    querySelector: () => null,
    createElement: (tag) => tag === 'video' ? new FakeVideo('tmp', dom) : new FakeElement(tag)
  }

  dom.Image = class FakeImage {
    constructor() { this.onload = null; this.onerror = null; this._src = '' }
    get src() { return this._src }
    set src(url) {
      this._src = url
      const file = fileFromUrl(url)
      const scenario = dom.imageScenario[file] || 'ok'
      dom.stats.imageLoads++
      if (scenario === 'never') return
      clock.setTimeout(() => {
        if (scenario === 'error') { dom.stats.imageErrors++; this.onerror && this.onerror() }
        else this.onload && this.onload()
      }, dom.imageDelay[file] || 10)
    }
  }

  /** Élément actuellement visible (display block/flex), hors conteneurs. */
  dom.visible = () => ['divImg1', 'divImg2', 'divVideo1', 'divVideo2']
    .filter(id => dom.elements[id].style.display === 'block')

  return dom
}

module.exports = { createFakeDom, FakeVideo, fileFromUrl }
