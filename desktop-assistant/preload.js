import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('wallyAssistant', {
    getStatus: () => ipcRenderer.invoke('assistant:get-status'),
    openWorkspace: () => ipcRenderer.invoke('assistant:open-workspace'),
    openLog: () => ipcRenderer.invoke('assistant:open-log'),
    restartService: () => ipcRenderer.invoke('assistant:restart-service'),
    recheckOfficeCli: () => ipcRenderer.invoke('assistant:recheck-officecli'),
    setAutoStart: (enabled) => ipcRenderer.invoke('assistant:set-auto-start', enabled),
    onStatus: (callback) => {
        const handler = (_event, status) => callback(status);
        ipcRenderer.on('assistant-status', handler);
        return () => ipcRenderer.removeListener('assistant-status', handler);
    }
});
