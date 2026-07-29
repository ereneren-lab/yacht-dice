/* text-floor.js — 읽어야 하는 글자에 최소 크기(12px)를 보장한다.
 *
 * 왜 있나 (2026-07-29, 384x748 실측)
 *   12px 미만 텍스트가 13종 합계 127개, 최소 7.5px였다. 그런데 대부분이 장식이 아니라
 *   **읽어야 하는 정보**였다:
 *     .hint 10.5px "주사위를 굴려 시작하세요"   ← 그 화면에서 뭘 해야 하는지 알려주는 문장
 *     .pname 10.5px "호구"                      ← 상대가 누구인지
 *     .pl 8.5px "팟" · .pb-l 9px "판돈"          ← 지금 걸린 돈
 *     .tag 7.5px "방향" · .chipl 8.5px "칩"
 *     .myhint 10px "내 카드는 나만 못 봐요 🙈"
 *
 * 왜 일괄로 안 올리나
 *   **카드 구석 무늬(.cs ♣)와 주사위 눈 번호(.idx 1)는 그래픽에 붙은 글자**다.
 *   키우면 카드·주사위가 깨진다. 그래서 '읽는 글자' 목록만 명시해서 올린다.
 *   (전부 올리는 게 편하지만, 편한 쪽이 맞는 쪽은 아니다.)
 *
 * ⚠️ 각 HTML의 인라인 <style>보다 뒤에 붙어야 이긴다 → head 끝에 append한다.
 * ⚠️ 글자가 커지면 넘칠 수 있다 → 넣은 뒤 반드시 `npm run audit:ux`로 넘침 0을 확인할 것.
 */
(function () {
  'use strict';

  var FLOOR = '12px';

  /* 읽는 글자 — 실측에서 12px 미만으로 잡힌 것들 중 '정보'인 것.
     그래픽에 붙은 .cs(카드 무늬) · .idx(주사위 번호)는 일부러 뺐다. */
  var SEL = [
    /* 사람·상태 */
    '.pname', '.pnm', '.hnm', '.me-tag', '.turnflag', '.pact', '.dealer',
    '.seatspeech', '.mturn', '.db-nm',
    /* 수량·판돈 */
    '.pcount', '.pchip', '.pl', '.pb-l', '.potl', '.pot-call', '.betchips',
    '.chipl', '.mc-chip', '.ba', '.rew', '.ax', '.op-pool-label',
    /* 라벨·안내 */
    '.hint', '.myhint', '.sq-hint', '.slotlabel', '.pilelbl', '.lbl2', '.lab',
    '.dirbadge', '.an', '.tag', '.obadge', '.stagenote', '.dr-h', '.opc-throwtag',
    '.divider', '.ztag', '.qh',
    /* 2차 — 자식 <b>/<span>만 작게 잡혀서 처음에 놓쳤던 '부모' 클래스들.
       리프만 세는 감사에서는 부모가 안 잡힌다(자식이 있으니까) — 자식이 물려받은 크기로 드러난다. */
    '.gaugehint',      // 윷: "버튼을 꾹 눌렀다 초록칸(찬스)에서 떼면…" — 조작 방법 그 자체다
    '.op-sub', '.op-progress',
    '.mini',           // 라이어: "4개 (와일드 1 포함)"
    '.myhead', '.myname', '.kbvs',
    '.sh-full',        // 좌·중·우: L/C/R — 한 글자지만 이게 규칙의 핵심이다
    '.sp',             // 바카라: 배당 "1 : 1"
    '.kbvs .lead'      // 너클본즈: '동점'/'앞섬' 배지 — 자체 font-size가 있어 부모를 올려도 안 따라온다
  ];

  function boot() {
    try {
      if (document.getElementById('tfStyle')) return;
      // 각 셀렉터를 개별 규칙으로 — :is()를 못 쓰는 구형 웹뷰에서도 나머지가 살아남는다
      /* ⚠️ line-height는 건드리지 않는다.
         처음엔 1.35를 같이 줬는데, 윷 가로(640x360)에서 .app이 0.9px 커져
         문서 넘침이 1px 잡혔다(서브픽셀 반올림). 글자 크기를 올리는 게 목적이지
         줄 간격을 바꾸는 게 목적이 아니다 — 필요 없는 변경은 부작용만 남긴다. */
      var css = SEL.map(function (s) {
        return s + '{font-size:' + FLOOR + ' !important}';
      }).join('');
      var st = document.createElement('style');
      st.id = 'tfStyle';
      st.textContent = css;
      document.head.appendChild(st);
    } catch (e) { }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
