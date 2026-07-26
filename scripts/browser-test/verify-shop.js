/**
 * 상점 검증 — 코인으로 사고, 장착이 실제 게임/허브에 먹히는가.
 *  ① 코인 부족 시 구매 거절 ② 구매 시 코인 차감·인벤 반영
 *  ③ 주사위 스킨 장착 → 5개 주사위 게임의 --die 변수가 바뀐다
 *  ④ 아바타 팩 → 허브 아바타 목록이 늘어난다  ⑤ 칭호 → 허브 프로필에 표시
 */
const { launchWithRetry } = require('./cdp');
(async () => {
  const cdp = await launchWithRetry();
  let bad = 0;
  const fail = m => { bad++; console.log('❌ ' + m); };

  // ①② 구매
  let p = await cdp.newPage(390, 844);
  await p.goto('http://localhost:3000/shop.html');
  await p.eval(`localStorage.removeItem('alley_inv'); localStorage.setItem('alley_coin','100'); return 1;`);
  await p.goto('http://localhost:3000/shop.html');
  await p.wait(400);
  const poor = await p.eval(`var r=SHOP.buy('dice_gold'); return {ok:r.ok, why:r.why, coin:AW.get()};`);
  if (poor.ok) fail('코인 100인데 20,000짜리가 구매됨'); else console.log(`✅ 부족 시 거절 — "${poor.why}"`);
  const rich = await p.eval(`
    localStorage.setItem('alley_coin','50000');
    var r=SHOP.buy('dice_gold');
    return {ok:r.ok, coin:AW.get(), owned:SHOP.owned('dice_gold'), eq:SHOP.equipped('dice')};`);
  if (!(rich.ok && rich.coin === 30000 && rich.owned && rich.eq === 'dice_gold')) fail(`구매 반영 이상 ${JSON.stringify(rich)}`);
  else console.log(`✅ 구매 — 코인 50,000→${rich.coin.toLocaleString()} · 자동 장착 ${rich.eq}`);
  const dup = await p.eval(`var r=SHOP.buy('dice_gold'); return {ok:r.ok, why:r.why, coin:AW.get()};`);
  if (dup.ok || dup.coin !== 30000) fail('중복 구매가 막히지 않음'); else console.log(`✅ 중복 구매 거절 — "${dup.why}"`);
  // 아바타 팩 + 칭호도 사둔다
  await p.eval(`localStorage.setItem('alley_coin','100000'); SHOP.buy('pack_animal'); SHOP.buy('title_boss'); return 1;`);
  await p.close();

  // ③ 주사위 스킨이 게임에 먹히는가
  for (const g of ['kb','lcr','ld','yut','yacht']) {
    p = await cdp.newPage(390, 844);
    await p.goto('http://localhost:3000/' + g + '.html');
    await p.wait(400);
    const r = await p.eval(`
      var v=getComputedStyle(document.documentElement).getPropertyValue('--die').trim();
      return {die:v, eq:window.SHOP?SHOP.equipped('dice'):null};`);
    const ok = r.eq === 'dice_gold' && /f2cf6a/i.test(r.die);
    if (!ok) fail(`${g} 주사위 스킨 미적용 (--die=${r.die}, 장착=${r.eq})`);
    else console.log(`✅ ${g.padEnd(7)} 황금 주사위 적용 --die=${r.die}`);
    await p.close();
  }

  // ④⑤ 허브
  p = await cdp.newPage(390, 844);
  await p.goto('http://localhost:3000/');
  await p.eval(`localStorage.setItem('alley_name','재성'); return 1;`);
  await p.goto('http://localhost:3000/');
  await p.wait(500);
  const hub = await p.eval(`
    var chips=[].map.call(document.querySelectorAll('.avchip'), function(c){return c.dataset.av});
    return {hasTiger: chips.indexOf('🐯')>=0, n:chips.length,
            name:(document.getElementById('pnamePreview')||{}).textContent,
            shopLink: !!document.querySelector('.shoplink'),
            coin:(document.querySelector('#coinBar b')||{}).textContent};`);
  if (!hub.hasTiger) fail(`아바타 팩이 허브에 안 뜸 (칩 ${hub.n}개)`); else console.log(`✅ 허브 아바타 ${hub.n}개 — 동물 팩 포함`);
  if (!/골목대장/.test(hub.name || '')) fail(`칭호 미표시 — "${hub.name}"`); else console.log(`✅ 허브 프로필 "${hub.name}"`);
  if (!hub.shopLink) fail('허브에 상점 링크 없음'); else console.log(`✅ 허브 상점 링크 · 코인 ${hub.coin}`);
  await p.close();

  await cdp.close();
  console.log(bad ? `\n❌ 문제 ${bad}건` : '\n✓ 상점: 구매·장착이 게임과 허브에 실제로 반영된다');
  process.exit(bad ? 1 : 0);
})();
