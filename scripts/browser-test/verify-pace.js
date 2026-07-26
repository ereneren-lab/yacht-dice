/**
 * 공통 진행 속도(pace.js) 검증 — 13게임 전부에서
 *  ① PMS/PACE 로드 ② 상단바 버튼 장착·가시 ③ 클릭하면 모드 순환+저장 ④ 배수 적용
 */
const { launchWithRetry } = require('./cdp');
const GAMES = ['kb','yut','ld','lcr','yacht','alkkagi','seotda','blackjack','indianpoker','highlow','oldmaid','baccarat','onecard'];
(async () => {
  const cdp = await launchWithRetry();
  let bad = 0;
  for (const g of GAMES) {
    const page = await cdp.newPage(390, 844);
    try {
      await page.goto('http://localhost:3000/' + g + '.html');
      await page.wait(500);
      const r = await page.eval(`
        var b=document.getElementById('paceBtn');
        var vis=false, size=null;
        if(b){ var rc=b.getBoundingClientRect(); vis=rc.width>0&&rc.height>0; size=Math.round(rc.width)+'x'+Math.round(rc.height); }
        var okFn = typeof window.PMS==='function' && !!window.PACE;
        var before = window.PACE && PACE.mode();
        var slowMs = null, fastMs = null;
        if(okFn){ PACE.set('slow'); slowMs=PMS(1000); PACE.set('fast'); fastMs=PMS(1000); PACE.set(before); }
        var cyc = null;
        if(b){ b.click(); cyc = localStorage.getItem('alley_pace'); PACE.set(before); }
        return {btn:!!b, vis:vis, size:size, okFn:okFn, slowMs:slowMs, fastMs:fastMs, cyc:cyc, icon:b?b.textContent:null};
      `);
      const ok = r.btn && r.vis && r.okFn && r.slowMs === 2100 && r.fastMs === 650 && r.cyc;
      if (!ok) bad++;
      console.log(`${ok ? '✅' : '❌'} ${g.padEnd(12)} 버튼${r.btn ? '✓' : '✗'}(${r.size||'-'} ${r.icon||''}) PMS${r.okFn ? '✓' : '✗'} 느긋=${r.slowMs}ms 빠름=${r.fastMs}ms 클릭후=${r.cyc}`);
      const errs = page.errors.filter(e => !/favicon|vibrate|plausible|net::/i.test(e));
      errs.slice(0,2).forEach(e => { bad++; console.log('     ‼ ' + e.slice(0,180)); });
    } catch (e) { bad++; console.log(`❌ ${g} 실행실패: ${e.message.slice(0,120)}`); }
    await page.close();
  }
  await cdp.close();
  console.log(bad ? `\n❌ 문제 ${bad}건` : '\n✓ 13게임 전부 진행 속도 조절 가능');
  process.exit(bad ? 1 : 0);
})();
