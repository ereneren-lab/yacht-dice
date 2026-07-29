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
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/verify-done-event.js
 */
const { launchWithRetry } = require('./cdp');

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

      /* ⚠️ analytics.js는 지금 **전 페이지에서 주석 처리**되어 있다.
         2026-07-22 '계측 보류' 결정으로 로딩만 꺼둔 상태다(호출부와 파일은 그대로).
         그래서 그냥 두고 재면 당연히 0건이 나온다 — 그건 '배선이 깨졌다'가 아니라
         '계측이 꺼져 있다'는 뜻이다. 둘을 구분해야 한다.
         여기서는 **테스트에서만** analytics.js를 주입해 배선이 살아 있는지 확인한다.
         제품 설정(보류)은 건드리지 않는다. */
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
      const ok = called !== 'none' && hit.length > 0 && named;
      if (!ok) fail++;
      console.log(`${ok ? '✅' : '❌'} ${G.name.padEnd(8)} 계측=${injected.padEnd(9)} 기록경로=${called.padEnd(6)} 발화=${hit.length}건 이름=${named ? G.label : (asHub ? '❌허브로 집계' : '❌없음')}`);
    } catch (e) {
      fail++; console.log(`❌ ${G.name} 예외 ${e.message.slice(0, 60)}`);
    }
    await page.close();
  }

  await cdp.close();
  console.log(fail ? `\n❌ ${fail}종 실패`
    : '\n✅ 1판완료 배선이 살아 있다 — 계측을 켜면 실제로 발화한다 (콘솔에서 확인)'
      + '\n   ⚠️ 단, 지금 제품은 계측 보류 상태다(analytics.js 주석). 켜기 전엔 대시보드에 안 찍힌다.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
