#!/usr/bin/env node
/**
 * 윷 말 배치 계산 검증 — **같은 자리에 선 말이 서로를 완전히 가리지 않는가.**
 *
 * 왜 (2026-08-11 재성님 지적: "말이 겹칠 때 누군가의 말이 밑에 깔려서 안 보이는 경우 없게")
 *   29(완주 게이트)는 0(출발점) **위치에 그려진다**. 그런데 렌더러가 칸 번호로 묶는 바람에
 *   0에 선 말과 29에 선 말이 각각 자기 그룹의 중앙(off=0)에 놓여 **좌표가 정확히 같았다.**
 *   그 상황은 무작위 판으로 재현하기 어렵다(한 바퀴 돈 말 + 후퇴로 0에 떨어진 말이 동시에 필요).
 *   그래서 화면 대신 **계산식을 그대로 떼어** 확인한다.
 *
 * ⚠️ 여기 식은 `public/yut.html`의 renderPieces와 **손으로 맞춘 사본**이다.
 *    렌더러를 고치면 여기도 같이 고칠 것 — 안 그러면 이 검사는 옛 식을 지키게 된다.
 */
'use strict';
const NODE_SPACING = 66;          // 이웃 칸 사이 거리(0.2 × 판 폭 332)
const PIECE_D = 32;               // 말 지름(ring r=16)

/* renderPieces의 배치 규칙 사본 */
const spotOf = (nd) => (nd === 29 ? 0 : nd);
function layout(pieces) {         // pieces: [{id, node}] → [{id, x, scale}]
  const by = {};
  pieces.forEach(p => { const k = spotOf(p.node); (by[k] = by[k] || []).push(p); });
  const out = [];
  Object.keys(by).forEach(k => {
    const arr = by[k], n = arr.length;
    const gap = n <= 3 ? 13 : n <= 5 ? 12 : 10;
    const shrink = n <= 4 ? 1 : n <= 6 ? 0.86 : 0.76;
    arr.forEach((p, i) => out.push({ id: p.id, x: (+k) * NODE_SPACING + (i - (n - 1) / 2) * gap, scale: shrink }));
  });
  return out;
}

let fail = 0;
const check = (name, cond, extra) => { console.log((cond ? '✅ ' : '❌ ') + name + (extra ? '  ' + extra : '')); if (!cond) fail++; };

/* ① 0과 29 — 판 위 같은 자리다. 겹쳐도 서로 보여야 한다. */
{
  const L = layout([{ id: 'a', node: 0 }, { id: 'b', node: 29 }]);
  const d = Math.abs(L[0].x - L[1].x);
  check('시작점(0)과 종착점(29) 말이 서로 안 가린다', d >= 8, `중심 거리 ${d.toFixed(1)}px`);
}
/* ② 붐빌 때 — 각 말의 '드러나는 폭'이 8px 이상이어야 뒤쪽도 알아본다. */
[2, 4, 5, 6, 8].forEach(n => {
  const L = layout(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, node: 7 })));
  const gap = Math.abs(L[1].x - L[0].x);
  const span = Math.abs(L[n - 1].x - L[0].x) + PIECE_D * L[0].scale;
  check(`한 칸에 ${n}개 — 드러나는 폭 ${gap.toFixed(1)}px · 전체 ${span.toFixed(0)}px`,
    gap >= 8 && span <= NODE_SPACING * 1.6, span > NODE_SPACING * 1.6 ? '(옆 칸까지 침범)' : '');
});
process.exit(fail ? 1 : 0);
