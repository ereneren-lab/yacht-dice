/* 섯다 엔진 1단계 검증 — 패평가 190조합 전순서 + 셔플 결정론 + 잡이 쇼다운 + 게임루프 스모크.
   실행: node scripts/seotda-test.js  (종료코드 0=통과) */
const { SeotdaEngine, makeDeck, shuffle, evalHand, resolveShowdown, mulberry32 } = require('../public/seotda-core.js');

let fail = 0;
const ok = (n, c, extra) => { console.log((c ? '  ✅ ' : '  ❌ ') + n + (extra ? ' — ' + extra : '')); if (!c) fail++; };
const C = (month, gwang) => ({ month, gwang: !!gwang });

// ── 1) 패평가 190조합(20C2) 전수 ──
console.log('▶ 패평가 190조합 전수');
const deck = makeDeck();
ok('덱 20장', deck.length === 20);
ok('광 3장(1·3·8월)', deck.filter(c => c.gwang).length === 3);
const pairs = [];
for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) pairs.push([deck[i], deck[j]]);
ok('조합 190개', pairs.length === 190);

const evs = pairs.map(([a, b]) => ({ a, b, e: evalHand(a, b) }));
const byTier = t => evs.filter(x => x.e.tier === t);
ok('광땡 3개', byTier('광땡').length === 3, byTier('광땡').map(x => x.e.name).sort().join(','));
ok('땡 10개', byTier('땡').length === 10);
ok('특수 24개', byTier('특수').length === 24, '(6종×4)');
ok('끗 153개', byTier('끗').length === 153);

// tier 구간 겹침 없음: 광땡(4000+) > 땡(3000+) > 특수(2000+) > 끗(1000+)
const rng = t => { const rs = byTier(t).map(x => x.e.rank); return [Math.min(...rs), Math.max(...rs)]; };
const [kmn, kmx] = rng('끗'), [smn, smx] = rng('특수'), [tmn, tmx] = rng('땡'), [gmn, gmx] = rng('광땡');
ok('전순서: 끗 < 특수 < 땡 < 광땡', kmx < smn && smx < tmn && tmx < gmn, `끗[${kmn}-${kmx}] 특수[${smn}-${smx}] 땡[${tmn}-${tmx}] 광땡[${gmn}-${gmx}]`);

// 광땡 순서 38>18>13
const g = n => byTier('광땡').find(x => x.e.name === n).e.rank;
ok('광땡 38>18>13', g('38광땡') > g('18광땡') && g('18광땡') > g('13광땡'));
// 땡 순서 장땡>...>삥땡
const tRank = m => evalHand(C(m), C(m)).rank;
ok('땡 장(10)>9>…>삥(1)', [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].every((m, i, arr) => i === 0 || tRank(arr[i - 1]) > tRank(m)));
ok('장땡 이름', evalHand(C(10), C(10)).name === '장땡');
ok('삥땡 이름', evalHand(C(1, true), C(1)).name === '삥땡' && evalHand(C(1, true), C(1)).tier === '땡');
// 특수 순서 알리>독사>구삥>장삥>장사>세륙
const sp = (m1, m2) => evalHand(C(m1), C(m2)).rank;
ok('특수 알리>독사>구삥>장삥>장사>세륙',
  sp(1, 2) > sp(1, 4) && sp(1, 4) > sp(1, 9) && sp(1, 9) > sp(1, 10) && sp(1, 10) > sp(4, 10) && sp(4, 10) > sp(4, 6));
ok('특수 이름', evalHand(C(1), C(2)).name === '알리' && evalHand(C(4), C(6)).name === '세륙' && evalHand(C(1), C(10)).name === '장삥');
// 끗: 갑오(9) 최고, 망통(0) 최저, 이름
ok('갑오=9끗 최고', evalHand(C(4), C(5)).name === '갑오' && evalHand(C(4), C(5)).rank === 1009);
ok('망통=0끗', evalHand(C(2), C(8)).name === '망통' && evalHand(C(2), C(8)).rank === 1000);
ok('5끗 이름', evalHand(C(2), C(3)).name === '5끗');
// 특수가 일반 끗을 덮어씀 (예: 1+9=0끗이지만 구삥, 4+6=0끗이지만 세륙)
ok('1+9는 구삥(0끗 아님)', evalHand(C(1), C(9)).tier === '특수' && evalHand(C(1), C(9)).name === '구삥');
ok('4+6은 세륙(0끗 아님)', evalHand(C(4), C(6)).tier === '특수');
// 광 1장 페어는 땡(광땡 아님)
ok('1광+1피 = 삥땡(광땡 아님)', evalHand(C(1, true), C(1)).tier === '땡');

// ── 2) 셔플 결정론 ──
console.log('\n▶ 셔플 결정론');
const s1 = shuffle(makeDeck(), mulberry32(42)).map(c => c.id).join(',');
const s2 = shuffle(makeDeck(), mulberry32(42)).map(c => c.id).join(',');
const s3 = shuffle(makeDeck(), mulberry32(43)).map(c => c.id).join(',');
ok('같은 시드 → 동일 딜', s1 === s2);
ok('다른 시드 → 다른 딜', s1 !== s3);
ok('셔플 후에도 20장 유지', shuffle(makeDeck(), mulberry32(1)).length === 20);

// ── 3) 잡이 플래그 ──
console.log('\n▶ 잡이 판정');
ok('암행어사 4+7', evalHand(C(4), C(7)).jabi.amhaeng === true);
ok('구사 4+9', evalHand(C(4), C(9)).jabi.gusa === true);
ok('땡잡이 3광+7', evalHand(C(3, true), C(7)).jabi.ttaengjabi === true);
ok('3피+7은 땡잡이 아님(3광 필요)', evalHand(C(3), C(7)).jabi.ttaengjabi === false);

// ── 4) 쇼다운 잡이 반전 ──
console.log('\n▶ 쇼다운(잡이 on/off)');
const show = (aCards, bCards, jabi) => resolveShowdown([{ seat: 0, cards: aCards }, { seat: 1, cards: bCards }], { jabi });
// 암행어사(4,7) vs 13광땡(1광,3광)
ok('잡이off: 13광땡 > 암행어사', show([C(4), C(7)], [C(1, true), C(3, true)], false).winners[0] === 1);
ok('잡이on: 암행어사가 13광땡 잡음', show([C(4), C(7)], [C(1, true), C(3, true)], true).winners[0] === 0);
// 암행어사 vs 38광땡 → 38 이김(못 잡음)
ok('잡이on: 38광땡 > 암행어사', show([C(4), C(7)], [C(3, true), C(8, true)], true).winners[0] === 1);
// 땡잡이(3광,7) vs 8땡 → 땡잡이 승 / vs 장땡 → 장땡 승
ok('잡이on: 땡잡이가 8땡 잡음', show([C(3, true), C(7)], [C(8, true), C(8)], true).winners[0] === 0);
ok('잡이on: 장땡 > 땡잡이', show([C(3, true), C(7)], [C(10), C(10)], true).winners[0] === 1);
// 구사(4,9) + 세륙(4,6) → 재경기 / 구사 vs 장땡 → 장땡 승(재경기 아님)
ok('잡이on: 구사+세륙 → 재경기', show([C(4), C(9)], [C(4), C(6)], true).result === 'redeal');
ok('잡이on: 구사 vs 장땡 → 장땡 승(재경기X)', (r => r.result === 'win' && r.winners[0] === 1)(show([C(4), C(9)], [C(10), C(10)], true)));

// ── 5) 게임 루프 스모크(전원 AI, 칩 정합·종료) ──
console.log('\n▶ 게임 루프 스모크');
function runGame(seed, N) {
  const players = Array.from({ length: N }, (_, i) => ({ pid: 'p' + i, ai: true, aiDiff: ['easy', 'normal', 'hard'][i % 3] }));
  const start = 3000;   // 앤티(150) 대비 스택을 작게 → 파산→종료 경로를 실제로 태움
  const e = new SeotdaEngine({ players, startChips: start, ante: 150, rng: mulberry32(seed), manualAI: true });
  e.start();
  const total = start * N;
  let guard = 0, hands = 0, badInv = 0;
  while (e.phase !== 'gameover' && guard < 8000) {
    guard++;
    if (e.phase === 'bet') { if (!e.aiTurnIfNeeded()) break; }
    else if (e.phase === 'handover') {
      const sum = e.players.reduce((a, p) => a + p.chips, 0);
      if (sum !== total) badInv++;              // 팟 배분 후 칩 총합 보존
      hands++; e.nextHand();
    } else if (e.phase === 'showdown') { /* 재경기 → 자동으로 bet 재개 */ if (!e.aiTurnIfNeeded()) { /* 대기 */ } }
    // 진행 중 항상: 칩합 + 팟 == 총액
    const live = e.players.reduce((a, p) => a + p.chips, 0) + (e.pot || 0);
    if (e.phase === 'bet' && live !== total) badInv++;
  }
  return { terminated: e.phase === 'gameover', winner: e.winner, hands, badInv, guard, chips: e.players.map(p => p.chips), total };
}
[[1, 3], [2, 4], [7, 5], [11, 2]].forEach(([seed, N]) => {
  const r = runGame(seed, N);
  ok(`${N}인 seed${seed}: 종료(파산→승자)`, r.terminated && r.winner != null, `${r.hands}판 · guard ${r.guard}`);
  ok(`${N}인 seed${seed}: 칩 정합(팟 보존)`, r.badInv === 0, r.badInv ? r.badInv + '회 위반' : '');
  // 종료 시 승자가 전 칩 보유(합 == 총액)
  ok(`${N}인 seed${seed}: 최종 칩합=총액`, r.chips.reduce((a, b) => a + b, 0) === r.total);
});

console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과 ✅');
process.exit(fail ? 1 : 0);
