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
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/audit-landscape.js
 *       node scripts/browser-test/audit-landscape.js kb yacht     (일부만)
 */
const { launchWithRetry } = require('./cdp');

/* 높이 360~430이 진짜 어려운 구간이다(폰을 돌리면 여기로 떨어진다).
   1024x600은 '넓은 가로'라 압축 규칙(max-height:520px)이 안 걸리는 대조군이다. */
const LAND = [
  { n: '844x390', w: 844, h: 390 },
  { n: '740x360', w: 740, h: 360 },
  { n: '932x430', w: 932, h: 430 },
];
const PORT = { n: '390x844', w: 390, h: 844 };

/* board: 판(사람이 들여다보는 놀이면). act: 이 턴에 눌러야 하는 것들. */
const GAMES = [
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
    return await page.eval(MEASURE(G.board, G.act));
  } finally { await page.close(); }
}

(async () => {
  const cdp = await launchWithRetry();
  const rows = [];
  for (const G of LIST) {
    let port = null;
    try { port = await run(cdp, G, PORT); } catch (e) { port = { fail: e.message.slice(0, 60) }; }
    for (const V of LAND) {
      let m;
      try { m = await run(cdp, G, V); } catch (e) { m = { fail: e.message.slice(0, 80) }; }
      rows.push({ g: G.g, view: V.n, m, port });
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

  const errs = rows.filter(r => r.m.fail);
  if (errs.length) { P('\n════════ ⑦ 실패 ════════'); errs.forEach(r => P(`❌ ${r.g} ${r.view}: ${r.m.fail}`)); }

  P(`\n합계 경고 ${bad}건 (⑤ 탭 타깃은 참고용 — 합계에 안 넣는다)`);
  await cdp.close();
})();
