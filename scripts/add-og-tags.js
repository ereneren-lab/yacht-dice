#!/usr/bin/env node
/**
 * 게임 13종 HTML에 링크 미리보기(OG/트위터) 태그를 넣는다.
 *
 * 왜 필요한가 (2026-08-07)
 *   이 서비스가 퍼지는 길은 '친구와 하기'로 만든 **방 링크를 카카오톡에 붙여넣는 것**이다.
 *   그런데 미리보기 태그가 **허브(index.html)에만** 있었다. 정작 제일 많이 공유되는
 *   게임/방 링크는 맨 URL로만 떠서, 받은 사람은 그게 뭔지도 모르고 넘긴다.
 *
 * 무엇을 넣나: 게임 이름이 들어간 제목 · 한 줄 설명 · 1200×630 카드(og-card.jpg).
 *   ⚠️ 카드는 게임별로 다르지 않다(공용 한 장). 게임별 카드는 나중에 만들 것 —
 *      지금은 '아무것도 없다'에서 '무엇인지 보인다'로 가는 게 먼저다.
 *
 * 다시 돌려도 안전하다(이미 있으면 건너뛴다). 새 게임을 추가하면 여기 목록에도 넣을 것.
 * 사용: node scripts/add-og-tags.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const BASE = 'https://yacht-dice-jxva.onrender.com';

/* 설명은 **그 게임이 뭔지 한 줄로** — 받은 사람이 링크만 보고 판단한다.
   시간 표기는 허브 배지와 같은 값(balance-sim 실측)이라 서로 어긋나지 않는다. */
const GAMES = {
  'kb':          ['너클본즈', '주사위를 굴려 상대 줄을 부수는 3×3 한 판 · 1분 안팎'],
  'yacht':       ['요트 다이스', '주사위 다섯 개로 열두 칸을 채우는 고전 · 2~3분'],
  'ld':          ['라이어 다이스', '허풍과 도전으로 주사위를 지키는 심리전 · 1~2분'],
  'lcr':         ['좌·중·우', '규칙 없이 굴리기만 하면 되는 파티 게임 · 1분 안팎'],
  'yut':         ['윷놀이', '업고 잡고 지름길로 — 네 말 먼저 들이기 · 3~4분'],
  'alkkagi':     ['알까기', '손끝으로 튕겨 상대 돌을 판 밖으로 · 1분 이내'],
  'seotda':      ['섯다', '두 장으로 겨루는 한국식 포커 · 4~5분'],
  'indianpoker': ['인디언 포커', '남의 패는 보이고 내 패만 안 보이는 판 · 2~3분'],
  'onecard':     ['원카드', '같은 무늬나 숫자로 먼저 손을 비우기 · 1분 안팎'],
  'oldmaid':     ['도둑잡기', '조커를 떠넘기는 눈치 싸움 · 1~2분'],
  'blackjack':   ['블랙잭', '21을 넘기지 않고 딜러 이기기 · 라운드제'],
  'baccarat':    ['바카라', '플레이어냐 뱅커냐, 한 판 승부 · 라운드제'],
  'highlow':     ['하이로우', '다음 카드가 높을까 낮을까 · 라운드제'],
};

const block = (key, name, desc) => `<!-- 링크 미리보기 — 방 링크를 카카오톡에 붙여넣었을 때 뜨는 카드(scripts/add-og-tags.js가 넣는다) -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="딱세판만">
<meta property="og:url" content="${BASE}/${key}.html">
<meta property="og:title" content="${name} · 딱세판만">
<meta property="og:description" content="${desc} — 설치 없이 링크 하나로 친구와.">
<meta property="og:image" content="${BASE}/og-card.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${name} · 딱세판만">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${BASE}/og-card.jpg">
<meta name="description" content="${name} — ${desc}. 설치 없이 브라우저에서 바로, 링크 하나로 친구와 즐기는 딱세판만 13종 중 하나.">`;

let added = 0, skipped = 0;
for (const [key, [name, desc]] of Object.entries(GAMES)) {
  const f = path.join(ROOT, key + '.html');
  if (!fs.existsSync(f)) { console.log(`⚠️ 없는 파일: ${key}.html`); continue; }
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('og:title')) { skipped++; continue; }
  const m = s.match(/<title>[\s\S]*?<\/title>/);
  if (!m) { console.log(`⚠️ <title>을 못 찾음: ${key}.html`); continue; }
  s = s.replace(m[0], m[0] + '\n' + block(key, name, desc));
  fs.writeFileSync(f, s);
  added++;
}
console.log(`✅ 미리보기 태그 — 새로 넣음 ${added}종 · 이미 있어서 건너뜀 ${skipped}종`);
