/**
 * 小花狮 - preload 桥接
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  dragBy: (dx, dy) => ipcRenderer.send('pet-drag-by', dx, dy),
  hide: () => ipcRenderer.send('pet-hide'),
  show: () => ipcRenderer.send('pet-show'),
  quit: () => ipcRenderer.send('pet-quit'),
  resetPos: () => ipcRenderer.send('pet-reset-pos'),
  reportAlive: () => ipcRenderer.send('pet-alive'),
  reportClick: (suppressed) => ipcRenderer.send('pet-click', !!suppressed),
  ping: () => ipcRenderer.invoke('pet-ping'),


  settingsLoad: () => ipcRenderer.invoke('settings-load'),
  settingsSave: (s) => ipcRenderer.invoke('settings-save', s),
  settingsOpacity: (v) => ipcRenderer.invoke('settings-apply-opacity', v),
  settingsScale: (s) => ipcRenderer.invoke('settings-apply-scale', s),
  settingsTopmost: (flag) => ipcRenderer.invoke('settings-apply-topmost', flag),
  settingsAutostart: (flag) => ipcRenderer.invoke('settings-apply-autostart', flag),
  chatLoadConfig: () => ipcRenderer.invoke('chat-load-config'),
  chatSaveConfig: (cfg) => ipcRenderer.invoke('chat-save-config', cfg),
  chatTest: (cfg) => ipcRenderer.invoke('chat-test', cfg),
  chatSend: (messages, opts) => ipcRenderer.invoke('chat-send', { messages, forceSearch: !!(opts && opts.forceSearch) }),
  onTrayAction: (cb) => {
    ipcRenderer.on('tray-action', (_e, action) => cb(action));
  }
});
