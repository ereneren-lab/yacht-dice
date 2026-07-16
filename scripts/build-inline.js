#!/usr/bin/env node
/* build-inline.js — 엔진 단일 소스화 빌드 (의존성 0)
 *
 * 각 게임의 *-core.js(서버가 require하는 원본)를 해당 HTML 안
 * <!-- CORE:x START --> ~ <!-- CORE:x END --> 사이 인라인 <script>로 주입한다.
 * 엔진 로직의 단일 소스는 core.js 하나이며, HTML 인라인 사본은 이 스크립트로만 갱신한다.
 *
 * 사용: npm run build   (== node scripts/build-inline.js)
 * 규칙: 마커 사이의 인라인 <script> 블록만 교체한다. 그 바깥(앱 로직/CSS)은 손대지 않는다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');

// 게임 → [core 파일, HTML 파일]
const MAP = {
  yut:   ['yut-core.js',  'yut.html'],
  kb:    ['kb-core.js',   'kb.html'],
  ld:    ['ld-core.js',   'ld.html'],
  lcr:   ['lcr-core.js',  'lcr.html'],
  yacht: ['game-core.js', 'yacht.html'],
};

let hadError = false;

for (const game of Object.keys(MAP)) {
  const [coreName, htmlName] = MAP[game];
  const corePath = path.join(PUBLIC, coreName);
  const htmlPath = path.join(PUBLIC, htmlName);

  const core = fs.readFileSync(corePath, 'utf8');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // core 안에 </script>가 있으면 HTML 파싱이 깨진다(대소문자·공백 포함 방어).
  if (/<\/\s*script/i.test(core)) {
    console.error(`✗ [${game}] ${coreName} 안에 </script> 시퀀스가 있습니다 — 인라인 주입 불가.`);
    hadError = true;
    continue;
  }

  // 마커 사이(마커 라인 자체는 보존)를 <script>\n{core}\n</script>로 치환.
  const re = new RegExp(
    `(<!-- CORE:${game} START[^\\n]*-->)\\n[\\s\\S]*?\\n(<!-- CORE:${game} END -->)`
  );
  if (!re.test(html)) {
    console.error(`✗ [${game}] ${htmlName}에 CORE:${game} 마커(START/END)가 없습니다. 마커를 먼저 삽입하세요.`);
    hadError = true;
    continue;
  }

  // 치환 형식: <script>\n{core 내용}\n</script>  (core는 말미 개행 포함)
  // 함수 리플레이서 사용: core 안의 $&, $`, $1 등이 특수 치환으로 오해되는 것을 방지.
  const next = html.replace(re, (m, startMarker, endMarker) =>
    `${startMarker}\n<script>\n${core}\n</script>\n${endMarker}`
  );

  if (next === html) {
    console.log(`= [${game}] 변화 없음 (이미 동기화됨)`);
  } else {
    fs.writeFileSync(htmlPath, next);
    console.log(`✓ [${game}] ${htmlName} ← ${coreName} 주입 완료`);
  }
}

if (hadError) {
  console.error('\n빌드 실패: 위 오류를 해결하세요.');
  process.exit(1);
}
console.log('\nbuild-inline 완료.');
