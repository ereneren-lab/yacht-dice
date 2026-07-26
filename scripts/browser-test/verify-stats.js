/**
 * 공통 전적(stats.js) 검증 — 7종에서 판이 끝나면 전적이 실제로 쌓이는가.
 * 각 게임의 실제 종료 함수(endGame/showResult)를 호출해 호출부까지 같이 검증한다.
 */
const { launchWithRetry } = require('./cdp');
const CASES = [
  { g:'blackjack',   call:'endGame(true)',  win:true },
  { g:'baccarat',    call:'endGame(true)',  win:true },
  { g:'highlow',     call:'endGame(false)', win:false },
  { g:'indianpoker', call:'endGame()',      win:null },
  { g:'oldmaid',     call:'endGame()',      win:null },
  { g:'onecard',     call:'(ST.winner=MYSEAT,endGame())', fn:'endGame', win:null },
  { g:'seotda',      call:'showResult()',   win:null },
];
(async () => {
  const cdp = await launchWithRetry();
  let bad = 0;
  for (const c of CASES) {
    const page = await cdp.newPage(390, 844);
    try {
      await page.goto('http://localhost:3000/' + c.g + '.html');
      await page.wait(400);
      await page.click('#startBtn').catch(()=>{});
      await page.wait(1200);
      const r = await page.eval(`
        localStorage.removeItem('alley_stats');
        var hasAS = !!window.AS, fn = typeof window[${JSON.stringify((c.fn)||c.call.split("(")[0])}];
        try{ ${c.call}; }catch(e){ return {hasAS:hasAS, fn:fn, err:String(e).slice(0,120)}; }
        var db = JSON.parse(localStorage.getItem('alley_stats')||'{}');
        var body = document.getElementById('resBody');
        return {hasAS:hasAS, fn:fn, rec:db[${JSON.stringify(c.g)}]||null,
                lineShown: !!(body && body.querySelector('.as-line')),
                lineText: body && body.querySelector('.as-line') ? body.querySelector('.as-line').textContent : null};
      `);
      const ok = r.hasAS && r.rec && r.rec.games === 1 && r.lineShown;
      if (!ok) bad++;
      console.log(`${ok?'✅':'❌'} ${c.g.padEnd(12)} AS=${r.hasAS} ${c.call}=${r.fn} 기록=${r.rec?JSON.stringify(r.rec):'없음'} 표시="${r.lineText||''}"` + (r.err?' 예외:'+r.err:''));
    } catch (e) { bad++; console.log(`❌ ${c.g} 실행실패 ${e.message.slice(0,100)}`); }
    await page.close();
  }
  await cdp.close();
  console.log(bad ? `\n❌ 문제 ${bad}건` : '\n✓ 7종 전부 전적이 쌓이고 결과창에 보인다');
  process.exit(bad?1:0);
})();
