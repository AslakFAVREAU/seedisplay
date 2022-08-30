const { app, BrowserWindow } = require('electron');
const log = require('electron-log');
const updater = require("electron-updater");
const autoUpdater = updater.autoUpdater;
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





//
// CHOOSE one of the following options for Auto updates
//

//-------------------------------------------------------------------
// Auto updates - Option 1 - Simplest version
//
// This will immediately download an update, then install when the
// app quits.
//-------------------------------------------------------------------
app.on('ready', function()  {
  autoUpdater.checkForUpdatesAndNotify();
});

///////////////////
// End Auto upadater //
///////////////////

function createWindow () {
  // Cree la fenetre du navigateur.
  const win = new BrowserWindow({
    icon: 'assets/Flavicon.png',
    width: 800,
    height: 600,
    fullscreen : true, 
    frame:true,
    alwaysOnTop :true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true
    }
  })

  // et charger le fichier index.html de l'application.
  win.loadFile('index.html')
  // Ouvre les DevTools.
  win.webContents.openDevTools()
}

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

// Dans ce fichier, vous pouvez inclure le reste de votre code spécifique au processus principal. Vous pouvez également le mettre dans des fichiers séparés et les inclure ici.