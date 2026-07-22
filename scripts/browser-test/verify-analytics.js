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
 */
const fs = require('fs');
const path = require('path');
const { CDP, URL, ensureServer, startGame, playTurn } = require('./yut-drive');
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

(async () => {
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
    /* ---- 5) 1판완료 배선 — 정적 단언 ----
     * Stats는 IIFE 스코프의 const라 브라우저에서 손댈 수 없다(yut-drive 주석과 같은 이유).
     * 그래서 '전적을 올리는 그 자리'에 훅이 붙어 있는지를 소스에서 단언한다.
     * 진짜 발화는 아래 --full 의 실제 한 판이 증명한다. */
    for (const g of GAMES) {
      const src = fs.readFileSync(path.join(__dirname, '../../public', g.slug + '.html'), 'utf8');
      // games++ 직전 120자 안에 AL.done이 있어야 한다 = '전적 1 증가'와 '1판완료 1건'이 같은 사건
      const m = src.match(/[\s\S]{0,120}\.(?:d|data)\.games\+\+/g) || [];
      const wired = m.length === 1 && /window\.AL&&AL\.done\(/.test(m[0]);
      check(`${g.name} — 1판완료 훅이 전적 증가 지점에 배선됨`, wired,
            wired ? 'AL.done → games++' : (m.length !== 1 ? `games++ ${m.length}곳 (1곳이어야 함)` : '훅 없음'));
    }
  } finally {
    await cdp.close();
  }

  // ---- 6) 실제 한 판 (--full) — 윷을 끝까지 돌려 1판완료가 진짜 발화하는지 본다 ----
  if (process.argv.includes('--full')) {
    console.log('\n── 실제 한 판 (윷놀이) ──');
    const cdp2 = await launchWithRetry();
    try {
      // startGame은 cdp를 받아 '판이 깔린 page'를 돌려준다 (newPage·goto·시작버튼까지 처리)
      const page = await startGame(cdp2);

      let turns = 0;
      const MAX = 220;   // 무한루프 방지. 윷 한 판은 보통 이 안에 끝난다.
      while (turns < MAX) {
        const done = alEvents(page).some(e => e.startsWith('1판완료'));
        if (done) break;
        await playTurn(page);
        turns++;
      }
      const ev = alEvents(page).filter(e => e.startsWith('1판완료'));
      check(`실제 한 판 — 1판완료 발화 (${turns}턴)`, ev.length >= 1 && ev[0].includes('윷놀이'),
            ev[0] || `${MAX}턴 안에 판이 끝나지 않음`);
      await page.close();
    } finally {
      await cdp2.close();
    }
  }

  const fail = results.filter(r => !r.ok);
  console.log(`\n${fail.length ? '❌' : '✓'} ${results.length - fail.length}/${results.length} 통과`);
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('실행 실패:', e); process.exit(1); });
