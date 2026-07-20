/**
 * 윷놀이 조작 헬퍼 — 실제 브라우저에서 게임을 진행시킨다.
 *
 * 주의: 게임 상태 S는 IIFE 스코프라 window에 없다. 상태 판정은 전부 DOM으로 한다.
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { CDP } = require('./cdp');

const URL = process.env.YUT_URL || 'http://localhost:3000/yut.html';

function ping() {
  return new Promise(res => {
    const req = http.get(URL, r => { r.resume(); res(r.statusCode === 200); });
    req.on('error', () => res(false));
    req.setTimeout(1000, () => { req.destroy(); res(false); });
  });
}

/**
 * 서버가 안 떠 있으면 직접 띄운다. 반환값이 있으면 호출자가 kill 해야 한다(없으면 남의 서버라 그대로 둔다).
 * 테스트 도중 서버가 죽어 결과가 흔들리는 걸 막으려 수명을 테스트가 쥔다.
 */
async function ensureServer() {
  if (await ping()) return null;
  const proc = spawn('node', [path.join(__dirname, '../../server.js')], { stdio: 'ignore' });
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    if (await ping()) return proc;
  }
  proc.kill();
  throw new Error('서버를 띄우지 못했다 (node server.js 를 직접 확인할 것)');
}

/** #fxLayer에 들어오는 원을 계측 — 잔상(r5, 90,66,40) vs 착지먼지(150,120,80,.5) 구분 */
const INSTRUMENT = `
  window.__fx = { trail: [], puff: [] };
  var layer = document.getElementById('fxLayer');
  new MutationObserver(function(muts){
    muts.forEach(function(m){
      Array.prototype.forEach.call(m.addedNodes, function(n){
        if (n.tagName !== 'circle' || n.getAttribute('data-clone')) return;
        var r = parseFloat(n.getAttribute('r')), f = n.getAttribute('fill')||'';
        var rec = { r:r, cx:+n.getAttribute('cx'), cy:+n.getAttribute('cy') };
        if (r === 5 && f.indexOf('90,66,40') > -1) window.__fx.trail.push(rec);
        else if (f.indexOf('150,120,80') > -1) window.__fx.puff.push(rec);
      });
    });
  }).observe(layer, { childList: true });
  return true;
`;

/** 던지기는 click()이 아니라 '꾹 눌렀다 떼기'(파워 게이지)다 */
async function throwYut(page, holdMs = 260) {
  const ok = await page.eval(`
    var b = document.getElementById('throwBtn');
    if (!b || b.disabled) return false;
    b.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
    return true;
  `);
  if (!ok) return false;
  await page.wait(holdMs);
  await page.eval(`window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true})); return true;`);
  return true;
}

/** 이동 가능한 말 선택 — 판 위 우선, 없으면 트레이 대기말 */
function pickPiece(page) {
  return page.eval(`
    var g = document.querySelector('#pieceLayer .pcpiece.mv');
    if (g) { g.onclick(); return 'board'; }
    var t = document.querySelector('#pieceTray .tp.movable');
    if (t) { t.onclick(); return 'tray'; }
    return null;
  `);
}

/** 지름길/직진 선택 오버레이가 떠 있으면 직진 */
function resolveDirection(page) {
  return page.eval(`
    var st = document.getElementById('dirSt');
    if (st && st.offsetParent !== null) { st.onclick(); return true; }
    return false;
  `);
}

/** DOM만으로 상태 판정 (S는 IIFE 스코프라 접근 불가) */
function state(page) {
  return page.eval(`
    var b = document.getElementById('throwBtn');
    var ov = document.getElementById('resultOv');
    var ti = document.getElementById('turnInfo');
    return {
      over: !!(ov && ov.classList.contains('on')),
      throwable: !!b && !b.disabled && b.offsetParent !== null,
      mv: document.querySelectorAll('#pieceLayer .pcpiece.mv').length,
      trayMv: document.querySelectorAll('#pieceTray .tp.movable').length,
      info: ti ? ti.textContent.trim().slice(0, 50) : ''
    };
  `);
}

/** 판 종료면 재경기로 이어 붙여 표본을 계속 모은다 */
async function restartIfOver(page, st) {
  if (!st.over) return false;
  await page.eval("var b=document.getElementById('againBtn'); if(b) b.click(); return true;");
  await page.wait(1500);
  return true;
}

/** 게임 시작까지(설정 오버레이 → 시작 → VS 인트로 종료) */
async function startGame(cdp, { width = 1100, height = 1100, motion = true, hideOverlays = false } = {}) {
  const page = await cdp.newPage(width, height);
  await page.setMotion(motion);
  await page.goto(URL);
  await page.click('#startBtn');
  await page.wait(motion ? 6000 : 2500);   // VS 인트로가 판을 가린다
  await page.eval(INSTRUMENT);
  if (hideOverlays) {
    await page.eval(`
      var st=document.createElement('style');
      st.textContent='#yutFx,#yutSpeech,#yutEffect,.speech{display:none !important}';
      document.head.appendChild(st); return true;
    `);
  }
  return page;
}

/** 한 턴 진행: 던지고 말 하나 움직인다. 이동이 일어났으면 true */
async function playTurn(page, { settleMs = 2600 } = {}) {
  const st = await state(page);
  if (await restartIfOver(page, st)) return false;
  if (!st.throwable) { await page.wait(500); return false; }

  await throwYut(page);
  await page.wait(1500);
  const picked = await pickPiece(page);
  if (!picked) return false;
  await page.wait(250);
  await resolveDirection(page);
  await page.wait(settleMs);
  return picked;
}

module.exports = { CDP, URL, INSTRUMENT, ensureServer, throwYut, pickPiece, resolveDirection, state, restartIfOver, startGame, playTurn };
