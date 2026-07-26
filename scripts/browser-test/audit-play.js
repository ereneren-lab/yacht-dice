/**
 * 전 게임 2차 감사 — 실제로 '시작'을 눌러 인게임까지 들어가서
 *  ① 인게임 콘솔 에러 ② 인게임 넘침(스크롤 없이 플레이 가능한가) ③ 프레임 끊김(렉) 을 잰다.
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/audit-play.js
 */
const { launchWithRetry } = require('./cdp');

const W = 390, H = 844;
const GAMES = [
  { g:'kb',          start:'#startBtn' },
  { g:'yut',         start:'#startBtn' },
  { g:'ld',          start:'#startBtn' },
  { g:'lcr',         start:'#startBtn' },
  { g:'yacht',       start:'#startLocal' },
  { g:'alkkagi',     start:'#startBtn' },
  { g:'seotda',      start:'#startBtn' },
  { g:'blackjack',   start:'#startBtn' },
  { g:'indianpoker', start:'#startBtn' },
  { g:'highlow',     start:'#startBtn' },
  { g:'oldmaid',     start:'#startBtn' },
  { g:'baccarat',    start:'#startBtn' },
  { g:'onecard',     start:'#startBtn' },
];

// rAF 간격을 모아 최악 프레임/끊김 횟수를 센다
const FPS_START = `window.__f=[];window.__last=performance.now();
  (function loop(){ var n=performance.now(); window.__f.push(n-window.__last); window.__last=n; window.__raf=requestAnimationFrame(loop); })(); return true;`;
const FPS_END = `cancelAnimationFrame(window.__raf); var f=window.__f.slice(2);
  f.sort(function(a,b){return b-a}); var worst=f[0]||0, jank=f.filter(function(x){return x>50}).length;
  return {worst:Math.round(worst), jank:jank, n:f.length};`;
const OVER = `var de=document.documentElement,b=document.body;
  return {h:Math.max(de.scrollWidth,b.scrollWidth)-window.innerWidth, v:Math.max(de.scrollHeight,b.scrollHeight)-window.innerHeight, ingame:b.classList.contains('ingame')};`;

(async () => {
  const cdp = await launchWithRetry();
  const out = [];
  for (const { g, start } of GAMES) {
    const page = await cdp.newPage(W, H);
    const rec = { g };
    try {
      await page.goto('http://localhost:3000/' + g + '.html');
      await page.wait(800);
      const before = page.errors.length;
      await page.eval(FPS_START);
      try { await page.click(start); } catch (e) { rec.startErr = e.message.slice(0, 80); }
      await page.wait(2600);
      rec.fps = await page.eval(FPS_END);
      rec.over = await page.eval(OVER);
      rec.errs = page.errors.slice(before).filter(e => !/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
    } catch (e) { rec.fail = e.message.slice(0, 120); }
    out.push(rec);
    const bad = (rec.errs && rec.errs.length) || rec.fail || rec.startErr;
    console.log(`${bad ? '❌' : (rec.over && rec.over.v > 0 ? '⚠️ ' : '✅')} ${g.padEnd(12)}` +
      (rec.fail ? ' 실패: ' + rec.fail : ` 넘침 v=${rec.over.v} h=${rec.over.h} · 최악프레임 ${rec.fps.worst}ms · 끊김(>50ms) ${rec.fps.jank}/${rec.fps.n}` + (rec.startErr ? ' · 시작클릭실패: ' + rec.startErr : '')));
    (rec.errs || []).slice(0, 3).forEach(e => console.log('     ‼ ' + e.slice(0, 220)));
    await page.close();
  }
  await cdp.close();
})();
