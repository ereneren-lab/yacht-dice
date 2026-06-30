// 렌더러(게임 화면)에 안전한 창 제어 API만 노출
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  pin: () => ipcRenderer.invoke('win:pin'),        // 항상 위 토글 → 새 상태(boolean)
  minimize: () => ipcRenderer.send('win:min'),
  close: () => ipcRenderer.send('win:close'),
  setOpacity: (v) => ipcRenderer.send('win:opacity', v),  // 창 전체 투명도 0.1~1
});
