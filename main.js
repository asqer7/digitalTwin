const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1180,
    minHeight: 720,
    frame: false,
    backgroundColor: '#F0EEE6',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => win.webContents.send('win:state', true));
  win.on('unmaximize', () => win.webContents.send('win:state', false));
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

ipcMain.handle('capture', async () => {
  const img = await win.webContents.capturePage();
  return img.toDataURL();
});
ipcMain.on('win:min', () => win.minimize());
ipcMain.on('win:max', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on('win:close', () => win.close());
ipcMain.on('win:bg', (_e, color) => win.setBackgroundColor(color));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// Dev hooks: mirror renderer console, and SHOT=<file> captures the window after SHOT_MS then quits.
if (!app.isPackaged) {
  app.on('browser-window-created', (_e, w) => {
    w.webContents.on('console-message', (e) => console.log('[renderer]', e.message ?? e));
    if (process.env.SHOT) {
      w.webContents.once('did-finish-load', () => {
        if (process.env.DEMO) setTimeout(() => w.webContents.executeJavaScript(process.env.DEMO).catch((err) => console.log(err)), 600);
        setTimeout(async () => {
          const img = await w.webContents.capturePage();
          require('fs').writeFileSync(process.env.SHOT, img.toPNG());
          app.quit();
        }, Number(process.env.SHOT_MS || 3000));
      });
    }
  });
}
