/* 방(웹소켓) 서버 주소 — **여기 한 곳에서만 정한다.**
 *
 * 🔴 2026-08-11에 이것 때문에 방이 안 열렸다.
 *   8/7에 화면을 CDN(GitHub Pages)으로 옮기면서 net.js의 주소 계산은 고쳤는데,
 *   **자기 소켓을 직접 여는 6종(윷·너클본즈·라이어·좌중우·요트·알까기)은 각자 옛 식을 갖고 있었다.**
 *   옛 식은 무조건 `location.host`라, 정적 주소에서 열면 `wss://ereneren-lab.github.io`로 걸어
 *   "서버 연결 실패"가 났다. 게임 서버는 멀쩡했는데 엉뚱한 데를 두드리고 있었다.
 *   → 식이 일곱 벌이면 한 벌만 고쳐지는 날이 온다. 그래서 한 벌로 모은다.
 *
 * 규칙
 *   ① 앱(Capacitor) — 번들이 https://localhost 로 뜨므로 게임 서버를 직접 가리킨다
 *   ② 로컬 개발(localhost) — 지금 이 서버(node server.js)에 그대로 붙는다
 *   ③ 그 외(CDN·정적 배포·데스크톱 앱) — 방은 게임 서버로
 */
(function (root) {
  'use strict';
  var GAME_SERVER = 'yacht-dice-jxva.onrender.com';

  function isLocal(h) { return h === 'localhost' || h === '127.0.0.1' || h === '::1'; }

  root.wsServerUrl = function () {
    try {
      if (root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform()) {
        return 'wss://' + GAME_SERVER;
      }
      if (isLocal(location.hostname)) {
        return (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host;
      }
    } catch (e) { /* 어떤 경우에도 주소는 하나 돌려준다 */ }
    return 'wss://' + GAME_SERVER;
  };
  root.WS_GAME_SERVER = GAME_SERVER;
})(typeof window !== 'undefined' ? window : this);
