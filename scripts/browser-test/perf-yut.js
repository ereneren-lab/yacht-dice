#!/usr/bin/env node
/**
 * 윷놀이 성능 계측 — "렉이 있다/없다"가 아니라 **어느 순간에 몇 ms인지**를 낸다.
 *
 *   node scripts/browser-test/perf-yut.js                 # 기본(CPU 4배 감속 = 저사양 폰 흉내)
 *   node scripts/browser-test/perf-yut.js --cpu=1         # 감속 없이
 *   node scripts/browser-test/perf-yut.js --variant=nograin,noshadow
 *   node scripts/browser-test/perf-yut.js --json=out/perf.json
 *
 * ⚠️ 함정 7 — 헤드리스는 prefers-reduced-motion:reduce가 기본이라 연출이 통째로 생략된 채 돈다.
 *    page.setMotion(true)로 반드시 켜고 잰다. 안 켜면 "렉 없음"이라는 거짓 결론이 나온다.
 * ⚠️ 데스크톱은 폰보다 훨씬 빠르다 → --cpu=4 로 감속해 저사양 기기 쪽으로 당겨서 본다.
 *    그래도 실기기가 진짜 답이다(scripts/phone/perf-yut-phone.js).
 *
 * 구간을 나눠 재는 이유: 렉은 "게임이 느리다"가 아니라 특정 순간에 몰린다.
 *   idle(아무것도 안 할 때) / throw(윷 던지기) / move(말 이동) / ai(상대 턴)
 */
const { launchWithRetry } = require('./cdp');
const { URL, ensureServer, throwYut, pickPiece, resolveDirection, state, restartIfOver } = require('./yut-drive');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const argv = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const CPU = +(argv('cpu') || 4);
const VARIANTS = (argv('variant') || '').split(',').map(s => s.trim()).filter(Boolean);
const JSON_OUT = argv('json');
const W = +(argv('w') || 384), H = +(argv('h') || 748);   // 실기기 앱 웹뷰 실측 뷰포트

/* ── 프레임 수집 ─────────────────────────────────────────────
   rAF 간격을 모은다. 60Hz면 16.7ms가 정상. 그 이상이 '프레임을 놓친 것'.
   audit-play.js의 FPS_START/FPS_END와 같은 방식이되, 백분위와 놓친 프레임 수를 더 낸다. */
const SAMPLE_START = `
  window.__pf = []; window.__pl = performance.now();
  (function loop(){ var n=performance.now(); window.__pf.push(n-window.__pl); window.__pl=n;
    window.__praf = requestAnimationFrame(loop); })();
  return true;`;
const SAMPLE_END = `
  cancelAnimationFrame(window.__praf);
  var f = (window.__pf||[]).slice(2);           // 시작 두 프레임은 계측 자체의 워밍업
  if (!f.length) return null;
  var s = f.slice().sort(function(a,b){return a-b});
  var q = function(p){ return s[Math.min(s.length-1, Math.floor(s.length*p))]; };
  var sum = f.reduce(function(a,b){return a+b},0);
  return {
    n: f.length,
    ms: Math.round(sum),
    fps: +(f.length/(sum/1000)).toFixed(1),
    p50: +q(.50).toFixed(1), p95: +q(.95).toFixed(1),
    worst: +s[s.length-1].toFixed(1),
    jank: f.filter(function(x){return x>50}).length,      // 눈에 보이는 끊김
    slow: f.filter(function(x){return x>33}).length       // 30fps 미만으로 떨어진 프레임
  };`;

/* ── 원인 분리용 변종 ────────────────────────────────────────
   "느리다"의 원인을 지목하려면 하나씩 꺼보고 숫자가 어떻게 변하는지 봐야 한다. */
const VARIANT_JS = {
  // 나무결 노이즈(feTurbulence) 제거 — SVG 안이 한 번이라도 다시 그려지면 이게 같이 재계산된다
  nograin: `document.querySelectorAll('#boardLayer rect[filter*="woodgrain"]').forEach(function(e){e.remove()}); return true;`,
  // 노드 30개에 걸린 feDropShadow 제거
  nonodeshadow: `document.querySelectorAll('#boardLayer circle[filter*="nodesh"]').forEach(function(e){e.removeAttribute('filter')}); return true;`,
  // 말마다 걸린 feDropShadow 제거
  noshadow: `var st=document.createElement('style'); st.textContent='#pieceLayer .ring{filter:none !important}'; document.head.appendChild(st); return true;`,
  // 상시 도는 CSS 애니메이션(숨쉬기·선두광·반짝임·이동가능 펄스) 정지
  noidleanim: `var st=document.createElement('style'); st.textContent=
      '#pieceLayer .pcpiece .pcbody,#pieceLayer .pcpiece.mv .pcbody,#pieceLayer .pcpiece.lead .pclead,#pieceLayer .pcpiece.mv .ring,#twinkleG circle{animation:none !important}';
    document.head.appendChild(st); return true;`,
};

/** Performance.getMetrics 델타 — 프레임이 왜 늦었는지(스크립트/스타일/레이아웃) 가른다 */
async function metrics(page) {
  const { metrics: m } = await page.s('Performance.getMetrics');
  const o = {}; m.forEach(x => o[x.name] = x.value); return o;
}
function mdiff(a, b) {
  const k = ['ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration', 'LayoutCount', 'RecalcStyleCount'];
  const o = {}; k.forEach(n => { o[n] = +(((b[n] || 0) - (a[n] || 0))).toFixed(3); }); return o;
}

async function measure(page, label, ms, during) {
  const m0 = await metrics(page);
  await page.eval(SAMPLE_START);
  const t0 = Date.now();
  if (during) await during();
  const left = ms - (Date.now() - t0);
  if (left > 0) await page.wait(left);
  const r = await page.eval(SAMPLE_END);
  const m1 = await metrics(page);
  return r ? { label, ...r, cpu: mdiff(m0, m1) } : { label, empty: true };
}

/** 판이 깔릴 때까지 — 첫 방문 오버레이(함정 15)를 먼저 치운다 */
async function boot(cdp) {
  const page = await cdp.newPage(W, H);
  await page.setMotion(true);                      // ⚠️ 함정 7
  await page.s('Performance.enable');
  if (CPU > 1) await page.s('Emulation.setCPUThrottlingRate', { rate: CPU });
  await page.goto(URL);
  await page.eval(`try{TUT&&TUT.close&&TUT.close()}catch(e){}
    ['helpClose','rulesClose'].forEach(function(id){var b=document.getElementById(id); if(b)b.click();});
    return true;`);
  await page.click('#startBtn');
  await page.wait(7000);                           // VS 인트로가 판을 가린다
  return page;
}

/** 말이 판 위에 여러 개 있는 '중반' 상태를 만든다 — 빈 판에서 잰 숫자는 실제 플레이가 아니다 */
async function warmup(page, turns) {
  let played = 0;
  for (let i = 0; i < turns * 4 && played < turns; i++) {
    const st = await state(page);
    if (await restartIfOver(page, st)) continue;
    if (!st.throwable) { await page.wait(400); continue; }
    await throwYut(page);
    await page.wait(1400);
    if (await pickPiece(page)) { await page.wait(250); await resolveDirection(page); played++; }
    await page.wait(1800);
  }
  return played;
}

async function run() {
  const server = await ensureServer();
  const cdp = await launchWithRetry();
  const out = { url: URL, viewport: W + 'x' + H, cpuThrottle: CPU, variants: VARIANTS, at: new Date().toISOString(), phases: [] };
  try {
    const page = await boot(cdp);
    const played = await warmup(page, 6);
    for (const v of VARIANTS) {
      if (!VARIANT_JS[v]) throw new Error('모르는 변종: ' + v + ' (' + Object.keys(VARIANT_JS).join(',') + ')');
      await page.eval(VARIANT_JS[v]);
    }
    out.warmupTurns = played;
    out.pieces = await page.eval(`return document.querySelectorAll('#pieceLayer .pcpiece').length;`);
    out.svgNodes = await page.eval(`return document.getElementById('board').getElementsByTagName('*').length;`);

    // ① idle — 아무 조작 없이. 상시 애니메이션만 도는 상태의 바닥 비용.
    out.phases.push(await measure(page, 'idle', 3000));

    // ② throw — 윷 던지기(게이지 → 토스 → 결과 오버레이)
    out.phases.push(await measure(page, 'throw', 2600, async () => {
      const st = await state(page);
      if (!st.throwable) { await page.wait(600); return; }
      await throwYut(page);
    }));

    // ③ move — 말 이동 슬라이드(잔상·먼지 포함)
    out.phases.push(await measure(page, 'move', 3000, async () => {
      const p = await pickPiece(page);
      if (p) { await page.wait(250); await resolveDirection(page); }
    }));

    // ④ ai — 상대(AI) 턴이 도는 동안
    out.phases.push(await measure(page, 'ai', 3000));

    out.errors = page.errors.slice(0, 5);
    await page.close();
  } finally {
    await cdp.close();
    if (server) try { server.kill('SIGKILL'); } catch (e) {}
  }

  const tag = VARIANTS.length ? VARIANTS.join('+') : 'baseline';
  console.log(`\n윷놀이 성능 — ${out.viewport} · CPU ${CPU}x 감속 · 변종 [${tag}]`);
  console.log(`  판 위 말 ${out.pieces}개 · SVG 요소 ${out.svgNodes}개 · 워밍업 ${out.warmupTurns}턴`);
  console.log('  구간      fps   p50    p95   최악   >33ms  >50ms   script  layout  style');
  for (const p of out.phases) {
    if (p.empty) { console.log(`  ${p.label.padEnd(8)} (표본 없음)`); continue; }
    const c = p.cpu;
    console.log(`  ${p.label.padEnd(8)} ${String(p.fps).padStart(5)} ${String(p.p50).padStart(6)} ${String(p.p95).padStart(6)} ${String(p.worst).padStart(6)} ${String(p.slow).padStart(6)} ${String(p.jank).padStart(6)}   ${c.ScriptDuration.toFixed(2).padStart(6)}  ${c.LayoutDuration.toFixed(2).padStart(6)}  ${c.RecalcStyleDuration.toFixed(2).padStart(5)}`);
  }
  if (out.errors && out.errors.length) console.log('  ⚠️ 페이지 에러:', out.errors.join(' | '));
  if (JSON_OUT) { fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true }); fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2)); console.log('  → ' + JSON_OUT); }
  return out;
}

run().catch(e => { console.error('실패:', e.message); process.exit(1); });
