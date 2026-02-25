const { contextBridge, ipcRenderer } = require('electron')
// Try to require Node modules; in some Electron setups (sandboxed preload)
// require may not be available. Fall back to IPC invocations handled by main.
let hasNode = true
let fs = null
let path = null
let axios = null
let os = null
try {
  fs = require('fs')
  path = require('path')
  axios = require('axios')
  os = require('os')
  // Verify fs works by checking if the module has expected methods
  if (!fs || typeof fs.readFileSync !== 'function') {
    hasNode = false
  }
} catch (e) {
  console.log('[preload] Node modules not available, using IPC fallback:', e.message)
  hasNode = false
}

console.log('[preload] hasNode =', hasNode)

//-------------------------------------------------------------------
// Cross-platform Base Path Configuration
// Windows: C:/SEE/
// Linux/macOS: /opt/seedisplay/data/ or ~/.seedisplay/
//-------------------------------------------------------------------
function getBasePath() {
  if (!hasNode || !os) {
    // Fallback si pas d'accès Node - sera géré par IPC
    return process.platform === 'win32' ? 'C:/SEE/' : '/opt/seedisplay/data/'
  }
  
  const platform = process.platform
  
  if (platform === 'win32') {
    return 'C:/SEE/'
  } else if (platform === 'linux') {
    // Sur Linux, préférer /opt/seedisplay/data si accessible
    const optPath = '/opt/seedisplay/data/'
    const homePath = path.join(os.homedir(), '.seedisplay/')
    
    try {
      if (fs.existsSync(optPath) || fs.existsSync('/opt/seedisplay/')) {
        if (!fs.existsSync(optPath)) {
          fs.mkdirSync(optPath, { recursive: true })
        }
        return optPath
      }
    } catch (e) {
      console.log('[preload] Cannot use /opt/seedisplay, falling back to home:', e.message)
    }
    
    // Fallback vers home directory
    try {
      if (!fs.existsSync(homePath)) {
        fs.mkdirSync(homePath, { recursive: true })
      }
    } catch (e) { /* ignore */ }
    return homePath
  } else if (platform === 'darwin') {
    const macPath = path.join(os.homedir(), 'Library/Application Support/SEEDisplay/')
    try {
      if (!fs.existsSync(macPath)) {
        fs.mkdirSync(macPath, { recursive: true })
      }
    } catch (e) { /* ignore */ }
    return macPath
  }
  
  return 'C:/SEE/' // Fallback
}

const BASE_PATH = getBasePath()
console.log('[preload] Platform:', process.platform, '/', process.arch, ', BASE_PATH:', BASE_PATH)

function safeJoin(base, p) {
  if (!path) {
    // Fallback: simple string join if path module not available
    const result = base.replace(/\/$/, '') + '/' + p.replace(/^\//, '')
    console.log('[preload] safeJoin (fallback):', base, '+', p, '->', result)
    return result
  }
  const resolved = path.resolve(base, p)
  if (!resolved.startsWith(path.resolve(base))) throw new Error('Path outside allowed base')
  return resolved
}

contextBridge.exposeInMainWorld('api', {
  // Update management
  checkForUpdates: async () => {
    try {
      return await ipcRenderer.invoke('check-for-updates');
    } catch (e) {
      console.error('[preload] checkForUpdates failed:', e.message);
      return { success: false, error: e.message };
    }
  },
  getAppVersion: async () => {
    try {
      return await ipcRenderer.invoke('get-app-version');
    } catch (e) {
      console.error('[preload] getAppVersion failed:', e.message);
      return 'unknown';
    }
  },
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, status) => {
      callback(status);
    });
  },
  // Reset user data (delete config, cache, media)
  resetUserData: async () => {
    try {
      return await ipcRenderer.invoke('reset-user-data');
    } catch (e) {
      console.error('[preload] resetUserData failed:', e.message);
      return { success: false, error: e.message };
    }
  },
  // Capture screenshot (720p by default)
  captureScreen: async (width = 1280, height = 720) => {
    try {
      return await ipcRenderer.invoke('capture-screen', width, height);
    } catch (e) {
      console.error('[preload] captureScreen failed:', e.message);
      return null;
    }
  },
  // Mode setup : désactiver fullscreen/kiosk pour naviguer entre fenêtres
  enterSetupMode: () => {
    try {
      ipcRenderer.send('enter-setup-mode');
    } catch (e) {
      console.error('[preload] enterSetupMode failed:', e.message);
    }
  },
  leaveSetupMode: () => {
    try {
      ipcRenderer.send('leave-setup-mode');
    } catch (e) {
      console.error('[preload] leaveSetupMode failed:', e.message);
    }
  },
  // Window resize (for custom screen dimensions from API)
  resizeWindow: async (width, height) => {
    try {
      console.log('[preload] resizeWindow:', width, 'x', height);
      return await ipcRenderer.invoke('resize-window', width, height);
    } catch (e) {
      console.error('[preload] resizeWindow failed:', e.message);
      return false;
    }
  },
  getConfig: async () => {
    console.log('[preload] getConfig called, hasNode =', hasNode)
    // If we have node, read directly, else ask main process
    if (hasNode) {
      const configPath = safeJoin(BASE_PATH, 'configSEE.json')
      console.log('[preload] Reading config from:', configPath)
      try {
        const raw = fs.readFileSync(configPath, 'utf8')
        const parsed = JSON.parse(raw)
        parsed._basePath = BASE_PATH  // Injecter le basePath pour le renderer
        console.log('[preload] Config loaded successfully:', JSON.stringify(parsed))
        return parsed
      } catch (e) {
        console.error('[preload] Failed to read config file:', e.message)
        console.log('[preload] Returning defaults')
        return { _basePath: BASE_PATH, meteo: true, meteoApiKey: null, meteoLat: 48.75, meteoLon: 2.3, meteoUnits: 'metric', env: 'prod' }
      }
    }
    console.log('[preload] Using IPC fallback for config')
    try {
      const res = await ipcRenderer.invoke('preload-getConfig')
      if (res) res._basePath = BASE_PATH  // Injecter le basePath pour le renderer
      console.log('[preload] IPC getConfig result:', JSON.stringify(res))
      return res || { _basePath: BASE_PATH, meteo: true, meteoApiKey: null, meteoLat: 48.75, meteoLon: 2.3, meteoUnits: 'metric', env: 'prod' }
    } catch (e) {
      console.error('[preload] IPC getConfig failed:', e.message)
      return { _basePath: BASE_PATH, meteo: true, meteoApiKey: null, meteoLat: 48.75, meteoLon: 2.3, meteoUnits: 'metric', env: 'prod' }
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
    try {
      if (hasNode && axios) {
        const res = await axios.get(url, opts)
        return res.data
      }
      return await ipcRenderer.invoke('preload-fetchJson', url, opts)
    } catch (e) {
      console.error('[preload] fetchJson error:', e.message)
      return null
    }
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
  },
  // Phase 2 Week 3: Binary download with MediaCache support
  // Downloads url to relativePath, using ETag validation and LRU disk cache
  saveBinaryWithCache: async (relativePath, url, cacheOptions = {}) => {
    if (hasNode) {
      try {
        const p = safeJoin(BASE_PATH, relativePath)
        const dir = path.dirname(p)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        
        // Get ETag info from cache metadata (if it exists)
        const cacheMetadataPath = p + '.metadata.json'
        let existingETag = null
        let existingLastModified = null
        
        try {
          if (fs.existsSync(cacheMetadataPath)) {
            const metadata = JSON.parse(fs.readFileSync(cacheMetadataPath, 'utf8'))
            existingETag = metadata.etag
            existingLastModified = metadata.lastModified
          }
        } catch(e) { /* ignore corrupted metadata */ }
        
        // Build request headers for conditional fetch
        const headers = {}
        if (existingETag) headers['If-None-Match'] = existingETag
        if (existingLastModified) headers['If-Modified-Since'] = existingLastModified
        
        try {
          const res = await axios.get(url, { 
            responseType: 'arraybuffer',
            headers,
            validateStatus: (status) => status === 200 || status === 304
          })
          
          // 304 Not Modified - file is still valid
          if (res.status === 304) {
            ipcRenderer.send('renderer-log', { level: 'info', msg: 'preload.saveBinaryWithCache: 304 Not Modified, using cached file: ' + p })
            return { success: true, cached: true, size: fs.statSync(p).size }
          }
          
          // 200 OK - save new file
          const buf = Buffer.from(res.data)
          fs.writeFileSync(p, buf)
          
          // Save cache metadata (ETag, Last-Modified)
          const metadata = {
            url,
            timestamp: Date.now(),
            size: buf.length,
            etag: res.headers['etag'] || null,
            lastModified: res.headers['last-modified'] || null
          }
          fs.writeFileSync(cacheMetadataPath, JSON.stringify(metadata, null, 2))
          
          ipcRenderer.send('renderer-log', { level: 'info', msg: 'preload.saveBinaryWithCache wrote: ' + p + ' (' + buf.length + ' bytes)' })
          
          // Prune old media (best-effort)
          try { ipcRenderer.invoke('preload-pruneMedia') } catch(e){}
          
          return { success: true, cached: false, size: buf.length }
        } catch(e) {
          ipcRenderer.send('renderer-log', { level: 'error', msg: 'preload.saveBinaryWithCache fetch failed: ' + String(e) })
          throw e
        }
      } catch(e) {
        ipcRenderer.send('renderer-log', { level: 'error', msg: 'preload.saveBinaryWithCache failed: ' + String(e) })
        return { success: false, error: String(e) }
      }
    }
    // Fallback to IPC call for sandboxed preload
    return await ipcRenderer.invoke('preload-saveBinaryWithCache', relativePath, url, cacheOptions)
  }
  ,
  onMessage: (callback) => {
    ipcRenderer.on('message', (event, text) => {
      try { callback(text) } catch (e) { /* swallow */ }
    })
  },
  // Récupérer les informations système (CPU, mémoire, IPs)
  getSystemInfo: async () => {
    return await ipcRenderer.invoke('preload-getSystemInfo')
  },
  quitApp: () => {
    ipcRenderer.send('quit-app')
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
    console.log('[preload-axios] get called, hasNode=', hasNode, 'axios=', !!axios, 'url=', url)
    try {
      if (hasNode && axios) {
        const res = await axios.get(url, opts)
        console.log('[preload-axios] native axios response, res.data?=', !!res.data)
        return res
      }
      // Fallback to ipc fetch: normalize to axios-like response { data }
      console.log('[preload-axios] using IPC fallback')
      const result = await ipcRenderer.invoke('preload-fetchJson', url, opts || {})
      console.log('[preload-axios] IPC result?=', !!result)
      return { data: result }
    } catch (e) {
      console.error('[preload-axios] get error:', e.message)
      return { data: null }
    }
  },
  post: async (url, data, opts) => {
    try {
      if (hasNode && axios) {
        const res = await axios.post(url, data, opts)
        return res
      }
      const req = Object.assign({}, opts || {}, { method: 'POST', data })
      const result = await ipcRenderer.invoke('preload-fetchJson', url, req)
      return { data: result }
    } catch (e) {
      console.error('[preload-axios] post error:', e.message)
      return { data: null }
    }
  }
})
