import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { setupIPCHandlers } from './ipc/handlers';
import { Logger } from './utils/logger';

const logger = Logger.getInstance().child('Main');
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    title: 'CryptoCast',
    icon: path.join(__dirname, '../../assets/icon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0F172A',
      symbolColor: '#7C3AED',
    },
  });

  // Load Vite server in development environment
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Load packaged files in production environment
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Application ready
app.whenReady().then(async () => {
  try {
    await setupIPCHandlers();
    createWindow();
    logger.info('Application started successfully');
  } catch (error) {
    logger.error('Failed to set up IPC handlers', error as Error);
    app.quit();
    return;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
