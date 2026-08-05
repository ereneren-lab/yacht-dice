/**
 * 가로(landscape) 감사 — "가로에서 보이나"가 아니라 "가로에서 쓸 수 있나"를 잰다.
 *
 * 왜 따로 있나 (2026-08-04)
 * ─────────────────────────
 * `audit:ux`는 가로 뷰포트를 이미 돌고 있었고 **경고 0으로 통과**하고 있었다.
 * 그런데 실사용자가 "가로가 상당히 불편하다"고 했다. 재보니 전부 사실이었다:
 *   · 바카라 판이 740x360에서 **61px**이었다(카드 88px이 들어갈 수 없다) — 넘침은 0이었다.
 *   · 딜러 패가 판 위로 잘려나갔다 — `overflow:hidden`이라 문서는 안 넘친다.
 *   · 상태 글이 내 손패 **위에** 얹혔다 — 겹침은 넘침으로 안 잡힌다.
 *   · 폭 932px 중 532px만 쓰고 좌우 200px씩 버렸다 — 넘침 0이라 통과였다.
 *   · 알까기 판이 세로 336px → 가로 248px로 **작아졌다** — 화면을 넓혔는데 판이 준다.
 * 즉 기존 감사가 보는 것(넘침·버튼 존재)과 사람이 겪는 것(판 크기·잘림·겹침)이 달랐다.
 * 이 파일은 그 간극만 잰다.
 *
 * 재는 것
 *   ① 판 크기      — 세로(390x844) 대비 가로에서 판 면적이 줄었나
 *   ② 폭 낭비      — 실제로 픽셀이 칠해지는 가로 범위 / 화면 폭
 *   ③ 잘림         — overflow:hidden 조상 밖으로 삐져나간 자식(= 영영 못 보는 것)
 *   ④ 겹침         — 글자가 카드·주사위 위에 얹혔나
 *   ⑤ 탭 타깃      — 가로에서 40px 미만인 조작 요소 (세로 44px의 절충값)
 *   ⑥ 조작부 도달  — 주 조작 버튼이 화면 안이고, 가려지지 않았나
 *   ⑦ 숨은 스크롤 — 패널 **안쪽** 스크롤로 화면 밖에 남은 내용 (세로·가로 둘 다)
 *
 * ⑦를 나중에 붙인 이유 (2026-08-04 · 같은 종류의 놓침이 세 번째다)
 * ─────────────────────────────────────────────────────────────
 *   ①~⑥까지 전부 초록이었는데 재성님은 "플레이하면서 스크롤도 해야 되고"라고 했다.
 *   재보니 요트 점수판(`div.sheetwrap`)이 **세로 155px · 가로 274px**을 안쪽 스크롤로 감추고 있었다.
 *   문서 넘침은 0이고 `documentElement`는 스크롤조차 안 된다 — 넘침을 **그 상자가 삼켰기 때문**이다.
 *   즉 "화면이 안 넘친다"는 "다 보인다"가 아니다. `overflow:auto|scroll`인 상자가 하나라도 있으면
 *   넘침 수치는 그 상자 뒤에서 조용히 사라진다.
 *   (함정 21 "안에 있다≠보인다", 22 "보인다≠누를 수 있다", 33 "안 넘친다≠쓸 만하다"의 다음 항목이다.)
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/audit-landscape.js
 *       node scripts/browser-test/audit-landscape.js kb yacht     (일부만)
 */
const { launchWithRetry, requireServer } = require('./cdp');

/* 높이 360~430이 진짜 어려운 구간이다(폰을 돌리면 여기로 떨어진다).
   1024x600은 '넓은 가로'라 압축 규칙(max-height:520px)이 안 걸리는 대조군이다. */
const LAND = [
  { n: '844x390', w: 844, h: 390 },
  { n: '740x360', w: 740, h: 360 },
  { n: '932x430', w: 932, h: 430 },
];
const PORT = { n: '390x844', w: 390, h: 844 };
/* ⑦ 전용 참고 뷰포트 — 재성님 Galaxy A16 앱 웹뷰의 **실제** 세로 크기(384x748).
   390x844보다 96px 짧아서, 세로에서 '안 들어가는 것'은 여기서만 드러난다.
   ⚠️ 합계(bad)에는 넣지 않는다 — 요트는 [주사위판 + 점수판 15줄]이 748px에 **구조적으로** 안 들어간다.
      고칠 수 있는 것은 다 고쳐 155→65px까지 줄였고(2026-08-04), 남은 65px을 없애려면
      주사위를 34px로 줄이거나 안내문(#hint)을 지워야 한다 — 둘 다 세로(주 사용 방향)를 깎는 일이다.
      그래서 '경고'가 아니라 '계속 보이는 숫자'로 둔다. 늘 우는 감사는 없느니만 못하다. */
const PORT_REAL = { n: '384x748', w: 384, h: 748 };

/* board: 판(사람이 들여다보는 놀이면). act: 이 턴에 눌러야 하는 것들. */
const GAMES = [
  /* ⚠️ 윷이 오래도록 이 목록에서 빠져 있었다(2026-08-04에 추가). 그동안 실측하면:
       844x390 판 210px(화면의 13%) · '윷 던지기' 버튼이 **화면 밖 216px**
       740x360 버튼 화면 밖 398px · 748x384 화면 밖 58px
     이 턴에 눌러야 하는 버튼이 화면 밖인데 어떤 감사도 안 울었다 —
     ⑥(조작부 도달)이 이미 있었으니 **목록에 한 줄만 있었으면 잡혔을 자리**다.
     → 게임을 추가하면 이 배열에도 반드시 넣을 것. audit-ux.js의 GAMES와 짝이다.
     판 셀렉터 `#board`는 SVG다 — tag()/rect 계산은 SVG에서도 그대로 돈다(className 가드 있음). */
  { g: 'yut',         start: '#startBtn',   board: '#board',     act: ['#throwBtn'],
    /* 선 뽑기를 통과시키는 절차. ① 결과창이 떠 있으면 '건너뛰기'를 눌러 치우고
       ② 아니면 던지기를 꾹 눌렀다 뗀다(click()으론 안 된다 — 게이지 조작이다). */
    settle: `var sk=document.getElementById('coSkip');
             if(sk && sk.getBoundingClientRect().width>0){ sk.click(); return true; }
             var b=document.getElementById('throwBtn'); if(!b) return false;
             b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
             setTimeout(function(){ window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); }, 260);
             return true;`,
    /* 판이 보이는 것만으로는 부족하다 — 선 뽑기 결과창이 아직 덮고 있으면 그 찰나를 재게 된다. */
    ready: `var b=document.getElementById('board'); if(!b) return false;
            var r=b.getBoundingClientRect(); if(r.width<=4||r.height<=4) return false;
            var sk=document.getElementById('coSkip');
            return !(sk && sk.getBoundingClientRect().width>0);` },
  { g: 'kb',          start: '#startBtn',   board: '#arena',     act: ['#rollBtn'] },
  { g: 'yacht',       start: '#startLocal', board: '.gamewrap',  act: ['#rollBtn'] },
  { g: 'ld',          start: '#startBtn',   board: '#game',      act: ['#qplus', '#qminus'] },
  { g: 'lcr',         start: '#startBtn',   board: '#game',      act: ['#rollBtn'] },
  { g: 'alkkagi',     start: '#startBtn',   board: '#board',     act: [] },
  { g: 'seotda',      start: '#startBtn',   board: '.tablewrap', act: ['#betbar .bbtn'] },
  { g: 'indianpoker', start: '#startBtn',   board: '#table',     act: ['#betbar button'] },
  { g: 'onecard',     start: '#startBtn',   board: '#table',     act: ['#acts button'] },
  { g: 'oldmaid',     start: '#startBtn',   board: '#table',     act: ['#drawtray .mc'] },
  { g: 'blackjack',   start: '#startBtn',   board: '#table',     act: ['#chiprow .cchip', '#dealBtn'] },
  { g: 'baccarat',    start: '#startBtn',   board: '#table',     act: ['#chiprow .cchip', '#dealBtn'] },
  { g: 'highlow',     start: '#startBtn',   board: '#table',     act: ['#chiprow .cchip', '#dealBtn'] },
];

/* ⑦ 숨은 스크롤 패널 — 예외 목록.
   ⚠️ 조용히 빼면 다음 사람이 또 속는다. 뺀 것은 전부 이유를 적는다.
   기준: **끝이 있는 내용**(점수판 15줄·설정 목록)은 다 보여야 하고,
        **끝이 없는 내용**(대화 기록·굴림 기록처럼 판이 진행될수록 계속 쌓이는 것)은
        스크롤이 정상이다. 후자는 "다 보이게 만든다"는 목표 자체가 성립하지 않는다. */
const SCROLL_OK = [
  '#chatLog', '.chatlog',     // 채팅 — 판이 길어질수록 무한히 쌓인다. 최신이 아래에 보이면 된다.
  '#rollLog', '.rolllog', '.logbody',   // 굴림/판 기록 — 위와 같은 이유(누적 로그)
  '.helpwrap', '.rulesbody', '.tut-body', '.ovbody',  // 규칙·튜토리얼 본문 — 긴 글이라 내부 스크롤이 설계다
];
/* 임계값 24px — 압축한 점수판 한 줄이 23px이다.
   그보다 작은 값은 테두리·서브픽셀 반올림이지 '못 보는 내용'이 아니다.
   한 줄 이상이 화면 밖이면 그건 사람이 스크롤해야만 닿는 정보다. */
const HIDDEN_MIN = 24;

/* 글자 ↔ 그림 겹침 판정용. 왼쪽은 '읽어야 하는 글', 오른쪽은 '들여다봐야 하는 그림'. */
const TEXTSEL = '#msg,.msg,.note,.stagenote,.seathint,.hint,.pilelbl,.handprog';
const ARTSEL = '.mc,.pc,.fc,.hwa,.squeeze,.d,.d2,.bigdie,.die,.cell';

const MEASURE = (boardSel, actSels) => `
var o = { vw: innerWidth, vh: innerHeight };
var de = document.documentElement;
o.over = Math.max(de.scrollHeight, document.body.scrollHeight) - innerHeight;

function tag(e){ return e.id ? '#'+e.id
  : (e.className && typeof e.className==='string' ? '.'+e.className.split(' ')[0] : e.tagName.toLowerCase()); }
function vis(e){ var st=getComputedStyle(e);
  return st.display!=='none' && st.visibility!=='hidden' && +st.opacity>0.05; }

// ① 판
var b = document.querySelector(${JSON.stringify(boardSel)});
if (b) { var r = b.getBoundingClientRect();
  o.board = { w: Math.round(r.width), h: Math.round(r.height), area: Math.round(r.width*r.height) }; }

// ② 폭 낭비 — 실제로 뭔가 그려지는 leaf 요소들의 가로 범위
var minL=1e9, maxR=-1e9, n=0;
Array.prototype.forEach.call(document.querySelectorAll('body *'), function(e){
  if (e.children.length) return;
  var st = getComputedStyle(e);
  if (st.display==='none'||st.visibility==='hidden'||+st.opacity<0.05||st.position==='fixed') return;
  var r = e.getBoundingClientRect();
  if (r.width<2||r.height<2||r.bottom<0||r.top>innerHeight) return;
  minL=Math.min(minL,r.left); maxR=Math.max(maxR,r.right); n++;
});
o.usedW = n ? Math.round(maxR-minL) : 0;

// ③ 잘림 — overflow:hidden 조상 밖으로 나간 자식.
//    ⚠️ transform이 걸린 것(연출 중)과 opacity 0(감춰진 것)은 뺀다 — 일부러 밖으로 보낸 것들이다.
var clip = [];
Array.prototype.forEach.call(document.querySelectorAll('*'), function(p){
  var ps = getComputedStyle(p);
  if (ps.overflow!=='hidden' && ps.overflowY!=='hidden' && ps.overflowX!=='hidden') return;
  var pr = p.getBoundingClientRect();
  if (pr.width<40||pr.height<40) return;
  Array.prototype.forEach.call(p.children, function(c){
    var cs = getComputedStyle(c);
    if (cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<0.9) return;
    if (cs.transform && cs.transform!=='none') return;
    if (cs.position==='fixed') return;
    var r = c.getBoundingClientRect();
    if (r.width<6||r.height<6) return;
    var cut = Math.round(Math.max(0, r.bottom-pr.bottom) + Math.max(0, pr.top-r.top)
                       + Math.max(0, r.right-pr.right) + Math.max(0, pr.left-r.left));
    if (cut > 6) clip.push(tag(p)+' > '+tag(c)+' '+cut+'px');
  });
});
o.clip = clip.slice(0, 6); o.clipN = clip.length;

// ④ 겹침 — 글자가 그림 위에 얹혔나 (서로 조상/자손이 아닐 때만)
var texts = [].slice.call(document.querySelectorAll(${JSON.stringify(TEXTSEL)})).filter(function(e){
  return vis(e) && (e.textContent||'').trim().length > 0; });
var arts = [].slice.call(document.querySelectorAll(${JSON.stringify(ARTSEL)})).filter(vis);
var ovl = [];
texts.forEach(function(t){
  var tr = t.getBoundingClientRect(); if (tr.width<4||tr.height<4) return;
  arts.forEach(function(a){
    if (t===a || t.contains(a) || a.contains(t)) return;
    var ar = a.getBoundingClientRect(); if (ar.width<4||ar.height<4) return;
    var iw = Math.min(tr.right,ar.right) - Math.max(tr.left,ar.left);
    var ih = Math.min(tr.bottom,ar.bottom) - Math.max(tr.top,ar.top);
    if (iw<=2||ih<=2) return;
    // 글자 면적의 12% 이상이 그림에 걸치면 '읽기 방해'로 센다(스치는 1~2px은 뺀다)
    if (iw*ih < tr.width*tr.height*0.12) return;
    ovl.push(tag(t)+' × '+tag(a)+' '+Math.round(iw)+'x'+Math.round(ih));
  });
});
o.ovl = ovl.slice(0, 5); o.ovlN = ovl.length;

// ⑤ 탭 타깃 — 가로는 40px로 절충(CLAUDE.md 함정 21)
//    ⚠️ <label> 안의 체크박스는 라벨 전체가 타깃이다 — 라벨 rect로 잰다.
var small = [];
Array.prototype.forEach.call(document.querySelectorAll('button,a[href],select,input,[role=button]'), function(e){
  if (!vis(e)) return;
  var t = e;
  if (e.tagName==='INPUT' && (e.type==='checkbox'||e.type==='radio')) { var L=e.closest('label'); if(L) t=L; }
  var r = t.getBoundingClientRect();
  if (r.width<2||r.height<2) return;
  if (r.bottom<0||r.top>innerHeight) return;            // 화면 밖(로비 등)은 세지 않는다
  if (Math.min(r.width,r.height) < 40)
    small.push(tag(e)+' '+Math.round(r.width)+'x'+Math.round(r.height));
});
o.small = small.slice(0, 8); o.smallN = small.length;

// ⑦ 숨은 스크롤 패널 — 안쪽 스크롤이 삼킨 높이. 문서 넘침으로는 절대 안 잡힌다.
var hidden = [];
Array.prototype.forEach.call(document.querySelectorAll('*'), function(e){
  var st = getComputedStyle(e);
  if (!vis(e)) return;
  if (!/auto|scroll/.test(st.overflowY)) return;
  var hid = e.scrollHeight - e.clientHeight;
  if (hid < ${HIDDEN_MIN}) return;
  var r = e.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return;
  if (r.bottom < 0 || r.top > innerHeight) return;      // 화면 밖(로비 등)은 세지 않는다
  if (${JSON.stringify(SCROLL_OK)}.some(function(s){ return e.matches(s); })) return;
  hidden.push({ t: tag(e), vis: Math.round(r.height), hid: Math.round(hid) });
});
o.hidden = hidden.slice(0, 5); o.hiddenN = hidden.length;
o.hiddenMax = hidden.reduce(function(a,b){ return Math.max(a, b.hid); }, 0);

// ⑥ 조작부 도달 — 있으면 화면 안이고 가려지지 않아야 한다
o.acts = [];
${JSON.stringify(actSels)}.forEach(function(sel){
  var e = document.querySelector(sel); if (!e || !vis(e)) return;
  var r = e.getBoundingClientRect();
  var inView = r.top>=-2 && r.left>=-2 && r.bottom<=innerHeight+2 && r.right<=innerWidth+2;
  var cx = Math.round(r.left+r.width/2), cy = Math.round(r.top+r.height/2), clickable=null, by=null;
  if (cx>=0&&cy>=0&&cx<=innerWidth&&cy<=innerHeight) {
    var h = document.elementFromPoint(cx, cy);
    clickable = !!(h && (h===e || e.contains(h) || h.contains(e)));   // 조상은 가림이 아니다(함정 22)
    if (!clickable && h) by = h.id ? '#'+h.id : h.tagName.toLowerCase()+'.'+((h.className||'')+'').split(' ')[0];
  }
  o.acts.push({ sel: sel, inView: inView, clickable: clickable, by: by,
                y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
});
return o;`;

const ONLY = process.argv.slice(2).filter(a => !a.startsWith('-'));
const LIST = ONLY.length ? GAMES.filter(x => ONLY.includes(x.g)) : GAMES;

async function run(cdp, G, V) {
  const page = await cdp.newPage(V.w, V.h);
  try {
    if (page.setMotion) await page.setMotion(true);
    await page.goto('http://localhost:3000/' + G.g + '.html');
    await page.wait(900);
    // 첫 방문 오버레이가 시작 클릭을 막는다 (CLAUDE.md 함정 15)
    await page.eval(`try{ if(window.TUT) TUT.close();
      var t=document.getElementById('tutorialOv'); if(t) t.classList.remove('on');
      var u=document.getElementById('tutOv'); if(u) u.classList.remove('on');
    }catch(e){} return true;`);
    await page.wait(200);
    try { await page.click(G.start); } catch (e) { /* 시작 못 하면 아래 board 없음으로 드러난다 */ }
    await page.wait(2400);
    /* ⚠️ 판이 곧바로 안 나오는 게임이 있다 — 윷은 시작 직후 '선 뽑기'(#game.orderphase) 동안
       `.board`가 display:none이라 rect가 0x0으로 잡힌다. 그대로 재면 판 크기 0으로 읽고
       "측정 실패"라며 ①을 조용히 건너뛴다 — **통과처럼 보이지만 아무것도 안 본 것이다.**
       그리고 그냥 기다려도 안 끝난다 — 선 뽑기는 사람이 던져야 넘어간다(14초 기다려도 그대로였다).
       → 판이 보일 때까지 '던지기'를 눌러 준다. 윷 던지기는 **꾹 눌렀다 떼는** 조작이라
         click()으로는 안 되고 mousedown → (게이지) → window의 mouseup이어야 한다
         (yut-drive.js가 쓰는 방식 그대로). */
    if (G.settle) {
      const ready = G.ready || `var e=document.querySelector(${JSON.stringify(G.board)});
        if(!e) return false; var r=e.getBoundingClientRect(); return r.width>4 && r.height>4;`;
      for (let i = 0; i < 30; i++) {
        const ok = await page.eval(ready).catch(() => false);
        if (ok) break;
        await page.eval(G.settle).catch(() => {});
        await page.wait(600);
      }
      /* 판이 뜬 **그 순간**은 아직 연출 중이다 — 윷은 선 뽑기 결과창(#orderReveal)이 잠깐 덮고
         말 트레이(#pieceTray)도 아직 8px로 접혀 있다. 그 찰나를 재면
         "던지기가 가려졌다"·"숨은 스크롤 53px" 같은 **연출이 원인인 가짜 경고**가 난다.
         가라앉을 때까지 한 번 더 기다린다. */
      await page.wait(2600);
    }
    return await page.eval(MEASURE(G.board, G.act));
  } finally { await page.close(); }
}

(async () => {
  await requireServer();   // 서버가 없으면 감사는 '전부 통과'로 거짓말을 한다 — cdp.js requireServer 주석 참고
  const cdp = await launchWithRetry();
  const rows = [];
  for (const G of LIST) {
    let port = null;
    try { port = await run(cdp, G, PORT); } catch (e) { port = { fail: e.message.slice(0, 60) }; }
    let portReal = null;
    try { portReal = await run(cdp, G, PORT_REAL); } catch (e) { portReal = { fail: e.message.slice(0, 60) }; }
    for (const V of LAND) {
      let m;
      try { m = await run(cdp, G, V); } catch (e) { m = { fail: e.message.slice(0, 80) }; }
      rows.push({ g: G.g, view: V.n, m, port, portReal });
    }
    const mine = rows.filter(r => r.g === G.g);
    console.log(`   ${G.g.padEnd(12)} ` + mine.map(r => {
      const m = r.m;
      if (m.fail) return `${r.view}:실패`;
      const bw = m.board ? `${m.board.w}x${m.board.h}` : '판?';
      return `${r.view} 판${bw} 폭${Math.round(m.usedW / m.vw * 100)}%`;
    }).join('  '));
  }

  const P = s => console.log(s);
  let bad = 0;

  P('\n════════ ① 판 크기: 판이 화면을 차지하는 비율이 세로만큼 되나 ════════');
  /* ⚠️ 면적을 그냥 비교하면 안 된다 — 360px 화면은 844px 화면보다 원래 작다.
        그래서 '판 면적 / 화면 면적'으로 정규화한 뒤 세로의 그 비율과 견준다.
        즉 "화면을 돌렸을 때 판이 화면을 덜 쓰게 되었나"를 묻는다.
        기준 70%: 고치기 전 실측이 바카라 20% · 알까기 54% · 원카드 53%였고,
        고친 뒤는 전부 74% 이상이다. 그 사이에 선을 둔다. */
  for (const G of LIST) {
    const mine = rows.filter(r => r.g === G.g);
    const p = mine[0] && mine[0].port;
    const pShare = (p && p.board) ? p.board.area / (p.vw * p.vh) : 0;
    if (!pShare) { P(`   ${G.g.padEnd(12)} 세로 판 측정 실패 — 판정 보류`); continue; }
    const rel = r => r.m.board ? (r.m.board.area / (r.m.vw * r.m.vh)) / pShare : null;
    const shrunk = mine.filter(r => rel(r) !== null && rel(r) < 0.70);
    const detail = mine.map(r => rel(r) === null ? `${r.view} ?`
      : `${r.view} ${Math.round(rel(r) * 100)}%`).join(' · ');
    if (shrunk.length) { bad++; P(`⚠️  ${G.g.padEnd(12)} ${detail}  (세로 판점유 ${Math.round(pShare * 100)}%)`); }
    else P(`✅ ${G.g.padEnd(12)} ${detail}`);
  }

  P('\n════════ ② 폭 낭비: 남는 가로 폭을 쓰고 있나 (80% 미만이면 경고) ════════');
  for (const G of LIST) {
    const mine = rows.filter(r => r.g === G.g);
    const w = mine.filter(r => r.m.usedW && r.m.usedW < r.m.vw * 0.8);
    if (!w.length) { P(`✅ ${G.g.padEnd(12)} 전 폭 OK`); continue; }
    bad++;
    P(`⚠️  ${G.g.padEnd(12)} ` + w.map(r => `${r.view} ${r.m.usedW}/${r.m.vw}(${Math.round(r.m.usedW / r.m.vw * 100)}%)`).join(' · '));
  }

  P('\n════════ ③ 잘림: overflow:hidden 밖으로 나가 영영 못 보는 것 ════════');
  for (const G of LIST) {
    const b = rows.filter(r => r.g === G.g && r.m.clipN);
    if (!b.length) { P(`✅ ${G.g.padEnd(12)} 전 폭 OK`); continue; }
    bad++;
    P(`⚠️  ${G.g.padEnd(12)} ` + b.map(r => `${r.view}(${r.m.clipN}건)`).join(' · '));
    b.slice(0, 2).forEach(r => r.m.clip.slice(0, 3).forEach(c => P(`      └ ${r.view}: ${c}`)));
  }

  P('\n════════ ④ 겹침: 읽어야 할 글자가 카드·주사위 위에 얹혔나 ════════');
  for (const G of LIST) {
    const b = rows.filter(r => r.g === G.g && r.m.ovlN);
    if (!b.length) { P(`✅ ${G.g.padEnd(12)} 전 폭 OK`); continue; }
    bad++;
    P(`⚠️  ${G.g.padEnd(12)} ` + b.map(r => `${r.view}(${r.m.ovlN}건)`).join(' · '));
    b.slice(0, 2).forEach(r => r.m.ovl.slice(0, 3).forEach(c => P(`      └ ${r.view}: ${c}`)));
  }

  P('\n════════ ⑤ 탭 타깃: 가로에서 40px 미만 (세로 44px의 절충) ════════');
  for (const G of LIST) {
    const b = rows.filter(r => r.g === G.g && r.m.smallN);
    if (!b.length) { P(`✅ ${G.g.padEnd(12)} 전 폭 OK`); continue; }
    P(`⚠️  ${G.g.padEnd(12)} ` + b.map(r => `${r.view}:${r.m.smallN}개`).join(' · ') + '  ' + (b[0].m.small || []).join(' | '));
  }

  P('\n════════ ⑥ 조작부: 주 조작 버튼이 화면 안이고 안 가려지나 ════════');
  for (const G of LIST) {
    const mine = rows.filter(r => r.g === G.g);
    const b = [];
    mine.forEach(r => (r.m.acts || []).forEach(a => {
      if (a.inView === false) b.push(`${r.view} ${a.sel} 화면밖(y=${a.y})`);
      else if (a.clickable === false) b.push(`${r.view} ${a.sel} 가려짐(${a.by})`);
    }));
    const found = mine.reduce((s, r) => s + ((r.m.acts || []).length), 0);
    if (!b.length) { P(`✅ ${G.g.padEnd(12)} ${found}개 지점 OK`); continue; }
    bad++;
    P(`⚠️  ${G.g.padEnd(12)} ` + b.slice(0, 4).join(' · '));
  }

  /* ⚠️ 세로도 함께 낸다 — 요트는 **가로가 더 나빴다**(실기기 748x384에서 274px · 384x748에서 155px).
        "가로만 문제"라고 넘겨짚으면 세로에 남은 것을 못 본다. */
  P(`\n════════ ⑦ 숨은 스크롤: 패널 안쪽 스크롤로 화면 밖에 남은 높이 (${HIDDEN_MIN}px 이상) ════════`);
  for (const G of LIST) {
    const mine = rows.filter(r => r.g === G.g);
    const p = mine[0] && mine[0].port;
    const hits = [];
    if (p && p.hiddenN) hits.push({ view: PORT.n + '(세로)', m: p });
    mine.forEach(r => { if (r.m.hiddenN) hits.push({ view: r.view, m: r.m }); });
    const pr = mine[0] && mine[0].portReal;
    const note = (pr && pr.hiddenN)
      ? `   [참고 ${PORT_REAL.n} 실기기세로 ${pr.hiddenMax}px — 합계 제외]` : '';
    if (!hits.length) { P(`✅ ${G.g.padEnd(12)} 숨은 패널 없음${note}`); continue; }
    bad++;
    P(`⚠️  ${G.g.padEnd(12)} ` + hits.map(h => `${h.view} ${h.m.hiddenMax}px`).join(' · ') + note);
    hits.slice(0, 4).forEach(h => h.m.hidden.slice(0, 2).forEach(x =>
      P(`      └ ${h.view}: ${x.t} 보임 ${x.vis} / 숨음 ${x.hid}px`)));
  }

  const errs = rows.filter(r => r.m.fail);
  if (errs.length) { P('\n════════ ⑧ 실패 ════════'); errs.forEach(r => P(`❌ ${r.g} ${r.view}: ${r.m.fail}`)); }

  P(`\n합계 경고 ${bad}건 (⑤ 탭 타깃은 참고용 — 합계에 안 넣는다)`);
  await cdp.close();
})();
