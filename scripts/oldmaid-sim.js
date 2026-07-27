/* 도둑잡기 엔진 헤드리스 시뮬 — 보존·누출·교착·아이템 소진 단언
 * 브라우저 테스트로는 절대 안 잡히는 것들만 본다.
 * 특히 **조커 위치 누출**: 이 게임은 조커가 어디 있는지가 전부라 그게 새면 게임이 무너진다.
 *
 * 사용: npm run test:oldmaid
 */
'use strict';
const path = require('path');
const { OMEngine, discardPairs } = require(path.join(__dirname, '..', 'public', 'oldmaid-core.js'));

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

const DECK_TOTAL = 53;   // 52 + 조커 1
let fails = [];
const fail = (m) => { if (fails.length < 25) fails.push(m); };

const handCount = (eng) => eng.hands.reduce((n, h) => n + h.length, 0);
const jokerSeat = (eng) => eng.hands.findIndex(h => h.some(c => c.joker));

function runOne(nPlayers, itemsOn, seed) {
  const players = [];
  for (let i = 0; i < nPlayers; i++) players.push({ pid: 'p' + i, name: 'P' + i, ai: true });
  const eng = new OMEngine({
    players, itemsOn, manualAI: true, rng: mkRng(seed),
    pairMs: 0, stepMs: 0, onState() {}
  });
  eng.start();

  const itemsAtStart = eng.items.slice();
  let steps = 0, peeks = 0, prevPeekSeq = 0;

  while (eng.phase === 'play') {
    if (++steps > 5000) { fail(`교착: n=${nPlayers} items=${itemsOn} seed=${seed} 5000스텝 초과`); break; }

    // ① 조커는 정확히 1장, 어딘가에 반드시 있다
    let jokers = 0;
    for (const h of eng.hands) for (const c of h) if (c.joker) jokers++;
    if (jokers !== 1) { fail(`조커가 ${jokers}장 (n=${nPlayers} seed=${seed} step=${steps})`); break; }

    // ② 짝은 손에 남아 있으면 안 된다(정리 후 상태에서 같은 숫자 2장 금지)
    for (let s = 0; s < nPlayers; s++) {
      const cnt = {};
      for (const c of eng.hands[s]) if (!c.joker) cnt[c.r] = (cnt[c.r] || 0) + 1;
      for (const r in cnt) if (cnt[r] >= 2) { fail(`짝이 안 버려짐 seat=${s} rank=${r} (seed=${seed})`); break; }
    }

    // ③ 정보 누출 0 — 각 자리의 스냅샷에 남의 손패도, 조커 위치도 없어야 한다
    const jSeat = jokerSeat(eng);
    for (let v = 0; v < nPlayers; v++) {
      const s = eng.serialize('p' + v);
      const blob = JSON.stringify(s);
      if (/"hands"\s*:/.test(blob)) fail(`누출: hands가 스냅샷에 있음 (seed=${seed})`);
      for (const p of s.players) {
        if (p.seat === v) continue;
        if (p.hand != null) fail(`누출: 남의 손패가 실렸다 seat=${p.seat} (seed=${seed})`);
        if (p.count !== eng.hands[p.seat].length) fail(`count 불일치 seat=${p.seat} (seed=${seed})`);
      }
      // 내 손패는 정확히 내 것
      const realIds = eng.hands[v].map(c => c.id).sort((a, b) => a - b).join(',');
      const snapIds = s.myHand.map(c => c.id).sort((a, b) => a - b).join(',');
      if (realIds !== snapIds) fail(`myHand 불일치 seat=${v} (seed=${seed})`);
      // 남이 조커를 들었는지가 내 스냅샷에서 드러나면 안 된다.
      // 유일하게 허용되는 건 (a) 내가 조커를 들고 있어 myHand에 보이는 것,
      //                    (b) 내가 아이템으로 훔쳐본 myPeek.
      if (jSeat !== v) {
        const myHandHasJoker = s.myHand.some(c => c.joker);
        if (myHandHasJoker) fail(`누출: 조커는 seat=${jSeat}인데 seat=${v}의 myHand에 있다 (seed=${seed})`);
        const peekTold = !!(s.myPeek && s.myPeek.jokerIdx != null && s.myPeek.targetSeat === jSeat);
        if (!peekTold) {
          // 아이템으로 본 게 아니라면, 스냅샷 어디에도 '조커'라는 단서가 없어야 한다
          const other = JSON.stringify(Object.assign({}, s, { myHand: null, myPeek: null, myJoker: null }));
          if (/"joker"\s*:\s*true/.test(other)) fail(`누출: 조커 카드가 스냅샷에 노출됨 viewer=${v} (seed=${seed})`);
        }
      }
      // myJoker(내가 조커를 집었다)는 남에게 절대 안 간다
      if (s.myJoker && eng.lastJoker && eng.lastJoker.seat !== v) fail(`누출: 남의 myJoker가 실렸다 (seed=${seed})`);
    }

    if (eng.peekSeq > prevPeekSeq) { peeks += (eng.peekSeq - prevPeekSeq); prevPeekSeq = eng.peekSeq; }

    const before = eng.actionSeq;
    const moved = eng.aiTurnIfNeeded();
    if (!moved) { fail(`AI가 안 움직임: phase=${eng.phase} turn=${eng.turn} (seed=${seed})`); break; }
    if (eng.actionSeq === before && eng.phase === 'play') {
      fail(`액션이 진행되지 않음(무한루프 위험): turn=${eng.turn} seed=${seed}`); break;
    }
  }
  if (eng.peekSeq > prevPeekSeq) peeks += (eng.peekSeq - prevPeekSeq);

  // ④ 교착 없이 종료 · 술래는 조커를 든 사람 하나
  if (eng.phase !== 'gameover') fail(`종료 안 됨: phase=${eng.phase} (n=${nPlayers} seed=${seed})`);
  else {
    const holders = [];
    for (let s = 0; s < nPlayers; s++) if (eng.hands[s].length > 0) holders.push(s);
    if (holders.length > 1) fail(`종료했는데 카드 든 사람이 ${holders.length}명 (seed=${seed})`);
    if (eng.loser >= 0) {
      if (!eng.hands[eng.loser].some(c => c.joker)) fail(`술래가 조커를 안 들었다 seat=${eng.loser} (seed=${seed})`);
      if (eng.hands[eng.loser].length !== 1) fail(`술래 손패가 1장이 아니다: ${eng.hands[eng.loser].length} (seed=${seed})`);
    } else fail(`술래가 없다 (seed=${seed})`);
    // 종료 시엔 술래 패가 공개돼야 한다(결과 화면용)
    const s0 = eng.serialize('p0');
    const shown = s0.players[eng.loser] ? s0.players[eng.loser].hand : null;
    if (!shown || !shown.length) fail(`종료 후 술래 패가 공개되지 않았다 (seed=${seed})`);
  }

  // ⑤ 아이템 지급이 전원 동일한가
  if (itemsOn) {
    const uniq = Array.from(new Set(itemsAtStart));
    if (uniq.length !== 1) fail(`아이템 지급 불균등: ${itemsAtStart.join(',')} (seed=${seed})`);
    else if (uniq[0] !== 2) fail(`기본 지급이 2가 아님: ${uniq[0]}`);
  } else if (itemsAtStart.some(x => x !== 0)) {
    fail(`아이템전 꺼짐인데 지급됨: ${itemsAtStart.join(',')}`);
  }

  eng.destroy();   // 함정: 하네스가 엔진을 안 놔주면 무한루프처럼 보인다
  return { steps, peeks, loser: eng.loser };
}

// ── 실행 ──────────────────────────────────────────────
let games = 0, totalSteps = 0, totalPeeks = 0, gamesWithPeek = 0, maxSteps = 0;
const loserTally = {};
for (const n of [3, 4, 5]) {
  for (const itemsOn of [false, true]) {
    for (let s = 0; s < 400; s++) {
      const seed = (n * 1000003) ^ (itemsOn ? 777 : 0) ^ (s * 2654435761);
      const r = runOne(n, itemsOn, seed);
      games++; totalSteps += r.steps; maxSteps = Math.max(maxSteps, r.steps);
      if (itemsOn) { totalPeeks += r.peeks; if (r.peeks > 0) gamesWithPeek++; }
      const k = n + '인';
      loserTally[k] = loserTally[k] || {};
      loserTally[k][r.loser] = (loserTally[k][r.loser] || 0) + 1;
    }
  }
}

console.log(`판 수: ${games}  ·  평균 ${(totalSteps / games).toFixed(1)}스텝  ·  최장 ${maxSteps}스텝`);
console.log(`아이템전 판(${games / 2}판) 중 실제로 👀을 쓴 판: ${gamesWithPeek}  ·  총 사용 ${totalPeeks}회`);
console.log('술래 분포:', JSON.stringify(loserTally));
/* ⚠️ 자리 편향은 **원래 HTML 로직에도 똑같이 있던 것**이라 실패로 치지 않는다.
   (원래 로직 독립 시뮬과 대조: 3인 33.9/42.4/23.7 · 5인 23.5/7.3/17.3/26.1/25.8 — 사실상 일치)
   4인은 공평하지만 3·5인은 크게 치우친다. 특히 5인 1번 자리는 술래 확률이 7%대로
   다른 자리(25%)의 1/3.5다. 규칙 변경이 필요한 밸런스 문제라 다음단계.md에 남겨뒀다. */
console.log('  ↑ 자리 편향은 원래 로직에도 있던 것(회귀 아님) — 다음단계.md 참고');

// AI가 아이템을 실제로 쓰는가 — 안 쓰면 '전원 지급'이 무의미하다
if (totalPeeks === 0) fail('AI가 👀을 한 번도 쓰지 않았다 (공정성 버그 — 윷에서 실제로 있었던 일)');

if (fails.length) {
  console.error('\n✗ 실패 ' + fails.length + '건:');
  fails.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log('\n✓ 조커누출0·짝정리·교착없음·아이템 전부 통과');
