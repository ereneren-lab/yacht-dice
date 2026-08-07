#!/usr/bin/env node
/**
 * 디자인 토큰 감사 — **13종이 같은 것을 같은 값으로 그리고 있나.**
 *
 * 왜 (2026-08-07)
 *   토큰(`--brass`·`--panel`)을 쓰고는 있는데 **파일마다 값이 따로**다. 공유가 아니라 복붙이었다.
 *   실측: 브랜드 골드 `--brass`가 4가지(#e0a23c · #d9b35a · #c99653 · #8f6420),
 *   `.btn` 모서리 3가지(12·13·14px), 상단 아이콘 3가지(34·36·40px).
 *   허브에서 섯다로 들어가면 금색이 바뀐다 — 사람은 이유를 모른 채 '싼 느낌'으로 받는다.
 *
 * 이 감사는 **값을 강제로 통일하지 않는다.** 어떤 차이는 의도다(카드 게임의 초록 펠트 판).
 *   대신 ① 지금 상태를 표로 보여주고 ② 아래 ALLOW에 적어 둔 '의도된 차이' 밖으로 새 값이
 *   생기면 실패한다. 이유 없이 벌어지는 것만 막는다.
 *
 * 사용: node scripts/audit-tokens.js      (브라우저 불필요)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const GAMES = ['index','kb','yacht','ld','lcr','yut','alkkagi','seotda','indianpoker','onecard','oldmaid','blackjack','baccarat','highlow'];

/* 무엇을 볼까 — '같아야 마땅한 것'만 고른다. 게임마다 다른 판·카드 색은 여기 넣지 않는다. */
const CHECKS = [
  { key: '--brass',      label: '강조색(금)',   re: /--brass:\s*([^;]+)/ },
  { key: '--ink',        label: '본문 글자색',  re: /--ink:\s*([^;]+)/ },
  { key: 'btn-radius',   label: '.btn 모서리',  re: /\.btn\s*\{[^}]*border-radius:\s*([^;]+)/ },
  { key: 'btn-padding',  label: '.btn 안여백',  re: /\.btn\s*\{[^}]*padding:\s*([^;]+)/ },
  { key: 'icon-size',    label: '상단 아이콘',  re: /\.iconbtn\s*\{[^}]*width:\s*([^;]+)/ },
];

/* 의도된 차이 — **왜 다른지 여기 적는다.** 적지 않은 차이는 실패로 잡힌다. */
const ALLOW = {
  '--brass': {
    '#e0a23c': '허브·주사위 계열 기본 금색',
    '#d9b35a': '카드 게임(초록 펠트 위) — 같은 금색이면 탁해 보여 한 톤 밝게',
    '#c99653': '알까기(나무 판) — 판이 이미 노란기라 채도를 낮춤',
    '#8f6420': '요트 — 라이트 테마(hanji) 값이 먼저 잡힌 것으로 보인다. ⚠️ 의도인지 미확인',
  },
  '--panel': {
    '#26201a': '기본(에스프레소)', '#1c2f18': '카드 게임 초록 펠트', '#2a2015': '알까기 나무',
  },
};

let fail = 0;
const table = [];
for (const g of GAMES) {
  const f = path.join(ROOT, g + '.html');
  if (!fs.existsSync(f)) continue;
  const css = fs.readFileSync(f, 'utf8');
  const row = { game: g };
  for (const c of CHECKS) { const m = css.match(c.re); row[c.key] = m ? m[1].trim() : '-'; }
  table.push(row);
}

const W = 13;
console.log('게임'.padEnd(W) + CHECKS.map(c => c.label.padEnd(16)).join(''));
console.log('─'.repeat(W + CHECKS.length * 16));
for (const r of table) console.log(r.game.padEnd(W) + CHECKS.map(c => String(r[c.key]).padEnd(16)).join(''));

console.log('');
for (const c of CHECKS) {
  const vals = {};
  for (const r of table) { const v = String(r[c.key]); if (v !== '-') (vals[v] = vals[v] || []).push(r.game); }
  const keys = Object.keys(vals);
  if (keys.length <= 1) { console.log(`✅ ${c.label} — 전부 ${keys[0] || '없음'}`); continue; }
  const allow = ALLOW[c.key] || {};
  const unexplained = keys.filter(v => !allow[v]);
  console.log(`${unexplained.length ? '❌' : '⚠️ '} ${c.label} — ${keys.length}가지`);
  for (const v of keys) {
    const why = allow[v] ? `(${allow[v]})` : '← 왜 다른지 적혀 있지 않다';
    console.log(`     ${v.padEnd(16)} ${vals[v].join(', ')}  ${why}`);
  }
  if (unexplained.length) fail++;
}

console.log(`\n${fail ? `❌ 이유가 적히지 않은 차이 ${fail}종 — 의도면 scripts/audit-tokens.js의 ALLOW에 적고, 아니면 값을 맞출 것`
  : '✅ 갈라진 값은 전부 이유가 적혀 있다'}`);
process.exit(fail ? 1 : 0);
