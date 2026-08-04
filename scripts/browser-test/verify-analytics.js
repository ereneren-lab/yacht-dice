/**
 * 계측 검증 — 퍼널 이벤트가 실제 브라우저에서 발화하는지 단언한다.
 *
 *   1) 모든 페이지에서 analytics.js가 로드되고 window.AL이 산다
 *   2) 허브 카드 클릭 → '허브_카드클릭'
 *   3) 판이 깔리면 → '게임시작'  (5종 전부: ingame 관찰 4종 + 요트 직접 호출)
 *   4) 판이 끝나면 → '1판완료'
 *   5) 계측 때문에 콘솔 예외가 늘지 않는다
 *
 * 로컬에선 Plausible이 이벤트를 무시하므로 analytics.js가 DEV 모드로 콘솔에 찍는다.
 * 이 스크립트는 그 '[AL] ...' 줄을 읽는다.
 *
 * 사용: node scripts/browser-test/verify-analytics.js   (서버는 알아서 띄운다)
 *
 * ⚠️ `--full`은 현재 미완성이다 (2026-07-22).
 * 윷을 몇 분 이상 돌리면 크로미움이 "CDP 소켓이 끊겼다"로 죽는다. 3회 연속 재현.
 * 브라우저 인스턴스를 하나만 쓰도록 고쳐도 동일 — 원인 미규명(장시간 CDP 세션 안정성 추정).
 * 그래서 여기서 `1판완료`는 정적 배선 단언(5번 블록)만 본다.
 * **실제 발화는 `npm run test:doneevent`가 13종 전부에서 이름까지 단언한다**(2026-07-29 신설).
 * 남은 확인은 하나 — 배포 후 Plausible 대시보드에 실제로 찍히는지 눈으로 볼 것.
 */
const fs = require('fs');
const path = require('path');
const { CDP, URL, ensureServer, startGame, playTurn, state } = require('./yut-drive');
const { launchWithRetry } = require('./cdp');

// yut-drive의 URL은 yut.html까지 포함한 전체 주소다. 우리는 다른 페이지도 열어야 하므로 origin만 뗀다.
const ORIGIN = URL.replace(/\/[^/]*$/, '');

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};

const alEvents = (page) => page.logs
  .filter(l => l.includes('[AL]'))
  .map(l => l.replace(/^\w+:\s*/, '').replace('[AL] ', ''));

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 각 게임을 '판이 깔린 상태'까지 밀어넣는다. 게임마다 시작 UI가 달라 개별로 둔다.
// 목적은 게임플레이 검증이 아니라 ingame 진입 신호 하나를 만드는 것이다.
const GAMES = [
  { slug: 'yut',   name: '윷놀이' },
  { slug: 'kb',    name: '너클본즈' },
  { slug: 'ld',    name: '라이어 다이스' },
  { slug: 'lcr',   name: '좌·중·우' },
  { slug: 'yacht', name: '요트 다이스' },
];

async function run() {
  await ensureServer();
  const cdp = await launchWithRetry();

  try {
    // ---- 1) 허브: AL 존재 + 카드 클릭 ----
    {
      const page = await cdp.newPage();
      await page.goto(ORIGIN + '/');
      await sleep(400);

      const hasAL = await page.eval('return typeof window.AL === "object" && typeof AL.ev === "function"');
      check('허브 — window.AL 로드됨', hasAL === true, String(hasAL));

      const noCookie = await page.eval('return document.cookie === ""');
      check('허브 — 계측이 쿠키를 굽지 않음', noCookie === true, 'document.cookie=' + JSON.stringify(await page.eval('return document.cookie')));

      await page.eval(`
        var a = document.querySelector('a.gcard[href="yacht.html"]');
        a.addEventListener('click', function(e){ e.preventDefault(); }, true);  // 이동은 막고 계측만 본다
        a.click();
        return true;
      `);
      await sleep(300);

      const ev = alEvents(page);
      const hit = ev.find(e => e.startsWith('허브_카드클릭'));
      check('허브 — 카드 클릭 이벤트', !!hit && hit.includes('요트'), hit || '이벤트 없음 / ' + JSON.stringify(ev));

      const privacyOK = await page.eval('return !!document.querySelector(\'a[href="privacy.html"]\')');
      check('허브 — 처리방침 링크 노출', privacyOK === true);

      const disguiseHint = await page.eval('return /위장 모드/.test(document.querySelector(\'a.gcard[href="yacht.html"]\').textContent)');
      check('허브 — 요트 카드에 위장 모드 힌트', disguiseHint === true);

      await page.close();
    }

    // ---- 2~4) 게임별: AL 로드 + 게임시작 + 1판완료 ----
    for (const g of GAMES) {
      const page = await cdp.newPage();
      await page.goto(`${ORIGIN}/${g.slug}.html`);
      await sleep(500);

      const hasAL = await page.eval('return typeof window.AL === "object"');
      check(`${g.name} — window.AL 로드됨`, hasAL === true);

      // 게임시작: body.ingame 관찰 경로(4종)와 요트 직접 호출 경로를 각각 실경로로 밀지 않고
      // 신호 자체를 만들어 배선을 검증한다. (게임별 시작 UI 조작은 별도 e2e의 몫)
      if (g.slug === 'yacht') {
        await page.eval('AL.start(); return true;');
      } else {
        await page.eval('document.body.classList.add("ingame"); return true;');
      }
      await sleep(250);

      let ev = alEvents(page);
      const started = ev.filter(e => e.startsWith('게임시작'));
      check(`${g.name} — 게임시작 발화`, started.length === 1 && started[0].includes(g.name),
            started[0] || '없음');

      // 멱등성: 로비 복귀 후 재진입해도 중복 집계되면 안 된다
      if (g.slug !== 'yacht') {
        await page.eval('document.body.classList.remove("ingame"); return true;');
        await sleep(100);
        await page.eval('document.body.classList.add("ingame"); return true;');
        await sleep(200);
      } else {
        await page.eval('AL.start(); return true;');
        await sleep(200);
      }
      ev = alEvents(page);
      check(`${g.name} — 게임시작 멱등(재진입 중복 없음)`,
            ev.filter(e => e.startsWith('게임시작')).length === 1,
            ev.filter(e => e.startsWith('게임시작')).length + '회');

      const errs = page.errors.filter(e => !/vibrate|AudioContext|plausible|ERR_/i.test(e));
      check(`${g.name} — 콘솔 예외 없음`, errs.length === 0, errs.slice(0, 2).join(' | '));

      await page.close();
    }
    /* ---- 5) 1판완료 배선 — 정적 단언 (발화처는 stats.js 한 곳이다) ----
     * Stats는 IIFE 스코프의 const라 브라우저에서 손댈 수 없다(yut-drive 주석과 같은 이유).
     * 그래서 '전적을 올리는 그 자리'에 훅이 붙어 있는지를 소스에서 단언한다.
     * 실제 발화는 `npm run test:doneevent`가 13종 전부에서 증명한다.
     *
     * ⚠️ 2026-08-04 이전엔 이 단언이 게임 HTML마다 AL.done을 찾았다. 그 사이 전적이
     *    stats.js(AS.record)로 통합되면서 **옛 5종 + 알까기가 AL.done을 두 번 부르고 있었다**
     *    (페이지에서 한 번, AS.record 안에서 또 한 번). 계측이 꺼져 있어 아무도 못 봤다.
     *    켰으면 그 6종만 완료 수가 2배 → 게임 간 퍼널 비교가 통째로 틀어진다.
     *    그래서 지금은 거꾸로 단언한다: **stats.js에만 있고, 게임 HTML엔 하나도 없어야 한다.** */
    {
      const stats = fs.readFileSync(path.join(__dirname, '../../public/stats.js'), 'utf8');
      // games++ 이후 400자 안(같은 record 함수 안)에 AL.done이 있어야 한다
      const seg = stats.match(/d\.games\+\+[\s\S]{0,400}/);
      const wired = !!seg && /AL\.done\(/.test(seg[0]) && (stats.match(/AL\.done\(/g) || []).length === 1;
      check('stats.js — 1판완료 훅이 전적 증가 지점에 1개', wired,
            wired ? 'AS.record: games++ → AL.done' : '훅 없음/중복');
    }
    for (const f of fs.readdirSync(path.join(__dirname, '../../public')).filter(f => f.endsWith('.html'))) {
      const src = fs.readFileSync(path.join(__dirname, '../../public', f), 'utf8');
      if (!/<script src="analytics\.js"/.test(src)) continue;
      const dup = (src.match(/AL\.done\(/g) || []).length;
      check(`${f} — 1판완료를 페이지에서 또 쏘지 않음`, dup === 0, dup ? `AL.done ${dup}곳 (중복 집계)` : '');

      /* 두 줄은 짝이다 — analytics.js만 있고 Plausible 스크립트가 없으면 이벤트는
         큐 스텁에만 쌓이고 어디로도 안 간다. 에러가 없어서 조용히 사라진다.
         실제로 8개 페이지가 그 상태로 들어와 있었다(2026-08-04에 발견). */
      const paired = /plausible\.io\/js\/script\.js/.test(src);
      check(`${f} — Plausible 스크립트가 analytics.js와 짝으로 있음`, paired, paired ? '' : 'Plausible 태그 없음');
    }
    /* ---- 6) 실제 한 판 (--full) — 윷을 끝까지 돌려 1판완료가 진짜 발화하는지 본다 ----
     * ⚠️ 브라우저를 새로 띄우지 말고 위의 cdp를 그대로 쓴다.
     * 앞 블록을 close()한 뒤 두 번째를 launch하면 같은 디버그 포트를 두고 경쟁해
     * 긴 게임 도중 "CDP 소켓이 끊겼다"로 죽는다 (실측: 두 번 연속). */
    if (process.argv.includes('--full')) {
      console.log('\n── 실제 한 판 (윷놀이) ──');
      // startGame은 cdp를 받아 '판이 깔린 page'를 돌려준다 (newPage·goto·시작버튼까지 처리)
      const page = await startGame(cdp);

      /* playTurn은 AI 차례엔 아무것도 안 하고 false를 반환한다.
         그걸 턴으로 세면 예산이 대기로만 소진된다 — 실제로 움직인 것만 센다. */
      let moves = 0, spins = 0;
      const DEADLINE = Date.now() + 8 * 60 * 1000;
      while (Date.now() < DEADLINE) {
        if (alEvents(page).some(e => e.startsWith('1판완료'))) break;
        const moved = await playTurn(page);
        if (moved) moves++; else spins++;
      }
      const ev = alEvents(page).filter(e => e.startsWith('1판완료'));
      const st = await state(page);
      check(`실제 한 판 — 1판완료 발화 (내 턴 ${moves}회 · 대기 ${spins}회)`,
            ev.length >= 1 && ev[0].includes('윷놀이'),
            ev[0] || `시간 내 미종료 (over=${st.over} throwable=${st.throwable} info="${st.info}")`);
      await page.close();
    }
  } finally {
    await cdp.close();
  }

  const fail = results.filter(r => !r.ok);
  console.log(`\n${fail.length ? '❌' : '✓'} ${results.length - fail.length}/${results.length} 통과`);
  return fail.length ? 1 : 0;
}

/* 이 환경은 메모리가 빠듯해 실행 도중 CDP 소켓이 조용히 끊긴다 → 1회 재시도.
   (verify-fx.js와 같은 패턴. 이 래퍼 없이 짰다가 3회 연속 죽었다 — CLAUDE.md 함정 #10) */
(async () => {
  try { process.exit(await run()); }
  catch (e) {
    console.error('실행 실패:', e.message.split('\n')[0], '— 재시도');
    results.length = 0;
    await new Promise(r => setTimeout(r, 4000));
    try { process.exit(await run()); }
    catch (e2) { console.error('실행 실패:', e2.message); process.exit(1); }
  }
})();
