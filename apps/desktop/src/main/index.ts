import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { Logger, getLogsDir } from "@aether/core";
import { openDatabase, SettingsRepository, type AetherDatabase } from "@aether/database";
import { runStartupSequence, clearRunMarker, type StartupResult } from "./startup.js";
import { registerSettingsIpc } from "./ipc/settingsIpc.js";
import { registerProjectsIpc } from "./ipc/projectsIpc.js";
import { registerSeriesIpc } from "./ipc/seriesIpc.js";
import { registerAssetsIpc } from "./ipc/assetsIpc.js";
import { registerVoiceIpc } from "./ipc/voiceIpc.js";
import { registerScreenCaptureIpc } from "./ipc/screenCaptureIpc.js";
import { registerTimelineIpc } from "./ipc/timelineIpc.js";
import { registerCaptionsIpc } from "./ipc/captionsIpc.js";
import { registerProvidersIpc } from "./ipc/providersIpc.js";
import { registerExportIpc } from "./ipc/exportIpc.js";
import { createSecretsStore } from "./secretsStore.js";

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let database: AetherDatabase | null = null;
let startupResult: StartupResult | null = null;
const logger = new Logger({ logsDir: getLogsDir() });

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: "#131A2B",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    startupResult = await runStartupSequence(logger, [
      async () => {
        database = await openDatabase();
      },
    ]);
  } catch (error) {
    logger.error("Fatal startup failure", error);
    app.quit();
    return;
  }

  ipcMain.handle("app:get-startup-info", () => ({
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    statusLog: startupResult?.statusLog ?? [],
    recoveryDetected: startupResult?.recoveryDetected ?? false,
    logFilePath: logger.getLogFilePath(),
  }));

  if (database) {
    registerSettingsIpc(database);
    registerProjectsIpc({
      db: database,
      logger,
      applicationVersion: app.getVersion(),
      getWindow: () => mainWindow,
    });
    registerSeriesIpc(database, logger);
    registerAssetsIpc({
      logger,
      settingsRepo: new SettingsRepository(database),
      getWindow: () => mainWindow,
    });
    registerVoiceIpc({
      logger,
      settingsRepo: new SettingsRepository(database),
      getWindow: () => mainWindow,
    });
    registerScreenCaptureIpc({
      logger,
      settingsRepo: new SettingsRepository(database),
    });
    registerTimelineIpc({
      logger,
      settingsRepo: new SettingsRepository(database),
    });
    registerCaptionsIpc({
      logger,
      getWindow: () => mainWindow,
    });
    registerProvidersIpc({
      db: database,
      settingsRepo: new SettingsRepository(database),
      secretsStore: createSecretsStore(logger),
      logger,
    });
    registerExportIpc({
      logger,
      settingsRepo: new SettingsRepository(database),
    });
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  clearRunMarker();
  database?.close();
});
