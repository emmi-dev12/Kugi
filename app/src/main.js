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
    ...(app.isPackaged && { icon: path.join(__dirname, '..', 'assets', 'icon.icns') }),
    show: true,
  });

  // Always load the deployed web app — works in both dev and production.
  // /app redirects to /setup on first launch (no Convex URL stored yet),
  // then straight to the calendar on every subsequent launch.
  win.loadURL('https://kugi.onrender.com/app');

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
