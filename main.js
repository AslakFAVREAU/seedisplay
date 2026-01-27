const { app, Menu, BrowserWindow, ipcMain, screen } = require('electron');
const log = require('electron-log');
const updater = require("electron-updater");
const autoUpdater = updater.autoUpdater;
const path = require('path');
const fs = require('fs');
const os = require('os');

//-------------------------------------------------------------------
// Cross-platform Base Path Configuration
// Windows: C:/SEE/
// Linux/macOS: /opt/seedisplay/data/ or ~/.seedisplay/
//-------------------------------------------------------------------
const IS_RASPBERRY_PI = process.platform === 'linux' && process.arch === 'arm64';
const IS_LINUX = process.platform === 'linux';
const IS_WINDOWS = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

function getBasePath() {
  if (IS_WINDOWS) {
    return 'C:/SEE/';
  } else if (IS_LINUX) {
    // Sur Linux, préférer /opt/seedisplay/data si accessible, sinon ~/.seedisplay
    const optPath = '/opt/seedisplay/data/';
    const homePath = path.join(os.homedir(), '.seedisplay/');
    
    // Vérifier si /opt/seedisplay/data existe ou peut être créé
    try {
      if (fs.existsSync(optPath) || fs.existsSync('/opt/seedisplay/')) {
        if (!fs.existsSync(optPath)) {
          fs.mkdirSync(optPath, { recursive: true });
        }
        return optPath;
      }
    } catch (e) {
      log.warn('[getBasePath] Cannot use /opt/seedisplay, falling back to home:', e.message);
    }
    
    // Fallback vers home directory
    if (!fs.existsSync(homePath)) {
      fs.mkdirSync(homePath, { recursive: true });
    }
    return homePath;
  } else if (IS_MAC) {
    const macPath = path.join(os.homedir(), 'Library/Application Support/SEEDisplay/');
    if (!fs.existsSync(macPath)) {
      fs.mkdirSync(macPath, { recursive: true });
    }
    return macPath;
  }
  return 'C:/SEE/'; // Fallback Windows
}

// Global base path - accessible throughout the app
const BASE_PATH = getBasePath();
log.info(`[Platform] ${process.platform}/${process.arch}, BASE_PATH=${BASE_PATH}, isRaspberryPi=${IS_RASPBERRY_PI}`);

//-------------------------------------------------------------------
// Auto-updater Configuration
// Supports two channels hosted on SOEK server:
//   - STABLE: https://soek.fr/updates/seedisplay
//   - BETA:   https://soek.fr/updates/seedisplay/beta
//-------------------------------------------------------------------
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Logger pour debug
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

/**
 * Détermine le canal de mise à jour (stable ou beta)
 * Lit la config pour voir si l'utilisateur veut les beta
 */
function getUpdateChannel() {
  const configPath = path.join(BASE_PATH, 'configSEE.json');
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(raw);
      if (config.updateChannel === 'beta') {
        return 'beta';
      }
    }
  } catch (e) {
    log.warn('Could not read config for update channel, using stable:', e.message);
  }
  return 'stable';
}

/**
 * Détermine l'environnement (beta, prod, localhost) depuis la config
 */
function getEnvironment() {
  const configPath = path.join(BASE_PATH, 'configSEE.json');
  log.info(`[getEnvironment] Reading config from: ${configPath}`);
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(raw);
      log.info(`[getEnvironment] Config env value: ${config.env}`);
      if (config.env) {
        const envLower = config.env.toLowerCase();
        log.info(`[getEnvironment] Returning environment: ${envLower}`);
        return envLower;
      }
    } else {
      log.warn(`[getEnvironment] Config file does not exist: ${configPath}`);
    }
  } catch (e) {
    log.warn('Could not read config for environment, using prod:', e.message);
  }
  log.info('[getEnvironment] Falling back to prod');
  return 'prod';
}

/**
 * Configure l'URL du serveur de mise à jour selon l'environnement
 * - beta → https://beta.soek.fr/updates/seedisplay
 * - prod/soek → https://soek.fr/updates/seedisplay
 * - localhost → http://localhost:3000/updates/seedisplay (pour tests)
 */
function configureUpdateServer() {
  const env = getEnvironment();
  const channel = getUpdateChannel();
  
  log.info(`[configureUpdateServer] env=${env}, channel=${channel}`);
  
  // Mapping environnement → URL de mise à jour
  const updateUrls = {
    beta: 'https://beta.soek.fr/updates/seedisplay',
    prod: 'https://soek.fr/updates/seedisplay',
    soek: 'https://soek.fr/updates/seedisplay',
    localhost: 'http://localhost:8000/updates/seedisplay',
    local: 'http://localhost:8000/updates/seedisplay'
  };
  
  const url = updateUrls[env] || updateUrls.prod;
  
  log.info(`[configureUpdateServer] Selected URL for env "${env}": ${url}`);
  
  // Configuration avec useMultipleRangeRequest: false pour éviter les problèmes de téléchargement
  // Ne PAS spécifier de channel pour que electron-updater cherche "latest.yml" par défaut
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: url,
    useMultipleRangeRequest: false
  });
  
  // Désactiver explicitement la vérification de channel dans le yml
  autoUpdater.channel = 'latest';
  
  log.info(`Auto-updater configured for ENV=${env.toUpperCase()}: ${url}`);
  return env;
}

// Initialize update server
const updateChannel = configureUpdateServer();

// Export pour être utilisé par ApiManager (headers)
module.exports = { getUpdateChannel };

//-------------------------------------------------------------------
// Performance & Hardware Acceleration
// Optimisations pour lecture vidéo fluide et transitions CUT
//-------------------------------------------------------------------

// Raspberry Pi / Linux ARM64 specific optimizations
if (IS_RASPBERRY_PI) {
  log.info('[Raspberry Pi] Applying ARM64 optimizations...');
  
  // Limiter l'utilisation mémoire
  app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
  
  // Limiter le nombre de processus renderer
  app.commandLine.appendSwitch('renderer-process-limit', '2');
  
  // Désactiver les fonctionnalités non nécessaires
  app.commandLine.appendSwitch('disable-extensions');
  app.commandLine.appendSwitch('disable-sync');
  app.commandLine.appendSwitch('disable-background-networking');
  app.commandLine.appendSwitch('disable-default-apps');
  
  // Mode low-end device
  app.commandLine.appendSwitch('enable-low-end-device-mode');
  
  // GPU optimizations for Pi
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  
  // Disable software rasterizer (use hardware)
  app.commandLine.appendSwitch('disable-software-rasterizer');
  
  log.info('[Raspberry Pi] Optimizations applied');
} else {
  // Standard Windows/Linux x64 optimizations
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('disable-software-rasterizer');
}

// Optimisations pour les codecs vidéo (VAAPI sur Linux)
if (IS_LINUX) {
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization');
} else {
  app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization');
}

// Smooth scrolling et rendering
app.commandLine.appendSwitch('enable-smooth-scrolling');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-frame-rate-limit');

log.info('Hardware acceleration enabled for smooth video playback');

// Définir le nom de l'application
app.setName('SEE Display');

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

/**
 * Lit la config pour récupérer les dimensions custom si elles existent
 */
function getScreenDimensionsFromConfig() {
  const configPath = path.join('C:/SEE/', 'configSEE.json')
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8')
      const config = JSON.parse(raw)
      // IMPORTANT: vérifier isCustomResolution - si false ou absent, on reste en fullscreen
      if (config.isCustomResolution === true && config.screenWidth && config.screenHeight) {
        log.info(`[main] Found CUSTOM dimensions in config: ${config.screenWidth}x${config.screenHeight} (isCustomResolution=true)`)
        return { width: config.screenWidth, height: config.screenHeight }
      } else if (config.screenWidth && config.screenHeight) {
        log.info(`[main] Found standard dimensions in config: ${config.screenWidth}x${config.screenHeight} but isCustomResolution=${config.isCustomResolution}, using fullscreen`)
      }
    }
  } catch (e) {
    log.warn('[main] Could not read config for dimensions:', e.message)
  }
  return null  // null = fullscreen
}

function createDefaultWindow() {
  // Détecter le mode de production
  const isProduction = process.env.NODE_ENV === 'production' || !process.defaultApp;
  
  // Load app icon from build directory
  const appIcon = path.join(__dirname, 'build', 'icon.ico');
  
  // Vérifier si des dimensions custom sont configurées
  const customDims = getScreenDimensionsFromConfig()
  const useCustomDimensions = customDims !== null
  
  log.info(`[main] createDefaultWindow: useCustomDimensions=${useCustomDimensions}`, customDims)
  
  // Options de base
  const windowOptions = {
    title: 'SEE Display',
    icon: appIcon,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: !isProduction
    }
  }
  
  if (useCustomDimensions) {
    // Mode dimensions personnalisées : fenêtre fixe, pas de fullscreen/kiosk
    windowOptions.width = customDims.width
    windowOptions.height = customDims.height
    windowOptions.x = 0
    windowOptions.y = 0
    windowOptions.fullscreen = false
    windowOptions.kiosk = false
    windowOptions.resizable = false
    windowOptions.alwaysOnTop = true  // Toujours au premier plan
    windowOptions.minWidth = customDims.width
    windowOptions.minHeight = customDims.height
    windowOptions.maxWidth = customDims.width
    windowOptions.maxHeight = customDims.height
    windowOptions.transparent = false
    windowOptions.hasShadow = false
    windowOptions.roundedCorners = false  // Pas de coins arrondis (Windows 11)
    log.info(`[main] Window will be ${customDims.width}x${customDims.height} at (0,0), alwaysOnTop=true`)
  } else {
    // Mode fullscreen standard - laisser Electron gérer le plein écran
    windowOptions.fullscreen = true
    windowOptions.kiosk = true  // Mode kiosk pour vrai plein écran
    windowOptions.alwaysOnTop = true
    log.info(`[main] Window will be fullscreen (kiosk mode)`)
  }
  
  win = new BrowserWindow(windowOptions);
  
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
    
    // Passer en plein écran UNIQUEMENT si pas de dimensions custom
    if (!useCustomDimensions) {
      win.setFullScreen(true);
      log.info('[main] ready-to-show: setting fullscreen');
    } else {
      // S'assurer que le fullscreen est désactivé et positionner en haut à gauche
      win.setFullScreen(false);
      win.setBounds({ x: 0, y: 0, width: customDims.width, height: customDims.height });
      log.info(`[main] ready-to-show: custom dimensions ${customDims.width}x${customDims.height} at (0,0)`);
    }
    
    // S'assurer que la fenêtre est au premier plan (seulement en fullscreen production)
    if (isProduction && !useCustomDimensions) {
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
  
  //-------------------------------------------------------------------
  // Auto-update : Vérification au démarrage + tous les jours à 2h du matin
  //-------------------------------------------------------------------
  
  // Fonction pour calculer le temps jusqu'à la prochaine heure cible
  function getMillisecondsUntilHour(targetHour) {
    const now = new Date();
    const target = new Date(now);
    target.setHours(targetHour, 0, 0, 0); // targetHour:00:00
    
    // Si l'heure est déjà passée aujourd'hui, programmer pour demain
    if (now >= target) {
      target.setDate(target.getDate() + 1);
    }
    
    return target.getTime() - now.getTime();
  }
  
  // Fonction pour planifier la vérification quotidienne à 2h
  function scheduleUpdateCheck() {
    const msUntil2am = getMillisecondsUntilHour(2);
    const hoursUntil = (msUntil2am / 1000 / 60 / 60).toFixed(1);
    log.info(`[auto-update] Next scheduled check in ${hoursUntil} hours (at 2:00 AM)`);
    
    setTimeout(() => {
      log.info('[auto-update] Scheduled 2:00 AM update check...');
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        log.warn('[auto-update] Scheduled check failed:', err.message);
      });
      
      // Programmer la prochaine vérification (dans ~24h)
      scheduleUpdateCheck();
    }, msUntil2am);
  }
  
  // Vérifier les mises à jour au démarrage (après 30 secondes pour laisser l'app se charger)
  setTimeout(() => {
    log.info('[auto-update] Initial update check...');
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      log.warn('[auto-update] Initial check failed:', err.message);
    });
  }, 30000);
  
  // Planifier la vérification quotidienne à 2h du matin
  scheduleUpdateCheck();
  
  log.info('[auto-update] Update checks scheduled: startup + daily at 2:00 AM');
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

// Track update status for renderer
let updateStatus = { checking: false, available: false, downloading: false, progress: 0, error: null, version: null };

autoUpdater.on('checking-for-update', () => {
  updateStatus = { ...updateStatus, checking: true, error: null };
  if (win) win.webContents.send('update-status', updateStatus);
});

autoUpdater.on('update-available', (info) => {
  updateStatus = { ...updateStatus, checking: false, available: true, version: info.version };
  if (win) win.webContents.send('update-status', updateStatus);
});

autoUpdater.on('update-not-available', (info) => {
  updateStatus = { ...updateStatus, checking: false, available: false };
  if (win) win.webContents.send('update-status', updateStatus);
});

autoUpdater.on('download-progress', (progressObj) => {
  updateStatus = { ...updateStatus, downloading: true, progress: Math.round(progressObj.percent) };
  if (win) win.webContents.send('update-status', updateStatus);
});

autoUpdater.on('error', (err) => {
  updateStatus = { ...updateStatus, checking: false, downloading: false, error: err.message };
  if (win) win.webContents.send('update-status', updateStatus);
});

// IPC handler for manual update check from renderer
ipcMain.handle('check-for-updates', async () => {
  log.info('Manual update check requested from renderer');
  try {
    log.info('Calling autoUpdater.checkForUpdatesAndNotify()...');
    const result = await autoUpdater.checkForUpdatesAndNotify();
    log.info('Update check result:', JSON.stringify(result?.updateInfo || 'no update info'));
    return { success: true, updateInfo: result?.updateInfo || null };
  } catch (e) {
    log.error('Manual update check failed:', e.message);
    log.error('Full error:', e);
    return { success: false, error: e.message };
  }
});

// IPC handler to get current app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// IPC handler pour supprimer les données utilisateur (reset)
ipcMain.handle('reset-user-data', async () => {
  log.info('[main] Reset user data requested');
  const basePath = 'C:/SEE/';
  
  try {
    // Supprimer les fichiers de cache et config
    const filesToDelete = [
      path.join(basePath, 'configSEE.json'),
      path.join(basePath, 'api-cache.json')
    ];
    
    for (const file of filesToDelete) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        log.info(`[main] Deleted: ${file}`);
      }
    }
    
    // Supprimer les dossiers media et fonds (récursivement)
    const foldersToDelete = [
      path.join(basePath, 'media'),
      path.join(basePath, 'fonds')
    ];
    
    for (const folder of foldersToDelete) {
      if (fs.existsSync(folder)) {
        fs.rmSync(folder, { recursive: true, force: true });
        log.info(`[main] Deleted folder: ${folder}`);
        // Recréer le dossier vide
        fs.mkdirSync(folder, { recursive: true });
      }
    }
    
    log.info('[main] User data reset complete');
    return { success: true };
  } catch (e) {
    log.error('[main] Reset user data failed:', e.message);
    return { success: false, error: e.message };
  }
});

app.on('ready', function() {
  // Vérifier les mises à jour au démarrage
  log.info('Checking for updates...');
  autoUpdater.checkForUpdatesAndNotify();
  
  // Vérifier périodiquement les mises à jour (une fois par jour)
  setInterval(() => {
    log.info('Daily update check...');
    autoUpdater.checkForUpdatesAndNotify();
  }, 24 * 60 * 60 * 1000); // 24 heures
});

///////////////////
// End Auto upadater //
///////////////////

function createWindow () {
  // Cree la fenetre du navigateur.
  const isProduction = process.env.NODE_ENV === 'production' || !process.defaultApp;
  
  // Vérifier si des dimensions custom sont configurées
  const customDims = getScreenDimensionsFromConfig()
  const useCustomDimensions = customDims !== null
  
  log.info(`[main] createWindow: isProduction=${isProduction}, useCustomDimensions=${useCustomDimensions}`, customDims)
  
  // Options de base - en fullscreen, désactiver DevTools même en dev
  const windowOptions = {
    title: 'SEE Display',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      nativeWindowOpen: true,
      contextIsolation: true,
      preload: require('path').join(__dirname, 'preload.js'),
      devTools: useCustomDimensions ? true : false  // DevTools seulement en mode custom, pas en fullscreen
    }
  }
  
  if (useCustomDimensions) {
    // Mode dimensions personnalisées : fenêtre fixe, pas de fullscreen/kiosk
    windowOptions.width = customDims.width
    windowOptions.height = customDims.height
    windowOptions.x = 0
    windowOptions.y = 0
    windowOptions.fullscreen = false
    windowOptions.kiosk = false
    windowOptions.frame = false
    windowOptions.resizable = false
    windowOptions.alwaysOnTop = true  // Toujours au premier plan
    windowOptions.minWidth = customDims.width
    windowOptions.minHeight = customDims.height
    windowOptions.maxWidth = customDims.width
    windowOptions.maxHeight = customDims.height
    windowOptions.transparent = false
    windowOptions.hasShadow = false
    windowOptions.roundedCorners = false  // Pas de coins arrondis (Windows 11)
    log.info(`[main] createWindow: custom ${customDims.width}x${customDims.height} at (0,0), alwaysOnTop=true`)
  } else {
    // Mode fullscreen standard - laisser Electron gérer le plein écran
    windowOptions.fullscreen = true
    windowOptions.kiosk = true  // Mode kiosk pour vrai plein écran
    windowOptions.frame = false
    windowOptions.alwaysOnTop = true
    log.info(`[main] createWindow: fullscreen kiosk mode`)
  }
  
  win = new BrowserWindow(windowOptions)

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
  
  // Ouvrir DevTools uniquement en mode custom (pas en fullscreen)
  if (useCustomDimensions) {
    win.webContents.openDevTools();
  }
}

// Listen for renderer log messages from preload
ipcMain.on('renderer-log', (event, { level, msg }) => {
  log.log(level || 'info', `[renderer-ipc] ${msg}`)
})

// Quit app on 'X' shortcut
ipcMain.on('quit-app', () => {
  log.info('[main] Quit requested via X shortcut')
  app.quit()
})

// Resize window to specific dimensions (from API screen config)
ipcMain.handle('resize-window', async (evt, width, height) => {
  if (!win) {
    log.warn('[main] resize-window: no window')
    return false
  }
  
  try {
    log.info(`[main] resize-window: requesting ${width}x${height}`)
    
    // Désactiver le mode kiosk d'abord si actif
    if (win.isKiosk()) {
      win.setKiosk(false)
      log.info('[main] resize-window: kiosk mode disabled')
    }
    
    // Désactiver le fullscreen si actif
    if (win.isFullScreen()) {
      win.setFullScreen(false)
      log.info('[main] resize-window: fullscreen disabled')
    }
    
    // Attendre que les changements de mode soient appliqués
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Permettre le redimensionnement temporairement
    win.setResizable(true)
    
    // Désactiver alwaysOnTop pour permettre le redimensionnement
    win.setAlwaysOnTop(false)
    
    // Positionner en haut à gauche
    win.setPosition(0, 0)
    
    // Redimensionner la fenêtre
    win.setSize(width, height)
    
    // Forcer la taille minimale et maximale pour bloquer
    win.setMinimumSize(width, height)
    win.setMaximumSize(width, height)
    
    // Désactiver le redimensionnement manuel
    win.setResizable(false)
    
    log.info(`[main] resize-window: done, actual size=${win.getSize()[0]}x${win.getSize()[1]}`)
    return true
  } catch (e) {
    log.error('[main] resize-window failed:', e.message)
    return false
  }
})

// Capture screen for heartbeat (720p thumbnail)
ipcMain.handle('capture-screen', async (evt, width = 1280, height = 720) => {
  if (!win) {
    log.warn('[main] capture-screen: no window')
    return null
  }
  
  try {
    // Capturer la page
    const image = await win.webContents.capturePage()
    
    // Redimensionner en 720p
    const resized = image.resize({ width, height, quality: 'good' })
    
    // Convertir en base64 JPEG (plus léger que PNG)
    const dataUrl = `data:image/jpeg;base64,${resized.toJPEG(80).toString('base64')}`
    
    log.debug('[main] capture-screen: captured', width, 'x', height)
    return dataUrl
  } catch (e) {
    log.error('[main] capture-screen failed:', e.message)
    return null
  }
})

// Provide handlers for preload fallback when native modules are unavailable in preload
const axios = require('axios')
// BASE_PATH is defined at the top of the file

ipcMain.handle('preload-getConfig', async () => {
  const p = path.join(BASE_PATH, 'configSEE.json')
  log.info('[main] preload-getConfig: checking path', p)
  try {
    const exists = fs.existsSync(p)
    log.info('[main] preload-getConfig: exists =', exists)
    if (!exists) {
      log.warn('[main] preload-getConfig: file not found at', p)
      return null
    }
    const raw = fs.readFileSync(p, 'utf8')
    const parsed = JSON.parse(raw)
    log.info('[main] preload-getConfig: loaded config', JSON.stringify(parsed))
    return parsed
  } catch (e) {
    log.error('[main] preload-getConfig: error', e.message)
    return null
  }
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
  console.log('[main] preload-fetchJson: url=', url, 'opts=', JSON.stringify(opts))
  try {
    // Support simple GET as well as a generic request via opts.method/data
    if (!opts || !opts.method) {
      const res = await axios.get(url, opts || {})
      console.log('[main] preload-fetchJson: success, data?=', !!res.data)
      return res.data
    }
    // axios.request supports method, url, data, headers, etc.
    const req = Object.assign({}, opts, { url })
    const res = await axios.request(req)
    console.log('[main] preload-fetchJson: success (request), data?=', !!res.data)
    return res.data
  } catch(e) {
    console.log('[main] preload-fetchJson: error:', e.message)
    return null
  }
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

ipcMain.handle('preload-saveBinaryWithCache', async (evt, relative, url, cacheOptions = {}) => {
  try {
    const p = path.join(BASE_PATH, relative)
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    
    // Check if file exists and get ETag for conditional request
    let existingETag = null
    const etagFile = p + '.etag'
    if (fs.existsSync(p) && fs.existsSync(etagFile)) {
      try { existingETag = fs.readFileSync(etagFile, 'utf8').trim() } catch(e) {}
    }
    
    const headers = {}
    if (existingETag) {
      headers['If-None-Match'] = existingETag
    }
    
    try {
      const res = await axios.get(url, { 
        responseType: 'arraybuffer',
        headers,
        validateStatus: s => s === 200 || s === 304
      })
      
      if (res.status === 304) {
        // Not modified - use cached file
        const stats = fs.statSync(p)
        return { success: true, cached: true, size: stats.size }
      }
      
      // Save new file
      const buf = Buffer.from(res.data)
      fs.writeFileSync(p, buf)
      
      // Save ETag if present
      const newETag = res.headers?.etag
      if (newETag) {
        fs.writeFileSync(etagFile, newETag)
      }
      
      return { success: true, cached: false, size: buf.length }
    } catch(fetchErr) {
      // If fetch fails but we have cached file, use it
      if (fs.existsSync(p)) {
        const stats = fs.statSync(p)
        return { success: true, cached: true, size: stats.size, fallback: true }
      }
      throw fetchErr
    }
  } catch(e) { 
    return { success: false, error: e.message } 
  }
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
// Get system info (CPU, memory, IPs) for debug overlay
// Note: os module already imported at top of file
ipcMain.handle('preload-getSystemInfo', async () => {
  try {
    // Get process memory usage
    const memUsage = process.memoryUsage()
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
    const rssMB = Math.round(memUsage.rss / 1024 / 1024)
    
    // Get CPU usage (approximation via process.cpuUsage)
    const cpuUsage = process.cpuUsage()
    const cpuPercent = Math.round((cpuUsage.user + cpuUsage.system) / 1000000) // rough approximation
    
    // Get local IP
    let localIP = '-'
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIP = iface.address
          break
        }
      }
      if (localIP !== '-') break
    }
    
    // Get public IP (async fetch)
    let publicIP = '-'
    try {
      const res = await axios.get('https://api.ipify.org?format=json', { timeout: 3000 })
      publicIP = res.data.ip || '-'
    } catch (e) {
      log.warn('[main] Could not fetch public IP:', e.message)
    }
    
    return {
      memory: {
        heapUsedMB,
        heapTotalMB,
        rssMB
      },
      cpuPercent,
      localIP,
      publicIP,
      platform: os.platform(),
      hostname: os.hostname()
    }
  } catch (e) {
    log.error('[main] getSystemInfo error:', e)
    return { memory: {}, cpuPercent: 0, localIP: '-', publicIP: '-' }
  }
})

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
