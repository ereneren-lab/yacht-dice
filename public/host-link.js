/**
 * `?host=1` — 허브의 '친구와 하기'에서 넘어오면 **그 게임의 방까지 자동으로 만든다.**
 *
 * 왜 필요한가 (2026-08-05):
 *   허브 첫 화면을 개편하며 '친구와 하기' 버튼을 만들었는데, 정작 방은 못 만들었다.
 *   게임마다 온라인 진입/방 만들기 버튼의 id가 다르기 때문이다:
 *     · 온라인 열기 — 없음(이미 온라인 박스가 보임) · #onlineBtn(net.js 4종) · #tabOnline(요트)
 *     · 방 만들기  — #createBtn(5종) · #createRoom(요트) · #ntCreate(net.js 오버레이)
 *   그래서 버튼은 게임까지만 데려다주고 "고르면 그 게임에서 방을 만들 수 있어"라고만 약속했다.
 *   이 파일이 그 약속을 "누르면 방이 열린다"로 바꾼다.
 *
 * 설계 원칙
 *   · **게임 코드를 고치지 않는다.** 각 게임의 기존 버튼을 순서대로 눌러줄 뿐이다.
 *   · **아무것도 못 찾으면 조용히 포기한다.** 그러면 사용자는 그냥 셋업 화면을 보게 된다(예전과 같음).
 *     실패가 게임을 망가뜨리면 안 된다.
 *   · 성공 판정은 게임과 무관한 신호로 한다 — 방에 들어가면 `{ns}_room`(4자리 코드)이 저장된다.
 *   · `?room=`(초대받아 들어온 쪽)일 땐 절대 끼어들지 않는다.
 *
 * 되돌리기: 각 게임 HTML의 <script src="host-link.js"> 한 줄을 지우면 된다.
 */
(function () {
  'use strict';
  var q;
  try { q = new URLSearchParams(location.search); } catch (e) { return; }
  if (!q || q.get('host') !== '1' || q.get('room')) return;

  /* 온라인을 여는 방법이 게임마다 다르다:
       · #onlineBtn      — net.js 4종(섯다·인디언·원카드·도둑잡기)
       · #tabOnline      — 요트
       · [data-m="online"] — 너클본즈·라이어(셋업의 '모드' 칩. 이게 빠져 있어서 이 둘만 실패했다)
       · 아예 없음        — 온라인 박스가 처음부터 보이는 게임 */
  var OPEN = ['#onlineBtn', '#tabOnline', '#netBtn', '#onlineTab', '#optMode .opt[data-m="online"]'];
  var CREATE = ['#createBtn', '#createRoom', '#ntCreate'];
  var DEADLINE = 7000, STEP = 160;
  var clicked = {};   // 같은 버튼을 두 번 누르지 않는다(누를 때마다 새 방이 열리면 최악이다)

  function visible(el) {
    if (!el || el.disabled) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && +st.opacity > 0.05;
  }
  function pick(list) {
    for (var i = 0; i < list.length; i++) {
      if (clicked[list[i]]) continue;
      var el = document.querySelector(list[i]);
      if (visible(el)) return { sel: list[i], el: el };
    }
    return null;
  }
  /** 방에 들어갔나 — 게임마다 ns가 다르므로 '_room으로 끝나는 4자리 값'을 본다.
   *  ⚠️ **지금 이 방문에서 새로 생긴 것만** 센다. 처음엔 그냥 "아무 _room이나 있으면 방에 있다"로 봤는데,
   *     localStorage는 같은 도메인이면 게임끼리 공유된다 — 어제 요트에서 만든 `yd_room`이 남아 있으면
   *     윷을 열어도 "이미 방에 있다"고 오인해 **방을 안 만든다.** 실제로 검증에서 10종 중 9종이
   *     같은 코드(요트에서 남은 것)로 '성공'처럼 찍혔다. 그래서 로드 시점 스냅샷과 비교한다. */
  var snap = {};
  (function () {
    try {
      for (var s = 0; s < 2; s++) {
        var store = s ? localStorage : sessionStorage;
        for (var i = 0; i < store.length; i++) {
          var k = store.key(i);
          if (k && k.slice(-5) === '_room') snap[(s ? 'L:' : 'S:') + k] = store.getItem(k);
        }
      }
    } catch (e) {}
  })();
  function inRoom() {
    try {
      for (var s = 0; s < 2; s++) {
        var store = s ? localStorage : sessionStorage;
        for (var i = 0; i < store.length; i++) {
          var k = store.key(i);
          if (!k || k.slice(-5) !== '_room') continue;
          var v = store.getItem(k) || '';
          if (!/^[A-Z0-9]{4}$/.test(v.replace(/"/g, ''))) continue;
          if (snap[(s ? 'L:' : 'S:') + k] !== v) return true;   // 이번에 새로 생겼거나 바뀐 것
        }
      }
    } catch (e) {}
    return false;
  }

  var t0 = Date.now(), opened = false;
  function tick() {
    if (inRoom()) return;                       // 됐다 — 더 누르지 않는다
    if (Date.now() - t0 > DEADLINE) return;     // 조용히 포기(셋업 화면이 그대로 남는다)

    // ① 방 만들기가 이미 보이면 그걸 먼저 — 온라인 박스가 처음부터 열려 있는 게임들이 있다
    var c = pick(CREATE);
    if (c) { clicked[c.sel] = 1; try { c.el.click(); } catch (e) {} setTimeout(tick, 600); return; }

    // ② 아니면 온라인부터 연다
    if (!opened) {
      var o = pick(OPEN);
      if (o) { clicked[o.sel] = 1; opened = true; try { o.el.click(); } catch (e) {} setTimeout(tick, 400); return; }
    }
    setTimeout(tick, STEP);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(tick, 300); });
  else setTimeout(tick, 300);
})();
