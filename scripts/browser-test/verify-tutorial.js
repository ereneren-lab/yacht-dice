/**
 * 공용 튜토리얼(tutorial.js) 검증.
 *   ① 스크립트가 실제로 로드됐나 (window.TUT 존재) — pace.js가 주석에 갇혀 안 떴던 전례가 있다
 *   ② 상단바에 📖 버튼이 달렸나
 *   ③ 첫 방문에 자동으로 뜨나
 *   ④ 다음/이전으로 단계가 넘어가고 점(dots)이 따라오나
 *   ⑤ 닫으면 사라지고, 재방문엔 자동으로 안 뜨나 (한 번 본 사람 방해 금지)
 *   ⑥ 기존 4종(kb·ld·lcr·seotda)의 자체 튜토리얼이 그대로 살아 있나
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/verify-tutorial.js
 */
const { launchWithRetry } = require('./cdp');

const NEW = ['yut', 'yacht', 'alkkagi', 'blackjack', 'baccarat', 'indianpoker', 'onecard', 'highlow', 'oldmaid'];
const LEGACY = [
  { g: 'kb', ov: '#tutOv' }, { g: 'ld', ov: '#tutOv' },
  { g: 'lcr', ov: '#tutOv' }, { g: 'seotda', ov: '#tutorialOv' }
];

let fails = 0;
const bad = m => { fails++; console.log('   ❌ ' + m); };

(async () => {
  const cdp = await launchWithRetry();

  for (const g of NEW) {
    const page = await cdp.newPage(390, 844);
    let line = '';
    try {
      await page.goto('http://localhost:3000/' + g + '.html');
      await page.wait(1200);   // 자동 오픈은 550ms 뒤

      // ① 로드 · ② 버튼 · ③ 자동 오픈
      const s1 = await page.eval(`return {
        tut: typeof window.TUT,
        steps: (window.TUT&&window.TUT._steps||[]).length,
        btn: !!document.getElementById('tutOpenBtn'),
        btnInBar: !!(document.querySelector('.topbar #tutOpenBtn, .kbtop #tutOpenBtn')),
        open: !!(document.getElementById('tutOverlay')||{}).classList&&document.getElementById('tutOverlay').classList.contains('on'),
        title: (document.getElementById('tutOT')||{}).textContent||'',
        body: ((document.getElementById('tutOB')||{}).innerHTML||'').length
      };`);
      if (s1.tut !== 'object') bad(`${g}: tutorial.js가 로드되지 않았다 (typeof TUT=${s1.tut})`);
      if (!s1.steps) bad(`${g}: 단계가 0개`);
      if (!s1.btn) bad(`${g}: 📖 버튼이 안 달렸다`);
      /* 2026-07-29: 첫 방문 자동 오픈을 **일부러** 없앴다.
         실측에서 첫 진입 시 튜토리얼·규칙 오버레이 2겹이 '시작' 버튼을 덮고 있었다(6/6 게임).
         보드게임은 한 판 해보는 게 설명보다 빠르다 → 판을 먼저 보여주고,
         규칙은 📖 버튼과 첫 판 종료 후 TUT.nudge()로 안내한다.
         그래서 여기서는 '안 뜨는 것'이 통과다. */
      if (s1.open) bad(`${g}: 첫 방문에 자동으로 떴다 — 시작 버튼을 덮는다`);

      // 📖 버튼으로 열리나 (자동 오픈을 없앤 대신 이 경로가 유일한 진입점이다)
      const s1b = await page.eval(`document.getElementById('tutOpenBtn').click();
        return { open: document.getElementById('tutOverlay').classList.contains('on'),
                 title: (document.getElementById('tutOT')||{}).textContent||'',
                 body: ((document.getElementById('tutOB')||{}).innerHTML||'').length };`);
      if (!s1b.open) bad(`${g}: 📖 버튼을 눌러도 안 열린다`);
      if (!s1b.title || s1b.body < 10) bad(`${g}: 첫 단계 내용이 비었다`);
      line = `단계 ${s1.steps} · 버튼${s1.btn ? (s1.btnInBar ? '(상단바)' : '(떠있음)') : '없음'} · 자동오픈 ${s1.open ? 'O(문제)' : 'X(의도)'} · 📖로 열림 ${s1b.open ? 'O' : 'X'}`;

      // ④ 단계 이동 + dots
      const s2 = await page.eval(`
        var t1=(document.getElementById('tutOT')||{}).textContent;
        document.getElementById('tutONext').click();
        var t2=(document.getElementById('tutOT')||{}).textContent;
        var onIdx=[].findIndex.call(document.querySelectorAll('#tutODots i'),function(x){return x.classList.contains('on')});
        var prevDisabled=document.getElementById('tutOPrev').disabled;
        document.getElementById('tutOPrev').click();
        var t3=(document.getElementById('tutOT')||{}).textContent;
        return {t1:t1,t2:t2,t3:t3,onIdx:onIdx,prevDisabledAt0:prevDisabled};`);
      if (s2.t1 === s2.t2) bad(`${g}: '다음'을 눌렀는데 단계가 안 바뀐다`);
      if (s2.onIdx !== 1) bad(`${g}: 두 번째 단계인데 점이 ${s2.onIdx}번째에 있다`);
      if (s2.t3 !== s2.t1) bad(`${g}: '이전'으로 안 돌아온다`);
      if (s2.prevDisabledAt0) bad(`${g}: 2단계에서도 '이전'이 잠겨 있다`);

      // 마지막 단계까지 넘기면 닫히나
      const s3 = await page.eval(`
        for(var i=0;i<30;i++){ var b=document.getElementById('tutONext'); if(!b) break;
          if(!document.getElementById('tutOverlay').classList.contains('on')) break; b.click(); }
        return { open: document.getElementById('tutOverlay').classList.contains('on'),
                 saved: (function(){try{return localStorage.getItem('alley_tut_${g}')}catch(e){return null}})() };`);
      if (s3.open) bad(`${g}: 끝까지 넘겼는데 안 닫힌다`);
      if (s3.saved !== '1') bad(`${g}: 봤다는 표시가 저장되지 않았다`);

      // ⑤ 재방문에도 자동으로 안 뜨기 (원래도 안 떴고, 이제는 첫 방문에도 안 뜬다)
      await page.goto('http://localhost:3000/' + g + '.html');
      await page.wait(1200);
      const s4 = await page.eval(`var o=document.getElementById('tutOverlay');
        return { open: !!o && o.classList.contains('on'), btn: !!document.getElementById('tutOpenBtn') };`);
      if (s4.open) bad(`${g}: 이미 본 사람인데 또 자동으로 떴다`);
      if (!s4.btn) bad(`${g}: 재방문 시 📖 버튼이 사라졌다`);

      // 버튼으로 다시 열리나
      const s5 = await page.eval(`document.getElementById('tutOpenBtn').click();
        return document.getElementById('tutOverlay').classList.contains('on');`);
      if (!s5) bad(`${g}: 📖 버튼으로 다시 열리지 않는다`);

      const errs = page.errors.filter(e => !/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
      if (errs.length) bad(`${g}: 콘솔 에러 — ${errs[0].slice(0, 140)}`);
    } catch (e) {
      bad(`${g}: 예외 — ${e.message.slice(0, 100)}`);
    }
    console.log(`${fails ? '  ' : '✅'} ${g.padEnd(12)} ${line}`);
    await page.close();
  }

  console.log('\n──── 기존 4종 자체 튜토리얼이 살아 있나 ────');
  for (const { g, ov } of LEGACY) {
    const page = await cdp.newPage(390, 844);
    try {
      await page.goto('http://localhost:3000/' + g + '.html');
      await page.wait(900);
      const r = await page.eval(`var e=document.querySelector('${ov}');
        return { exists: !!e, dupe: !!document.getElementById('tutOverlay') };`);
      if (!r.exists) bad(`${g}: 기존 튜토리얼(${ov})이 사라졌다`);
      if (r.dupe) bad(`${g}: 공용 튜토리얼이 중복으로 붙었다`);
      console.log(`${r.exists && !r.dupe ? '✅' : '  '} ${g.padEnd(12)} 기존 ${ov} ${r.exists ? '있음' : '없음'} · 공용 중복 ${r.dupe ? '있음' : '없음'}`);
    } catch (e) { bad(`${g}: 예외 — ${e.message.slice(0, 80)}`); }
    await page.close();
  }

  /* 첫 방문 자동 오픈을 없앤 대신 넣은 안내 — 첫 판이 끝나면 한 번만 권한다.
     '배선했다'와 '실제로 뜬다'는 다른 말이라 여기서 발화를 직접 확인한다.
     ⚠️ 전적 모듈의 전역 이름은 AS다(Stats가 아니다). 그리고 최상위 let/const는 window에 없으므로
        `typeof AS`로 맨 이름을 참조한다(함정 #18). */
  console.log('\n──── 첫 판 종료 후 규칙 권유(TUT.nudge) ────');
  {
    const page = await cdp.newPage(384, 748);
    try {
      await page.goto('http://localhost:3000/highlow.html');
      await page.eval(`localStorage.clear(); return 1`);
      await page.goto('http://localhost:3000/highlow.html');
      await page.wait(1200);

      const a = await page.eval(`
        if(typeof AS==='undefined') return {err:'AS 없음'};
        if(typeof TUT==='undefined') return {err:'TUT 없음'};
        AS.record('highlow', true, 100);
        var n=document.getElementById('tutNudge');
        var inView=false;
        if(n){var b=n.getBoundingClientRect(); inView=(b.top>=0&&b.bottom<=innerHeight&&b.height>10);}
        return {shown:!!n, inView:inView, games:AS.get('highlow').games};`);
      if (a.err) bad(`nudge: ${a.err}`);
      else {
        if (!a.shown) bad('nudge: 첫 판이 끝났는데 안 떴다');
        if (a.shown && !a.inView) bad('nudge: 떴는데 화면 밖이다');
      }

      const b2 = await page.eval(`
        var n=document.getElementById('tutNudge'); if(n)n.remove();
        AS.record('highlow', false, 50);
        return {again:!!document.getElementById('tutNudge')};`);
      if (b2.again) bad('nudge: 두 번째 판에도 또 떴다');

      const c = await page.eval(`
        var n=document.getElementById('tutNudge'); if(n)n.remove();
        localStorage.removeItem('alley_tutnudge_highlow');
        localStorage.setItem('alley_tut_highlow','1');            // 이미 튜토리얼을 본 사람
        var db=JSON.parse(localStorage.getItem('alley_stats')||'{}'); db.highlow.games=0;
        localStorage.setItem('alley_stats',JSON.stringify(db));
        AS.record('highlow', true, 10);
        return {shown:!!document.getElementById('tutNudge')};`);
      if (c.shown) bad('nudge: 이미 튜토리얼을 본 사람에게도 떴다');

      console.log(`${a.shown && a.inView && !b2.again && !c.shown ? '✅' : '  '} highlow      첫 판 뒤 뜸 ${a.shown ? 'O' : 'X'} · 화면안 ${a.inView ? 'O' : 'X'} · 두 번째 판 ${b2.again ? '또 뜸(문제)' : '안 뜸'} · 이미 본 사람 ${c.shown ? '뜸(문제)' : '안 뜸'}`);
    } catch (e) { bad(`nudge: 예외 — ${e.message.slice(0, 80)}`); }
    await page.close();
  }

  await cdp.close();
  console.log(fails ? `\n❌ 실패 ${fails}건` : '\n✅ 튜토리얼 13종 + 첫 판 후 권유 전부 통과');
  process.exit(fails ? 1 : 0);
})();
