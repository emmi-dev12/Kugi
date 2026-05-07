const { app, BrowserWindow, Menu, nativeTheme } = require('electron');
const path = require('path');

nativeTheme.themeSource = 'dark';

const DEV = !app.isPackaged;
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#080808',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.icns'),
    show: true,
  });

  if (DEV) {
    win.loadURL('http://localhost:5173').catch(err => {
      win.loadURL(`data:text/html,<h2 style="font:16px sans-serif;color:#f00;padding:32px">
        Vite dev server not running.<br><br>
        Run <code>npm run dev</code> in the <b>web/</b> folder first.
        <br><br><small>${err.message}</small></h2>`);
    });
  } else {
    // Load the bundled web dist embedded in the .app package
    win.loadFile(path.join(__dirname, 'web-dist', 'index.html'));
  }

  if (DEV) win.webContents.openDevTools({ mode: 'detach' });

  buildMenu();
}

function buildMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
