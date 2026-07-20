/**
 * 연출을 눈으로 보기 위한 캡처 도구. 연출은 수백 ms 만에 사라지므로 그냥 찍으면 못 잡는다.
 *
 *   node scripts/browser-test/capture.js hold     판 위 잔상을 페이드 중간 밝기로 고정해 한 장 (기본)
 *   node scripts/browser-test/capture.js film     이동 구간을 스크린캐스트해 4x4 몽타주
 *   node scripts/browser-test/capture.js alpha    색/농도 후보를 판 위에 늘어놓고 비교
 *
 * 결과는 scripts/browser-test/out/ 에 저장된다.
 */
const fs = require('fs');
const path = require('path');
const { CDP, ensureServer, startGame, throwYut, pickPiece, resolveDirection, state, restartIfOver } = require('./yut-drive');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

/** 잔상은 540ms 뒤 JS 타이머로 remove된다 → 생성 순간 복제본을 남겨 한 장에 담는다 */
const holdHook = (op) => `
  var layer = document.getElementById('fxLayer');
  new MutationObserver(function(muts){
    muts.forEach(function(m){
      Array.prototype.forEach.call(m.addedNodes, function(n){
        if (n.tagName !== 'circle' || n.getAttribute('data-clone')) return;
        if ((n.getAttribute('fill')||'').indexOf('90,66,40') < 0) return;
        var c = n.cloneNode(true);
        c.setAttribute('data-clone','1');
        c.style.transition = 'none';
        c.style.opacity = '${op}';
        layer.appendChild(c);
      });
    });
  }).observe(layer, { childList: true });
  return true;
`;

/** 잔상이 여러 개 생긴 이동을 만날 때까지 게임을 돌린다 (윷 결과가 랜덤이라 편차가 있다) */
async function playUntilTrails(page, min, onMove) {
  for (let i = 0; i < 400; i++) {
    const st = await state(page);
    if (await restartIfOver(page, st)) continue;
    if (!st.throwable) { await page.wait(500); continue; }

    await page.eval('window.__fx.trail=[]; return true;');
    await throwYut(page);
    await page.wait(1500);
    if (!(await page.eval("return document.querySelectorAll('#pieceLayer .pcpiece.mv').length"))) {
      await pickPiece(page);
      await page.wait(300); await resolveDirection(page); await page.wait(2400);
      continue;
    }
    await page.eval("document.querySelector('#pieceLayer .pcpiece.mv').onclick(); return true;");
    await page.wait(150);
    await resolveDirection(page);

    const extra = onMove ? await onMove(page) : (await page.wait(3000), null);
    const n = await page.eval('return window.__fx.trail.length');
    if (n >= min) return { n, extra };
    await page.wait(300);
  }
  return null;
}

async function cmdHold(cdp) {
  const page = await startGame(cdp, { hideOverlays: true });
  await page.eval(holdHook(0.6));   // 480ms 페이드의 중간 ≈ 생성 후 130ms 시점 밝기
  const r = await playUntilTrails(page, 3);
  if (!r) return console.log('잔상이 충분한 이동을 못 만났다 — 윷 결과가 랜덤이라 편차가 있다. 다시 실행할 것.');
  await page.shot(path.join(OUT, 'trail-hold.png'), '#board');
  console.log(`out/trail-hold.png — 잔상 ${r.n}개 (페이드 중간 밝기로 고정)`);
}

async function cmdFilm(cdp) {
  const page = await startGame(cdp, { width: 900, height: 900, hideOverlays: true });
  const r = await playUntilTrails(page, 3, async (p) => {
    const rect = await p.eval("var b=document.getElementById('board').getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height}");
    const frames = await p.record(3400);   // MOVE_PAUSE(1050ms) + 이동 전체
    return { rect, frames };
  });
  if (!r || !r.extra || r.extra.frames.length < 12) return console.log('녹화 실패');

  const { rect, frames } = r.extra;
  // 이동은 대기 뒤에 시작한다 → 전체에서 균등 추출
  const use = Array.from({ length: 16 }, (_, k) =>
    frames[Math.floor(k * (frames.length - 1) / 15)].toString('base64'));

  // 이 프로젝트의 ffmpeg(Playwright 빌드)엔 PNG 디코더가 없다 → 브라우저로 합성
  const mont = await cdp.newPage(1700, 1750);
  await mont.goto('about:blank');
  await mont.eval(`
    var imgs = ${JSON.stringify(use)}, R = ${JSON.stringify(rect)}, z = 0.61;
    document.body.style.cssText='margin:0;background:#222;display:grid;grid-template-columns:repeat(4,1fr);gap:6px';
    imgs.forEach(function(b64,i){
      var d=document.createElement('div');
      d.style.cssText='position:relative;overflow:hidden;height:'+(R.h*2*z)+'px';
      var im=new Image(); im.src='data:image/png;base64,'+b64;
      im.style.cssText='position:absolute;left:'+(-R.x*2*z)+'px;top:'+(-R.y*2*z)+'px;width:'+(1800*z)+'px';
      var n=document.createElement('span'); n.textContent=i;
      n.style.cssText='position:absolute;left:4px;top:2px;color:#ffcc66;font:700 15px sans-serif;z-index:2;text-shadow:0 0 4px #000';
      d.appendChild(im); d.appendChild(n); document.body.appendChild(d);
    });
    return true;
  `);
  await mont.wait(1200);
  await mont.shot(path.join(OUT, 'trail-film.png'));
  console.log(`out/trail-film.png — ${frames.length}프레임 중 16장 (잔상 ${r.n}개)`);
}

async function cmdAlpha(cdp) {
  const page = await startGame(cdp, { hideOverlays: true });
  await page.eval(`
    var NS='http://www.w3.org/2000/svg', layer=document.getElementById('fxLayer');
    [[150,120,80],[90,66,40]].forEach(function(c,ci){
      [.14,.22,.30,.40].forEach(function(a,ai){
        var x=110+ci*180, y=90+ai*70;
        var g=document.createElementNS(NS,'circle');
        g.setAttribute('cx',x); g.setAttribute('cy',y); g.setAttribute('r',5);
        g.setAttribute('fill','rgba('+c.join(',')+','+a+')');
        layer.appendChild(g);
        var t=document.createElementNS(NS,'text');
        t.setAttribute('x',x+12); t.setAttribute('y',y+4);
        t.setAttribute('font-size','11'); t.setAttribute('fill','#333');
        t.textContent='a='+a; layer.appendChild(t);
      });
    });
    return true;
  `);
  await page.shot(path.join(OUT, 'trail-alpha.png'), '#board');
  console.log('out/trail-alpha.png — 좌: 150,120,80 / 우: 90,66,40');
}

(async () => {
  const cmd = process.argv[2] || 'hold';
  const server = await ensureServer();
  const cdp = await new CDP().launch();
  try {
    if (cmd === 'hold') await cmdHold(cdp);
    else if (cmd === 'film') await cmdFilm(cdp);
    else if (cmd === 'alpha') await cmdAlpha(cdp);
    else console.log('알 수 없는 명령: ' + cmd + ' (hold | film | alpha)');
  } finally {
    await cdp.close();
    if (server) server.kill();
  }
})().catch(e => { console.error('실행 실패:', e.message); process.exit(1); });
