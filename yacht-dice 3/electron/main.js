// 요트 다이스 데스크톱 앱
// 실행(개발): npm run app
// 배포 빌드:   npm run dist   (.exe/.dmg 생성)
//
// 친구들과 온라인으로 같이 하려면 모두 "같은 서버"에 붙어야 함.
// 아래 DEFAULT_URL을 네 Render 배포 주소로 맞춰두면, 빌드된 앱이 그 주소로 접속함.
// (필요하면 실행 시 APP_URL 환경변수로 덮어쓸 수 있음)

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// ★★★ 여기를 네 배포 주소로! (끝에 / 붙이지 말 것) ★★★
const DEFAULT_URL = 'https://yacht-dice-jxva.onrender.com';

// APP_URL 환경변수가 있으면 그걸 우선 사용. 'local'이면 내장 서버(혼자/LAN)로 동작.
const APP_URL = process.env.APP_URL || DEFAULT_URL;
let win;

async function resolveUrl() {
  if (APP_URL && APP_URL !== 'local') return APP_URL;
  // 내장 서버 실행 (혼자 플레이/같은 PC·LAN용)
  process.env.PORT = process.env.PORT || '3000';
  require(path.join(__dirname, '..', 'server.js'));
  await new Promise(r => setTimeout(r, 700));
  return 'http://localhost:' + process.env.PORT;
}

async function createWindow() {
  const url = await resolveUrl();
  // 친구 배포용: 일반 앱 창(테두리/닫기버튼 있음). 투명 위젯이 좋으면 APP_TRANSPARENT=1 로 실행.
  const transparent = !!process.env.APP_TRANSPARENT;
  win = new BrowserWindow({
    width: 1000, height: 720, minWidth: 720, minHeight: 480,
    transparent,
    frame: !transparent,
    backgroundColor: transparent ? '#00000000' : '#15111f',
    hasShadow: true,
    resizable: true,
    title: 'Yacht Dice',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // 앱이 항상 Render 최신 화면을 받도록 캐시 무시
  try { win.webContents.session.clearCache(); } catch (e) {}
  win.loadURL(url, { extraHeaders: 'pragma: no-cache\nCache-Control: no-cache\n' });
  win.webContents.on('did-fail-load', () => setTimeout(() => win && win.loadURL(url), 1500));
}

app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => app.quit());

// 창 컨트롤 (preload를 통해 렌더러에서 호출) — 투명 모드에서 주로 사용
ipcMain.handle('win:pin', () => {
  if (!win) return false;
  const v = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(v, 'floating');
  return v;
});
ipcMain.on('win:min', () => win && win.minimize());
ipcMain.on('win:opacity', (_e, v) => { if (win) win.setOpacity(Math.max(0.2, Math.min(1, Number(v) || 1))); });
ipcMain.on('win:close', () => win && win.close());
