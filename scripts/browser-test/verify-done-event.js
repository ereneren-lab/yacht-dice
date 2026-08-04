/**
 * '1판완료' 계측이 **실제로 발화하는지** 확인한다.
 *
 * 왜 있나
 *   CLAUDE.md에 이렇게 남아 있었다:
 *     "1판완료은 정적 배선 단언까지만 검증됐다 — AL.done이 games++ 바로 앞에 있음은 보장되나
 *      실제 발화를 브라우저에서 보지는 못했다"
 *   '코드가 그 자리에 있다'와 '실행됐다'는 다른 말이다. 여기서 그 간극을 메운다.
 *
 * 어떻게 보나
 *   localhost에서는 Plausible이 이벤트를 버리므로 analytics.js가 콘솔에 `[AL] ...`을 찍는다.
 *   그 줄을 CDP 콘솔로 받아 단언한다.
 *
 * 사용: npm run test:doneevent   (서버는 알아서 띄운다)
 *   ⚠️ 서버가 없으면 페이지가 about:blank로 남아 13종 전부
 *      "SecurityError: localStorage"로 죽는다 — 계측 버그처럼 보이지만 아니다.
 */
const { launchWithRetry } = require('./cdp');
const { ensureServer } = require('./yut-drive');

/* 전적이 쌓이는 경로가 게임마다 다르다.
   AS.record(공통 전적)를 쓰는 게임은 그걸 부르면 되고,
   기존 5종은 각자 Stats.record를 쓴다 — 둘 다 시도한다. */
const GAMES = [
  { g: 'highlow', name: '하이로우', label: '하이로우' },
  { g: 'onecard', name: '원카드', label: '원카드' },
  { g: 'oldmaid', name: '도둑잡기', label: '도둑잡기' },
  { g: 'blackjack', name: '블랙잭', label: '블랙잭' },
  { g: 'baccarat', name: '바카라', label: '바카라' },
  { g: 'indianpoker', name: '인디언', label: '인디언 포커' },
  { g: 'seotda', name: '섯다', label: '섯다' },
  { g: 'alkkagi', name: '알까기', label: '알까기' },
  { g: 'kb', name: '너클본즈', label: '너클본즈' },
  { g: 'yacht', name: '요트', label: '요트 다이스' },
  { g: 'yut', name: '윷놀이', label: '윷놀이' },
  { g: 'ld', name: '라이어', label: '라이어 다이스' },
  { g: 'lcr', name: '좌중우', label: '좌·중·우' },
];

(async () => {
  await ensureServer();
  const cdp = await launchWithRetry();
  let fail = 0;

  console.log('\n════════ 1판완료 실제 발화 ════════');
  for (const G of GAMES) {
    const page = await cdp.newPage(384, 748);
    try {
      // cdp.js가 콘솔을 page.logs에 모아둔다 (Runtime.consoleAPICalled)
      await page.setMotion(true);
      await page.goto(`http://localhost:3000/${G.g}.html`);
      await page.eval('localStorage.clear(); sessionStorage.clear(); return 1');
      await page.goto(`http://localhost:3000/${G.g}.html`);
      await page.wait(1400);

      /* 계측은 2026-08-04부터 **켜져 있다**(그 전엔 전 페이지에서 주석 처리돼 있었다).
         켜져 있으면 아래는 'already'로 지나간다. 주입 경로는 남겨둔다 —
         `npm run analytics:off`로 다시 끄더라도 이 테스트는 배선을 계속 지켜야 하기 때문이다.
         ('배선이 깨졌다'와 '계측이 꺼져 있다'는 다른 말이다.) */
      const injected = await page.eval(`
        if(typeof AL!=='undefined') return 'already';
        var s=document.createElement('script'); s.src='analytics.js';
        document.head.appendChild(s);
        return 'injected';`);
      await page.wait(900);

      // 한 판이 끝난 것으로 만든다 — 전적 기록 경로를 직접 부른다
      const called = await page.eval(`
        // ⚠️ 최상위 let/const는 window에 없다 → typeof로 맨 이름 참조 (함정 #18)
        if(typeof AS!=='undefined' && AS.record){ AS.record('${G.g}', true, 10); return 'AS'; }
        if(typeof Stats!=='undefined' && Stats.record){ Stats.record('${G.g}', true, 10); return 'Stats'; }
        return 'none';`);
      await page.wait(700);

      const hit = (page.logs || []).filter(l => /\[AL\]/.test(l) && /1판완료/.test(l));
      /* 이름까지 본다 — analytics.js의 GAMES 표에 빠진 게임은 조용히 '허브'로 집계된다.
         계측 도입 이후 추가된 8종이 실제로 그 상태였다(2026-07-29). */
      const named = hit.some(l => l.indexOf('"게임":"' + G.label + '"') >= 0);
      const asHub = hit.some(l => l.indexOf('"게임":"허브"') >= 0);
      /* ⚠️ '1건 이상'이 아니라 **정확히 1건**이어야 한다.
         이 단언이 '>0'이던 동안, 옛 5종 + 알까기는 페이지와 AS.record에서 각각 쏴
         2건씩 나가고 있었는데도 통과했다(2026-08-04에 발견). 한 판은 한 건이다. */
      const ok = called !== 'none' && hit.length === 1 && named;
      if (!ok) fail++;
      console.log(`${ok ? '✅' : '❌'} ${G.name.padEnd(8)} 계측=${injected.padEnd(9)} 기록경로=${called.padEnd(6)} 발화=${hit.length}건${hit.length > 1 ? '(중복!)' : ''} 이름=${named ? G.label : (asHub ? '❌허브로 집계' : '❌없음')}`);
    } catch (e) {
      fail++; console.log(`❌ ${G.name} 예외 ${e.message.slice(0, 60)}`);
    }
    await page.close();
  }

  await cdp.close();
  console.log(fail ? `\n❌ ${fail}종 실패`
    : '\n✅ 13종 전부 1판완료가 판당 정확히 1건, 게임 이름까지 맞게 발화한다'
      + '\n   지금 상태는 `npm run analytics:status`로 확인할 것.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
