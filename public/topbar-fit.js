/* topbar-fit.js — 인게임 상단바의 제목이 짓눌려 잘리는 걸 막는다.
 *
 * 왜 있나 (2026-07-29, 384x748 실측)
 *   상단바 아이콘이 5~7개라 제목에 남는 폭이 **20~60px**밖에 없었다.
 *     윷      client=20  / 필요 47   "윷놀이 · AI 대전"   ← 사실상 안 보임
 *     요트    client=60  / 필요 82   "요트 다이스 Lv.1 · 주사위 새내기"
 *     하이로우 client=48  / 필요 58   "하이로우"
 *   게다가 text-overflow가 clip이라 **말줄임(…)도 없이 글자 중간에서 뚝 끊긴다.**
 *   에러가 안 나니 감사에서도 오래 안 잡혔다(그래서 audit-readable.js를 새로 만들었다).
 *
 * 무엇이 원인인가
 *   .title과 .spacer가 같은 flex 컨테이너에 있는데 .spacer{flex:1}만 자라고
 *   .title은 min-width:auto 기본값에도 불구하고 버튼들에 밀려 계속 줄어든다.
 *   → 남는 폭을 .title에 주고(.spacer는 안 자라게), 그래도 넘치면 말줄임으로 처리한다.
 *
 * 좁은 화면에서는 레벨·칭호 칩과 모드 표시를 숨긴다 —
 * 게임 이름이 먼저다. 레벨·칭호는 셋업 화면에서 이미 크게 보여준다.
 *
 * ⚠️ 각 HTML의 인라인 <style>보다 **뒤에** 붙어야 이긴다(같은 특이도면 나중이 이김).
 *    이 파일은 head 끝에 style을 append하므로 조건을 만족한다.
 */
(function () {
  'use strict';
  var CSS =
    /* 남는 폭은 제목이 갖는다. min-width:0이 없으면 flex 자식은 콘텐츠 최소폭 아래로 안 줄어들지만,
       반대로 여기서는 '더 줄어들지 않게' 하려는 게 아니라 '자라게' 하려는 것이다. */
    '.topbar .title,.kbtop .title,.topbar>h1,.topbar>h2,.kbtop>h1,.kbtop>h2{flex:1 1 auto;min-width:0;' +
    'overflow:hidden;white-space:nowrap;text-overflow:ellipsis}' +
    /* spacer가 남는 폭을 다 먹으면 제목이 못 자란다 → 자라지 않게 */
    '.topbar .spacer,.kbtop .spacer{flex:0 0 auto}' +
    /* 아이콘 버튼은 줄어들면 안 된다(찌그러진 버튼이 더 나쁘다) */
    '.topbar .iconbtn,.kbtop .iconbtn{flex:0 0 auto}' +
    /* 좁은 화면: 이름을 먼저 살린다. 레벨·칭호·모드는 셋업에서 이미 보여준다. */
    '@media (max-width:460px){' +
    '.topbar .title .meta-chip,.kbtop .title .meta-chip,' +
    '.topbar>.meta-chip,.kbtop>.meta-chip,.topbar>.mode-pill,.kbtop>.mode-pill,' +
    '.topbar .title #modeName,.topbar .title #modePill{display:none !important}' +
    '}';

  function boot() {
    try {
      if (document.getElementById('tbfStyle')) return;
      var st = document.createElement('style');
      st.id = 'tbfStyle';
      st.textContent = CSS;
      document.head.appendChild(st);
    } catch (e) { }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
