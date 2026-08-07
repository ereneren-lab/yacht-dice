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

const META = require('./game-meta');
const ROOT = path.join(__dirname, '..', 'public');
const BASE = 'https://yacht-dice-jxva.onrender.com';

/* 이름·설명·시간은 **game-meta.js 한 곳**에서 온다 — 카드(make-og-card.js)와 같은 문구를
   두 군데 두면 반드시 어긋난다. 카드에 적힌 시간과 태그의 시간이 다르면 그건 거짓말이 된다. */
const block = (key) => { const m = META[key]; const name = m.name, desc = `${m.desc} · 한 판 ${m.time}`; return `<!-- 링크 미리보기 — 방 링크를 카카오톡에 붙여넣었을 때 뜨는 카드(scripts/add-og-tags.js가 넣는다) -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="딱세판만">
<meta property="og:url" content="${BASE}/${key}.html">
<meta property="og:title" content="${name} · 딱세판만">
<meta property="og:description" content="${desc} — 설치 없이 링크 하나로 친구와.">
<meta property="og:image" content="${BASE}/og/${key}.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${name} · 딱세판만">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${BASE}/og/${key}.jpg">
<meta name="description" content="${name} — ${desc}. 설치 없이 브라우저에서 바로, 링크 하나로 친구와 즐기는 딱세판만 13종 중 하나.">`; };

let added = 0, fixed = 0;
for (const key of Object.keys(META)) {
  const f = path.join(ROOT, key + '.html');
  if (!fs.existsSync(f)) { console.log(`⚠️ 없는 파일: ${key}.html`); continue; }
  let s = fs.readFileSync(f, 'utf8');
  /* 이미 태그가 있으면 **건너뛰지 않고 카드 주소만 맞춘다.** 예전엔 건너뛰었다가
     온라인 5종이 옛 아이콘을 가리킨 채 남았다 — 방 링크를 제일 많이 보내는 게임들이었다. */
  if (s.includes('og:title')) {
    const before = s;
    s = s.split(`${BASE}/og-card.jpg`).join(`${BASE}/og/${key}.jpg`);
    if (s !== before) { fs.writeFileSync(f, s); fixed++; }
    continue;
  }
  const m = s.match(/<title>[\s\S]*?<\/title>/);
  if (!m) { console.log(`⚠️ <title>을 못 찾음: ${key}.html`); continue; }
  s = s.replace(m[0], m[0] + '\n' + block(key));
  fs.writeFileSync(f, s);
  added++;
}
console.log(`✅ 미리보기 태그 — 새로 넣음 ${added}종 · 카드 주소 갱신 ${fixed}종`);
