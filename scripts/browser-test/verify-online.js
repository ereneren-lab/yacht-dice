/**
 * 온라인 2인 실측 — 실제 크로미움 탭 2개로 "사람 둘"을 흉내 내 서버 e2e가 못 잡는 것을 잡는다.
 *
 *  1) 채팅 왕복(요트): 내 메시지 즉시 표시 · 상대 수신 · 연타 5개 무손실 · 순서 · IME Enter 오전송 · 중복
 *  2) 자리 소유권(5종): 같은 브라우저 두 탭이 같은 자리(pid)를 놓고 싸우지 않는지
 *     + 게임 중 새로고침(= 모바일 화면잠금 복귀) 시 내 자리로 rejoin 되는지
 *
 * ⚠️ 두 탭은 localStorage를 공유한다. 그래서 방/pid를 localStorage에만 두면
 *    나중에 join한 탭이 값을 덮어써 먼저 있던 탭이 남의 자리로 rejoin한다(v1.154에서 고침).
 *    이 테스트는 컨텍스트를 일부러 격리하지 **않는다** — 그 회귀를 잡는 게 목적이라서.
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/verify-online.js
 */
const { launchWithRetry } = require('./cdp.js');

const BASE = process.env.ALLEY_URL || 'http://localhost:3000';
const wait = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (n, c, e = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + n + (e ? ' — ' + e : '')); if (!c) fail++; };
async function until(fn, ms = 9000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await fn()) return true; await wait(150); }
  return false;
}
const type = (p, sel, txt) => p.eval(`var e=document.querySelector(${JSON.stringify(sel)}); e.focus(); e.value=${JSON.stringify(txt)}; return true;`);
// 채팅 전송은 click()이 아니라 keydown Enter로 — IME 분기(keyCode 229)를 같은 경로로 태우기 위해서다.
const enter = (p, sel, keyCode = 13) => p.eval(`var e=document.querySelector(${JSON.stringify(sel)}); e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:${keyCode},bubbles:true,cancelable:true})); return true;`);
const lines = p => p.eval(`return [...document.querySelectorAll('#chatLog .cmsg')].map(e=>e.textContent);`);
const visible = (p, sel) => p.eval(`var e=document.querySelector(${JSON.stringify(sel)}); return !!e && e.style.display!=='none';`);
const codeOf = p => p.eval(`return (document.getElementById('lobbyCode').textContent||'').trim();`);

/** 요트 — 채팅 왕복 */
async function chatRoundTrip(cdp) {
  console.log('\n▶ 요트 채팅 2인 왕복');
  const A = await cdp.newPage(), B = await cdp.newPage();
  try {
    const url = BASE + '/yacht.html';
    await A.goto(url); await B.goto(url);
    await A.click('#tabOnline'); await wait(300);
    await type(A, '#onlineName', '호스트'); await A.click('#createRoom');
    ok('방 생성', await until(async () => /^[A-Z0-9]{4}$/.test(await codeOf(A))));
    const code = await codeOf(A);
    await B.click('#tabOnline'); await wait(300);
    await type(B, '#onlineName', '게스트'); await type(B, '#joinCode', code); await B.click('#joinRoom');
    ok('참가', await until(() => visible(B, '#lobby')));
    await A.click('#startOnline');
    ok('게임 시작 + 채팅창 노출', await until(() => visible(B, '#chatBox'), 15000));
    await wait(700);

    await type(A, '#chatInput', '안녕'); await enter(A, '#chatInput');
    ok('보낸 쪽 즉시 표시', await until(async () => (await lines(A)).some(l => l.includes('안녕'))));
    ok('상대 수신', await until(async () => (await lines(B)).some(l => l.includes('안녕'))));

    await type(B, '#chatInput', '반가워'); await enter(B, '#chatInput');
    ok('역방향 수신', await until(async () => (await lines(A)).some(l => l.includes('반가워'))));

    for (let i = 1; i <= 5; i++) { await type(A, '#chatInput', '연타' + i); await enter(A, '#chatInput'); await wait(40); }
    const arrived = await until(async () => { const l = await lines(B); return [1, 2, 3, 4, 5].every(i => l.some(x => x.includes('연타' + i))); });
    const lb = await lines(B), la = await lines(A);
    ok('연타 5개 무손실', arrived, lb.filter(x => /연타/.test(x)).length + '개');
    ok('중복 없음(양쪽)', la.filter(x => /연타/.test(x)).length === 5 && lb.filter(x => /연타/.test(x)).length === 5);
    ok('수신 순서 보존', lb.filter(x => /연타/.test(x)).map(x => x.match(/연타(\d)/)[1]).join('') === '12345');

    // 한글 조합 확정 Enter(keyCode 229)는 전송이 아니다 — 오전송되면 대화가 토막 난다
    await type(B, '#chatInput', '조합중'); await enter(B, '#chatInput', 229); await wait(600);
    ok('IME Enter는 전송 안 함', !(await lines(A)).some(l => l.includes('조합중')));
    ok('입력값 유지', (await B.eval(`return document.getElementById('chatInput').value;`)) === '조합중');

    const errs = [...A.errors, ...B.errors].filter(e => !/vibrate|AudioContext/i.test(e));
    ok('콘솔 에러 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  } finally { await A.close(); await B.close(); }
}

/* 게임별 셀렉터. 시작 버튼(#lobbyStart)·코드(#lobbyCode)·참가(#joinBtn)는 요트만 이름이 다르다. */
const GAMES = {
  yut:     { online: '#tabOnline', game: '#game' },
  kb:      { online: '[data-m="online"]', game: '#arena' },
  ld:      { online: '[data-m="online"]', game: '#game' },
  lcr:     { online: '#tabOnline', game: '#game', ai: 1 },   // 3명부터 시작 가능
  yacht:   { online: '#tabOnline', game: '#game', yacht: true },
  alkkagi: { online: '#tabOnline', game: '#game' },
};

/** 5종 — 두 탭 자리 격리 + 게임 중 새로고침 rejoin */
async function seatOwnership(cdp, g, cfg) {
  console.log(`\n▶ [${g}] 두 탭 자리 소유권 · 새로고침 rejoin`);
  const A = await cdp.newPage(), B = await cdp.newPage();
  const url = `${BASE}/${g}.html`;
  const sel = cfg.yacht
    ? { name: '#onlineName', create: '#createRoom', join: '#joinRoom', start: '#startOnline' }
    : { name: '#onName', create: '#createBtn', join: '#joinBtn', start: '#lobbyStart' };
  try {
    await A.goto(url); await B.goto(url);
    await A.click(cfg.online); await wait(300);
    await type(A, sel.name, '호스트'); await A.click(sel.create);
    ok(`[${g}] 방 생성`, await until(async () => /^[A-Z0-9]{4}$/.test(await codeOf(A))));
    const code = await codeOf(A);
    await B.click(cfg.online); await wait(300);
    await type(B, sel.name, '게스트'); await type(B, '#joinCode', code); await B.click(sel.join);
    ok(`[${g}] 참가`, await until(async () => (await codeOf(B)) === code));

    const key = cfg.yacht ? 'yd' : g;
    const pA = await A.eval(`return sessionStorage.getItem('${key}_pid');`);
    const pB = await B.eval(`return sessionStorage.getItem('${key}_pid');`);
    ok(`[${g}] 탭별 pid 분리`, !!pA && !!pB && pA !== pB);

    if (cfg.ai) for (let i = 0; i < cfg.ai; i++) { await A.click('#lobbyAddAi'); await wait(400); }
    await A.click(sel.start);
    ok(`[${g}] 게임 시작`, await until(() => visible(A, cfg.game), 15000));
    await wait(1500);

    await A.goto(url);   // 💥 모바일 화면잠금 후 복귀 = 새로고침
    ok(`[${g}] 새로고침 rejoin(내 자리 유지)`, await until(async () =>
      (await visible(A, cfg.game)) && (await A.eval(`return sessionStorage.getItem('${key}_pid');`)) === pA, 15000));
    ok(`[${g}] 상대 자리 안 뺏김`, (await B.eval(`return sessionStorage.getItem('${key}_pid');`)) === pB);
    ok(`[${g}] 허브 '이어하기'용 localStorage 유지`, !!(await A.eval(`return localStorage.getItem('${key}_room');`)));

    // 초대 링크를 같은 브라우저의 '새 탭'으로 연 경우: sessionStorage가 비어 localStorage로 폴백하는데,
    // 그 자리는 A/B가 쓰는 중이다 → BroadcastChannel로 물어보고 자동 rejoin을 포기해야 한다(v1.154).
    const C = await cdp.newPage();
    try {
      await C.goto(`${url}?room=${code}`);
      await wait(2500);
      const pC = await C.eval(`return sessionStorage.getItem('${key}_pid');`);
      ok(`[${g}] 새 탭이 남의 자리 안 뺏음`, pC !== pA && pC !== pB, 'C=' + pC);
      ok(`[${g}] 새 탭 때문에 기존 탭이 안 끊김`,
        (await visible(A, cfg.game)) && (await A.eval(`return sessionStorage.getItem('${key}_pid');`)) === pA);
    } finally { await C.close(); }
  } finally { await A.close(); await B.close(); }
}

(async () => {
  const cdp = await launchWithRetry();
  try {
    await chatRoundTrip(cdp);
    for (const [g, cfg] of Object.entries(GAMES)) await seatOwnership(cdp, g, cfg);
  } catch (e) {
    console.error('  ❌ 예외: ' + e.message); fail++;
  } finally { await cdp.close(); }
  console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과');
  process.exit(fail ? 1 : 0);
})();
