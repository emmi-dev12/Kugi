const { app, BrowserWindow, Menu, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { ConvexClient } = require('convex/browser');
const { makeFunctionReference } = require('convex/server');

// String-based function refs (avoids ESM generated api.js)
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

// ─── ENV ─────────────────────────────────────────────────────
const fs = require('fs');
function loadEnv() {
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
    for (const line of env.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch {}
}
loadEnv();

const CONVEX_URL = process.env.CONVEX_URL || 'http://127.0.0.1:3210';
const APP_DIR = path.join(__dirname, '..');

// ─── CONVEX BACKEND PROCESS ──────────────────────────────────
let convexProc = null;

function startConvexBackend() {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  convexProc = spawn(npx, ['convex', 'dev', '--once'], {
    cwd: APP_DIR,
    stdio: 'ignore',
    detached: false,
  });
  convexProc.on('error', () => {});
}

function waitForConvex(timeout = 15000) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const start = Date.now();
    function attempt() {
      http.get(CONVEX_URL, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (Date.now() - start > timeout) return reject(new Error('Convex timeout'));
        setTimeout(attempt, 300);
      });
    }
    attempt();
  });
}

const convex = new ConvexClient(CONVEX_URL);

let mainWindow = null;

// ─── IPC HANDLERS ────────────────────────────────────────────
ipcMain.handle('db:listBlocks', async () => {
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
  subscribeBlocks();
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
        {
          label: 'Week View', accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow?.webContents.executeJavaScript(`setView('week')`),
        },
        {
          label: 'Day View', accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow?.webContents.executeJavaScript(`setView('day')`),
        },
        { type: 'separator' },
        {
          label: 'Go to Today', accelerator: 'CmdOrCtrl+T',
          click: () => mainWindow?.webContents.executeJavaScript(`document.getElementById('today-btn').click()`),
        },
        { type: 'separator' },
        { role: 'reload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Previous', accelerator: 'CmdOrCtrl+Left',
          click: () => mainWindow?.webContents.executeJavaScript(`document.getElementById('prev-btn').click()`),
        },
        {
          label: 'Next', accelerator: 'CmdOrCtrl+Right',
          click: () => mainWindow?.webContents.executeJavaScript(`document.getElementById('next-btn').click()`),
        },
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

app.whenReady().then(async () => {
  startConvexBackend();
  try { await waitForConvex(); } catch (e) { console.error('Convex backend did not start:', e.message); }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  convex.close();
  if (convexProc) convexProc.kill();
});
