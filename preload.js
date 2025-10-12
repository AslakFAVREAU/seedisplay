const { contextBridge, ipcRenderer } = require('electron')
// Try to require Node modules; in some Electron setups (sandboxed preload)
// require may not be available. Fall back to IPC invocations handled by main.
let hasNode = true
let fs = null
let path = null
let axios = null
try {
  fs = require('fs')
  path = require('path')
  axios = require('axios')
} catch (e) {
  hasNode = false
}

// Limit paths to C:\\SEE by default
const BASE_PATH = 'C:/SEE/'

function safeJoin(base, p) {
  const resolved = path.resolve(base, p)
  if (!resolved.startsWith(path.resolve(base))) throw new Error('Path outside allowed base')
  return resolved
}

contextBridge.exposeInMainWorld('api', {
  getConfig: async () => {
    // If we have node, read directly, else ask main process
    if (hasNode) {
      const configPath = safeJoin(BASE_PATH, 'configSEE.json')
      try {
        const raw = fs.readFileSync(configPath, 'utf8')
        return JSON.parse(raw)
      } catch (e) {
        return { meteo: true, meteoApiKey: null, meteoLat: 48.75, meteoLon: 2.3, meteoUnits: 'metric', env: 'prod' }
      }
    }
    try {
      const res = await ipcRenderer.invoke('preload-getConfig')
      return res || { meteo: true, meteoApiKey: null, meteoLat: 48.75, meteoLon: 2.3, meteoUnits: 'metric', env: 'prod' }
    } catch (e) {
      return { meteo: true, meteoApiKey: null, meteoLat: 48.75, meteoLon: 2.3, meteoUnits: 'metric', env: 'prod' }
    }
  },
  readFile: async (relativePath) => {
    if (hasNode) {
      const p = safeJoin(BASE_PATH, relativePath)
      return fs.readFileSync(p, 'utf8')
    }
    return await ipcRenderer.invoke('preload-readFile', relativePath)
  },
  writeFile: async (relativePath, data) => {
    if (hasNode) {
      const p = safeJoin(BASE_PATH, relativePath)
      try {
        const dir = path.dirname(p)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      } catch (e) {
        try { ipcRenderer.send('renderer-log', { level: 'error', msg: 'preload.writeFile mkdir failed: ' + String(e) }) } catch (err) { /* ignore */ }
        throw e
      }
      fs.writeFileSync(p, data)
      try { ipcRenderer.send('renderer-log', { level: 'info', msg: 'preload.writeFile wrote: ' + p }) } catch (err) { /* ignore */ }
      return true
    }
    return await ipcRenderer.invoke('preload-writeFile', relativePath, data)
  },
  // Read a file bundled with the application (relative to app root)
  readBundledFile: async (relativePath) => {
    if (hasNode) {
      const p = require('path').join(__dirname, relativePath)
      return fs.readFileSync(p, 'utf8')
    }
    return await ipcRenderer.invoke('preload-readBundledFile', relativePath)
  },
  fetchJson: async (url, opts) => {
    if (hasNode && axios) {
      const res = await axios.get(url, opts)
      return res.data
    }
    return await ipcRenderer.invoke('preload-fetchJson', url, opts)
  },
  getEnv: (name) => {
    try { if (hasNode) return process.env[name] || null } catch(e) {}
    try { return ipcRenderer.sendSync('preload-getEnv', name) } catch(e) { return null }
  },
  existsSync: (relativePath) => {
    try {
      if (hasNode) {
        const p = safeJoin(BASE_PATH, relativePath)
        return fs.existsSync(p)
      }
      return ipcRenderer.sendSync('preload-existsSync', relativePath)
    } catch (e) { return false }
  },
  // Save binary content downloaded from url into relativePath under BASE_PATH
  saveBinary: async (relativePath, url) => {
    if (hasNode) {
      try {
        const p = safeJoin(BASE_PATH, relativePath)
        const dir = path.dirname(p)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const res = await axios.get(url, { responseType: 'arraybuffer' })
        const buf = Buffer.from(res.data)
        fs.writeFileSync(p, buf)
        try { ipcRenderer.send('renderer-log', { level: 'info', msg: 'preload.saveBinary wrote: ' + p }) } catch (err) { /* ignore */ }
        // prune (best-effort)
        try { ipcRenderer.invoke('preload-pruneMedia') } catch(e){}
        return true
      } catch (e) {
        try { ipcRenderer.send('renderer-log', { level: 'error', msg: 'preload.saveBinary failed: ' + String(e) }) } catch (err) { /* ignore */ }
        return false
      }
    }
    return await ipcRenderer.invoke('preload-saveBinary', relativePath, url)
  },
  // Media cache management APIs
  getMediaCacheInfo: async () => {
    if (hasNode) {
      try {
        const mediaDir = safeJoin(BASE_PATH, 'media')
        if (!fs.existsSync(mediaDir)) return { totalBytes: 0, files: 0 }
        const files = fs.readdirSync(mediaDir)
        let total = 0
        for (const f of files) {
          try { total += fs.statSync(path.join(mediaDir, f)).size } catch(e){}
        }
        return { totalBytes: total, files: files.length }
      } catch(e) { return { totalBytes: 0, files: 0 } }
    }
    return await ipcRenderer.invoke('preload-getMediaCacheInfo')
  },
  setMediaCacheLimit: (bytes) => {
    try { if (hasNode) { global.__mediaCacheLimitBytes = Number(bytes) || 0; return true } return ipcRenderer.sendSync('preload-setMediaCacheLimit', bytes) } catch(e){ return false }
  },
  pruneMedia: () => {
    if (hasNode) {
      try {
        const mediaDir = safeJoin(BASE_PATH, 'media')
        if (!fs.existsSync(mediaDir)) return false
        const files = fs.readdirSync(mediaDir).map(f => {
          const st = fs.statSync(path.join(mediaDir, f))
          return { name: f, path: path.join(mediaDir, f), mtime: st.mtimeMs, size: st.size }
        }).sort((a,b) => a.mtime - b.mtime)
        const limit = global.__mediaCacheLimitBytes || (1024 * 1024 * 1024)
        let total = files.reduce((s, x) => s + x.size, 0)
        for (const file of files) {
          if (total <= limit) break
          try { fs.unlinkSync(file.path); total -= file.size; ipcRenderer.send('renderer-log', { level: 'info', msg: 'preload.pruneMedia removed ' + file.path }) } catch(e) { /* ignore */ }
        }
        return true
      } catch(e) { return false }
    }
    try { return ipcRenderer.invoke('preload-pruneMedia') } catch(e) { return false }
  },
  log: (level, msg) => {
    ipcRenderer.send('renderer-log', { level, msg })
  }
  ,
  onMessage: (callback) => {
    ipcRenderer.on('message', (event, text) => {
      try { callback(text) } catch (e) { /* swallow */ }
    })
  }
})

// Expose a structured logger helper to the renderer. Use it to standardize logs
// across the UI: each message will include ISO timestamp, level and tag.
contextBridge.exposeInMainWorld('logger', {
  _format: (level, tag, args) => {
    const ts = new Date().toISOString()
    const payload = Array.from(args || []).map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
    return `[${ts}] [${String(level).toUpperCase()}] [${String(tag)}] ${payload}`
  },
  info: (tag, ...args) => {
    try {
      const formatted = contextBridge ? (`${new Date().toISOString()} [INFO] [${tag}] ${Array.from(args || []).map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`) : ''
      if (ipcRenderer && typeof ipcRenderer.send === 'function') ipcRenderer.send('renderer-log', { level: 'info', msg: formatted })
    } catch (e) { /* ignore */ }
  },
  warn: (tag, ...args) => {
    try {
      const formatted = `${new Date().toISOString()} [WARN] [${tag}] ${Array.from(args || []).map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
      if (ipcRenderer && typeof ipcRenderer.send === 'function') ipcRenderer.send('renderer-log', { level: 'warn', msg: formatted })
    } catch (e) { /* ignore */ }
  },
  error: (tag, ...args) => {
    try {
      const formatted = `${new Date().toISOString()} [ERROR] [${tag}] ${Array.from(args || []).map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
      if (ipcRenderer && typeof ipcRenderer.send === 'function') ipcRenderer.send('renderer-log', { level: 'error', msg: formatted })
    } catch (e) { /* ignore */ }
  },
  debug: (tag, ...args) => {
    try {
      const formatted = `${new Date().toISOString()} [DEBUG] [${tag}] ${Array.from(args || []).map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
      if (ipcRenderer && typeof ipcRenderer.send === 'function') ipcRenderer.send('renderer-log', { level: 'debug', msg: formatted })
    } catch (e) { /* ignore */ }
  }
})

// Expose a minimal axios-like API for renderer code that expects axios
contextBridge.exposeInMainWorld('axios', {
  get: async (url, opts) => {
    if (hasNode && axios) {
      const res = await axios.get(url, opts)
      return res
    }
    // Fallback to ipc fetch: normalize to axios-like response { data }
    try {
      const result = await ipcRenderer.invoke('preload-fetchJson', url, opts || {})
      return { data: result }
    } catch (e) {
      return { data: null }
    }
  },
  post: async (url, data, opts) => {
    if (hasNode && axios) {
      const res = await axios.post(url, data, opts)
      return res
    }
    const req = Object.assign({}, opts || {}, { method: 'POST', data })
    try {
      const result = await ipcRenderer.invoke('preload-fetchJson', url, req)
      return { data: result }
    } catch (e) {
      return { data: null }
    }
  }
})
