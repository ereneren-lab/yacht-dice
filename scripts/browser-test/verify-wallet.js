/**
 * 통합 코인(wallet.js) 검증
 *  ① 베팅 3종: 시작 시 지갑에서 바이인 → 끝나면 남은 칩 환급 (자금 보존)
 *  ② 비베팅 3종: 이기면 보상 코인
 *  ③ 섯다: 기존 seotda_wallet 값이 alley_coin으로 이관
 *  ④ 허브에 코인 표시
 */
const { launchWithRetry } = require('./cdp');
(async () => {
  const cdp = await launchWithRetry();
  let bad = 0;
  const fail = (m) => { bad++; console.log('❌ ' + m); };

  // ① 바이인 → 환급
  for (const g of ['blackjack','baccarat','highlow']) {
    const p = await cdp.newPage(390, 844);
    await p.goto('http://localhost:3000/' + g + '.html');
    await p.eval(`localStorage.setItem('alley_coin','100000'); return 1;`);
    await p.goto('http://localhost:3000/' + g + '.html');
    await p.wait(400);
    const before = await p.eval(`return AW.get();`);
    await p.click('#startBtn');
    await p.wait(600);
    const r = await p.eval(`return {coin:AW.get(), bank:bank, chips:cfg.chips};`);
    // 게임 종료(승리) → 남은 칩 환급
    await p.eval(`endGame(true); return 1;`);
    await p.wait(300);
    const after = await p.eval(`return {coin:AW.get(), body:document.getElementById('resBody').textContent};`);
    const okBuy = r.coin === before - r.chips && r.bank === r.chips;
    const okBack = after.coin === before;   // 안 쓰고 끝냈으니 원복
    if (!okBuy) fail(`${g} 바이인 어긋남 — 시작전 ${before} → ${r.coin} (칩 ${r.chips}, bank ${r.bank})`);
    if (!okBack) fail(`${g} 환급 어긋남 — ${after.coin} ≠ ${before}`);
    if (okBuy && okBack) console.log(`✅ ${g.padEnd(10)} 바이인 ${before}→${r.coin} · 환급 후 ${after.coin} · 결과창에 코인 표시=${/보유 코인/.test(after.body)}`);
    await p.close();
  }

  // ② 비베팅 보상
  /* ⚠️ 원카드는 v1.223부터 `ST.winner=MYSEAT`를 세팅하고 있었는데 **onecard.html엔 ST가 없다.**
     ReferenceError가 eval 전체를 죽여서, 이 테스트는 원카드 보상을 **한 번도 검증한 적이 없다**
     (2026-08-04에 발견). 실제 이름은 `S.winnerSeat`/`S.mySeat`다.
     window.S로는 안 잡히고 맨 이름으로만 참조된다(함정 #18 — 최상위 let/const는 window에 없다). */
  for (const [g, win] of [['oldmaid',`loser=-1;`], ['onecard',`S.winnerSeat=S.mySeat;`], ['indianpoker',null]]) {
    const p = await cdp.newPage(390, 844);
    await p.goto('http://localhost:3000/' + g + '.html');
    await p.eval(`localStorage.setItem('alley_coin','1000'); return 1;`);
    await p.goto('http://localhost:3000/' + g + '.html');
    await p.wait(400);
    await p.click('#startBtn');
    await p.wait(1200);
    const r = await p.eval(`${win || ''} var b=AW.get(); endGame(); return {before:b, after:AW.get()};`).catch(e => ({err: e.message}));
    if (r.err) { fail(`${g} 종료 호출 실패: ${r.err.slice(0,80)}`); }
    else if (r.after < r.before) fail(`${g} 보상인데 코인이 줄었다 ${r.before}→${r.after}`);
    else console.log(`✅ ${g.padEnd(10)} 승리 보상 ${r.before}→${r.after} (+${r.after - r.before})`);
    await p.close();
  }

  // ③ 섯다 이관
  {
    const p = await cdp.newPage(390, 844);
    await p.goto('http://localhost:3000/seotda.html');
    await p.eval(`localStorage.clear(); localStorage.setItem('seotda_wallet','77777'); return 1;`);
    await p.goto('http://localhost:3000/seotda.html');
    await p.wait(400);
    const r = await p.eval(`return {coin:AW.get(), shown:(document.getElementById('walletAmt')||{}).textContent};`);
    if (r.coin !== 77777) fail(`섯다 지갑 이관 실패 — alley_coin=${r.coin}`);
    else console.log(`✅ seotda    옛 지갑 77,777 → 공통 코인 ${r.coin} (화면 표시 ${r.shown})`);
    await p.close();
  }

  // ④ 허브 표시
  {
    const p = await cdp.newPage(390, 844);
    await p.goto('http://localhost:3000/');
    await p.eval(`localStorage.setItem('alley_coin','12345'); return 1;`);
    await p.goto('http://localhost:3000/');
    await p.wait(400);
    const t = await p.eval(`var e=document.querySelector('#coinBar b'); return e?e.textContent:null;`);
    if (t !== '12,345') fail(`허브 코인 표시 = ${t}`);
    else console.log(`✅ 허브       내 코인 ${t}`);
    await p.close();
  }

  await cdp.close();
  console.log(bad ? `\n❌ 문제 ${bad}건` : '\n✓ 통합 코인이 게임을 넘나들며 하나로 굴러간다');
  process.exit(bad ? 1 : 0);
})();
