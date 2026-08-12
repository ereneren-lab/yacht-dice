/* juice.js — 게임 공통 '손맛' 레이어. window.JUICE
 *
 * 왜 있나 (2026-08-12, 게임필 확산 ④)
 *   윷은 착지 팝+햅틱으로 손맛을 살렸는데, 다른 게임은 액션에 촉각 피드백이 제각각이었다
 *   (인디언포커·원카드·바카라는 진동이 아예 0). 게임회사급 일관성을 위해 '탭 한 번의 손맛'을
 *   한 곳에서 정의하고, 각 게임은 자기 액션 순간에 이걸 부른다.
 *
 *   ④-2 (2026-08-12) — 세 겹으로 통일:
 *     ① 승리/결과 순간: JUICE.celebrate(제목) 한 번으로 팝+축하 촉각을 모든 게임이 동일하게.
 *        (단 '엑셀 위장'처럼 의도적으로 차분한 게임은 부르지 않는다 — 근거 없는 통일은 안 한다.)
 *     ② 버튼 프레스: 이 파일이 로드된 페이지의 모든 버튼에 '누르면 쏙' 느낌을 자동 배선(initPress).
 *        각 게임이 손댈 필요 없이 <button>·[role=button]·.btn 이 전부 눌리는 손맛을 갖는다.
 *
 * 원칙
 *   - 촉각(tap)은 **내 액션**에만. 상대 턴·매 딜마다 울리면 '삑삑'이 되어 오히려 싫다.
 *     (프레스 촉각은 예외 — '내 손가락이 버튼을 누르는' 물리적 순간이라 항상 내 액션이다. 대신 아주 약하게.)
 *   - 소리를 끄면(SFX.on()===false) 진동도 끈다 — 음소거는 '조용히'라는 뜻이다.
 *   - 시각 팝(pop)·프레스 스케일은 prefers-reduced-motion에서 자동 정지.
 *   - iOS Safari 웹은 navigator.vibrate를 무시한다 → tap은 안드로이드 웹·네이티브 앱에서 체감된다.
 *     (네이티브 앱 햅틱 고도화는 별도 항목 D1에서 Capacitor Haptics로 잇는다.)
 *   - 게임 로직·레이아웃은 절대 안 건드린다. 프레스 스케일은 요소가 이미 transform을 쓰면
 *     건너뛴다(위치 잡는 transform을 덮어써 튀는 사고 방지). 실패해도 try/catch로 삼킨다.
 */
(function () {
  'use strict';

  /* 축하 촉각의 표준 패턴 — 인디언포커·원카드·바카라 승리에서 이미 쓰던 리듬. */
  var WIN_PATTERN = [0, 22, 18, 38];

  var CSS =
    '.juice-pop{animation:juicePop .2s cubic-bezier(.2,1.5,.4,1)}' +
    '@keyframes juicePop{0%{transform:scale(1)}40%{transform:scale(1.13)}70%{transform:scale(.965)}100%{transform:none}}' +
    // 결과창 등장 통일 — 패널이 '툭' 스냅 대신 살짝 떠오르며 페이드인.
    // 컨테이너 구조가 3가지라(.ov>.sheet · .sheet>.card · .result>.resbox) 내부 패널만 겨냥한다.
    // yacht는 #overlay.show 라 여기 안 걸린다(엑셀 위장 = 차분 유지, 의도적 제외).
    '.ov.on>.sheet,.sheet.on>.card,.sheet.on>.sheetbox,.result.on>.resbox{animation:juiceRise .3s cubic-bezier(.2,.9,.3,1) both}' +
    '@keyframes juiceRise{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}' +
    // '내 차례' 진입 신호 — 액션바가 잔잔히 두 번 빛나며 시선을 끈다. 촉각 없음(턴 전환에 진동은 삑삑).
    '.juice-turn{animation:juiceTurn .95s ease}' +
    '@keyframes juiceTurn{0%,50%,100%{box-shadow:0 0 0 0 rgba(232,161,58,0);transform:none}25%{box-shadow:0 0 0 3px rgba(232,161,58,.5),0 0 18px 3px rgba(232,161,58,.35);transform:scale(1.025)}75%{box-shadow:0 0 0 3px rgba(232,161,58,.4);transform:scale(1.018)}}' +
    '@media (prefers-reduced-motion:reduce){.juice-pop,.ov.on>.sheet,.sheet.on>.card,.sheet.on>.sheetbox,.result.on>.resbox,.juice-turn{animation:none}}';

  function muted() {
    try { return !!(window.SFX && typeof SFX.on === 'function' && SFX.on() === false); } catch (e) { return false; }
  }
  function reduced() {
    try { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches); } catch (e) { return false; }
  }
  function elOf(t) { return (typeof t === 'string') ? document.querySelector(t) : t; }

  var JUICE = {
    /* 촉각 한 번. pattern: 숫자(ms) 또는 배열([진동,멈춤,…]). 음소거면 조용히 통과. */
    tap: function (pattern) {
      if (muted()) return;
      try { if (navigator.vibrate) navigator.vibrate(pattern == null ? 10 : pattern); } catch (e) {}
    },
    /* 시각 팝(스케일 바운스). 요소를 '탁' 튀긴다 — reduced-motion이면 CSS가 정지시킨다. */
    pop: function (target) {
      var e = elOf(target); if (!e) return;
      try {
        e.classList.remove('juice-pop'); void e.offsetWidth; e.classList.add('juice-pop');
        setTimeout(function () { try { e.classList.remove('juice-pop'); } catch (er) {} }, 260);
      } catch (er) {}
    },
    /* 착지 손맛 = 팝 + 촉각을 한 번에. */
    land: function (target, pattern) { JUICE.pop(target); JUICE.tap(pattern); },
    /* 승리/결과 순간 표준 축하 = 제목 팝 + 축하 촉각. 모든 게임이 '이겼다'를 같은 손맛으로.
       내가 이겼을 때만 부른다(패배·상대 승리엔 부르지 않는다). */
    celebrate: function (target, pattern) { JUICE.pop(target); JUICE.tap(pattern || WIN_PATTERN); },
    /* '내 차례' 진입 신호. 매 렌더마다 현재 내턴 여부(active)를 넘기면, '상대→나' 엣지에서만 한 번 빛난다.
       엣지 판정을 여기서 중앙화해 각 게임은 myTurn 불린만 넘기면 된다(반복 렌더에도 삑삑 안 남). */
    turnCue: function (target, active) {
      var e = elOf(target); if (!e) return;
      var was = e.__jturn; e.__jturn = !!active;
      if (!active || was) return;   // false→true 로 바뀐 순간에만
      try {
        e.classList.remove('juice-turn'); void e.offsetWidth; e.classList.add('juice-turn');
        setTimeout(function () { try { e.classList.remove('juice-turn'); } catch (er) {} }, 1000);
      } catch (er) {}
    }
  };

  /* ── 전역 버튼 프레스: '누르면 쏙 들어갔다 튀어나오는' 손맛을 페이지의 모든 버튼에 자동 배선 ──
     한 곳에서 위임(delegation)으로 처리해 각 게임 코드는 건드리지 않는다. */
  function initPress() {
    var held = null;   // 현재 눌린 버튼 1개 {el, prev}

    function release() {
      if (!held) return;
      try { held.el.style.transform = held.prev; } catch (e) {}
      held = null;
    }

    function pressTarget(node) {
      if (!node || !node.closest) return null;
      var b = node.closest('button,[role="button"],.btn,.chip');
      if (!b) return null;
      // 비활성 버튼엔 반응하지 않는다(눌러도 아무 일 없는 걸 손맛으로 속이지 않는다).
      if (b.disabled || b.getAttribute('aria-disabled') === 'true') return null;
      return b;
    }

    document.addEventListener('pointerdown', function (e) {
      var b = pressTarget(e.target);
      if (!b) return;
      JUICE.tap(6);   // 아주 약한 '툭' — 물리적 누름. 액션 확정 촉각(더 강함)과 구분된다.
      if (reduced()) return;   // 모션 줄이기: 시각 프레스는 생략, 촉각만.
      try {
        // 이미 transform을 쓰는 버튼은 건너뛴다 — 위치·회전용 transform을 덮으면 튄다.
        var cur = getComputedStyle(b).transform;
        if (cur && cur !== 'none') return;
        release();
        held = { el: b, prev: b.style.transform || '' };
        b.style.transition = 'transform .09s cubic-bezier(.2,1.5,.4,1)';
        b.style.transform = 'scale(.955)';
      } catch (er) {}
    }, true);

    // 어디서 떼든/취소되든 원복. pointerup은 사실상 항상 발생한다.
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
    // 창 밖으로 드래그해 나갈 때의 안전망.
    window.addEventListener('blur', release, true);
  }

  function boot() {
    if (!document.getElementById('juiceStyle')) {
      var st = document.createElement('style'); st.id = 'juiceStyle'; st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    }
    initPress();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.JUICE = JUICE;
})();
