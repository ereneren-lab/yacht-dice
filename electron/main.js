// 요트 다이스 데스크톱 앱
// 실행(개발): npm run app
// 배포 빌드:   npm run dist   (.exe/.dmg 생성)
//
// 친구들과 온라인으로 같이 하려면 모두 "같은 서버"에 붙어야 함.
// 아래 DEFAULT_URL을 네 Render 배포 주소로 맞춰두면, 빌드된 앱이 그 주소로 접속함.
// (필요하면 실행 시 APP_URL 환경변수로 덮어쓸 수 있음)

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// ★★★ 여기를 네 배포 주소로! (끝에 / 붙이지 말 것) ★★★
const DEFAULT_URL = 'https://yacht-dice-jxva.onrender.com';

// APP_URL 환경변수가 있으면 그걸 우선 사용. 'local'이면 내장 서버(혼자/LAN)로 동작.
const APP_URL = process.env.APP_URL || DEFAULT_URL;
let win;

/* ===== 창 투명도 =====
 * setOpacity는 **창 전체**(테두리 포함)에 걸리는 OS 기능이라 웹 페이지 CSS로는 못 한다.
 * 그래서 원격(Render) 페이지가 무엇이든 상관없이 동작하도록 **네이티브 메뉴 단축키**로 붙였다.
 * (기존 'win:opacity' IPC는 그대로 두지만, 원격 페이지엔 이걸 부르는 UI가 없어서 죽어 있었다.)
 * 0.2 밑으로는 못 내려간다 — 창이 안 보여서 되돌릴 수 없게 되는 걸 막는다. */
const OPACITY_MIN = 0.2, OPACITY_STEP = 0.05;
let opacity = 1;

const prefsFile = () => path.join(app.getPath('userData'), 'window-prefs.json');
function loadPrefs() {
  try {
    const j = JSON.parse(fs.readFileSync(prefsFile(), 'utf8'));
    if (typeof j.opacity === 'number') opacity = clampOpacity(j.opacity);
  } catch (e) {}
}
function savePrefs() {
  try { fs.writeFileSync(prefsFile(), JSON.stringify({ opacity })); } catch (e) {}
}
function clampOpacity(v) { return Math.max(OPACITY_MIN, Math.min(1, Number(v) || 1)); }
function applyOpacity(v) {
  opacity = clampOpacity(v);
  if (win) win.setOpacity(opacity);
  savePrefs();
  buildMenu();   // 메뉴에 현재 % 를 다시 그린다
}

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
  win.setOpacity(opacity);   // 지난번에 쓰던 투명도를 그대로 복원
}

/* 메뉴를 매번 새로 만든다 — 라벨에 현재 투명도(%)를 보여주려고.
   Menu.setApplicationMenu는 macOS에서 앱 전역 메뉴라 창이 없어도 안전하다. */
function buildMenu() {
  const pct = Math.round(opacity * 100);
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    {
      label: '창',
      submenu: [
        { label: `투명도: ${pct}%`, enabled: false },
        { type: 'separator' },
        // macOS는 Cmd+- / Cmd+= 가 확대·축소와 겹치기 쉬워 Shift를 끼웠다
        { label: '더 투명하게', accelerator: 'CommandOrControl+Shift+-',
          click: () => applyOpacity(opacity - OPACITY_STEP) },
        { label: '더 불투명하게', accelerator: 'CommandOrControl+Shift+=',
          click: () => applyOpacity(opacity + OPACITY_STEP) },
        { label: '투명도 초기화 (100%)', accelerator: 'CommandOrControl+Shift+0',
          click: () => applyOpacity(1) },
        { type: 'separator' },
        { label: '항상 위에 띄우기', type: 'checkbox',
          checked: !!(win && win.isAlwaysOnTop()),
          accelerator: 'CommandOrControl+Shift+P',
          click: () => { if (win) { win.setAlwaysOnTop(!win.isAlwaysOnTop(), 'floating'); buildMenu(); } } },
        { type: 'separator' },
        { role: 'reload', label: '새로고침' },
        { role: 'minimize', label: '최소화' },
        { role: 'togglefullscreen', label: '전체화면' },
        { role: 'close', label: '닫기' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => { loadPrefs(); buildMenu(); return createWindow(); });
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
ipcMain.on('win:opacity', (_e, v) => applyOpacity(v));   // 메뉴와 같은 경로를 타게(저장·라벨 갱신 포함)
ipcMain.on('win:close', () => win && win.close());
