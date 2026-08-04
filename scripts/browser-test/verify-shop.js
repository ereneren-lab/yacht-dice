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
  // 칭호도 사둔다 (이모지 아바타 팩은 2026-08-04에 판매 중단 — 아래 ⑥ 참고)
  await p.eval(`localStorage.setItem('alley_coin','100000'); SHOP.buy('title_boss'); return 1;`);
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
  /* ⚠️ 예전엔 '동물 팩이 반영됐나'를 🐯로 확인했는데 **🐯는 원래 무료 프리셋**이라
     팩이 아무것도 안 줘도 통과했다. 지금은 팩 자체를 내렸으므로(⑥ 참고),
     허브에서는 '아바타를 고를 수단이 살아 있는가'만 본다. */
  const hub = await p.eval(`
    var chips=[].map.call(document.querySelectorAll('.avchip'), function(c){return c.dataset.av});
    return {chips: chips, n:chips.length,
            custom: !!document.getElementById('profAvatarCustom'),
            name:(document.getElementById('pnamePreview')||{}).textContent,
            shopLink: !!document.querySelector('.shoplink'),
            coin:(document.querySelector('#coinBar b')||{}).textContent};`);
  if (hub.n < 10 || !hub.custom) fail(`허브 아바타 선택 수단 이상 — 칩 ${hub.n}개, 직접입력 ${hub.custom}`);
  else console.log(`✅ 허브 아바타 ${hub.n}개 + 직접 입력칸`);
  if (!/골목대장/.test(hub.name || '')) fail(`칭호 미표시 — "${hub.name}"`); else console.log(`✅ 허브 프로필 "${hub.name}"`);
  if (!hub.shopLink) fail('허브에 상점 링크 없음'); else console.log(`✅ 허브 상점 링크 · 코인 ${hub.coin}`);
  await p.close();

  /* ⑥ 파는 것이 실제로 '새것'인가 — **이모지는 팔 수 없다.**
     허브에 이모지 직접 입력칸(#profAvatarCustom)이 있어서 아무 이모지나 공짜로 쓸 수 있다.
     게다가 2026-08-04에 동물 팩은 6개 중 5개, 행운 팩은 6개 중 4개가 이미 프리셋에 있었다.
     지금은 팩을 전부 내렸고, 이 검사는 **다시 이모지를 팔기 시작하면 실패**한다. */
  {
    const fs = require('fs'), path = require('path');
    const P = (f) => fs.readFileSync(path.join(__dirname, '../../public', f), 'utf8');
    const pick = (src, re) => ((src.match(re) || [])[1] || '').match(/[^,'"\s\[\]]+/g) || [];
    const free = new Set([
      ...pick(P('index.html'), /var PRESETS=\[([^\]]*)\]/),
      ...pick(P('kb.html'), /const AV_EMOJIS=\[([^\]]*)\]/),
      ...pick(P('ld.html'), /const AV_EMOJIS=\[([^\]]*)\]/),
    ]);
    const shop = P('shop.js');
    const re = /id:\s*'(pack_\w+)'[\s\S]*?avatars:\s*\[([^\]]*)\]/g;
    let m, over = 0;
    while ((m = re.exec(shop))) {
      const list = (m[2].match(/[^,'"\s]+/g) || []);
      const dup = list.filter(e => free.has(e));
      if (dup.length) { over++; fail(`${m[1]}: 이미 무료인 이모지를 팔고 있다 — ${dup.join(' ')} (${dup.length}/${list.length})`); }
      else console.log(`✅ ${m[1].padEnd(12)} ${list.length}개 전부 팩 전용 — ${list.join(' ')}`);
    }
    if (!over) console.log('✅ 무료로 쓸 수 있는 걸 파는 팩은 없다');
  }

  await cdp.close();
  console.log(bad ? `\n❌ 문제 ${bad}건` : '\n✓ 상점: 구매·장착이 게임과 허브에 실제로 반영된다');
  process.exit(bad ? 1 : 0);
})();
