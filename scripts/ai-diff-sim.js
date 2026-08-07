#!/usr/bin/env node
/* AI 난이도 검증 — **쉬움/보통/어려움 손잡이를 돌리면 실제로 세지나.**
 *
 * 왜 필요한가 (2026-08-06)
 *   알까기에서 '어려움'이 '보통'을 상대로 51.5%였다 — 동전 던지기다.
 *   원인은 AI가 후보 샷을 시뮬해 고르면서 **삑사리 확률을 계산에 안 넣은 것**이었고,
 *   파워 1.0 후보를 가진 어려움만 스스로 위험한 수를 골라 왔다.
 *   같은 종류의 결함이 다른 게임에도 있는지 보려면 실제로 이기는지를 재야 한다.
 *
 * 어떻게 재나
 *   **한 자리만 시험 난이도, 나머지는 전부 보통**으로 두고 그 자리 승률을 잰다(자리는 판마다 돌린다).
 *   약한 봇을 상대로 재면 보통·어려움이 둘 다 천장에 붙어 안 갈리고, 2인 맞대결로 재면
 *   3인이 기본인 베팅 게임(섯다·인디언·라이어)의 '접는 성향' 가치가 뒤집혀 엉뚱한 답이 나온다.
 *
 * 판정: 쉬움 < 보통 < 어려움이면서 칸 사이가 5%p 넘게 벌어질 것.
 *   300판에서 흔들림이 ±2.7%p라 그보다 좁은 차이는 손잡이가 안 듣는 것과 구분이 안 된다.
 *
 * 요트만 다르다 — `difficulty`가 자리별이 아니라 **엔진 전역 옵션**이라 맞대결을 못 짠다.
 *   대신 같은 난이도끼리 돌려 **평균 점수**를 잰다(높을수록 세다).
 *
 * 빠진 게임: 좌·중·우(선택지가 없는 순수 운), 원카드·도둑잡기(난이도 옵션 없음), 알까기
 *   (전용 도구 `npm run test:alkkagi:ai` — 물리 시뮬이라 타이머가 필요 없다).
 *
 * 사용: node scripts/ai-diff-sim.js [판수]        (기본 100판, 판정하려면 300 이상)
 *       node scripts/ai-diff-sim.js 200 --only=kb,ld
 */
'use strict';
const path = require('path');
const P = (f) => require(path.join(__dirname, '..', 'public', f));

const { GameEngine } = P('game-core.js');
const { KBEngine } = P('kb-core.js');
const { LDEngine } = P('ld-core.js');
const { YutEngine } = P('yut-core.js');
const { SeotdaEngine } = P('seotda-core.js');
const { IPEngine } = P('indianpoker-core.js');

/* ───────── 가상 시계 — balance-sim.js와 같은 방식 ─────────
   엔진은 setTimeout으로 AI 템포를 만든다. 실시간이면 한 판에 몇 분이라 200판을 못 잰다.
   ⚠️ drain은 **비동기여야 한다**: kb·요트·인디언의 `_aiTurn()`이 async라
      동기 루프로 타이머만 때리면 마이크로태스크가 안 흘러 'idle'로 죽는다. */
const REAL = { setTimeout: global.setTimeout, clearTimeout: global.clearTimeout,
  setInterval: global.setInterval, clearInterval: global.clearInterval,
  setImmediate: global.setImmediate, now: Date.now };
function makeClock() {
  let now = 0, seq = 0, q = new Map();
  const push = (cb, ms, every, args) => { const id = ++seq;
    q.set(id, { id, at: now + Math.max(0, ms || 0), seq: id, cb, every, args }); return id; };
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
    async drain(isDone, maxVirtualMs, maxSteps) {
      let steps = 0;
      while (!isDone()) {
        if (!q.size) return 'idle';
        let best = null;
        for (const t of q.values()) if (!best || t.at < best.at || (t.at === best.at && t.seq < best.seq)) best = t;
        if (best.at > maxVirtualMs) return 'stuck';
        now = best.at;
        if (best.every) { best.at = now + best.every; best.seq = ++seq; } else q.delete(best.id);
        try { best.cb.apply(null, best.args || []); } catch (e) { return 'error:' + e.message.slice(0, 60); }
        await new Promise(r => REAL.setImmediate(r));
        if (++steps > maxSteps) return 'stuck';
      }
      return 'done';
    },
  };
}
function mkRng(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const mkPlayers = (diffs) => diffs.map((d, i) => ({
  pid: 'p' + i, name: 'P' + i, color: ['#e0563f', '#4a90d9'][i % 2],
  ai: true, aiDiff: d, connected: true,
}));

/* 구성은 balance-sim.js와 같은 값(온라인 기본 템포). **인원은 각 게임 셋업의 기본값**이다
   (`public/*.html`의 `cfg`) — 사람이 실제로 마주치는 판에서 재야 의미가 있다. */
const GAMES = [
  { key: 'kb', name: '너클본즈', n: 2, make: (pl, rng, on) => new KBEngine({
      aiFast: false, itemsOn: false, players: pl, rng, onState: on, onRoll() {} }) },
  { key: 'ld', name: '라이어', n: 3, make: (pl, rng, on) => new LDEngine({
      aiFast: false, itemsOn: false, players: pl, spotOn: true, diceCount: 5, wild: true,
      turnMs: 45000, rng, onState: on }) },
  { key: 'yut', name: '윷놀이', n: 2, make: (pl, rng, on) => new YutEngine({
      aiFast: false, players: pl, markers: 4, goal: 4, teamMode: false, decideOrder: true,
      itemBattle: false, speedStart: false, pit: true, limitMs: 0, turnMs: 60000, aiMs: 1100, rng, onState: on }) },
  { key: 'seotda', name: '섯다', n: 3, make: (pl, rng, on) => new SeotdaEngine({
      players: pl, itemsOn: false, ante: 200, startChips: 10000, jabi: false, ttaengValue: false,
      aiMs: 900, rng, onState: on }) },
  { key: 'indianpoker', name: '인디언', n: 3, make: (pl, rng, on) => new IPEngine({
      players: pl, itemsOn: false, startChips: 5, aiMs: 850, showdownMs: 520, rng, onState: on }) },
];

const OVER = (e) => e.phase === 'over' || e.phase === 'gameover';
/* 칩 게임(섯다·인디언)은 **한 명만 남을 때까지** 간다 — 그래서 최종 칩 점유율이 0 아니면 1이라
   승/패와 똑같은 무딘 자가 된다. 대신 **정해진 판수(HANDS)만 치고 칩을 센다.**
   칩 증감은 연속값이라 같은 판수로도 난이도 차이를 훨씬 잘 가른다. */
const HANDS = 40;
const CHIP_GAMES = { seotda: 1, indianpoker: 1 };
/* 인디언 포커는 판 사이를 **사람이 '다음'을 눌러** 넘긴다. 아무도 안 밀면 result에서 멈춘다. */
const ADVANCE = { indianpoker: (e) => (e.phase === 'result' ? () => e.nextHand() : null) };
const HUMAN_CLICK_MS = 1200;

/* 무승부를 '판정 불가'와 구분한다 — 너클본즈는 두 판의 점수가 같으면 `{tie:true}`를 준다.
   예전엔 이걸 seat 없음으로 보고 '불발'로 셌다(300판 중 6~7판). 게임 결함이 아니라 자의 문제였다. */
function isTie(eng, pl) {
  let w = eng.winner;
  if (w == null && typeof eng.serialize === 'function') {
    try { w = (eng.serialize(pl[0].pid) || {}).winner; } catch (e) { try { w = (eng.serialize() || {}).winner; } catch (e2) {} }
  }
  return !!(w && typeof w === 'object' && w.tie);
}
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
  }
  return null;
}

async function runOne(g, diffs, seed) {
  const pl = mkPlayers(diffs);
  const clock = makeClock();
  clock.install();
  let eng = null, verdict = 'done';
  try {
    let pending = false;
    const adv = ADVANCE[g.key];
    eng = g.make(pl, mkRng(seed), () => {
      if (!adv || pending) return;
      const push = adv(eng);
      if (push) { pending = true; setTimeout(() => { pending = false; push(); }, HUMAN_CLICK_MS); }
    });
    eng.start();
    const stop = CHIP_GAMES[g.key]
      ? () => OVER(eng) || (eng.handNo || 0) > HANDS
      : () => OVER(eng);
    verdict = await clock.drain(stop, 60 * 60 * 1000, 300000);
  } catch (e) {
    verdict = 'error:' + e.message.slice(0, 70);
  } finally {
    clock.restore();
    const seat = eng && OVER(eng) ? winnerSeat(eng, pl) : null;   // 판수로 끊었으면 승자가 없다(null)
    const tie = !!(eng && OVER(eng) && isTie(eng, pl));
    /* 칩 게임은 **최종 칩 점유율**도 같이 낸다. 승/패 한 비트는 300판이라도 분해능이 ±3.8%p라
       난이도 차이를 못 가른다(섯다에서 시드마다 결론이 뒤집혔다). 칩은 훨씬 예민한 자다. */
    let share = null;
    try {
      if (eng && eng.players && eng.players[0] && typeof eng.players[0].chips === 'number') {
        const tot = eng.players.reduce((a, p) => a + Math.max(0, p.chips || 0), 0);
        if (tot > 0) share = eng.players.map(p => Math.max(0, p.chips || 0) / tot);
      }
    } catch (e) {}
    try { eng && eng.destroy && eng.destroy(); } catch (e) {}
    return { seat, verdict, share, tie };
  }
}

/* 한 난이도의 성적 — **한 자리만 시험 난이도, 나머지는 전부 보통**으로 두고 그 자리 승률을 잰다.
 *
 * ⚠️ 처음엔 2인 맞대결로 쟀다가 다시 짰다(2026-08-06). 섯다·인디언·라이어의 실제 기본은 **3인**인데
 *    베팅 게임에서 '접는 성향'의 가치는 인원수에 따라 뒤집힌다 — 2인에서 잰 숫자를 3인 게임의
 *    난이도라고 말할 수 없다. 시험 자리는 판마다 옮겨 자리 편향을 뺀다.
 *    기대 승률은 1/n이고, 손잡이가 들으면 쉬움 < 보통 < 어려움 순으로 올라야 한다. */
async function series(g, diff, K) {
  const n = g.n;
  let w = 0, done = 0, bad = 0, shareSum = 0, shareN = 0, ties = 0;
  for (let i = 0; i < K; i++) {
    const testSeat = i % n;
    const diffs = Array.from({ length: n }, (_, s) => (s === testSeat ? diff : 'normal'));
    const r = await runOne(g, diffs, seedOf(i));
    const chipGame = !!CHIP_GAMES[g.key];
    if (r.tie) { ties++; continue; }        // 무승부는 승률 분모에서 뺀다(따로 센다)
    if (r.verdict !== 'done' || (!chipGame && r.seat == null) || (chipGame && !r.share)) { bad++; continue; }
    done++;
    if (r.seat === testSeat) w++;
    if (r.share) { shareSum += r.share[testSeat]; shareN++; }
  }
  return { w, done, bad, ties, rate: w / (done || 1), share: shareN ? shareSum / shareN : null };
}

/* 요트는 `difficulty`가 엔진 전역이라 맞대결이 안 된다 — 같은 난이도끼리 돌려 평균 점수를 잰다. */
async function yachtScores(diff, K) {
  const scores = [];
  for (let i = 0; i < K; i++) {
    const pl = mkPlayers(['normal', 'normal']);
    const clock = makeClock(); clock.install();
    let eng = null;
    try {
      eng = new GameEngine({ mode: 'yacht_kr', difficulty: diff, aiFast: false, itemsOn: false,
        joker: false, players: pl, rng: mkRng(seedOf(i)), onState() {}, onRoll() {} });
      eng.start();
      const v = await clock.drain(() => OVER(eng), 60 * 60 * 1000, 300000);
      if (v === 'done') {
        for (const p of eng.players) {
          const t = typeof eng._total === 'function' ? eng._total(p) : null;
          if (t != null) scores.push(t);
        }
      }
    } catch (e) { /* 아래 표에서 판수로 드러난다 */ }
    finally { clock.restore(); try { eng && eng.destroy && eng.destroy(); } catch (e) {} }
  }
  return scores;
}

const K = parseInt(process.argv[2], 10) || 100;
/* 시드는 고정이라 같은 코드면 결과가 똑같다(대조에 좋다). 다만 **한 벌의 시드에 맞춰 튜닝하면
   그건 과적합**이라, 고친 뒤에는 `--seed=2` 처럼 다른 벌로도 한 번 더 재 볼 것. */
const ONLY_DIFF = (process.argv.find(a => a.startsWith('--diff=')) || '').slice(7) || null;
const SEED0 = (parseInt((process.argv.find(a => a.startsWith('--seed=')) || '').slice(7), 10) || 1) * 0x9E37;
/* ⚠️ 판 번호로 시드를 만들 때 **곱셈으로 늘리면 안 된다**(2026-08-07).
   예전엔 `SEED0 + i*7919`였는데 시험 자리를 `i % n`으로 돌리다 보니 시드 증가폭과 자리 회전이
   맞물렸다 — 전원 '보통'인데도 시험 자리 승률이 25.3%로 찍혔다(33.3%여야 한다).
   해시로 흩어 자리 회전과의 상관을 끊는다. 아래 selfCheck()로 이걸 매번 확인한다. */
function seedOf(i) {
  let x = (SEED0 ^ Math.imul(i + 1, 2654435761)) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 2246822519); x ^= x >>> 13;
  return x >>> 0;
}
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const list = only.length ? GAMES.filter(g => only.includes(g.key)) : GAMES;
const THRESH = 0.55;

(async () => {
  console.log(`AI 난이도 — 난이도별 ${K}판, 시험 자리 1명 vs 나머지 보통, 자리 돌려가며\n`);
  console.log('게임        인원  쉬움    보통    어려움   기대    판정');
  console.log(`(칩 게임은 ${HANDS}판만 치고 끊으므로 승률 칸은 '그 안에 상대를 파산시킨 비율'이다 — 판정은 칩점유로 한다)`);
  console.log('─'.repeat(74));
  let fail = 0;
  for (const g of list) {
    const rs = {};
    for (const d of ONLY_DIFF ? [ONLY_DIFF] : ['easy', 'normal', 'hard']) rs[d] = await series(g, d, K);
    if (ONLY_DIFF) {   // 한 난이도만 잴 때(파라미터 쓸어보기용) — 그 칸만 찍고 넘어간다
      const r = rs[ONLY_DIFF];
      console.log(`${g.name.padEnd(10)} ${g.n}인  ${ONLY_DIFF.padEnd(7)} 승률 ${(r.rate * 100).toFixed(1)}%` +
        (r.share != null ? `  칩점유 ${(r.share * 100).toFixed(1)}%` : ''));
      continue;
    }
    const exp = 1 / g.n;
    /* 판정: 쉬움 < 보통 < 어려움이면서 각 칸이 소음(±3.3%p)보다 크게 벌어져야 한다.
       "손잡이를 돌렸는데 승률이 그대로"는 손잡이가 안 듣는 것이다. */
    const GAP = 0.05;
    /* 칩 점유율이 있으면 그걸로 판정한다(예민한 자). 없으면 승률로 본다. */
    const useChips = rs.easy.share != null;
    const val = (r) => (useChips ? r.share : r.rate);
    const ok = val(rs.normal) - val(rs.easy) > GAP && val(rs.hard) - val(rs.normal) > GAP;
    if (!ok) fail++;
    const f = (r) => `${(r.rate * 100).toFixed(1)}%`.padStart(6) + (r.bad ? `(불발${r.bad})` : '') + (r.ties ? `(무${r.ties})` : '');
    /* 자가 멀쩡한지 매번 확인한다 — '보통' 자리는 전원 보통인 판에서 재므로 정확히 1/n이 나와야 한다.
       크게 벗어나면 난이도가 아니라 **측정이 틀어진 것**이다(예전에 시드와 자리 회전이 맞물려 25.3%가 나왔다). */
    const off = Math.abs(val(rs.normal) - (useChips ? exp : exp));
    const noise = 2.5 * Math.sqrt(exp * (1 - exp) / K);
    if (off > noise) console.log(`${''.padEnd(10)} ⚠️ 자 점검: 보통(전원 보통)이 ${(val(rs.normal) * 100).toFixed(1)}% — 기대 ${(exp * 100).toFixed(1)}%에서 ${(off * 100).toFixed(1)}%p 벗어났다. 난이도가 아니라 측정을 의심할 것`);
    let why = '✅';
    if (!ok) {
      const bits = [];
      if (val(rs.normal) - val(rs.easy) <= GAP) bits.push(val(rs.normal) < val(rs.easy) ? '쉬움이 보통보다 셈' : '쉬움=보통');
      if (val(rs.hard) - val(rs.normal) <= GAP) bits.push(val(rs.hard) < val(rs.normal) ? '보통이 어려움보다 셈' : '보통=어려움');
      why = '❌ ' + bits.join(' · ');
    }
    console.log(`${g.name.padEnd(10)} ${g.n}인  ${f(rs.easy)} ${f(rs.normal)} ${f(rs.hard)}  ${(exp * 100).toFixed(1).padStart(5)}%  ${why}`);
    if (useChips) {
      const c = (r) => `${(r.share * 100).toFixed(1)}%`.padStart(6);
      console.log(`${''.padEnd(10)} 칩점유 ${c(rs.easy)} ${c(rs.normal)} ${c(rs.hard)}  ← 판정은 이 줄로 한다`);
    }
  }

  if (!only.length || only.includes('yacht')) {
    console.log(`\n요트 다이스 — 전역 옵션이라 맞대결 불가. 같은 난이도끼리 ${K}판, 평균 점수(높을수록 셈)`);
    console.log('─'.repeat(74));
    const avg = [];
    for (const d of ['easy', 'normal', 'hard']) {
      const s = await yachtScores(d, K);
      const m = s.length ? s.reduce((x, y) => x + y, 0) / s.length : 0;
      avg.push(m);
      console.log(`${d.padEnd(8)} 평균 ${m.toFixed(1).padStart(6)}점  (${s.length}명분)`);
    }
    const ok = avg[0] < avg[1] && avg[1] < avg[2];
    if (!ok) fail++;
    console.log(ok ? '✅ 점수가 난이도 순서대로 오른다' : '❌ 점수가 난이도 순서대로 안 오른다');
  }

  console.log(`\n${fail ? `❌ ${fail}종에서 난이도 손잡이가 기대대로 안 듣는다` : '✅ 검사한 게임 전부 난이도 순서가 지켜진다'}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
