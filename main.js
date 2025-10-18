const { app, Menu, BrowserWindow } = require('electron');
const log = require('electron-log');
const updater = require("electron-updater");
const autoUpdater = updater.autoUpdater;
const path = require('path');

//-------------------------------------------------------------------
// Performance & Hardware Acceleration
// Optimisations pour lecture vidéo fluide et transitions CUT
//-------------------------------------------------------------------
// Activer l'accélération matérielle pour les vidéos
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Optimisations pour les codecs vidéo
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization');

// Smooth scrolling et rendering
app.commandLine.appendSwitch('enable-smooth-scrolling');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-frame-rate-limit');

log.info('Hardware acceleration enabled for smooth video playback');

//-------------------------------------------------------------------
// Logging
//
// THIS SECTION IS NOT REQUIRED
//
// This logging setup is not required for auto-updates to work,
// but it sure makes debugging easier :)
//-------------------------------------------------------------------
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

//-------------------------------------------------------------------
// Define the menu
//
// THIS SECTION IS NOT REQUIRED
//-------------------------------------------------------------------
let template = []




//-------------------------------------------------------------------
// Open a window that displays the version
//
// THIS SECTION IS NOT REQUIRED
//
// This isn't required for auto-updates to work, but it's easier
// for the app to show a window than to have to click "About" to see
// that updates are working.
//-------------------------------------------------------------------
let win;

function sendStatusToWindow(text) {
  log.info(text);
  win.webContents.send('message', text);
}
function createDefaultWindow() {
  // Détecter le mode de production
  const isProduction = process.env.NODE_ENV === 'production' || !process.defaultApp;
  
  // Load app icon from build directory
  const appIcon = path.join(__dirname, 'build', 'icon.ico');
  
  win = new BrowserWindow({
    icon: appIcon, // Add window icon for taskbar
    fullscreen: true, // Toujours en plein écran
    show: false, // Ne pas afficher immédiatement
    frame: false, // Pas de frame (bordure Windows)
    autoHideMenuBar: true, // Toujours masquer la barre de menu
    alwaysOnTop: isProduction, // Premier plan en production
    skipTaskbar: isProduction, // Ne pas afficher dans la barre des tâches en production
    kiosk: isProduction, // Mode kiosk en production (masque la barre des tâches)
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: require('path').join(__dirname, 'preload.js'),
      devTools: !isProduction // Désactiver DevTools en production
    }
  });
  
  // Forward renderer console messages to main log so we can see them in the terminal
  try {
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      // Log messages coming from the renderer process so they appear in the main process logs
      log.info(`[renderer-${level}] ${message} (${sourceId}:${line})`);
    });
  } catch (e) {
    log.warn('Could not attach console-message listener to default window', e);
  }
  
  // Raccourci pour ouvrir DevTools même en production
  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      event.preventDefault();
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools();
      }
    }
  });
  
  // Ouvrir DevTools uniquement en mode développement
  if (!isProduction) {
    win.webContents.openDevTools();
    log.info('Mode développement - DevTools activés');
  } else {
    log.info('Mode production - Mode kiosk activé, Ctrl+Shift+I pour DevTools');
  }
  
  // Afficher la fenêtre une fois prête
  win.once('ready-to-show', () => {
    win.show();
    
    // Passer immédiatement en plein écran
    win.setFullScreen(true);
    
    // S'assurer que la fenêtre est au premier plan
    if (isProduction) {
      win.focus();
      win.setAlwaysOnTop(true, 'screen-saver');
    }
    
    if (isProduction) {
      // En mode production, charger l'application principale
      win.loadURL(`file://${__dirname}/index.html`);
    } else {
      // En mode développement, charger la page de version
      win.loadURL(`file://${__dirname}/version.html#v${app.getVersion()}`);
    }
  });
  
  win.on('closed', () => {
    win = null;
  });
  
  return win;
}
autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for update...');
})
autoUpdater.on('update-available', (info) => {
  sendStatusToWindow('Update available.');
})
autoUpdater.on('update-not-available', (info) => {
  sendStatusToWindow('Update not available.');
})
autoUpdater.on('error', (err) => {
  sendStatusToWindow('Error in auto-updater. ' + err);
})
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  sendStatusToWindow(log_message);
})
autoUpdater.on('update-downloaded', (info) => {
  sendStatusToWindow('Update downloaded');
});
app.on('ready', function() {
  // Create the Menu
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  createDefaultWindow();
  
  // Raccourcis clavier globaux pour le mode production
  const { globalShortcut } = require('electron');
  
  // Ctrl+Shift+K pour quitter l'application
  globalShortcut.register('CommandOrControl+Shift+K', () => {
    log.info('Fermeture de l\'application via Ctrl+Shift+K');
    app.quit();
  });
  
  // F11 pour basculer le plein écran
  globalShortcut.register('F11', () => {
    if (win) {
      const isFullScreen = win.isFullScreen();
      win.setFullScreen(!isFullScreen);
      log.info(`Plein écran ${!isFullScreen ? 'activé' : 'désactivé'}`);
    }
  });
  
  // Ctrl+Shift+I pour ouvrir DevTools en cas d'urgence (même en production)
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (win && win.webContents) {
      win.webContents.toggleDevTools();
      log.info('DevTools basculés');
    }
  });
  
  // Ctrl+R pour recharger
  globalShortcut.register('CommandOrControl+R', () => {
    if (win && win.webContents) {
      win.webContents.reload();
      log.info('Application rechargée');
    }
  });
  
  // Alt+F4 ou Ctrl+Q pour quitter
  globalShortcut.register('Alt+F4', () => {
    app.quit();
  });
  
  globalShortcut.register('CommandOrControl+Q', () => {
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  // Nettoyer les raccourcis clavier
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});




//
// CHOOSE one of the following options for Auto updates
//

//-------------------------------------------------------------------
// Auto updates - Configuration améliorée
//
// Configuration sécurisée et user-friendly des mises à jour automatiques
//-------------------------------------------------------------------

// Configuration de l'updater pour le développement (optionnel)
if (process.env.NODE_ENV === 'development') {
  // Force les updates en développement si la variable d'environnement est définie
  if (process.env.ENABLE_DEV_UPDATES === 'true') {
    autoUpdater.forceDevUpdateConfig = true;
    log.info('Development updates enabled');
  }
}

// Gestion des erreurs d'update
autoUpdater.on('error', (error) => {
  log.error('Update error:', error);
  // Pas de notification - log seulement
});

// Auto-update silencieuse et immédiate
autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded, installing immediately');
  log.info('New version: ' + info.version);
  
  // Redémarrage immédiat et silencieux - pas de notification
  autoUpdater.quitAndInstall(false, true);
});

app.on('ready', function() {
  // Vérifier les mises à jour au démarrage
  log.info('Checking for updates...');
  autoUpdater.checkForUpdatesAndNotify();
  
  // Vérifier périodiquement les mises à jour (toutes les 4 heures)
  setInterval(() => {
    log.info('Periodic update check...');
    autoUpdater.checkForUpdatesAndNotify();
  }, 4 * 60 * 60 * 1000); // 4 heures
});

///////////////////
// End Auto upadater //
///////////////////

function createWindow () {
  // Cree la fenetre du navigateur.
  const isProduction = process.env.NODE_ENV === 'production' || !process.defaultApp;
  const win = new BrowserWindow({
    icon: 'assets/Flavicon.png',
    width: 800,
    height: 600,
    // En production, s'assurer que la fenêtre est sans bordure, pleine et au premier plan
    fullscreen: isProduction || true,
    frame: !isProduction ? true : false,
    alwaysOnTop: isProduction ? true : false,
    kiosk: isProduction ? true : false,
    webPreferences: {
      nodeIntegration: false,
      nativeWindowOpen: true,
      contextIsolation: true,
      preload: require('path').join(__dirname, 'preload.js'),
      devTools: !isProduction
    }
  })

  // et charger le fichier index.html de l'application.
  win.loadFile('index.html')
  // Attach console forwarding for this window as well
  try {
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      // Forward renderer console messages to the main log (useful when DevTools is closed)
      log.info(`[renderer] ${message} (level=${level}, ${sourceId}:${line})`);
    });
  } catch (e) {
    log.warn('Could not attach console-message listener to index window', e);
  }
  
  // Ouvrir DevTools uniquement en mode développement
  if (!isProduction) {
    win.webContents.openDevTools();
  }
}

// Listen for renderer log messages from preload
const { ipcMain } = require('electron')
ipcMain.on('renderer-log', (event, { level, msg }) => {
  log.log(level || 'info', `[renderer-ipc] ${msg}`)
})

// Provide handlers for preload fallback when native modules are unavailable in preload
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const BASE_PATH = 'C:/SEE/'

ipcMain.handle('preload-getConfig', async () => {
  try {
    const p = path.join(BASE_PATH, 'configSEE.json')
    if (!fs.existsSync(p)) return null
    const raw = fs.readFileSync(p, 'utf8')
    return JSON.parse(raw)
  } catch (e) { return null }
})

ipcMain.handle('preload-readFile', async (evt, relative) => {
  try { const p = path.join(BASE_PATH, relative); return fs.readFileSync(p, 'utf8') } catch(e) { return null }
})

ipcMain.handle('preload-writeFile', async (evt, relative, data) => {
  try { const p = path.join(BASE_PATH, relative); const dir = path.dirname(p); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(p, data); return true } catch(e) { return false }
})

ipcMain.handle('preload-readBundledFile', async (evt, relative) => {
  try { const p = path.join(__dirname, relative); return fs.readFileSync(p, 'utf8') } catch(e) { return null }
})

ipcMain.handle('preload-fetchJson', async (evt, url, opts) => {
  try {
    // Support simple GET as well as a generic request via opts.method/data
    if (!opts || !opts.method) {
      const res = await axios.get(url, opts || {})
      return res.data
    }
    // axios.request supports method, url, data, headers, etc.
    const req = Object.assign({}, opts, { url })
    const res = await axios.request(req)
    return res.data
  } catch(e) { return null }
})

ipcMain.on('preload-getEnv', (evt, name) => {
  try { evt.returnValue = process.env[name] || null } catch(e) { evt.returnValue = null }
})

ipcMain.on('preload-existsSync', (evt, relative) => {
  try { const p = path.join(BASE_PATH, relative); evt.returnValue = fs.existsSync(p) } catch(e) { evt.returnValue = false }
})

ipcMain.handle('preload-saveBinary', async (evt, relative, url) => {
  try {
    const p = path.join(BASE_PATH, relative)
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const res = await axios.get(url, { responseType: 'arraybuffer' })
    const buf = Buffer.from(res.data)
    fs.writeFileSync(p, buf)
    return true
  } catch(e) { return false }
})

ipcMain.handle('preload-getMediaCacheInfo', async () => {
  try {
    const mediaDir = path.join(BASE_PATH, 'media')
    if (!fs.existsSync(mediaDir)) return { totalBytes: 0, files: 0 }
    const files = fs.readdirSync(mediaDir)
    let total = 0
    for (const f of files) { try { total += fs.statSync(path.join(mediaDir,f)).size } catch(e){} }
    return { totalBytes: total, files: files.length }
  } catch(e) { return { totalBytes:0, files:0 } }
})

ipcMain.on('preload-setMediaCacheLimit', (evt, bytes) => {
  try { global.__mediaCacheLimitBytes = Number(bytes) || 0; evt.returnValue = true } catch(e) { evt.returnValue = false }
})

ipcMain.handle('preload-pruneMedia', async () => {
  try {
    const mediaDir = path.join(BASE_PATH, 'media')
    if (!fs.existsSync(mediaDir)) return false
    const files = fs.readdirSync(mediaDir).map(f => { const st = fs.statSync(path.join(mediaDir,f)); return { name:f, path:path.join(mediaDir,f), mtime:st.mtimeMs, size:st.size } }).sort((a,b)=>a.mtime-b.mtime)
    const limit = global.__mediaCacheLimitBytes || (1024*1024*1024)
    let total = files.reduce((s,x)=>s+x.size,0)
    for (const file of files) { if (total<=limit) break; try { fs.unlinkSync(file.path); total -= file.size } catch(e){} }
    return true
  } catch(e) { return false }
})

// Cette méthode sera appelée quant Electron aura fini
// de s'initialiser et prêt à créer des fenêtres de navigation.
// Certaines APIs peuvent être utilisées uniquement quant cet événement est émit.
app.whenReady().then(createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})


//End
