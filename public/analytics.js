/* 계측 — Plausible(쿠키리스, 개인 식별 없음)
 *
 * 퍼널 4단계 (설계: A 트랙)
 *   1. 진입      → pageview (Plausible 자동, UTM 자동 수집)
 *   2. 게임시작  → '게임시작'  — 판이 실제로 깔린 순간
 *   3. 1판완료   → '1판완료'   — 판이 끝까지 간 순간
 *   4. D1/D3 재방문 → Plausible 재방문자 지표
 *
 * 곁가지 퍼널 — 친구 부르기 (2026-08-11 추가)
 *   방만들기 → 초대보내기 → 초대입장(친구가 ?room= 링크를 열었다)
 *   이 앱의 핵심 행동이라 따로 본다. 셋 다 아래쪽에서 **한 곳으로** 잡는다.
 *   ⚠️ 초대입장을 pageview로 대신할 수 없다 — Plausible은 쿼리스트링을 버려서
 *      `?room=`으로 들어온 사람과 그냥 들어온 사람이 같은 줄로 합쳐진다.
 *      이 이벤트가 없으면 초대보내기의 성공률을 영영 모른다.
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

  /* 페이지 경로 → 게임 이름.
   * ⚠️ 여기 없는 게임은 조용히 '허브'로 집계된다 — 에러가 안 나서 알아채기 어렵다.
   *    실제로 계측 도입(5종) 이후 추가된 8종이 전부 '허브'로 찍히고 있었다
   *    (2026-07-29에 verify-done-event.js로 발견: 하이로우·원카드·도둑잡기·블랙잭 → "게임":"허브").
   *    게임을 새로 추가하면 **이 표에 반드시 한 줄 추가할 것.** */
  var GAMES = {
    'yut':         '윷놀이',
    'yacht':       '요트 다이스',
    'kb':          '너클본즈',
    'ld':          '라이어 다이스',
    'lcr':         '좌·중·우',
    'alkkagi':     '알까기',
    'seotda':      '섯다',
    'indianpoker': '인디언 포커',
    'onecard':     '원카드',
    'oldmaid':     '도둑잡기',
    'blackjack':   '블랙잭',
    'baccarat':    '바카라',
    'highlow':     '하이로우'
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

  /* 방만들기 — 나가는 소켓 메시지를 엿본다.
   *
   * 방 만들기는 페이지마다 제 손으로 {t:'create'}를 쏜다. 지금 일곱 군데다:
   *   net.js(인디언·섯다·원카드·도둑잡기) · yut · kb · ld · lcr · yacht · alkkagi
   * 그 일곱 곳에 AL 호출을 심는 대신 여기서 한 번 본다 —
   * 위 GAMES 표를 새 게임에서 잊어 8종이 통째로 '허브'로 찍히던 일을 이미 겪었다(2026-07-29).
   * 호출부를 늘리면 같은 방식으로 또 썩는다. 소켓을 보면 새로 붙는 게임도 저절로 잡힌다.
   *
   * 재접속은 {t:'rejoin'}이라 다시 세지 않는다(6종 전부 확인). 한 판 하고 나와 또 만들면
   * 그건 진짜로 두 번 만든 것이므로 두 번 센다.
   */
  try {
    var WS = window.WebSocket;
    if (WS && WS.prototype && typeof WS.prototype.send === 'function') {
      var _wsSend = WS.prototype.send;
      WS.prototype.send = function (data) {
        // 엿보다 터져도 원래 send는 반드시 나가야 한다 — 계측이 방 만들기를 막으면 안 된다
        try {
          if (typeof data === 'string' && data.indexOf('"create"') > 0) {
            var m = JSON.parse(data);
            if (m && m.t === 'create') send('방만들기', { 게임: GAME });
          }
        } catch (e) { /* 계측 실패는 삼킨다 */ }
        return _wsSend.apply(this, arguments);
      };
    }
  } catch (e) { /* WebSocket이 없는 환경 */ }

  /* 초대보내기 — 대기실의 '초대 링크' 버튼. id 세 개가 전부다.
   *   ntInvite(net.js 4종) · lobbyCopy(윷·좌중우·알까기) · copyLink(요트·너클본즈·라이어)
   * 허브의 '친구와 하기'(inviteBtn)는 코드 입력창을 여는 것이라 뺀다 — 보내는 쪽이 아니다.
   *
   * 공유 시트를 띄웠다가 취소해도 센다. 알고 싶은 건 '보내려 했는가'이고,
   * 공유 성공 여부는 브라우저마다 알 수 있는 정도가 달라 어차피 못 믿는다.
   * capture 단계로 듣는다 — 게임 쪽 핸들러가 전파를 끊어도 놓치지 않게.
   */
  /* 초대입장 — 받은 링크(?room=CODE)를 열었다. 초대보내기의 짝이다.
   * 허브(index.html)로도 ?room=이 들어오고 거기서 게임 페이지로 다시 넘겨준다 —
   * 그때 게임 페이지에서 또 한 번 세면 한 사람이 두 번 찍힌다.
   * 그래서 허브에선 세지 않는다(라우팅을 거칠 뿐 도착지가 아니다). */
  try {
    if (GAME !== '허브' && /[?&]room=[A-Za-z0-9]/.test(location.search)) {
      send('초대입장', { 게임: GAME });
    }
  } catch (e) { /* 계측 실패는 삼킨다 */ }

  var INVITE_BTN = { ntInvite: 1, lobbyCopy: 1, copyLink: 1 };
  document.addEventListener('click', function (e) {
    try {
      // 버튼 안쪽 이모지·span을 눌렀을 수 있으니 몇 겹 위까지 올려다본다
      for (var n = e.target, i = 0; n && i < 4; i++, n = n.parentElement) {
        if (n.id && INVITE_BTN[n.id] === 1) { send('초대보내기', { 게임: GAME }); return; }
      }
    } catch (err) { /* 계측 실패는 삼킨다 */ }
  }, true);
})();
