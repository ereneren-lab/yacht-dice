/**
 * 상점 소모품 검증 — 실제 브라우저에서 사서, 판에서 쓰고, 개수가 주는가.
 *  ① 너클본즈: 굴린 뒤 '다시 굴리기' 버튼이 뜨고 눌리면 개수 -1
 *  ② 요트: 3번 다 굴린 뒤에만 '한 번 더'가 뜨고, 누르면 굴림이 한 번 더 돈다
 *  ③ 아이템이 0개면 버튼이 안 뜬다
 */
const { launchWithRetry } = require('./cdp');
(async () => {
  const cdp = await launchWithRetry();
  let bad = 0;
  const fail = m => { bad++; console.log('❌ ' + m); };

  // ① 너클본즈
  let p = await cdp.newPage(390, 844);
  await p.goto('http://localhost:3000/kb.html');
  await p.eval(`localStorage.setItem('alley_coin','100000'); localStorage.removeItem('alley_inv'); return 1;`);
  await p.goto('http://localhost:3000/kb.html');
  await p.wait(400);
  const none = await p.eval(`return {n:SHOP.count('reroll')};`);
  await p.click('#startBtn'); await p.wait(900);
  await p.click('#rollBtn'); await p.wait(700);
  const hidden = await p.eval(`var b=document.getElementById('itemReroll'); return getComputedStyle(b).display;`);
  if (hidden !== 'none') fail(`아이템 0개인데 버튼이 보인다 (display=${hidden})`);
  else console.log(`✅ kb    0개일 땐 버튼 숨김 (보유 ${none.n})`);

  await p.eval(`SHOP.buy('use_reroll3'); return SHOP.count('reroll');`);
  await p.goto('http://localhost:3000/kb.html'); await p.wait(400);
  await p.click('#startBtn'); await p.wait(900);
  await p.click('#rollBtn'); await p.wait(700);
  const shown = await p.eval(`
    var b=document.getElementById('itemReroll');
    return {disp:getComputedStyle(b).display, txt:b.textContent, n:SHOP.count('reroll')};`);
  if (shown.disp === 'none') fail('아이템 3개인데 버튼이 안 보인다');
  else console.log(`✅ kb    버튼 노출 "${shown.txt}"`);
  await p.click('#itemReroll'); await p.wait(700);
  const used = await p.eval(`var b=document.getElementById('itemReroll'); return {n:SHOP.count('reroll'), txt:b.textContent};`);
  if (used.n !== shown.n - 1) fail(`사용 후 개수 ${shown.n}→${used.n} (1 줄어야 함)`);
  else console.log(`✅ kb    사용 — 개수 ${shown.n}→${used.n}, 버튼 "${used.txt}"`);
  await p.close();

  // ② 요트
  p = await cdp.newPage(390, 844);
  await p.goto('http://localhost:3000/yacht.html');
  await p.eval(`localStorage.setItem('alley_coin','100000'); localStorage.removeItem('alley_inv'); SHOP.buy('use_reroll3'); return 1;`);
  await p.goto('http://localhost:3000/yacht.html'); await p.wait(400);
  await p.click('#startLocal'); await p.wait(1200);
  await p.click('#rollBtn'); await p.wait(900);
  const mid = await p.eval(`var b=document.getElementById('itemReroll'); return {disp:getComputedStyle(b).display};`);
  if (mid.disp !== 'none') fail("아직 굴림이 남았는데 '한 번 더'가 보인다");
  else console.log("✅ yacht 굴림 남았을 땐 숨김");
  await p.click('#rollBtn'); await p.wait(800);
  await p.click('#rollBtn'); await p.wait(900);
  const ready = await p.eval(`var b=document.getElementById('itemReroll'); return {disp:getComputedStyle(b).display, n:SHOP.count('reroll')};`);
  if (ready.disp === 'none') fail("굴림을 다 썼는데 '한 번 더'가 안 보인다");
  else console.log(`✅ yacht 다 굴린 뒤 노출 (보유 ${ready.n})`);
  await p.click('#itemReroll'); await p.wait(900);
  const after = await p.eval(`var b=document.getElementById('itemReroll'); return {n:SHOP.count('reroll'), disp:getComputedStyle(b).display};`);
  if (after.n !== ready.n - 1) fail(`요트 사용 후 개수 ${ready.n}→${after.n}`);
  else console.log(`✅ yacht 사용 — 개수 ${ready.n}→${after.n} (사용 후 버튼 ${after.disp})`);
  await p.close();

  await cdp.close();
  console.log(bad ? `\n❌ 문제 ${bad}건` : '\n✓ 소모품: 사고·쓰고·줄어드는 흐름이 실제로 돈다');
  process.exit(bad ? 1 : 0);
})();
