const { app, BrowserWindow, Menu, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const { ConvexClient } = require('convex/browser');
const { makeFunctionReference } = require('convex/server');

const api = {
  blocks: {
    list:           makeFunctionReference('blocks:list'),
    create:         makeFunctionReference('blocks:create'),
    update:         makeFunctionReference('blocks:update'),
    remove:         makeFunctionReference('blocks:remove'),
    toggleComplete: makeFunctionReference('blocks:toggleComplete'),
    bulkCreate:     makeFunctionReference('blocks:bulkCreate'),
  },
};

nativeTheme.themeSource = 'dark';

// ─── CONVEX URL STORAGE ──────────────────────────────────────
const Store = require('./store');
const store = new Store();

function getConvexUrl() {
  return store.get('convexUrl');
}

function setConvexUrl(url) {
  store.set('convexUrl', url);
}

// ─── CONVEX CLIENT ───────────────────────────────────────────
let convex = null;
let mainWindow = null;

function initConvex(url) {
  if (convex) convex.close();
  convex = new ConvexClient(url);
  subscribeBlocks();
}

// ─── IPC HANDLERS ────────────────────────────────────────────
ipcMain.handle('db:getConvexUrl', () => getConvexUrl());

ipcMain.handle('db:setConvexUrl', (_, url) => {
  setConvexUrl(url);
  initConvex(url);
  return true;
});

ipcMain.handle('db:listBlocks', async () => {
  if (!convex) return [];
  return await convex.query(api.blocks.list, {});
});

ipcMain.handle('db:createBlock', async (_, block) => {
  return await convex.mutation(api.blocks.create, block);
});

ipcMain.handle('db:updateBlock', async (_, id, fields) => {
  return await convex.mutation(api.blocks.update, { id, ...fields });
});

ipcMain.handle('db:deleteBlock', async (_, id) => {
  return await convex.mutation(api.blocks.remove, { id });
});

ipcMain.handle('db:toggleComplete', async (_, id) => {
  return await convex.mutation(api.blocks.toggleComplete, { id });
});

ipcMain.handle('db:bulkCreate', async (_, blocks) => {
  return await convex.mutation(api.blocks.bulkCreate, { blocks });
});

// ─── REAL-TIME SUBSCRIPTION ──────────────────────────────────
function subscribeBlocks() {
  if (!convex) return;
  convex.onUpdate(api.blocks.list, {}, (blocks) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('db:blocksChanged', blocks);
    }
  });
}

// ─── WINDOW ──────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#080808',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.icns'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  buildMenu();
  return mainWindow;
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
      label: 'File',
      submenu: [
        {
          label: 'New Block',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.executeJavaScript(`openModal(null)`),
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
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
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  // Init Convex if URL already saved
  const savedUrl = getConvexUrl();
  if (savedUrl) initConvex(savedUrl);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (convex) convex.close();
});
