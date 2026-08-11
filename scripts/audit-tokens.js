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

/* ⚠️ **기본 테마(:root)에서만 읽는다.** 처음엔 파일 전체에서 첫 `--brass:`를 잡았다가
   요트가 혼자 `#8f6420`인 것처럼 나왔다 — 알고 보니 그건 **라이트 테마(hanji) 값**이고
   요트 파일에선 그 블록이 위에 있었을 뿐이다. 하마터면 멀쩡한 브랜드 색을 '고칠' 뻔했다.
   테마별 값은 원래 달라야 한다. 비교 대상은 기본 테마 하나다. */
function rootBlock(css) {
  const m = css.match(/:root\s*\{([\s\S]*?)\}/);
  return m ? m[1] : '';
}

/* 토큰 이관(2026-08-11) 이후 — 이제 :root의 첫 블록은 대개 주입된 tokens.css다.
   그래서 '첫 정의된 이름'을 해석해 읽는다. 옛 이름(--brass/--accent/--gold)은
   새 이름(--brand-gold/--coin)의 별칭이므로, 새 이름 → 옛 이름 순으로 첫 값을 취한다.
   목적이 바뀌었다: 예전엔 '복붙 값이 갈라졌나'를 봤다면, 이제 tokens.css 단일소스로
   통일됐는지 + 아직 이관 안 된 파일(yacht)만 남았는지를 확인한다(check:drift와 짝). */
function firstVal(root, names) {
  for (const n of names) {
    const m = root.match(new RegExp(n.replace(/[-]/g, '\\-') + '\\s*:\\s*([^;]+)'));
    if (m) return m[1].trim();
  }
  return '-';
}

/* 무엇을 볼까 — '같아야 마땅한 것'만 고른다. 게임마다 다른 판·펠트 색은 여기 넣지 않는다. */
const CHECKS = [
  { key: '--brand-gold', label: '브랜드 골드', pick: r => firstVal(r, ['--brand-gold', '--brass', '--accent']), root: true },
  { key: '--coin',       label: '코인/재화',   pick: r => firstVal(r, ['--coin', '--gold']), root: true },
  { key: '--ink',        label: '본문 글자색',  pick: r => firstVal(r, ['--ink']), root: true },
  { key: 'btn-radius',   label: '.btn 모서리',  re: /\.btn\s*\{[^}]*border-radius:\s*([^;]+)/ },
  { key: 'btn-padding',  label: '.btn 안여백',  re: /\.btn\s*\{[^}]*padding:\s*([^;]+)/ },
  { key: 'icon-size',    label: '상단 아이콘',  re: /\.iconbtn\s*\{[^}]*width:\s*([^;]+)/ },
];

/* 의도된 차이 — **왜 다른지 여기 적는다.** 적지 않은 차이는 실패로 잡힌다.
   이관 후 --brand-gold·--ink는 tokens.css로 통일됐다(예외 없음 = 새 값이 생기면 실패).
   남은 차이는 아직 이관 안 한 yacht뿐 — 그 이유를 여기 적어 실패가 아닌 경고로 둔다. */
const ALLOW = {
  '--coin': {
    '#f0c65a': '기본 — 공용 tokens.css(이관 완료 13파일 전부 동일)',
    '#e8a13a': 'yacht — 아직 tokens.css 미이관(--accent·조크테마 얽힘, B 세계관 착수 시 --accent→--brand-gold 리네이밍과 함께 처리)',
  },
};

let fail = 0;
const table = [];
for (const g of GAMES) {
  const f = path.join(ROOT, g + '.html');
  if (!fs.existsSync(f)) continue;
  const css = fs.readFileSync(f, 'utf8');
  const row = { game: g };
  const root = rootBlock(css);
  for (const c of CHECKS) {
    if (c.pick) { row[c.key] = c.root ? c.pick(root) : c.pick(css); }
    else { const m = css.match(c.re); row[c.key] = m ? m[1].trim() : '-'; }
  }
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
