/* 원카드 엔진 헤드리스 시뮬 — 보존·누출·교착·아이템 소진 단언
 * 브라우저 테스트로는 절대 안 잡히는 것들만 본다. */
'use strict';
const path = require('path');
const { OCEngine } = require(path.join(__dirname, '..', 'public', 'onecard-core.js'));

// 재현 가능한 rng (mulberry32) — 실패를 다시 만들 수 있어야 한다
function mkRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DECK_TOTAL = 54;
let fails = [];
const fail = (m) => { if (fails.length < 25) fails.push(m); };

function countCards(eng) {
  let n = eng.draw.length + eng.discard.length;
  for (const h of eng.hands) n += h.length;
  return n;
}

function runOne(nPlayers, itemsOn, seed) {
  const players = [];
  for (let i = 0; i < nPlayers; i++) players.push({ pid: 'p' + i, name: 'P' + i, ai: true });
  const eng = new OCEngine({ players, itemsOn, manualAI: true, rng: mkRng(seed), onState() {} });
  eng.start();

  const itemsAtStart = eng.items.slice();
  let steps = 0, shieldUses = 0, takeCount = 0, prevShieldSeq = 0;

  while (eng.phase === 'play') {
    if (++steps > 20000) { fail(`교착: n=${nPlayers} items=${itemsOn} seed=${seed} 20000스텝 초과`); break; }

    // ① 카드 보존 — 매 스텝 총합이 54여야 한다
    const tot = countCards(eng);
    if (tot !== DECK_TOTAL) { fail(`카드 보존 깨짐: ${tot}/54 (n=${nPlayers} seed=${seed} step=${steps})`); break; }

    // ② 정보 누출 0 — 각 자리의 스냅샷에 남의 손패 내용도, 더미 내용도 없어야 한다
    for (let v = 0; v < nPlayers; v++) {
      const s = eng.serialize('p' + v);
      const blob = JSON.stringify(s);
      if (/"draw"\s*:\s*\[/.test(blob)) fail(`누출: 더미 배열이 스냅샷에 있음 (seed=${seed})`);
      if (/"hands"\s*:/.test(blob)) fail(`누출: hands가 스냅샷에 있음 (seed=${seed})`);
      for (const p of s.players) {
        if (p.seat === v) continue;
        if (Object.prototype.hasOwnProperty.call(p, 'hand') || Object.prototype.hasOwnProperty.call(p, 'cards')) {
          fail(`누출: 남의 손패 필드가 있음 seat=${p.seat} (seed=${seed})`);
        }
      }
      // 내 손패는 정확히 내 것이어야 한다(수·id 일치)
      if (s.myHand.length !== eng.hands[v].length) fail(`myHand 길이 불일치 seat=${v} (seed=${seed})`);
      const realIds = eng.hands[v].map(c => c.id).sort((a, b) => a - b).join(',');
      const snapIds = s.myHand.map(c => c.id).sort((a, b) => a - b).join(',');
      if (realIds !== snapIds) fail(`myHand id 불일치 seat=${v} (seed=${seed})`);
      // 남의 장수는 공개 정보 — 실제와 맞아야 한다
      for (const p of s.players) {
        if (p.count !== eng.hands[p.seat].length) fail(`count 불일치 seat=${p.seat} (seed=${seed})`);
      }
    }

    if (eng.shieldSeq > prevShieldSeq) { shieldUses += (eng.shieldSeq - prevShieldSeq); prevShieldSeq = eng.shieldSeq; }
    const before = eng.actionSeq;
    const moved = eng.aiTurnIfNeeded();
    if (!moved) { fail(`AI가 안 움직임: phase=${eng.phase} turn=${eng.turn} (seed=${seed})`); break; }
    if (eng.actionSeq === before && eng.phase === 'play') {
      fail(`액션이 진행되지 않음(무한루프 위험): turn=${eng.turn} seed=${seed}`);
      break;
    }
  }
  if (eng.shieldSeq > prevShieldSeq) shieldUses += (eng.shieldSeq - prevShieldSeq);

  // ③ 교착 없이 정확히 1명 승리로 종료
  if (eng.phase !== 'gameover') fail(`종료 안 됨: phase=${eng.phase} (n=${nPlayers} seed=${seed})`);
  else {
    if (eng.winnerSeat < 0 || eng.winnerSeat >= nPlayers) fail(`승자 이상: ${eng.winnerSeat} (seed=${seed})`);
    else if (eng.hands[eng.winnerSeat].length !== 0) fail(`승자 손패가 0이 아님: ${eng.hands[eng.winnerSeat].length} (seed=${seed})`);
    const tot = countCards(eng);
    if (tot !== DECK_TOTAL) fail(`종료 시 카드 보존 깨짐: ${tot}/54 (seed=${seed})`);
  }

  // ④ 아이템 지급이 전원 동일한가
  if (itemsOn) {
    const uniq = Array.from(new Set(itemsAtStart));
    if (uniq.length !== 1) fail(`아이템 지급이 불균등: ${itemsAtStart.join(',')} (seed=${seed})`);
    if (uniq[0] !== 2) fail(`기본 지급이 2가 아님: ${uniq[0]}`);
  } else {
    if (itemsAtStart.some(x => x !== 0)) fail(`아이템전 꺼짐인데 지급됨: ${itemsAtStart.join(',')}`);
  }

  eng.destroy();   // 함정: 하네스가 엔진을 안 놔주면 무한루프처럼 보인다
  return { steps, shieldUses, winner: eng.winnerSeat, capped: steps > 20000 };
}

// ── 실행 ──────────────────────────────────────────────
let games = 0, totalSteps = 0, totalShield = 0, gamesWithShield = 0, maxSteps = 0;
const winTally = {};
for (const n of [2, 3, 4]) {
  for (const itemsOn of [false, true]) {
    for (let s = 0; s < 400; s++) {
      const seed = (n * 1000003) ^ (itemsOn ? 777 : 0) ^ (s * 2654435761);
      const r = runOne(n, itemsOn, seed);
      games++; totalSteps += r.steps; maxSteps = Math.max(maxSteps, r.steps);
      if (itemsOn) { totalShield += r.shieldUses; if (r.shieldUses > 0) gamesWithShield++; }
      const k = n + '인';
      winTally[k] = winTally[k] || {};
      winTally[k][r.winner] = (winTally[k][r.winner] || 0) + 1;
    }
  }
}

console.log(`판 수: ${games}  ·  평균 ${(totalSteps / games).toFixed(1)}스텝  ·  최장 ${maxSteps}스텝`);
console.log(`아이템전 판(${games / 2}판) 중 실제로 🛡을 쓴 판: ${gamesWithShield}  ·  총 사용 ${totalShield}회`);
console.log('승자 분포:', JSON.stringify(winTally));

// AI가 아이템을 실제로 쓰는가 — 안 쓰면 '전원 지급'이 무의미하다
if (totalShield === 0) fail('AI가 🛡을 한 번도 쓰지 않았다 (공정성 버그 — 윷에서 실제로 있었던 일)');

if (fails.length) {
  console.error('\n✗ 실패 ' + fails.length + '건:');
  fails.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log('\n✓ 보존·누출0·교착없음·아이템 전부 통과');
