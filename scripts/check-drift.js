#!/usr/bin/env node
/* check-drift.js — 엔진 이중 구조 드리프트 검사 (의존성 0)
 *
 * 각 *-core.js(서버 원본)가 해당 HTML 인라인 사본에 그대로 들어있는지 확인한다.
 * 비교는 주석·공백을 제거한 뒤 "core 문자열이 HTML 문자열의 부분집합인가"로 판정
 * (CLAUDE.md의 동기화 확인 로직과 동일). 하나라도 어긋나면 exit 1.
 *
 * 사용: npm run check:drift   (== node scripts/check-drift.js)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');

// [게임, core 파일, HTML 파일]
const CASES = [
  ['yut',   'yut-core.js',  'yut.html'],
  ['kb',    'kb-core.js',   'kb.html'],
  ['ld',    'ld-core.js',   'ld.html'],
  ['lcr',   'lcr-core.js',  'lcr.html'],
  ['yacht', 'game-core.js', 'yacht.html'],
];

// 블록/라인 주석과 모든 공백 제거
const strip = (x) =>
  x
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, '');

let drift = false;
for (const [game, coreName, htmlName] of CASES) {
  const core = fs.readFileSync(path.join(PUBLIC, coreName), 'utf8');
  const html = fs.readFileSync(path.join(PUBLIC, htmlName), 'utf8');
  const ok = strip(html).includes(strip(core));
  console.log(`${ok ? 'OK   ' : 'DRIFT'} ${game}  (${coreName} ⊂ ${htmlName})`);
  if (!ok) drift = true;
}

if (drift) {
  console.error('\n✗ 드리프트 감지: 위 DRIFT 게임의 인라인 사본이 core와 다릅니다. `npm run build`로 동기화하세요.');
  process.exit(1);
}
console.log('\n✓ 모든 게임 동기화됨.');
