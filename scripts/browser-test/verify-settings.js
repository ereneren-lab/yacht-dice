/**
 * 공통 설정 검증 — 소리/닉네임이 게임을 넘나들며 유지되는가.
 *  ① 한 게임에서 음소거 → 나머지 12게임이 음소거 상태로 뜬다
 *  ② 옛 키(bj_sound·ip_name 등)를 쓰던 사용자는 값이 옮겨 온다
 */
const { launchWithRetry } = require('./cdp');
const GAMES = ['kb','yut','ld','lcr','yacht','alkkagi','seotda','blackjack','indianpoker','highlow','oldmaid','baccarat','onecard'];
const BTN = "document.getElementById('soundBtn')||document.getElementById('muteBtn')";
(async () => {
  const cdp = await launchWithRetry();
  let bad = 0;
  // ① 섯다에서 음소거 → 전 게임 반영
  let p = await cdp.newPage(390, 844);
  await p.goto('http://localhost:3000/seotda.html');
  await p.wait(300);
  await p.eval(`var b=${BTN}; if(b&&b.textContent==='🔊') b.click(); return localStorage.getItem('alley_sound');`);
  const stored = await p.eval(`return localStorage.getItem('alley_sound');`);
  console.log('섯다에서 음소거 → alley_sound=' + stored);
  await p.close();
  if (stored !== '0') { bad++; console.log('❌ 음소거가 alley_sound에 저장되지 않음'); }

  for (const g of GAMES) {
    p = await cdp.newPage(390, 844);
    await p.goto('http://localhost:3000/' + g + '.html');
    await p.wait(350);
    const r = await p.eval(`var b=${BTN}; return {icon:b?b.textContent:null, key:localStorage.getItem('alley_sound')};`);
    const ok = r.icon === '🔇';
    if (!ok) bad++;
    console.log(`${ok ? '✅' : '❌'} ${g.padEnd(12)} 소리버튼=${r.icon} (alley_sound=${r.key})`);
    await p.close();
  }

  // ② 옛 키 마이그레이션
  p = await cdp.newPage(390, 844);
  await p.goto('http://localhost:3000/blackjack.html');
  await p.eval(`localStorage.clear(); localStorage.setItem('ip_name','재성'); localStorage.setItem('bj_sound','0'); return 1;`);
  await p.goto('http://localhost:3000/blackjack.html');
  await p.wait(300);
  const mig = await p.eval(`return {name:localStorage.getItem('alley_name'), sound:localStorage.getItem('alley_sound')};`);
  const migOk = mig.name === '재성' && mig.sound === '0';
  if (!migOk) bad++;
  console.log(`${migOk ? '✅' : '❌'} 옛 키 이관 — alley_name=${mig.name} alley_sound=${mig.sound}`);
  await p.close();

  await cdp.close();
  console.log(bad ? `\n❌ 문제 ${bad}건` : '\n✓ 소리·닉네임이 전 게임 공통으로 유지됨');
  process.exit(bad ? 1 : 0);
})();
