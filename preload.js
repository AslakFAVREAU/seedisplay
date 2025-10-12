const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')
const axios = require('axios')

// Limit paths to C:\\SEE by default
const BASE_PATH = 'C:/SEE/'

function safeJoin(base, p) {
  const resolved = path.resolve(base, p)
  if (!resolved.startsWith(path.resolve(base))) throw new Error('Path outside allowed base')
  return resolved
}

contextBridge.exposeInMainWorld('api', {
  getConfig: async () => {
    const configPath = safeJoin(BASE_PATH, 'configSEE.json')
    try {
      const raw = fs.readFileSync(configPath, 'utf8')
      // Retourne la configuration trouvée sur le disque (C:/SEE/configSEE.json)
      return JSON.parse(raw)
    } catch (e) {
      // Return defaults if no config
      // Si aucun fichier de config n'existe, renvoyer des valeurs par défaut raisonnables
      return { meteo: true, meteoApiKey: null, meteoLat: 48.75, meteoLon: 2.3, meteoUnits: 'metric', env: 'prod' }
    }
  },
  readFile: (relativePath) => {
    const p = safeJoin(BASE_PATH, relativePath)
    // Lit un fichier texte sous C:/SEE/, renvoie son contenu
    return fs.readFileSync(p, 'utf8')
  },
  writeFile: (relativePath, data) => {
    const p = safeJoin(BASE_PATH, relativePath)
    // Ensure parent directory exists (create recursively) to avoid ENOENT
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
  },
  // Read a file bundled with the application (relative to app root)
  readBundledFile: (relativePath) => {
    const p = require('path').join(__dirname, relativePath)
    // Lit un fichier inclus dans l'archive de l'application (fallback embarqué)
    return fs.readFileSync(p, 'utf8')
  },
  fetchJson: async (url, opts) => {
    const res = await axios.get(url, opts)
    return res.data
  },
  getEnv: (name) => {
    // Accès à une variable d'environnement (utile pour stocker des clés API sans les mettre dans le bundle)
    try { return process.env[name] || null } catch (e) { return null }
  },
  existsSync: (relativePath) => {
    try {
      const p = safeJoin(BASE_PATH, relativePath)
      return fs.existsSync(p)
    } catch (e) { return false }
  },
  // Save binary content downloaded from url into relativePath under BASE_PATH
  saveBinary: async (relativePath, url) => {
    try {
      const p = safeJoin(BASE_PATH, relativePath)
      // Ensure parent directory exists
      const dir = path.dirname(p)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const res = await axios.get(url, { responseType: 'arraybuffer' })
      const buf = Buffer.from(res.data)
      fs.writeFileSync(p, buf)
      try { ipcRenderer.send('renderer-log', { level: 'info', msg: 'preload.saveBinary wrote: ' + p }) } catch (err) { /* ignore */ }
      // After saving a media file, attempt to prune cache according to configured limit
      try {
        const limit = global.__mediaCacheLimitBytes || (1024 * 1024 * 1024) // default 1GB
        await (async function prune(){
          try {
            const mediaDir = safeJoin(BASE_PATH, 'media')
            if (!fs.existsSync(mediaDir)) return
            const files = fs.readdirSync(mediaDir).map(f => {
              const st = fs.statSync(path.join(mediaDir, f))
              return { name: f, path: path.join(mediaDir, f), mtime: st.mtimeMs, size: st.size }
            }).sort((a,b) => a.mtime - b.mtime)
            let total = files.reduce((s, x) => s + x.size, 0)
            for (const file of files) {
              if (total <= limit) break
              try { fs.unlinkSync(file.path); total -= file.size; ipcRenderer.send('renderer-log', { level: 'info', msg: 'preload.prune: removed ' + file.path }) } catch(e) { /* ignore */ }
            }
          } catch(e){ /* ignore */ }
        })()
      } catch(e) { /* ignore */ }
      return true
    } catch (e) {
      // En cas d'erreur, log depuis le preload via ipc et renvoyer false
      try { ipcRenderer.send('renderer-log', { level: 'error', msg: 'preload.saveBinary failed: ' + String(e) }) } catch (err) { /* ignore */ }
      return false
    }
  },
  // Media cache management APIs
  getMediaCacheInfo: () => {
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
  },
  setMediaCacheLimit: (bytes) => {
    try { global.__mediaCacheLimitBytes = Number(bytes) || 0; return true } catch(e){ return false }
  },
  pruneMedia: () => {
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
    const res = await axios.get(url, opts)
    return res
  },
  post: async (url, data, opts) => {
    const res = await axios.post(url, data, opts)
    return res
  }
})
