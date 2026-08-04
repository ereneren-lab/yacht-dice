/**
 * 실기기 카드 연출 확인 — v1.245에서 "폰이 끊겨 눈으로 못 봤다"고 남긴 그 확인.
 *
 * 스크린샷으로는 못 잡는다. 유령 카드(.cfx-ghost)는 ~300ms 만에 사라져서
 * 찍는 순간을 맞추기 어렵고, 찍혀도 '움직였는지'는 정지 화면으로 판별이 안 된다.
 * → **DOM에 유령이 생겼다 사라지는 것**을 MutationObserver로 세고,
 *   그 사이 transform이 실제로 변했는지(=움직였는지)까지 본다.
 *
 * ⚠️ 이 게임들의 연출은 `prefers-reduced-motion:reduce`면 **일부러 즉시 도착**시킨다.
 *    그래서 기기의 접근성 설정(애니메이션 제거)을 먼저 읽고 함께 보고한다 —
 *    '연출이 안 보인다'와 '연출을 끈 기기다'는 다른 말이다.
 *
 * 사용: adb forward tcp:9223 localabstract:webview_devtools_remote_<pid> 뒤
 *       node scripts/phone/verify-cardfx.js
 */
const { attach } = require('./phone-cdp');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 유령을 감시한다 — 생성 시각·최초/최종 transform·수명을 기록 */
const WATCH = `
  window.__fx = { ghosts: [], reduced: null };
  try { window.__fx.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  (function () {
    if (window.__fxObs) window.__fxObs.disconnect();
    window.__fxObs = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        [].forEach.call(m.addedNodes, function (n) {
          /* 두 종류를 다 잡는다 — 원카드는 공용 CFX(.cfx-ghost)를 쓰지만
             도둑잡기는 자체 flyover()가 **클래스 없는 인라인 스타일 div**를 만든다. */
          if (!n.style) return;
          var isGhost = (n.classList && n.classList.contains('cfx-ghost')) ||
                        /will-change:\s*transform/.test(n.getAttribute('style') || '');
          if (!isGhost) return;
          var rec = { born: performance.now(), first: null, last: null, died: null };
          window.__fx.ghosts.push(rec);
          var t0 = performance.now();
          (function poll() {
            if (!n.isConnected) { rec.died = performance.now() - t0; return; }
            var tr = getComputedStyle(n).transform;
            if (rec.first === null) rec.first = tr;
            rec.last = tr;
            requestAnimationFrame(poll);
          })();
        });
      });
    });
    window.__fxObs.observe(document.body, { childList: true, subtree: false });
  })();
  return true;`;

/* 판을 깔고, 내 차례면 아무 카드나 눌러 본다.
   ⚠️ 손패 컨테이너는 `#myhand` — **소문자 h**다. `#myHand`로 쓰면 조용히 0개가 잡히고
      "연출이 안 뜬다"로 오진하게 된다(실제로 한 번 그렇게 나왔다). */
const PLAY = `
  var b = document.querySelector('#startBtn');
  if (b && !document.body.classList.contains('ingame')) { b.click(); return 'started'; }
  /* 도둑잡기는 **상대 패(#drawtray)를 눌러 뽑는다** — 내 손패를 눌러선 판이 굴러가지 않는다.
     이걸 몰라서 유령 0개가 나왔고, 하마터면 '연출이 안 돈다'로 오진할 뻔했다. */
  var c = document.querySelector('#drawtray .mc') ||
          document.querySelector('#myhand .mc:not(.dim):not(.back)') ||
          document.querySelector('#drawPileEl') ||
          document.querySelector('#drawSlot .mc') ||
          document.querySelector('.seat.target .fan .mc');
  if (c) { c.click(); return 'clicked'; }
  return 'wait';`;

(async () => {
  const p = await attach();
  const out = [];

  for (const g of ['onecard', 'oldmaid']) {
    await p.goto(`https://localhost/${g}.html`);
    await sleep(1200);
    await p.eval(WATCH);

    // 판을 깔고 몇 수 진행시킨다 — AI 차례에도 카드는 움직인다
    for (let i = 0; i < 14; i++) {
      try { await p.eval(PLAY); } catch (e) {}
      await sleep(900);
    }

    const fx = await p.eval('return JSON.stringify(window.__fx)');
    const data = JSON.parse(fx || '{}');
    const ghosts = data.ghosts || [];
    const moved = ghosts.filter(x => x.first && x.last && x.first !== x.last);
    out.push({ g, reduced: data.reduced, n: ghosts.length, moved: moved.length, life: ghosts.map(x => Math.round(x.died || 0)) });
  }

  console.log('=== 실기기 카드 연출 (유령 카드가 실제로 날았나) ===');
  for (const r of out) {
    const ok = r.reduced ? (r.n === 0) : (r.moved > 0);
    console.log(`${ok ? '✅' : '❌'} ${r.g.padEnd(9)} 모션제거=${r.reduced} · 유령 ${r.n}개 · 움직인 것 ${r.moved}개 · 수명(ms) ${r.life.slice(0, 6).join(',')}`);
    if (r.reduced) console.log('   ⚠️ 이 기기는 애니메이션 제거가 켜져 있다 — 즉시 도착이 정상 동작이다');
  }
  await p.close?.();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
