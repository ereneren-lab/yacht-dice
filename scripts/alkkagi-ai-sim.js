#!/usr/bin/env node
/* 알까기 AI 난이도 실측 — **쉬움 < 보통 < 어려움 순서가 실제로 지켜지나.**
 *
 * 왜 필요한가 (2026-08-06)
 *   헤드리스 브라우저로 6판씩 눌러 봤더니 초보 수준 조작 상대로
 *   쉬움 3승 · 보통 0승 · **어려움 3승**이 나왔다. 6판은 표본이 아니라 소음이라
 *   여기서 수백 판을 돌려 확인한다. 코어가 UMD라 브라우저 없이 그대로 돌아간다.
 *
 * 상대(초보 역)는 엔진 안에 있는 옛 AI `_naiveFlick`이다 —
 * '아무 내 돌이나 골라 가장 가까운 상대 쪽으로 대충 친다'. 사람 초보의 대용이지 사람은 아니다.
 *
 * ⚠️ 승률은 '이 초보 대용 상대에게' 몇 판 이겼나다. 사람 실력의 절대 척도가 아니다.
 *    난이도끼리 **비교**하는 용도로만 쓸 것.
 *
 * 사용: node scripts/alkkagi-ai-sim.js [판수]      (기본 200판)
 */
'use strict';
const path = require('path');
const { AlkkagiEngine } = require(path.join(__dirname, '..', 'public', 'alkkagi-core.js'));

const N = +(process.argv[2] || 200);
const MAX_TURNS = 200;   // 교착 방지 — 여기 걸리면 무승부로 센다

/* 한 판. seat0 · seat1에 각각 '누가 두나'를 넣는다.
   엔진 타이머를 안 쓰려고 manualAI로 두고 두 쪽 다 여기서 직접 둔다.
   ⚠️ `action`은 `type:'flick'`이 있어야 받는다(클라가 보내는 모양). AI 내부 함수는 그걸 안 붙인다. */
function playOne(p0, p1, firstSeat) {
  const eng = new AlkkagiEngine({
    players: [{ pid: 's0', name: 'S0', ai: true, aiDiff: p0 === 'novice' ? 'easy' : p0 },
              { pid: 's1', name: 'S1', ai: true, aiDiff: p1 === 'novice' ? 'easy' : p1 }],
    preset: 'standard', manualAI: true,
  });
  eng.turn = firstSeat;
  const pick = (seat, who) => who === 'novice' ? eng._naiveFlick(seat) : eng._pickAiFlick(seat, who);
  let turns = 0, mis = [0, 0];
  while (eng.phase !== 'over' && turns < MAX_TURNS) {
    const seat = eng.turn;
    const flick = pick(seat, seat === 0 ? p0 : p1);
    if (!flick) break;
    eng.action(eng.players[seat].pid, { type: 'flick', ...flick });
    if (eng.lastSim && eng.lastSim.misfired) mis[seat]++;
    turns++;
  }
  const win = eng.phase === 'over' ? (eng.winner === 's1' ? 1 : 0) : null;   // null = 교착
  return { win, turns, mis };
}

/* p1(뒤쪽) 기준 성적. 선공을 반씩 나눠 자리 편향을 뺀다. */
function series(p0, p1, n) {
  let w = 0, l = 0, stall = 0, mis = 0, turns = 0;
  for (let i = 0; i < n; i++) {
    const r = playOne(p0, p1, i % 2);
    if (r.win === 1) w++; else if (r.win === 0) l++; else stall++;
    mis += r.mis[1]; turns += r.turns;
  }
  return { w, l, stall, mis: mis / n, turns: turns / n, rate: w / (w + l || 1) };
}

const NAME = { easy: '쉬움', normal: '보통', hard: '어려움', novice: '초보대용' };

console.log(`알까기 AI 난이도 — ${N}판씩, 선공 반반\n`);
console.log(`① 초보 대용(옛 무작위 AI) 상대 승률 — 절대 감각용`);
console.log('난이도    승률       교착   판당 삑사리  평균 차례');
console.log('─'.repeat(56));
for (const d of ['easy', 'normal', 'hard']) {
  const r = series('novice', d, N);
  console.log(`${NAME[d].padEnd(8)} ${String(r.w).padStart(3)}승 ${String(r.l).padStart(3)}패 ${(r.rate * 100).toFixed(1).padStart(5)}%` +
    `  ${String(r.stall).padStart(3)}판  ${r.mis.toFixed(2).padStart(8)}회 ${r.turns.toFixed(1).padStart(8)}`);
}

/* ⚠️ 위 ①만 보면 보통과 어려움이 둘 다 천장(97%)에 붙어 안 갈린다 — 상대가 너무 약해서다.
   난이도의 순서는 **맞대결**로 가른다. */
console.log(`\n② 맞대결 — 센 쪽이 이겨야 순서가 맞다`);
console.log('대진                 뒤쪽 승률   교착');
console.log('─'.repeat(56));
const pairs = [['easy', 'normal'], ['normal', 'hard'], ['easy', 'hard']];
const res = pairs.map(([a, b]) => {
  const r = series(a, b, N);
  console.log(`${(NAME[a] + ' vs ' + NAME[b]).padEnd(20)} ${(r.rate * 100).toFixed(1).padStart(6)}%  ${String(r.stall).padStart(3)}판`);
  return r.rate;
});
/* 문턱을 55%로 둔다 — 200판에서 50:50의 흔들림이 ±3.5%p라 51%짜리 '승리'는 동전 던지기다.
   실제로 고치기 전 어려움은 보통 상대 51.5%였다(= 안 셌다는 뜻인데 >50%면 통과해 버렸다). */
const ok = res.every(x => x > 0.55);
console.log(`\n${ok ? '✅ 쉬움 < 보통 < 어려움 순서가 지켜진다(전 대진 55% 초과)'
  : '❌ 난이도 순서가 깨졌다 — 센 난이도가 55%를 못 넘긴 대진이 있다(동전 던지기와 구분이 안 된다)'}`);
process.exit(ok ? 0 : 1);
