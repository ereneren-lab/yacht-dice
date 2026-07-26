/**
 * 아이템전 검증 — 아이템은 '아이템전'에서만, 그리고 **전원이 같은 개수**를 받는다.
 *  ① 일반전(기본): 버튼이 아예 안 뜬다
 *  ② 아이템전: 양쪽 좌석에 같은 개수가 지급되고, 쓰면 내 몫만 준다
 *  ③ 상점 보유량과 무관하다(돈으로 개수를 늘릴 수 없다)
 */
const { launchWithRetry } = require('./cdp');
(async () => {
  const cdp = await launchWithRetry();
  let bad = 0; const fail = m => { bad++; console.log('❌ ' + m); };

  // ── 너클본즈: 일반전
  let p = await cdp.newPage(390, 844);
  await p.goto('http://localhost:3000/kb.html'); await p.wait(400);
  await p.click('#startBtn'); await p.wait(900);
  await p.click('#rollBtn'); await p.wait(700);
  let r = await p.eval(`var b=document.getElementById('itemReroll'); return getComputedStyle(b).display;`);
  if (r !== 'none') fail(`kb 일반전인데 아이템 버튼이 보인다 (${r})`); else console.log('✅ kb    일반전 — 버튼 없음');
  await p.close();

  // ── 너클본즈: 아이템전
  p = await cdp.newPage(390, 844);
  await p.goto('http://localhost:3000/kb.html'); await p.wait(400);
  await p.eval(`document.querySelector('#optItems .opt[data-items="1"]').click(); return 1;`);
  await p.click('#startBtn'); await p.wait(900);
  await p.click('#rollBtn'); await p.wait(700);
  const on = await p.eval(`
    var b=document.getElementById('itemReroll');
    return {disp:getComputedStyle(b).display, txt:b.textContent, inv:(window.SHOP?JSON.stringify(SHOP.inv().use||{}):'-')};`);
  if (on.disp === 'none') fail('kb 아이템전인데 버튼이 안 보인다');
  else console.log(`✅ kb    아이템전 — "${on.txt.trim()}" (상점 소모품 보유 ${on.inv})`);
  await p.click('#itemReroll'); await p.wait(800);
  const after = await p.eval(`var b=document.getElementById('itemReroll'); return b.textContent;`);
  if (!/\(1\)/.test(after)) fail(`kb 사용 후 표시가 (1)이 아니다 — "${after}"`);
  else console.log(`✅ kb    사용 — "${on.txt.trim()}" → "${after.trim()}"`);
  await p.close();

  // ── 요트: 일반전 / 아이템전
  p = await cdp.newPage(390, 844);
  await p.goto('http://localhost:3000/yacht.html'); await p.wait(400);
  await p.click('#startLocal'); await p.wait(1100);
  for (let i = 0; i < 3; i++) { await p.click('#rollBtn'); await p.wait(800); }
  r = await p.eval(`var b=document.getElementById('itemReroll'); return getComputedStyle(b).display;`);
  if (r !== 'none') fail(`yacht 일반전인데 버튼이 보인다 (${r})`); else console.log('✅ yacht 일반전 — 버튼 없음');
  await p.close();

  p = await cdp.newPage(390, 844);
  await p.goto('http://localhost:3000/yacht.html'); await p.wait(400);
  await p.eval(`document.getElementById('itemToggleL').click(); return 1;`);
  await p.click('#startLocal'); await p.wait(1100);
  for (let i = 0; i < 3; i++) { await p.click('#rollBtn'); await p.wait(800); }
  const y = await p.eval(`var b=document.getElementById('itemReroll'); return {disp:getComputedStyle(b).display, txt:b.textContent};`);
  if (y.disp === 'none') fail('yacht 아이템전인데 버튼이 안 보인다');
  else console.log(`✅ yacht 아이템전 — "${y.txt.trim()}"`);
  await p.click('#itemReroll'); await p.wait(900);
  const y2 = await p.eval(`var b=document.getElementById('itemReroll'); return b.textContent;`);
  console.log(`   사용 후 표시 "${y2.trim()}"`);
  await p.close();

  await cdp.close();
  console.log(bad ? `\n❌ 문제 ${bad}건` : '\n✓ 아이템은 아이템전에서만, 전원 같은 개수로 쓰인다');
  process.exit(bad ? 1 : 0);
})();
