const { app, Menu, BrowserWindow, ipcMain, screen, protocol, net } = require('electron');
const log = require('electron-log');
const updater = require("electron-updater");
const autoUpdater = updater.autoUpdater;
const path = require('path');
const fs = require('fs');
const os = require('os');

//-------------------------------------------------------------------
// Base Path Configuration
// Windows: C:/SEE/
// Linux: /opt/seedisplay/data/ or ~/.seedisplay/
// macOS: ~/Library/Application Support/SEEDisplay/
//-------------------------------------------------------------------
const IS_LINUX = process.platform === 'linux';

function getBasePath() {
  const platform = process.platform;
  
  if (platform === 'win32') {
    return 'C:/SEE/';
  }
  
  if (platform === 'linux') {
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
  }
  
  if (platform === 'darwin') {
    const macPath = path.join(os.homedir(), 'Library/Application Support/SEEDisplay/');
    try {
      if (!fs.existsSync(macPath)) {
        fs.mkdirSync(macPath, { recursive: true });
      }
    } catch (e) { /* ignore */ }
    return macPath;
  }
  
  // Fallback
  const fallback = path.join(os.homedir(), '.seedisplay/');
  if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

// Global base path - accessible throughout the app
const BASE_PATH = getBasePath();
const START_OFFLINE = process.argv.includes('--offline');
if (START_OFFLINE) {
  process.env.SEEDISPLAY_OFFLINE = '1';
}
log.info(`[Platform] ${process.platform}/${process.arch}, BASE_PATH=${BASE_PATH}${START_OFFLINE ? ', START_OFFLINE=true' : ''}`);
if (START_OFFLINE) log.warn('[OFFLINE] App will start with ALL network blocked (--offline flag)');

// Enregistrer le scheme see-media comme privilégié (doit être fait avant app.ready)
protocol.registerSchemesAsPrivileged([{
  scheme: 'see-media',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true
  }
}]);

//-------------------------------------------------------------------
// Auto-updater Configuration (AppImage only)
//
// Deux axes indépendants dans configSEE.json :
//   1. "env"           → serveur API + base des updates
//      - "prod"  → soek.fr
//      - "beta"  → beta.soek.fr
//      - "local" → localhost:8000
//
//   2. "updateChannel" → canal de mise à jour (dans chaque env)
//      - "stable" (défaut) → /updates/seedisplay
//      - "beta"            → /updates/seedisplay/beta
//
// Exemples d'URLs finales :
//   prod  + stable → https://soek.fr/updates/seedisplay
//   prod  + beta   → https://soek.fr/updates/seedisplay/beta
//   beta  + stable → https://beta.soek.fr/updates/seedisplay
//   beta  + beta   → https://beta.soek.fr/updates/seedisplay/beta
//   local + stable → http://localhost:8000/updates/seedisplay
//   local + beta   → http://localhost:8000/updates/seedisplay/beta
//-------------------------------------------------------------------
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Logger pour debug
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

/**
 * Détermine le canal de mise à jour (stable ou beta)
 * Lit configSEE.json → "updateChannel": "beta" | "stable"
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
 * Détermine l'environnement (prod, beta, local) depuis la config
 * Lit configSEE.json → "env": "prod" | "beta" | "local"
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
 * Configure l'URL du serveur de mise à jour selon l'environnement ET le canal.
 *
 * env  → choisit le serveur (soek.fr / beta.soek.fr / localhost)
 * canal → ajoute /beta au chemin si updateChannel === 'beta'
 */
function configureUpdateServer() {
  const env = getEnvironment();
  const channel = getUpdateChannel();
  
  log.info(`[configureUpdateServer] env=${env}, channel=${channel}`);
  
  // 1. Base URL selon l'environnement (quel serveur)
  const envBaseUrls = {
    prod:      'https://soek.fr/updates/seedisplay',
    soek:      'https://soek.fr/updates/seedisplay',
    beta:      'https://beta.soek.fr/updates/seedisplay',
    local:     'http://localhost:8000/updates/seedisplay',
    localhost: 'http://localhost:8000/updates/seedisplay'
  };
  
  const baseUrl = envBaseUrls[env] || envBaseUrls.prod;
  
  // 2. Ajouter /beta si le canal est beta
  const url = channel === 'beta' ? `${baseUrl}/beta` : baseUrl;
  
  log.info(`[configureUpdateServer] URL=${url} (env=${env}, channel=${channel})`);
  
  // Configuration: désactiver le téléchargement différentiel (pas de blockmap)
  // Télécharge toujours l'AppImage complète (~122 Mo) — plus fiable
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: url,
    useMultipleRangeRequest: false
  });
  autoUpdater.disableDifferentialDownload = true;
  
  // Désactiver explicitement la vérification de channel dans le yml
  autoUpdater.channel = 'latest';
  
  log.info(`Auto-updater configured: ENV=${env.toUpperCase()}, CHANNEL=${channel.toUpperCase()}, URL=${url}`);
  return env;
}

// Initialize update server
const updateChannel = configureUpdateServer();

// Migration: écrire updateChannel dans configSEE.json si absent
// Les boîtiers existants en prod n'ont pas ce champ → on l'ajoute avec 'stable'
(function ensureUpdateChannelInConfig() {
  const configPath = path.join(BASE_PATH, 'configSEE.json');
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(raw);
      if (!config.updateChannel) {
        config.updateChannel = 'stable';
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        log.info('[main] Config migrated: added updateChannel=stable');
      }
    }
  } catch (e) {
    log.warn('[main] Could not migrate updateChannel in config:', e.message);
  }
})();

// Export pour être utilisé par ApiManager (headers)
module.exports = { getUpdateChannel };

//-------------------------------------------------------------------
// Performance & Hardware Acceleration
// Optimisations pour lecture vidéo fluide et transitions CUT
//-------------------------------------------------------------------

// Linux x64 optimizations
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// Décodage vidéo : forcer le décodage logiciel sur Linux
// VAAPI / hardware decode cause PIPELINE_ERROR_DECODE sur beaucoup de machines
if (IS_LINUX) {
  app.commandLine.appendSwitch('disable-gpu-video-decode');
  app.commandLine.appendSwitch('disable-accelerated-video-decode');
}
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization');

// Smooth scrolling et rendering
app.commandLine.appendSwitch('enable-smooth-scrolling');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');

// Performance: empêcher le throttling du renderer (kiosk = toujours au premier plan)
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

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
// backdropWin supprimé - tout géré dans une seule fenêtre

function sendStatusToWindow(text) {
  log.info(text);
  if (win && win.webContents && !win.isDestroyed()) {
    win.webContents.send('message', text);
  }
}

/**
 * Lit la config pour récupérer les dimensions custom si elles existent
 */
function getScreenDimensionsFromConfig() {
  const configPath = path.join(BASE_PATH, 'configSEE.json')
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8')
      const config = JSON.parse(raw)
      // IMPORTANT: vérifier isCustomResolution - si false ou absent, on reste en fullscreen
      if (config.isCustomResolution === true && config.screenWidth && config.screenHeight) {
        log.info(`[main] Found CUSTOM dimensions in config: ${config.screenWidth}x${config.screenHeight} (isCustomResolution=true)`)
        return {
          width: config.screenWidth,
          height: config.screenHeight,
          orientation: config.screenOrientation || null,
          ratio: config.screenRatio || null
        }
      } else if (config.screenWidth && config.screenHeight) {
        log.info(`[main] Found standard dimensions in config: ${config.screenWidth}x${config.screenHeight} but isCustomResolution=${config.isCustomResolution}, using fullscreen`)
        // Return orientation info even for standard mode (used by capture-screen)
        return {
          width: config.screenWidth,
          height: config.screenHeight,
          orientation: config.screenOrientation || null,
          ratio: config.screenRatio || null,
          isStandard: true  // Flag: don't use custom capture rect
        }
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
  
  // Vérifier si une config existe avec ecranUuid (sinon → mode setup)
  let hasValidConfig = false;
  try {
    const cfgPath = path.join(BASE_PATH, 'configSEE.json');
    if (fs.existsSync(cfgPath)) {
      const cfgRaw = fs.readFileSync(cfgPath, 'utf8');
      const cfgData = JSON.parse(cfgRaw);
      hasValidConfig = !!cfgData.ecranUuid;
    }
  } catch (e) {
    log.warn('[main] Could not read config to check setup mode:', e.message);
  }
  
  // Vérifier si des dimensions custom sont configurées
  const customDims = getScreenDimensionsFromConfig()
  const useCustomDimensions = customDims !== null && !customDims.isStandard
  
  log.info(`[main] createDefaultWindow: hasValidConfig=${hasValidConfig}, useCustomDimensions=${useCustomDimensions}`, customDims)
  
  // Si pas de config → démarrer en plein écran SANS kiosk (setup screen lisible)
  // Si config valide → démarrer en fullscreen/kiosk comme d'habitude
  const windowOptions = {
    title: 'SEE Display',
    icon: appIcon,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: hasValidConfig ? '#000000' : '#e8e8e8',
    fullscreen: true,
    kiosk: hasValidConfig,
    alwaysOnTop: hasValidConfig,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true  // Toujours disponible (ouverture via Ctrl+D ou Ctrl+Shift+I)
    }
  }
  
  if (useCustomDimensions) {
    log.info(`[main] Custom mode: content will be ${customDims.width}x${customDims.height} at (0,0), window stays fullscreen with black background`)
  } else {
    log.info(`[main] Fullscreen mode`)
  }
  
  win = new BrowserWindow(windowOptions);
  
  // Forward renderer console messages to main log so we can see them in the terminal
  try {
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      log.info(`[renderer-${level}] ${message} (${sourceId}:${line})`);
    });
  } catch (e) {
    log.warn('Could not attach console-message listener to default window', e);
  }
  
  // Raccourci Ctrl+Shift+I pour ouvrir DevTools (même en production, pour debug)
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
  
  // NE PAS ouvrir DevTools automatiquement - même en mode dev
  // L'utilisateur peut les ouvrir avec Ctrl+Shift+I si besoin
  if (!isProduction) {
    log.info('Mode développement - DevTools disponibles avec Ctrl+Shift+I');
  } else {
    log.info('Mode production - Ctrl+Shift+I pour DevTools si besoin');
  }
  
  // Charger l'application AVANT ready-to-show
  // Si démarré avec --offline, couper le réseau AVANT le chargement de la page
  if (START_OFFLINE && win.webContents && win.webContents.session) {
    win.webContents.session.enableNetworkEmulation({ offline: true });
    win.webContents.session._offlineSimulated = true;
    log.warn('[OFFLINE] Network emulation activated BEFORE page load');
  }
  win.loadFile('index.html');
  
  // Injecter les dimensions custom une fois la page chargée
  if (useCustomDimensions) {
    win.webContents.on('did-finish-load', () => {
      // 1. Injecter le CSS via l'API native Electron
      const customCSS = `
        html, body { overflow: hidden !important; }
        #appWrapper {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: ${customDims.width}px !important;
          height: ${customDims.height}px !important;
          max-width: ${customDims.width}px !important;
          max-height: ${customDims.height}px !important;
          overflow: hidden !important;
          clip-path: inset(0) !important;
          transform: translate(0) !important;
        }
        #pageDefault, #mediaContainer, #loadingScreen, #pagePsaume,
        #planningContainer, #templateContainer {
          width: ${customDims.width}px !important;
          height: ${customDims.height}px !important;
          max-width: ${customDims.width}px !important;
          max-height: ${customDims.height}px !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        #pagePsaume { min-height: 0 !important; }
        #loadingScreen {
          position: absolute !important;
          width: ${customDims.width}px !important;
          height: ${customDims.height}px !important;
        }
        #resetModeIndicator, #resetConfirmDialog, #debugLog, #gifNoel {
          position: absolute !important;
        }
        #bottomBar {
          position: absolute !important;
          bottom: 0 !important;
          max-height: 80px !important;
        }
      `;
      win.webContents.insertCSS(customCSS).then(() => {
        log.info('[main] Custom CSS inserted via insertCSS API (createDefaultWindow)');
      });

      // 2. Injecter les variables JS
      win.webContents.executeJavaScript(`
        window.CUSTOM_WIDTH = ${customDims.width};
        window.CUSTOM_HEIGHT = ${customDims.height};
        window.IS_CUSTOM_MODE = true;
        document.body.classList.add('custom-mode');
        document.documentElement.style.setProperty('--custom-width', '${customDims.width}px');
        document.documentElement.style.setProperty('--custom-height', '${customDims.height}px');
        var dbg = document.getElementById('debugLog');
        if (dbg) dbg.style.display = 'none';
      `);
    });
    log.info(`[main] Custom mode: content area ${customDims.width}x${customDims.height} on fullscreen window`);
  }
  
  // Afficher la fenêtre une fois prête
  win.once('ready-to-show', () => {
    win.show();
    if (hasValidConfig) {
      win.setFullScreen(true);
      win.focus();
      log.info('[main] ready-to-show: fullscreen mode');
    } else {
      win.setFullScreen(true);
      win.focus();
      log.info('[main] ready-to-show: setup mode (fullscreen, no kiosk)');
    }
    
    // Notifier le renderer du mode offline (après que la page soit chargée)
    if (START_OFFLINE) {
      setTimeout(() => {
        try { win.webContents.send('message', '__OFFLINE_ON__'); } catch(e) {}
      }, 1000);
    }
  });
  
  win.on('closed', () => {
    win = null;
  });
  
  return win;
}

app.on('ready', function() {
  // Enregistrer le protocol handler see-media:// pour servir les fichiers media
  // depuis BASE_PATH sur toutes les plateformes (nécessaire sur Linux où file:// 
  // ne peut pas accéder aux fichiers hors du dossier app)
  try {
    protocol.handle('see-media', (request) => {
      // URL: see-media://media/file.jpg → BASE_PATH + media/file.jpg
      let filePath = decodeURIComponent(request.url.replace('see-media://', ''));
      // Supprimer le slash initial si présent (see-media:///media/... → media/...)
      filePath = filePath.replace(/^\/+/, '');
      const fullPath = path.join(BASE_PATH, filePath);
      log.debug(`[see-media] ${request.url} → ${fullPath}`);
      return net.fetch('file://' + fullPath);
    });
    log.info('[see-media] Protocol handler registered for BASE_PATH=' + BASE_PATH);
  } catch (e) {
    log.error('[see-media] Failed to register protocol handler:', e.message);
  }

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
      log.info('DevTools basculés via Ctrl+Shift+I');
    }
  });
  
  // Ctrl+D pour ouvrir DevTools (raccourci rapide)
  globalShortcut.register('CommandOrControl+D', () => {
    if (win && win.webContents) {
      win.webContents.toggleDevTools();
      log.info('DevTools basculés via Ctrl+D');
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
  
  // Auto-update : AppImage uniquement
  // Vérifier que $APPIMAGE est défini (= lancé en tant qu'AppImage)
  let canAutoUpdate = !!process.env.APPIMAGE;
  
  // Vérifier les permissions d'écriture sur le fichier AppImage
  if (canAutoUpdate) {
    try {
      const appImagePath = process.env.APPIMAGE;
      const appImageDir = path.dirname(appImagePath);
      fs.accessSync(appImagePath, fs.constants.W_OK);
      fs.accessSync(appImageDir, fs.constants.W_OK);
      log.info(`[auto-update] AppImage writable: ${appImagePath}`);
    } catch (permErr) {
      log.error(`[auto-update] EACCES: AppImage or directory not writable: ${process.env.APPIMAGE}`);
      log.error(`[auto-update] Fix with: chmod u+rwx "${process.env.APPIMAGE}" && chmod u+rwx "${path.dirname(process.env.APPIMAGE)}"`);
      log.info('[auto-update] Auto-update disabled due to permission issue');
      canAutoUpdate = false;
    }
  }
  
  if (canAutoUpdate) {
    setTimeout(() => {
      log.info('[auto-update] Initial update check...');
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        log.warn('[auto-update] Initial check failed:', err.message);
      });
    }, 30000);
    
    // Planifier la vérification quotidienne à 2h du matin
    scheduleUpdateCheck();
    
    log.info('[auto-update] Update checks scheduled: startup + daily at 2:00 AM');
  } else {
    log.info('[auto-update] Auto-update disabled (not running as AppImage, $APPIMAGE not set)');
  }
});

app.on('window-all-closed', () => {
  // Fermer le backdrop si présent
  if (backdropWin && !backdropWin.isDestroyed()) {
    backdropWin.close()
    backdropWin = null
  }
  app.quit();
});

app.on('will-quit', () => {
  // Nettoyer les raccourcis clavier
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});


//-------------------------------------------------------------------
// Auto updates - Configuration unique et centralisée
//-------------------------------------------------------------------

// Configuration de l'updater pour le développement (optionnel)
if (process.env.NODE_ENV === 'development') {
  if (process.env.ENABLE_DEV_UPDATES === 'true') {
    autoUpdater.forceDevUpdateConfig = true;
    log.info('Development updates enabled');
  }
}

// Track update status for renderer
let updateStatus = { checking: false, available: false, downloading: false, progress: 0, error: null, version: null };

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for update...');
  updateStatus = { ...updateStatus, checking: true, error: null };
  if (win && !win.isDestroyed()) win.webContents.send('update-status', updateStatus);
});

autoUpdater.on('update-available', (info) => {
  sendStatusToWindow('Update available: v' + (info && info.version));
  updateStatus = { ...updateStatus, checking: false, available: true, version: info.version };
  if (win && !win.isDestroyed()) win.webContents.send('update-status', updateStatus);
});

autoUpdater.on('update-not-available', (info) => {
  sendStatusToWindow('Update not available.');
  updateStatus = { ...updateStatus, checking: false, available: false };
  if (win && !win.isDestroyed()) win.webContents.send('update-status', updateStatus);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message += ' - Downloaded ' + progressObj.percent + '%';
  log_message += ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  sendStatusToWindow(log_message);
  updateStatus = { ...updateStatus, downloading: true, progress: Math.round(progressObj.percent) };
  if (win && !win.isDestroyed()) win.webContents.send('update-status', updateStatus);
});

autoUpdater.on('error', (err) => {
  log.error('[auto-update] Error:', err.message);
  log.error('[auto-update] Error stack:', err.stack);
  if (err.statusCode) log.error('[auto-update] HTTP status:', err.statusCode);
  if (err.url) log.error('[auto-update] URL:', err.url);
  log.error('[auto-update] Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
  updateStatus = { ...updateStatus, checking: false, downloading: false, error: err.message };
  if (win && !win.isDestroyed()) win.webContents.send('update-status', updateStatus);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('[auto-update] Update downloaded: v' + (info && info.version));
  log.info('[auto-update] Restarting app to install update...');
  // Petit délai pour laisser les logs s'écrire avant le restart
  setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
  }, 1000);
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
  const basePath = BASE_PATH;
  
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
  const isProduction = process.env.NODE_ENV === 'production' || !process.defaultApp;
  const customDims = getScreenDimensionsFromConfig()
  const useCustomDimensions = customDims !== null && !customDims.isStandard
  
  log.info(`[main] createWindow: isProduction=${isProduction}, useCustomDimensions=${useCustomDimensions}`, customDims)
  
  // Toujours fullscreen kiosk - en mode custom, on clippe le contenu via CSS
  win = new BrowserWindow({
    title: 'SEE Display',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    fullscreen: true,
    kiosk: true,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#000000',
    roundedCorners: false,
    hasShadow: false,
    thickFrame: false,
    webPreferences: {
      nodeIntegration: false,
      nativeWindowOpen: true,
      contextIsolation: true,
      preload: require('path').join(__dirname, 'preload.js'),
      devTools: !isProduction
    }
  })
  
  win.loadFile('index.html')
  
  if (useCustomDimensions) {
    // clip-path sur <body> : clippe TOUT le rendu (même position:fixed) 
    // Le reste de l'écran montre le background noir de <html>
    win.webContents.on('did-finish-load', () => {
      win.webContents.insertCSS(`
        html { background: #000 !important; }
        body {
          clip-path: polygon(0 0, ${customDims.width}px 0, ${customDims.width}px ${customDims.height}px, 0 ${customDims.height}px) !important;
          -webkit-clip-path: polygon(0 0, ${customDims.width}px 0, ${customDims.width}px ${customDims.height}px, 0 ${customDims.height}px) !important;
        }
        #bottomBar { display: none !important; }
      `);
      win.webContents.executeJavaScript(`
        window.CUSTOM_WIDTH = ${customDims.width};
        window.CUSTOM_HEIGHT = ${customDims.height};
        window.IS_CUSTOM_MODE = true;
        // Masquer le debugLog et le bottomBar en mode custom
        var dbg = document.getElementById('debugLog');
        if (dbg) dbg.style.display = 'none';
        var bar = document.getElementById('bottomBar');
        if (bar) bar.style.display = 'none';
      `);
    });
    log.info(`[main] Custom mode: clip-path will clip body to ${customDims.width}x${customDims.height}`)
  }
  
  win.on('closed', () => { win = null })
  
  // Attach console forwarding for this window as well
  try {
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      // Forward renderer console messages to the main log (useful when DevTools is closed)
      log.info(`[renderer] ${message} (level=${level}, ${sourceId}:${line})`);
    });
  } catch (e) {
    log.warn('Could not attach console-message listener to index window', e);
  }
  
  // NE PAS ouvrir DevTools automatiquement
  // L'utilisateur peut les ouvrir avec Ctrl+Shift+I si besoin
  if (!isProduction) {
    log.info('[main] Mode développement - DevTools disponibles avec Ctrl+Shift+I');
  }
}

// Listen for renderer log messages from preload
ipcMain.on('renderer-log', (event, { level, msg }) => {
  log.log(level || 'info', `[renderer-ipc] ${msg}`)
})

// Mode setup : désactiver kiosk/alwaysOnTop, garder fullscreen pour occuper tout l'écran
ipcMain.on('enter-setup-mode', () => {
  if (!win) return
  log.info('[main] Entering setup mode - disabling kiosk/alwaysOnTop, keeping fullscreen')
  try {
    win.setKiosk(false)
    win.setAlwaysOnTop(false)
    // Garder fullscreen pour que l'écran de setup occupe tout l'affichage
    win.setFullScreen(true)
  } catch (e) {
    log.warn('[main] enter-setup-mode error:', e.message)
  }
})

// Re-activer le mode kiosk après config
ipcMain.on('leave-setup-mode', () => {
  if (!win) return
  log.info('[main] Leaving setup mode - re-enabling fullscreen/kiosk')
  try {
    // Récupérer la taille de l'écran pour forcer le redimensionnement
    const display = screen.getPrimaryDisplay()
    const { width, height } = display.size
    log.info(`[main] leave-setup-mode: display size ${width}x${height}`)

    // Remettre en taille écran avant fullscreen (évite les problèmes de resize)
    win.setMinimumSize(1, 1)
    win.setResizable(true)
    win.setPosition(0, 0)
    win.setSize(width, height)

    // Puis activer fullscreen/kiosk
    win.setResizable(false)
    win.setAlwaysOnTop(true)
    win.setFullScreen(true)
    win.setKiosk(true)
    log.info('[main] leave-setup-mode: fullscreen/kiosk re-enabled')
  } catch (e) {
    log.warn('[main] leave-setup-mode error:', e.message)
  }
})

// Restart complet de l'app (utilisé après première association)
ipcMain.on('restart-app', () => {
  log.info('[main] Restart requested - relaunching app')
  app.relaunch()
  app.exit(0)
})

// Quit app on 'X' shortcut
ipcMain.on('quit-app', () => {
  log.info('[main] Quit requested via X shortcut')
  app.quit()
})

// Resize window to specific dimensions (from API screen config)
// En mode custom avec isCustomResolution=true, on IGNORE le resize car la fenêtre
// reste fullscreen et le contenu est positionné par CSS
ipcMain.handle('resize-window', async (evt, width, height) => {
  if (!win) {
    log.warn('[main] resize-window: no window')
    return false
  }
  
  // Vérifier si on est en mode custom (depuis la config)
  const customDims = getScreenDimensionsFromConfig()
  if (customDims !== null) {
    // Mode custom: NE PAS redimensionner la fenêtre, elle reste fullscreen
    // Le contenu est positionné par CSS dans le renderer
    log.info(`[main] resize-window: IGNORED in custom mode (window stays fullscreen, content is ${width}x${height} via CSS)`)
    return true  // Retourner true pour que le renderer ne réessaie pas
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
    
    // Réactiver alwaysOnTop pour que la fenêtre soit toujours au premier plan
    win.setAlwaysOnTop(true, 'screen-saver')  // 'screen-saver' = niveau le plus élevé
    
    // Forcer le focus sur la fenêtre
    win.focus()
    
    log.info(`[main] resize-window: done, actual size=${win.getSize()[0]}x${win.getSize()[1]}, alwaysOnTop=true`)
    return true
  } catch (e) {
    log.error('[main] resize-window failed:', e.message)
    return false
  }
})

// Capture screen for heartbeat — adapts to orientation and custom resolution
ipcMain.handle('capture-screen', async (evt, width = 1280, height = 720) => {
  if (!win) {
    log.warn('[main] capture-screen: no window')
    return null
  }
  
  try {
    // Read config for custom dims and orientation
    const dimInfo = getScreenDimensionsFromConfig()
    let image
    
    if (dimInfo && !dimInfo.isStandard) {
      // Custom mode: capture only the content area (top-left rectangle)
      const captureRect = { x: 0, y: 0, width: dimInfo.width, height: dimInfo.height }
      image = await win.webContents.capturePage(captureRect)
      log.debug(`[main] capture-screen: custom mode, capturing rect ${dimInfo.width}x${dimInfo.height} (no resize, sending as-is)`)
    } else {
      // Fullscreen / standard mode: capture the entire page then downscale
      image = await win.webContents.capturePage()
      // Downscale only — never upscale (avoid distortion)
      const capturedWidth = image.getSize().width
      if (capturedWidth > width) {
        image = image.resize({ width, quality: 'good' })
      }
    }
    
    // Convertir en base64 JPEG (plus léger que PNG)
    const finalSize = image.getSize()
    const dataUrl = `data:image/jpeg;base64,${image.toJPEG(80).toString('base64')}`
    
    log.debug(`[main] capture-screen: sending ${finalSize.width}x${finalSize.height}`, dimInfo && !dimInfo.isStandard ? '(custom rect)' : '(fullscreen resized)')
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
  log.info('[main] preload-fetchJson: url=', url)
  try {
    // Support simple GET as well as a generic request via opts.method/data
    if (!opts || !opts.method) {
      const res = await axios.get(url, opts || {})
      log.info('[main] preload-fetchJson: success, data?=', !!res.data)
      return res.data
    }
    // axios.request supports method, url, data, headers, etc.
    const req = Object.assign({}, opts, { url })
    const res = await axios.request(req)
    log.info('[main] preload-fetchJson: success (request), data?=', !!res.data)
    return res.data
  } catch(e) {
    log.warn('[main] preload-fetchJson: FAILED:', e.code || e.message)
    return null  // Renderer will detect null and throw
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

ipcMain.handle('preload-listMediaFiles', async () => {
  try {
    const mediaDir = path.join(BASE_PATH, 'media')
    if (!fs.existsSync(mediaDir)) return []
    const files = fs.readdirSync(mediaDir).map(f => {
      try {
        const st = fs.statSync(path.join(mediaDir, f))
        return { name: f, size: st.size, mtime: st.mtimeMs, isDir: st.isDirectory() }
      } catch(e) { return { name: f, size: 0, mtime: 0, isDir: false } }
    }).filter(f => !f.isDir).sort((a, b) => b.mtime - a.mtime)
    return files
  } catch(e) { return [] }
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

// NOTE: createWindow n'est plus appelée ici.
// La fenêtre principale est déjà créée par createDefaultWindow()
// dans app.on('ready'). L'ancien appel ci-dessous créait une 2e fenêtre
// qui lançait startPairing en double (→ erreur 500 sur le serveur).
// app.whenReady().then(createWindow)  // SUPPRIMÉ - doublon

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
    
    // Get screen resolution and refresh rate
    let screenInfo = { width: 0, height: 0, refreshRate: 0, scaleFactor: 1 }
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      screenInfo = {
        width: primaryDisplay.size.width,
        height: primaryDisplay.size.height,
        refreshRate: primaryDisplay.displayFrequency || 0,
        scaleFactor: primaryDisplay.scaleFactor || 1
      }
    } catch (e) {
      log.warn('[main] Could not get screen info:', e.message)
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
      hostname: os.hostname(),
      screen: screenInfo
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
