import { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOfficeCliService } from './bridge/officecli-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let tray = null;
let service = null;
let lastStatus = null;
let updateStatus = {
    supported: false,
    checking: false,
    available: false,
    downloaded: false,
    message: '自动更新仅在正式安装包环境启用'
};

function createBaseStatus(message = '桌面助手启动中') {
    return {
        success: false,
        service: 'wally-office-assistant',
        appName: 'Wally Office Assistant',
        version: app.getVersion(),
        bridgeUrl: '',
        healthUrl: '',
        host: '127.0.0.1',
        port: null,
        preferredPort: 8765,
        portChanged: false,
        workspace: '',
        logFile: '',
        historyFile: '',
        cliCommand: 'officecli',
        officeCli: {
            available: false,
            command: 'officecli',
            version: '',
            error: message
        },
        startedAt: null,
        protocol: 'wally-office://start',
        protocolVersion: '1.0.0',
        minFrontendVersion: '0.1.0',
        productization: {
            installerReady: true,
            autoStartSupported: true,
            historySupported: true,
            retrySupported: true,
            confirmationSupported: true,
            compatibilityCheckSupported: true
        },
        message
    };
}

function getAutoStartStatus() {
    const settings = app.getLoginItemSettings();
    return {
        supported: process.platform === 'win32' || process.platform === 'darwin',
        enabled: Boolean(settings.openAtLogin),
        openAsHidden: Boolean(settings.openAsHidden)
    };
}

function setAutoStart(enabled) {
    app.setLoginItemSettings({
        openAtLogin: Boolean(enabled),
        openAsHidden: true
    });
    return getAutoStartStatus();
}

function withRuntimeStatus(status) {
    if (!status) return status;
    return {
        ...status,
        autoStart: getAutoStartStatus(),
        updates: updateStatus,
        appPackaged: app.isPackaged,
        permissions: {
            localOnly: true,
            fileAccess: 'workspace',
            shellExecution: false,
            commandAllowlist: true
        }
    };
}

async function setupAutoUpdater() {
    if (!app.isPackaged) return;
    try {
        const { autoUpdater } = await import('electron-updater');
        updateStatus = { supported: true, checking: true, available: false, downloaded: false, message: '正在检查更新' };
        autoUpdater.autoDownload = true;
        autoUpdater.on('update-available', () => {
            updateStatus = { supported: true, checking: false, available: true, downloaded: false, message: '发现新版本，正在下载' };
            broadcastStatus();
        });
        autoUpdater.on('update-not-available', () => {
            updateStatus = { supported: true, checking: false, available: false, downloaded: false, message: '当前已是最新版本' };
            broadcastStatus();
        });
        autoUpdater.on('update-downloaded', () => {
            updateStatus = { supported: true, checking: false, available: true, downloaded: true, message: '新版本已下载，重启助手后安装' };
            broadcastStatus();
        });
        autoUpdater.on('error', (error) => {
            updateStatus = { supported: true, checking: false, available: false, downloaded: false, message: error.message };
            broadcastStatus();
        });
        await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
        updateStatus = { supported: false, checking: false, available: false, downloaded: false, message: error.message };
    }
}

function createWindow() {
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        return mainWindow;
    }
    mainWindow = new BrowserWindow({
        width: 860,
        height: 640,
        minWidth: 720,
        minHeight: 520,
        title: 'Wally Office Assistant',
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.loadFile(path.join(__dirname, 'ui', 'status.html'));
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
    mainWindow.once('ready-to-show', () => mainWindow.show());
    return mainWindow;
}

function broadcastStatus() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('assistant-status', withRuntimeStatus(lastStatus));
    }
}

function buildTrayMenu() {
    return Menu.buildFromTemplate([
        { label: 'Wally Office Assistant', enabled: false },
        { label: lastStatus ? `状态：${lastStatus.portChanged ? `已连接，端口 ${lastStatus.port}` : '已连接'}` : '状态：启动中', enabled: false },
        { type: 'separator' },
        { label: '打开状态页', click: () => createWindow() },
        { label: '打开工作目录', click: () => service && shell.openPath(service.workspace) },
        { label: '查看日志', click: () => service && shell.openPath(service.logFile) },
        { label: '重新检测 OfficeCLI', click: async () => {
            if (!service) {
                await startService().catch((error) => {
                    lastStatus = createBaseStatus(`本地服务启动失败：${error.message}`);
                });
            } else {
                lastStatus.officeCli = await service.refreshOfficeCliStatus();
            }
            broadcastStatus();
            updateTray();
        } },
        { label: '重启本地服务', click: async () => {
            try {
                lastStatus = service ? await service.restart() : await startService();
            } catch (error) {
                lastStatus = createBaseStatus(`本地服务启动失败：${error.message}`);
            }
            broadcastStatus();
            updateTray();
        } },
        { type: 'separator' },
        { label: '退出助手', click: () => {
            app.isQuitting = true;
            app.quit();
        } }
    ]);
}

function updateTray() {
    if (!tray) return;
    tray.setToolTip(lastStatus ? `Wally Office Assistant - ${lastStatus.bridgeUrl}` : 'Wally Office Assistant');
    tray.setContextMenu(buildTrayMenu());
}

function createTray() {
    const iconPath = path.join(__dirname, 'resources', 'icon.ico');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    tray.on('double-click', () => createWindow());
    updateTray();
}

function ensureSingleInstance() {
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
        app.quit();
        return false;
    }
    app.on('second-instance', () => createWindow());
    return true;
}

function getServiceOptions() {
    return {
        appName: 'Wally Office Assistant',
        version: app.getVersion(),
        openPath: (targetPath) => shell.openPath(targetPath),
        confirmExecution: async (plan, context) => {
            const commandCount = context?.commandCount || 0;
            const detail = [
                `任务：${plan.goal || 'OfficeCLI 写入任务'}`,
                `命令数：${commandCount}`,
                `工作目录：${context?.workspace || ''}`,
                context?.retryOf ? `重试任务：${context.retryOf}` : ''
            ].filter(Boolean).join('\n');
            const result = await dialog.showMessageBox(createWindow(), {
                type: 'warning',
                buttons: ['确认执行', '取消'],
                defaultId: 1,
                cancelId: 1,
                title: '确认执行 OfficeCLI 写入任务',
                message: '这个任务会修改或生成本地文件，是否继续？',
                detail
            });
            return result.response === 0;
        },
        onStatusChange: (status) => {
            lastStatus = status;
            broadcastStatus();
            updateTray();
        }
    };
}

async function startService() {
    service = await startOfficeCliService(getServiceOptions());
    lastStatus = service.getStatus();
    broadcastStatus();
    updateTray();
    return lastStatus;
}

async function boot() {
    if (!ensureSingleInstance()) return;
    app.setName('Wally Office Assistant');
    if (process.defaultApp && process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('wally-office', process.execPath, [path.resolve(process.argv[1])]);
    } else {
        app.setAsDefaultProtocolClient('wally-office');
    }
    if (app.isPackaged && !app.getLoginItemSettings().openAtLogin) {
        setAutoStart(true);
    }

    lastStatus = createBaseStatus();
    createTray();
    createWindow();
    try {
        await startService();
        setupAutoUpdater();
    } catch (error) {
        lastStatus = createBaseStatus(`本地服务启动失败：${error.message}`);
        broadcastStatus();
        updateTray();
    }
}

app.whenReady().then(boot);

app.on('open-url', (event) => {
    event.preventDefault();
    createWindow();
});

app.on('activate', () => createWindow());

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (mainWindow) mainWindow.hide();
    }
});

app.on('before-quit', async () => {
    app.isQuitting = true;
    if (service) await service.stop();
});

ipcMain.handle('assistant:get-status', () => withRuntimeStatus(lastStatus || service?.getStatus() || null));
ipcMain.handle('assistant:open-workspace', async () => service ? shell.openPath(service.workspace) : null);
ipcMain.handle('assistant:open-log', async () => service ? shell.openPath(service.logFile) : null);
ipcMain.handle('assistant:restart-service', async () => {
    try {
        lastStatus = service ? await service.restart() : await startService();
    } catch (error) {
        lastStatus = createBaseStatus(`本地服务启动失败：${error.message}`);
    }
    updateTray();
    return withRuntimeStatus(lastStatus);
});
ipcMain.handle('assistant:recheck-officecli', async () => {
    try {
        if (!service) {
            await startService();
        } else {
            lastStatus.officeCli = await service.refreshOfficeCliStatus();
        }
    } catch (error) {
        lastStatus = createBaseStatus(`本地服务启动失败：${error.message}`);
    }
    updateTray();
    return withRuntimeStatus(lastStatus);
});
ipcMain.handle('assistant:set-auto-start', async (_event, enabled) => {
    const autoStart = setAutoStart(enabled);
    return { ...withRuntimeStatus(lastStatus || createBaseStatus()), autoStart };
});
