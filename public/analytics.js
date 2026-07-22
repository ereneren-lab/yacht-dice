/* 계측 — Plausible(쿠키리스, 개인 식별 없음)
 *
 * 퍼널 4단계 (설계: A 트랙)
 *   1. 진입      → pageview (Plausible 자동, UTM 자동 수집)
 *   2. 게임시작  → '게임시작'  — 판이 실제로 깔린 순간
 *   3. 1판완료   → '1판완료'   — 판이 끝까지 간 순간
 *   4. D1/D3 재방문 → Plausible 재방문자 지표
 *
 * 설계 원칙: 계측은 게임을 절대 망가뜨리지 않는다.
 *  - Plausible이 차단·실패해도 큐 스텁이 호출을 삼킨다
 *  - 모든 전송은 try/catch
 *  - 쿠키·localStorage 미사용 → 동의 배너 불필요
 *  - 게임 로직 파일을 거의 건드리지 않는다 (아래 '게임시작 감지' 참고)
 */
(function () {
  // Plausible 로드 전/차단 시에도 호출이 터지지 않도록 큐 스텁
  window.plausible = window.plausible || function () {
    (window.plausible.q = window.plausible.q || []).push(arguments);
  };

  // 로컬 개발에선 Plausible이 이벤트를 무시한다. 콘솔로 확인한다(검증 스크립트가 이 줄을 읽는다).
  var DEV = /^(localhost|127\.|0\.0\.0\.0|\[?::1)/.test(location.hostname);

  function send(name, props) {
    try {
      if (DEV) { console.log('[AL]', name, props ? JSON.stringify(props) : ''); return; }
      window.plausible(name, props ? { props: props } : undefined);
    } catch (e) { /* 계측 실패는 삼킨다 */ }
  }

  // 페이지 경로 → 게임 이름
  var GAMES = {
    'yut':   '윷놀이',
    'yacht': '요트 다이스',
    'kb':    '너클본즈',
    'ld':    '라이어 다이스',
    'lcr':   '좌·중·우'
  };
  var slug = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
  var GAME = GAMES[slug] || '허브';

  // 게임 시작은 진입 경로가 여러 개다(혼자/온라인/재입장). 페이지당 1회만 센다.
  var started = false;

  var AL = window.AL = {
    start: function () {
      if (started) return;
      started = true;
      send('게임시작', { 게임: GAME });
    },
    done: function (won) {
      send('1판완료', { 게임: GAME, 결과: won ? '승' : '패' });
    },
    ev: send
  };

  /* 게임시작 감지 — 윷·너클본즈·라이어·좌중우는 판이 깔릴 때 body에 'ingame'을 붙인다.
   * 그 신호를 여기서 관찰하면 게임 로직 4곳을 건드리지 않아도 된다.
   * (요트만 'ingame'을 쓰지 않아 yacht.html에서 AL.start()를 직접 부른다.)
   * AL.start가 멱등이라 로비 복귀 후 재시작해도 중복으로 세지 않는다. */
  function watchIngame() {
    try {
      var body = document.body;
      if (!body) return;
      if (body.classList.contains('ingame')) AL.start();
      new MutationObserver(function () {
        if (body.classList.contains('ingame')) AL.start();
      }).observe(body, { attributes: true, attributeFilter: ['class'] });
    } catch (e) { /* 관찰 실패해도 게임엔 영향 없음 */ }
  }

  // 이 파일은 <head>에서 실행되므로 body가 아직 없다. DOM 준비 후에 관찰을 건다.
  if (GAME !== '허브' && typeof MutationObserver === 'function') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', watchIngame);
    } else {
      watchIngame();
    }
  }
})();
