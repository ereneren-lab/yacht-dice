#!/usr/bin/env node
/**
 * 윷 말 배치 셈이 **한 벌인가** — 소스를 읽어서 본다(브라우저 불필요).
 *
 * 왜 이 방식인가 (2026-08-11)
 *   같은 자리 계산이 세 군데에 따로 적혀 있었다:
 *     ① renderPieces        — 실제로 그리는 곳
 *     ② pieceSettledXY      — 이동 애니가 **내려앉을 좌표**를 정하는 곳
 *     ③ scripts/sim/yut-stack-math.js — 손으로 베낀 사본
 *   8/11에 ①만 고쳤다(29→0 접기 · 간격 가변). ②는 옛 셈(칸 번호 그대로 · 13px 고정)으로 남아
 *   좌표가 어긋났고 — 0과 29에 하나씩이면 6.5px, 여섯이 몰리면 7.5px —
 *   말이 내려앉은 뒤 옆으로 튀고 착지 먼지도 엉뚱한 데서 폈다.
 *   **튐을 막으려고 만든 함수가 튐을 만들었다.**
 *
 * 왜 화면으로 안 재나
 *   게임 상태 S도 pieceSettledXY도 **IIFE 안**이라 밖에서 부를 수 없다(yut-drive.js에도 적혀 있다).
 *   그려진 좌표만 읽을 수 있고 '착지 좌표'는 못 읽으니 두 답을 화면에서 맞댈 수가 없다.
 *   실제로 판을 굴려 잡으려 해도 그 배치(0과 29에 동시에 · 한 칸에 6개)는 무작위로는 거의 안 나온다.
 *   → 그래서 **셈이 여러 벌로 갈라지는 것 자체를** 막는다. 갈라지지 않으면 어긋날 수 없다.
 *
 * 재는 것
 *   ⓐ 스택 오프셋 식이 파일 전체에 한 번만 나오는가
 *   ⓑ 29→0 접기 · 간격 사다리 · 축소 사다리가 각각 한 번만 나오는가
 *   ⓒ pieceSettledXY가 제 손으로 셈하지 않고 공용 함수를 쓰는가
 *   ⓓ 베낀 사본(yut-stack-math.js)의 상수가 원본과 같은가
 *
 * 사용: npm run test:yutstack
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
/* 경로를 인자로 받는다 — 이 검사가 **정말 그 버그를 잡는지** 옛 버전에 돌려 확인하려고 열어 뒀다:
   git show 73f201e:public/yut.html > /tmp/old.html && node 이파일 /tmp/old.html  → ❌가 나와야 맞다 */
const YUT = fs.readFileSync(process.argv[2] || path.join(ROOT, 'public/yut.html'), 'utf8');
const SIMP = path.join(ROOT, 'scripts/sim/yut-stack-math.js');

let fail = 0;
const P = (s) => console.log(s);
const ok = (cond, label, detail) => {
  if (cond) { P(`✅ ${label}`); return true; }
  fail++; P(`❌ ${label}`); if (detail) P(`   ${detail}`); return false;
};

const count = (re) => (YUT.match(re) || []).length;

P('\n════════ 윷 말 배치 셈이 한 벌인가 ════════');

/* ⓐ 판 위 말 자리는 `[..., by-2]` 꼴로 나온다 — 이 y보정이 '칸에 놓인 말'의 표식이다.
   (다른 곳의 `(i-(n-1)/2)*` 센터링은 자리 배치·주사위·날아가는 연출이라 상관없다.
    표식으로 좁히지 않으면 그런 것들까지 잡혀 검사가 늘 빨간불이 된다.) */
const nOffset = count(/by-2\s*\]/g);
ok(nOffset === 1, `판 위 말 자리를 내는 곳이 하나다 (${nOffset}곳)`,
  nOffset > 1 ? 'pieceStackXY 말고 다른 곳에서도 자리를 셈한다 — 둘이 어긋나면 말이 튄다'
              : '못 찾았다 — pieceStackXY가 사라졌거나 모양이 바뀌었다');

/* ⓑ 29→0 접기 */
const nSpot = count(/29\s*\?\s*0\s*:/g);
ok(nSpot === 1, `29→0 접기가 한 번만 나온다 (${nSpot}번)`,
  '완주 게이트(29)를 출발점(0) 자리로 접는 규칙이 두 곳에 있으면 한쪽만 고쳐진다');

/* ⓑ 간격 사다리·축소 사다리 */
const nGap = count(/\?\s*13\s*:.*?\?\s*12\s*:/g);
ok(nGap === 1, `간격 사다리(13/12/10)가 한 번만 나온다 (${nGap}번)`, 'PC_GAP 말고 다른 사본이 있다');
const nShrink = count(/0\.86\s*:\s*0\.76/g);
ok(nShrink === 1, `축소 사다리(0.86/0.76)가 한 번만 나온다 (${nShrink}번)`, 'PC_SHRINK 말고 다른 사본이 있다');

/* ⓒ pieceSettledXY가 공용 셈을 쓰는가 — 제 손으로 셈하면 8/11 버그가 그대로 돌아온다 */
const body = (YUT.match(/function pieceSettledXY\([\s\S]*?\n  \}/) || [''])[0];
ok(/pieceStacks\(\)/.test(body) && /pieceStackXY\(/.test(body),
  'pieceSettledXY가 공용 셈(pieceStacks·pieceStackXY)을 쓴다',
  '착지 좌표를 제 손으로 셈하고 있다 — 그리는 쪽과 어긋날 수 있다');
ok(!/by-2\s*\]/.test(body), 'pieceSettledXY 안에서 자리를 따로 셈하지 않는다',
  '공용 함수를 두고도 제 손으로 또 셈한다');
ok(count(/PC_GAP\(/g) === 1, `간격을 꺼내 쓰는 곳이 하나다 (${count(/PC_GAP\(/g)}곳)`,
  '여러 곳에서 간격을 쓰면 한쪽만 바뀐다 — pieceStackXY를 부를 것');

/* renderPieces 쪽도 공용 셈을 쓰는가 */
ok(/const byNode\s*=\s*pieceStacks\(\)/.test(YUT), 'renderPieces가 공용 셈으로 말을 묶는다',
  'renderPieces가 따로 묶으면 pieceSettledXY와 스택 순서가 달라질 수 있다');

/* ⓓ 베낀 사본이 원본과 같은가 — 사본은 어긋나면 '옛 식을 지키는 검사'가 된다 */
if (fs.existsSync(SIMP)) {
  const SIM = fs.readFileSync(SIMP, 'utf8');
  const same = (re, label) => {
    const a = (YUT.match(re) || [])[0], b = (SIM.match(re) || [])[0];
    ok(a && b && a.replace(/\s+/g, '') === b.replace(/\s+/g, ''),
      `사본(yut-stack-math.js)의 ${label}이 원본과 같다`,
      `원본 "${a}" ↔ 사본 "${b}" — 사본이 옛 식을 지키고 있다`);
  };
  same(/29\s*\?\s*0\s*:\s*\w+/, '29→0 접기');
  same(/13\s*:\s*\w+\s*<=\s*5\s*\?\s*12\s*:\s*10/, '간격 사다리');
  same(/1\s*:\s*\w+\s*<=\s*6\s*\?\s*0\.86\s*:\s*0\.76/, '축소 사다리');
} else {
  P('ℹ️  사본(scripts/sim/yut-stack-math.js)이 없다 — 대조 생략');
}

P(`\n${fail ? `❌ ${fail}건 — 말 자리 셈이 갈라져 있다. 갈라진 채로 두면 한쪽만 고쳐지고 말이 튄다.`
            : '✅ 말 자리 셈은 한 벌이다 — 그리는 곳과 착지 좌표가 어긋날 수 없다'}`);
process.exit(fail ? 1 : 0);
