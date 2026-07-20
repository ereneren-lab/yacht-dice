/**
 * 윷 연출 자동 검증 — 실제 브라우저에서 게임을 돌리며 단언한다.
 *   1) 이동 잔상이 '출발칸'에도 남는가 (1칸 이동에서도 최소 1개)
 *   2) prefers-reduced-motion에서 완전히 생략되는가
 *   3) 콘솔 예외 0
 * 페이드 opacity 추이는 타이밍에 흔들려 단언하지 않고 수치만 보고한다.
 *
 * 사용: node scripts/browser-test/verify-fx.js   (서버는 안 떠 있으면 알아서 띄운다)
 */
const { CDP, ensureServer, startGame, throwYut, pickPiece, resolveDirection, state, restartIfOver } = require('./yut-drive');

const OPACITY_PROBE = `
  window.__op = [];
  var layer = document.getElementById('fxLayer');
  new MutationObserver(function(muts){
    muts.forEach(function(m){
      Array.prototype.forEach.call(m.addedNodes, function(n){
        if (n.tagName !== 'circle') return;
        if ((n.getAttribute('fill')||'').indexOf('90,66,40') < 0) return;
        var rec = { samples: [] };
        window.__op.push(rec);
        [0, 80, 160, 300, 450].forEach(function(ms){
          setTimeout(function(){
            rec.samples.push([ms, n.isConnected ? +getComputedStyle(n).opacity : -1]);
          }, ms);
        });
      });
    });
  }).observe(layer, { childList: true });
  return true;
`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}
/** 표본을 못 모은 건 '실패'가 아니라 '판정 못 함'이다 — 둘을 뭉뚱그리면 신호가 죽는다 */
function skip(name, detail) {
  results.push({ name, skipped: true, detail });
  console.log(`⚠️  ${name} — 판정 불가: ${detail}`);
}

(async () => {
  const server = await ensureServer();
  const cdp = await new CDP().launch();

  // ── 1·2) 모션 켠 상태: 출발칸 잔상 + 페이드 ────────────────────────
  const page = await startGame(cdp, { motion: true });
  await page.eval(OPACITY_PROBE);

  const rows = [];
  for (let i = 0; i < 160 && rows.length < 4; i++) {
    const st = await state(page);
    if (await restartIfOver(page, st)) continue;
    if (!st.throwable) { await page.wait(500); continue; }

    await page.eval('window.__fx.trail=[]; return true;');
    await throwYut(page);
    await page.wait(1500);

    // 판 위 말만 계측(출발 좌표가 명확). 없으면 트레이 말로 게임만 진행
    const before = await page.eval(`
      var g = document.querySelector('#pieceLayer .pcpiece.mv');
      if (!g) return null;
      var m = /translate\\(\\s*(-?[\\d.]+)[ ,]+(-?[\\d.]+)/.exec(g.getAttribute('transform')||'');
      if (!m) return null;
      var xy = [+m[1], +m[2]];
      g.onclick();
      return xy;
    `);
    if (!before) {
      await pickPiece(page);
      await page.wait(300); await resolveDirection(page); await page.wait(2400);
      continue;
    }
    await page.wait(250); await resolveDirection(page); await page.wait(2600);

    const trail = await page.eval('return window.__fx.trail.map(function(r){return [r.cx, r.cy]})');
    if (!trail.length) { rows.push({ ok: false, n: 0 }); continue; }
    // '첫' 잔상으로 단정하면 안 된다 — 대기 중 다음 턴 연출이 겹치면 남의 잔상이 섞인다.
    // 확인하려는 건 '출발 칸에 자취가 남는가'이므로 하나라도 맞으면 통과.
    // 잔상은 cy에 +4 오프셋, 업힌 말은 칸 중심에서 ±13*(N-1)/2 만큼 벌어져 있어 그만큼 허용한다.
    const ok = trail.some(t => Math.abs(t[0] - before[0]) <= 20 && Math.abs(t[1] - (before[1] + 4)) <= 20);
    rows.push({ ok, n: trail.length, before });
    if (!ok) console.log(`   ↳ 불일치: 말(${before}) 출발칸에 잔상 없음. 생성된 잔상=${JSON.stringify(trail)}`);
  }

  const sampled = rows.filter(r => r.n > 0);
  if (!sampled.length) {
    skip('출발칸 잔상 (이동 시작 지점에도 자취)', '판 위 이동 표본을 못 모았다 (재실행할 것)');
    skip('모든 이동에 잔상 1개 이상 (1칸 이동 포함)', '동일');
  } else {
    check('출발칸 잔상 (이동 시작 지점에도 자취)',
      sampled.every(r => r.ok),
      `표본 ${sampled.length}건 / 일치 ${sampled.filter(r => r.ok).length}건`);
    check('모든 이동에 잔상 1개 이상 (1칸 이동 포함)',
      sampled.every(r => r.n >= 1),
      `이동당 잔상 최소 ${Math.min(...sampled.map(r => r.n))}개`);
  }

  // 페이드는 '단언'하지 않고 '보고'만 한다.
  // setTimeout 지터 + 측정 시점에 노드가 이미 remove된 표본이 섞여 결과가 실행마다 흔들린다.
  // 플래키한 단언은 없느니만 못하므로 수치만 남기고 판단은 사람이 한다.
  const op = await page.eval('return window.__op.slice(-3)');
  const line = op.length
    ? op.map(r => r.samples.map(s => `${s[0]}ms=${s[1] < 0 ? 'x' : s[1].toFixed(2)}`).join(' ')).join('  |  ')
    : '표본 없음';
  console.log(`ℹ️  잔상 opacity 추이 (x=이미 제거됨) — ${line}`);
  check('콘솔 예외 없음 (모션 ON)', page.errors.length === 0, page.errors.slice(0, 2).join(' | '));

  // ── 3) reduced-motion: 연출 전량 생략 ──────────────────────────────
  const rp = await startGame(cdp, { motion: false });
  let moves = 0, trails = 0;
  for (let i = 0; i < 120 && moves < 5; i++) {
    const st = await state(rp);
    if (await restartIfOver(rp, st)) continue;
    if (!st.throwable) { await rp.wait(400); continue; }
    await rp.eval('window.__fx.trail=[]; return true;');
    await throwYut(rp);
    await rp.wait(900);
    if (!(await pickPiece(rp))) continue;
    await rp.wait(200); await resolveDirection(rp); await rp.wait(1200);
    moves++; trails += await rp.eval('return window.__fx.trail.length');
  }
  check('reduced-motion에서 잔상 생략', trails === 0, `이동 ${moves}회 / 잔상 ${trails}개`);
  check('콘솔 예외 없음 (reduced-motion)', rp.errors.length === 0, rp.errors.slice(0, 2).join(' | '));

  await cdp.close();
  if (server) server.kill();
  const failed = results.filter(r => !r.skipped && !r.ok);
  const skipped = results.filter(r => r.skipped);
  console.log(failed.length
    ? `\n실패 ${failed.length}건${skipped.length ? ` (판정 불가 ${skipped.length}건)` : ''}`
    : skipped.length
      ? `\n실패 없음 — 다만 판정 불가 ${skipped.length}건, 재실행 권장`
      : '\n전부 통과');
  process.exit(failed.length ? 1 : skipped.length ? 2 : 0);
})().catch(e => { console.error('실행 실패:', e.message); process.exit(1); });
