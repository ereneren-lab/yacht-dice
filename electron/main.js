// 요트 다이스 데스크톱 앱 — 투명 창 + 항상 위 고정
// 실행: npm run app
//
// 온라인을 인터넷 너머 친구들과 하려면 배포된 주소를 지정해서 실행:
//   APP_URL=https://your-app.onrender.com npm run app
// (지정하지 않으면 앱이 내장 서버를 띄우고 localhost로 로컬/AI + 같은 PC/LAN 온라인을 제공)

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const APP_URL = process.env.APP_URL || '';
let win;

async function resolveUrl() {
  if (APP_URL) return APP_URL;
  // 내장 서버 실행 (server.js가 listen 시작)
  process.env.PORT = process.env.PORT || '3000';
  require(path.join(__dirname, '..', 'server.js'));
  await new Promise(r => setTimeout(r, 700)); // 서버가 뜰 시간을 잠깐 줌
  return 'http://localhost:' + process.env.PORT;
}

async function createWindow() {
  const url = await resolveUrl();
  win = new BrowserWindow({
    width: 980, height: 640, minWidth: 720, minHeight: 480,
    transparent: true,      // 진짜 투명 창 (바탕화면이 비침)
    frame: false,           // 기본 창 테두리 제거
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(url);
}

app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => app.quit());

// 창 컨트롤 (preload를 통해 렌더러에서 호출)
ipcMain.handle('win:pin', () => {
  if (!win) return false;
  const v = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(v, 'floating');
  return v;
});
ipcMain.on('win:min', () => win && win.minimize());
ipcMain.on('win:close', () => win && win.close());
