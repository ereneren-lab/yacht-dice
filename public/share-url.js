/* share-url.js — 초대(공유) 링크 주소를 **한 곳에서** 정한다. window.inviteUrl
 *
 * 왜 있나 (2026-08-12, 초대·공유 루프 강화)
 *   초대 링크가 7개 파일 14곳에 `location.origin + location.pathname + '?room='` 로 복붙돼 있었다.
 *   문제: **잠든 Render(yacht-dice-jxva.onrender.com)에서 만든 링크**를 친구가 받으면
 *     ① 페이지 콜드스타트 21.6초(실측) → 많이 이탈  ② 카톡 미리보기 카드도 크롤러가 잠든
 *     서버를 못 깨워 안 뜬다 → 클릭률 급락. 바이럴 루프의 최대 누수였다.
 *   해결: **onrender에서 만든 링크는 항상 깨어있는 github.io로 바꿔준다.** 정적 호스트라
 *     즉시 로딩 + 미리보기 항상 뜸. 방(WebSocket)은 ws-url.js가 페이지 출처와 무관하게
 *     늘 Render로 걸므로, github.io 페이지에서도 멀티플레이는 그대로 된다.
 *
 * 규칙 (ws-url.js와 같은 계열 — 한 벌로 모아 드리프트 방지)
 *   · onrender.com 에서 만든 링크  → https://ereneren-lab.github.io/yacht-dice/<파일>?room=코드
 *   · 그 외(github.io·커스텀 도메인·localhost·Capacitor 앱) → 현재 origin 그대로 (바꿀 이유 없음)
 *   ⚠️ 되돌리기/도메인 변경: 아래 FAST 한 줄만 바꾸면 전 게임 초대 링크가 그리로 간다.
 */
(function (root) {
  'use strict';
  var FAST = 'https://ereneren-lab.github.io/yacht-dice';   // 항상 깨어있는 정적 호스트

  function fileOf() {
    try { var p = (location.pathname || '').split('/').pop(); return p || 'index.html'; }
    catch (e) { return 'index.html'; }
  }

  /* 초대 URL을 돌려준다. code가 없으면 방 파라미터 없이 그 페이지 링크만. */
  root.inviteUrl = function (code) {
    var q = code ? ('?room=' + encodeURIComponent(code)) : '';
    try {
      if (/\.onrender\.com$/i.test(location.hostname)) return FAST + '/' + fileOf() + q;
    } catch (e) {}
    return location.origin + location.pathname + q;
  };
  /* 초대 **문구**도 여기서 만든다 (2026-08-13).
     🔴 왜: 링크는 여기로 모았는데 문구는 각자 갖고 있어서, net.js 4종만 좋은 문구를 쓰고
        자체소켓 5종(윷·너클본즈·라이어·좌중우·요트)은 옛 문구가 그대로 나갔다(실기기에서 확인).
        초대 문구는 친구가 받는 **첫인상**이라 갈리면 안 된다. 링크와 같은 곳에 둔다.
     게임 이름은 <title>의 '·' 앞부분에서 가져온다(전 게임 공통 형식). */
  root.inviteText = function (code) {
    /* ⚠️ 게임 이름은 <title>에서 **뒤의 '딱세판만'을 떼서** 얻는다. 앞에서 자르면 안 된다:
         · 구분자가 두 가지다 — '섯다 · 딱세판만' 과 '너클본즈 — 딱세판만'
         · '좌·중·우 — 딱세판만'은 이름 안에 '·'가 있어 앞에서 자르면 '좌'만 남는다
       (2026-08-13: 처음엔 split('·')[0]으로 썼다가 윷이 '윷놀이 — 딱세판만'으로 통째로 들어갔다.) */
    var g = '';
    try {
      g = (document.title || '').replace(/\s*[·—-]\s*딱세판만\s*$/, '').trim();
      if (g === '딱세판만') g = '';        // 허브처럼 이름이 없는 페이지
    } catch (e) {}
    return (g ? '딱세판만 · ' + g : '딱세판만') +
           ' 한 판 하자! 🔗 링크만 누르면 바로 시작 · 설치 없어요' +
           (code ? ' (방 코드 ' + code + ')' : '');
  };
  root.SHARE_FAST_BASE = FAST;
})(typeof window !== 'undefined' ? window : this);
