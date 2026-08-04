#!/usr/bin/env node
/* 밸런스 실측 — 10종 코어를 전원 AI로 돌려 '한 판'을 숫자로 잰다.
 *
 * 무엇을 재나
 *   ① 판 길이   — 가상 시계로 **실제 걸리는 시간**(AI 생각 지연·연출 지연 포함)
 *   ② 자리 편향 — 0번 자리(=사람이 앉는 자리)가 유리/불리한가
 *   ③ 교착      — 안 끝나는 판이 있나
 *
 * 왜 가상 시계인가
 *   엔진은 setTimeout으로 AI 템포를 만든다. 실시간으로 돌리면 한 판에 몇 분씩 걸려
 *   200판을 못 잰다. 그래서 setTimeout을 **즉시 실행 + 가상 시각 누적**으로 바꿔
 *   "그 판이 진짜로는 몇 초짜리였나"를 정확히 뽑는다. 빨리 감기지, 건너뛰기가 아니다.
 *
 * ⚠️ 여기 시간은 **코어 기준 하한**이다. 실제 화면은 pace.js 배수(보통 1.35×)와
 *    카드/주사위 연출이 더 붙는다. 게임 간 비교용이지 절대값이 아니다.
 *
 * 사용: node scripts/balance-sim.js [판수]     (기본 200판)
 */
'use strict';
const path = require('path');
const P = (f) => require(path.join(__dirname, '..', 'public', f));

const { GameEngine } = P('game-core.js');
const { KBEngine } = P('kb-core.js');
const { LDEngine } = P('ld-core.js');
const { LCREngine } = P('lcr-core.js');
const { YutEngine } = P('yut-core.js');
const { AlkkagiEngine } = P('alkkagi-core.js');
const { IPEngine } = P('indianpoker-core.js');
const { OCEngine } = P('onecard-core.js');
const { OMEngine } = P('oldmaid-core.js');
const { SeotdaEngine } = P('seotda-core.js');

/* ───────── 가상 시계 ───────── */
const REAL = {
  setTimeout: global.setTimeout, clearTimeout: global.clearTimeout,
  setInterval: global.setInterval, clearInterval: global.clearInterval,
  setImmediate: global.setImmediate, now: Date.now,
};
function makeClock() {
  let now = 0, seq = 0, q = new Map();
  const push = (cb, ms, every, args) => {
    const id = ++seq;
    q.set(id, { id, at: now + Math.max(0, ms || 0), seq: id, cb, every, args });
    return id;
  };
  return {
    now: () => now,
    install() {
      global.setTimeout = (cb, ms, ...a) => push(cb, ms, 0, a);
      global.setInterval = (cb, ms, ...a) => push(cb, ms, Math.max(1, ms || 1), a);
      global.clearTimeout = (id) => q.delete(id && id.id ? id.id : id);
      global.clearInterval = global.clearTimeout;
      Date.now = () => now;
    },
    restore() {
      global.setTimeout = REAL.setTimeout; global.clearTimeout = REAL.clearTimeout;
      global.setInterval = REAL.setInterval; global.clearInterval = REAL.clearInterval;
      Date.now = REAL.now;
    },
    /** 끝날 때까지 돌린다. 반환: 'done' | 'stuck' | 'idle'
     *
     * ⚠️ **비동기여야 한다.** kb·yacht·인디언의 `_aiTurn()`은 `async` 함수이고
     *    `await wait(ms)`로 연출 사이를 쉰다. 동기 while 루프로 타이머만 때리면
     *    프라미스 continuation(마이크로태스크)이 **한 번도 실행되지 않아** 큐가 비고
     *    'idle'로 끝난다 — 엔진이 멈춘 것처럼 보이지만 우리가 안 돌린 것이다.
     *    매 스텝 setImmediate로 진짜 이벤트루프에 양보해 그걸 흘려보낸다. */
    async drain(isDone, maxVirtualMs, maxSteps) {
      let steps = 0;
      while (!isDone()) {
        if (!q.size) return 'idle';                    // 더 돌 게 없는데 안 끝났다
        let best = null;
        for (const t of q.values()) if (!best || t.at < best.at || (t.at === best.at && t.seq < best.seq)) best = t;
        if (best.at > maxVirtualMs) return 'stuck';
        now = best.at;
        if (best.every) { best.at = now + best.every; best.seq = ++seq; } else q.delete(best.id);
        try { best.cb.apply(null, best.args || []); } catch (e) { return 'error:' + e.message.slice(0, 60); }
        await new Promise(r => REAL.setImmediate(r));  // 마이크로태스크 flush
        if (++steps > maxSteps) return 'stuck';
      }
      return 'done';
    },
  };
}

/* ───────── 재현 가능한 rng (다른 sim들과 같은 mulberry32) ───────── */
function mkRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** --startturn=N: 선공을 고정한다(대조군). 안 주면 엔진 기본(무작위). */
const FIXED_TURN = (() => {
  const a = process.argv.find(x => x.startsWith('--startturn='));
  return a ? parseInt(a.slice(12), 10) : -1;
})();

const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({
  pid: 'p' + i, name: 'P' + i, color: ['#e0563f', '#4a90d9', '#57b36a', '#d9a441'][i % 4],
  ai: true, aiDiff: 'normal', connected: true,
}));

/* 구성은 server.js의 startEngine()과 같은 값을 쓴다(온라인 기본 템포).
   n = 이 게임의 기본 인원. */
const GAMES = [
  { key: 'yut', name: '윷놀이', n: 4, make: (pl, rng, on) => new YutEngine({
      aiFast: false, players: pl, markers: 4, goal: 4, teamMode: false, decideOrder: true,
      itemBattle: false, speedStart: false, pit: true, limitMs: 0, turnMs: 60000, aiMs: 1100, rng, onState: on }) },
  { key: 'yacht', name: '요트 다이스', n: 2, make: (pl, rng, on) => new GameEngine({
      mode: 'yacht_kr', difficulty: 'normal', aiFast: false, itemsOn: false, joker: false,
      players: pl, rng, onState: on, onRoll() {} }) },
  { key: 'kb', name: '너클본즈', n: 2, make: (pl, rng, on) => new KBEngine({
      aiFast: false, itemsOn: false, players: pl, rng, onState: on, onRoll() {} }) },
  { key: 'ld', name: '라이어 다이스', n: 4, make: (pl, rng, on) => new LDEngine({
      aiFast: false, itemsOn: false, players: pl, spotOn: true, diceCount: 5, wild: true,
      turnMs: 45000, rng, onState: on }) },
  { key: 'lcr', name: '좌·중·우', n: 4, make: (pl, rng, on) => new LCREngine({
      aiFast: false, itemsOn: false, players: pl, startChips: 3, turnMs: 45000, aiMs: 1400, rng, onState: on }) },
  /* --startturn=0 을 주면 옛 동작(늘 0번 자리가 선공)을 재현한다 — 편향이 실제였는지 대조용 */
  { key: 'alkkagi', name: '알까기', n: 2, make: (pl, rng, on) => new AlkkagiEngine({
      aiFast: false, players: pl, preset: 'standard', aiMs: 900, rng, onState: on,
      startTurn: (FIXED_TURN >= 0 ? FIXED_TURN : undefined) }) },
  { key: 'seotda', name: '섯다', n: 4, make: (pl, rng, on) => new SeotdaEngine({
      players: pl, itemsOn: false, ante: 200, startChips: 10000, jabi: false, ttaengValue: false,
      aiMs: 900, rng, onState: on }) },
  { key: 'indianpoker', name: '인디언 포커', n: 4, make: (pl, rng, on) => new IPEngine({
      players: pl, itemsOn: false, startChips: 5, aiMs: 850, showdownMs: 520, rng, onState: on }) },
  { key: 'onecard', name: '원카드', n: 4, make: (pl, rng, on) => new OCEngine({
      players: pl, itemsOn: false, aiMs: 780, rng, onState: on,
      startTurn: (FIXED_TURN >= 0 ? FIXED_TURN : undefined) }) },
  /* 도둑잡기만 '이긴 자리'가 아니라 **조커를 든 자리(진 사람)**를 센다 — 이 게임은 그게 결과다 */
  { key: 'oldmaid', name: '도둑잡기', n: 4, lose: true, make: (pl, rng, on) => new OMEngine({
      players: pl, itemsOn: false, aiMs: 780, pairMs: 420, stepMs: 360, rng, onState: on }) },
];

const OVER = (e) => e.phase === 'over' || e.phase === 'gameover';

/* 판과 판 사이를 누가 미는가 — 게임마다 다르다.
 *   섯다: 코어가 스스로 타이머로 다음 판을 깐다(seotda-core.js:403).
 *   인디언 포커: **사람이 '다음' 버튼을 눌러야 한다**(indianpoker.html:879).
 *     그래서 아무도 안 밀면 result에서 영원히 멈춘다 — 시뮬이 'idle'로 죽던 이유다.
 * 여기서는 사람의 클릭을 1.2초로 잡아 대신 눌러준다(그 시간도 판 길이에 포함된다). */
const HUMAN_CLICK_MS = 1200;
const ADVANCE = {
  indianpoker: (e) => (e.phase === 'result' ? () => e.nextHand() : null),
};

/* 결과 판정도 엔진마다 다르다 — 여기서 '틀리면 조용히 0%가 나온다'.
 *   요트: winner가 없고 `_winners()`(동점 가능한 배열)뿐이다.
 *   도둑잡기: 이기는 사람이 아니라 **조커를 든 사람(loser)**이 정해진다.
 * 둘 다 winner만 읽으면 데이터가 통째로 비는데, 표에는 '0%'로 보여서
 * "0번 자리가 한 번도 못 이긴다"로 오독하게 된다(실제로 그렇게 나왔었다). */
const RESULT = {
  // 요트의 _winners()는 배열이 아니라 {top, names, pids} — pids가 2개면 동점이라 뺀다
  yacht: (e, pl) => { const w = e._winners(); return w && w.pids && w.pids.length === 1 ? pl.findIndex(p => p.pid === w.pids[0]) : null; },
  oldmaid: (e) => (e.loser >= 0 ? e.loser : null),
};

function seatOfPlayer(x, pl) {
  const p = x && x.p ? x.p : x;
  if (!p) return null;
  if (typeof p.seat === 'number') return p.seat;
  const i = pl.findIndex(q => q.pid === p.pid);
  return i >= 0 ? i : null;
}

/** 승자를 자리 번호로 정규화한다 — 엔진마다 pid/인덱스/객체로 제각각이다 */
function winnerSeat(eng, pl) {
  let w = eng.winner;
  if (w == null && typeof eng.serialize === 'function') {
    try { w = (eng.serialize(pl[0].pid) || {}).winner; } catch (e) { try { w = (eng.serialize() || {}).winner; } catch (e2) {} }
  }
  if (w == null) return null;
  if (typeof w === 'number') return w;
  if (typeof w === 'string') { const i = pl.findIndex(p => p.pid === w); return i >= 0 ? i : null; }
  if (typeof w === 'object') {
    if (typeof w.seat === 'number') return w.seat;
    if (w.pid != null) { const i = pl.findIndex(p => p.pid === w.pid); return i >= 0 ? i : null; }
    if (Array.isArray(w) && w.length) return winnerSeat({ winner: w[0] }, pl);
  }
  return null;
}

async function runOne(g, seed) {
  const clock = makeClock();
  const pl = mkPlayers(g.n);
  let states = 0;
  clock.install();
  let eng = null, verdict = 'done';
  try {
    let pending = false;
    const adv = ADVANCE[g.key];
    eng = g.make(pl, mkRng(seed), () => {
      states++;
      if (!adv || pending) return;
      const push = adv(eng);
      if (push) { pending = true; setTimeout(() => { pending = false; push(); }, HUMAN_CLICK_MS); }
    });
    eng.start();
    verdict = await clock.drain(() => OVER(eng), 60 * 60 * 1000, 300000);
  } catch (e) {
    verdict = 'error:' + e.message.slice(0, 70);
  } finally {
    const ms = clock.now();
    clock.restore();
    const pick = RESULT[g.key] || winnerSeat;
    const seat = eng && OVER(eng) ? pick(eng, pl) : null;
    try { eng && eng.destroy && eng.destroy(); } catch (e) {}
    return { ms, states, seat, verdict };
  }
}

const fmt = (ms) => {
  const s = Math.round(ms / 1000);
  return (s >= 60 ? Math.floor(s / 60) + '분 ' + String(s % 60).padStart(2, '0') + '초' : s + '초');
};
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
const pct = (x) => (x * 100).toFixed(1) + '%';

/* CLI
 *   node scripts/balance-sim.js 300                    전 게임 300판
 *   node scripts/balance-sim.js 200 --only=seotda,onecard --n=3
 *
 * ⚠️ 기본 인원은 **server.js(온라인) 기준**이다. 혼자 하기(로컬) 기본은 다를 수 있다 —
 *    섯다·인디언·원카드는 로컬 cfg가 3인, 도둑잡기는 4인이다(각 HTML의 `const cfg`).
 *    퍼널에서 중요한 건 처음 온 사람이 혼자 하는 판이므로 `--n`으로 맞춰서도 재볼 것. */
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const nOverride = parseInt((process.argv.find(a => a.startsWith('--n=')) || '').slice(4), 10) || 0;
if (only.length) { for (let i = GAMES.length - 1; i >= 0; i--) if (!only.includes(GAMES[i].key)) GAMES.splice(i, 1); }
if (nOverride) GAMES.forEach(g => { g.n = nOverride; });

const K = parseInt(process.argv[2], 10) || 200;
console.log(`판수 ${K} · 전원 AI(normal) · 온라인 기본 템포 · 아이템 없음\n`);
console.log('게임          인원  판 길이(중앙)   최장       상태변화  0번자리 승률(기대)  교착');
console.log('─'.repeat(88));

const report = [];
(async () => {
for (const g of GAMES) {
  const runs = [];
  for (let i = 0; i < K; i++) runs.push(await runOne(g, 0x9E37 + i * 7919));
  const ok = runs.filter(r => r.verdict === 'done');
  const bad = runs.filter(r => r.verdict !== 'done');
  const times = ok.map(r => r.ms);
  const seats = ok.map(r => r.seat).filter(s => s != null);
  const p0 = seats.filter(s => s === 0).length;
  const share = seats.length ? p0 / seats.length : 0;
  const expect = 1 / g.n;
  /* 이항 표준편차로 '우연인가'를 본다. |관측-기대| > 2σ면 표시한다. */
  const sd = Math.sqrt(expect * (1 - expect) / Math.max(1, seats.length));
  const off = seats.length ? (share - expect) / sd : 0;
  const flag = Math.abs(off) >= 2 ? (off > 0 ? ' ⚠️유리' : ' ⚠️불리') : '';
  report.push({ g, med: med(times), max: Math.max(...times, 0), states: med(ok.map(r => r.states)), share, expect, off, bad, seats: seats.length });
  const rate = seats.length
    ? pct(share) + '(' + pct(expect) + ')' + (g.lose ? '패' : '')
    : '판정불가';
  console.log(
    g.name.padEnd(12) + String(g.n).padStart(3) + '   ' +
    fmt(med(times)).padEnd(13) + fmt(Math.max(...times, 0)).padEnd(10) +
    String(med(ok.map(r => r.states))).padStart(6) + '   ' +
    rate.padStart(17) + flag.padEnd(8) +
    (bad.length ? ` ❌${bad.length}판 ${bad[0].verdict}` : ''));
}

console.log('\n── 눈여겨볼 것 ──');
const long = report.filter(r => r.med > 4 * 60 * 1000);
const biased = report.filter(r => Math.abs(r.off) >= 2);
const stuck = report.filter(r => r.bad.length);
if (long.length) console.log('· 판이 길다(중앙 4분↑): ' + long.map(r => `${r.g.name} ${fmt(r.med)}`).join(' · '));
if (biased.length) console.log('· 자리 편향: ' + biased.map(r => `${r.g.name} ${pct(r.share)} vs 기대 ${pct(r.expect)} (${r.off.toFixed(1)}σ)`).join(' · '));
if (stuck.length) console.log('· 안 끝나거나 터진 판: ' + stuck.map(r => `${r.g.name} ${r.bad.length}판(${r.bad[0].verdict})`).join(' · '));
if (!long.length && !biased.length && !stuck.length) console.log('· 없음 — 길이·편향·교착 전부 정상 범위');
})();
