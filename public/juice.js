/* juice.js — 게임 공통 '손맛' 레이어. window.JUICE
 *
 * 왜 있나 (2026-08-12, 게임필 확산 ④)
 *   윷은 착지 팝+햅틱으로 손맛을 살렸는데, 다른 게임은 액션에 촉각 피드백이 제각각이었다
 *   (인디언포커·원카드·바카라는 진동이 아예 0). 게임회사급 일관성을 위해 '탭 한 번의 손맛'을
 *   한 곳에서 정의하고, 각 게임은 자기 액션 순간에 이걸 부른다.
 *
 * 원칙
 *   - 촉각(tap)은 **내 액션**에만. 상대 턴·매 딜마다 울리면 '삑삑'이 되어 오히려 싫다.
 *   - 소리를 끄면(SFX.on()===false) 진동도 끈다 — 음소거는 '조용히'라는 뜻이다.
 *   - 시각 팝(pop)은 prefers-reduced-motion에서 자동 정지(CSS media).
 *   - iOS Safari 웹은 navigator.vibrate를 무시한다 → tap은 안드로이드 웹·네이티브 앱에서 체감된다.
 *     (네이티브 앱 햅틱 고도화는 별도 항목 D1에서 Capacitor Haptics로 잇는다.)
 *   - 게임 로직은 절대 안 건드린다. 실패해도 try/catch로 삼킨다.
 */
(function () {
  'use strict';
  var CSS =
    '.juice-pop{animation:juicePop .2s cubic-bezier(.2,1.5,.4,1)}' +
    '@keyframes juicePop{0%{transform:scale(1)}40%{transform:scale(1.13)}70%{transform:scale(.965)}100%{transform:none}}' +
    '@media (prefers-reduced-motion:reduce){.juice-pop{animation:none}}';

  function muted() {
    try { return !!(window.SFX && typeof SFX.on === 'function' && SFX.on() === false); } catch (e) { return false; }
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
    land: function (target, pattern) { JUICE.pop(target); JUICE.tap(pattern); }
  };

  function boot() {
    if (!document.getElementById('juiceStyle')) {
      var st = document.createElement('style'); st.id = 'juiceStyle'; st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.JUICE = JUICE;
})();
