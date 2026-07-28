/* cardfx.js — 카드가 '움직이게' 하는 공용 연출. window.CFX
 *
 * 왜 있나 (2026-07-28, 재성님: "카드게임에 찰짐이 너무 없어")
 *   카드를 내면 소리만 나고 버림패가 툭 바뀌었다. 카드가 손에서 판으로 **가는** 과정이 없으니
 *   내가 뭘 했는지 몸으로 느껴지지 않는다. 반대로 렌더마다 모든 카드가 dealIn으로 튀어서
 *   '연출이 없다'가 아니라 '엉뚱한 데서 흔들린다'에 가까웠다.
 *
 * 원칙
 *   - **움직임은 의미 있는 순간에만.** 매 렌더가 아니라 '카드가 이동한 순간'에만 준다.
 *   - 유령(복제본)을 띄워 날리고, 도착지는 그동안 숨긴다 → 두 장으로 보이지 않는다.
 *   - `prefers-reduced-motion:reduce`면 **즉시 도착**시킨다(접근성 · 헤드리스 기본값이기도 하다).
 *   - 게임 로직을 절대 건드리지 않는다. 실패해도 try/catch로 삼키고 게임은 계속된다.
 */
(function () {
  'use strict';
  var CSS =
    '.cfx-ghost{position:fixed;z-index:120;pointer-events:none;will-change:transform,opacity;' +
    'transform-origin:50% 50%}' +
    '.cfx-land{animation:cfxLand .18s cubic-bezier(.2,1.5,.4,1) both}' +
    '@keyframes cfxLand{0%{transform:scale(1.14)}60%{transform:scale(.96)}100%{transform:none}}' +
    '@media (prefers-reduced-motion:reduce){.cfx-land{animation:none}}';

  function reduced() {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function el(t) { return (typeof t === 'string') ? document.querySelector(t) : t; }
  function centerOf(t) {
    var e = el(t); if (!e) return null;
    var r = e.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }

  var CFX = {
    center: centerOf,
    reduced: reduced,

    /* 유령 카드를 from → to 로 날린다.
       from/to: 셀렉터·엘리먼트·{x,y}
       opts: { html, ms, spin, arc, hideTo, scaleFrom, onDone } */
    fly: function (from, to, opts) {
      opts = opts || {};
      var a = (from && from.x != null) ? from : centerOf(from);
      var b = (to && to.x != null) ? to : centerOf(to);
      var done = opts.onDone || function () { };
      if (!a || !b) { done(); return; }

      var toEl = (to && to.x == null) ? el(to) : null;
      var hide = opts.hideTo !== false && toEl;
      if (hide) toEl.style.visibility = 'hidden';
      var finish = function () {
        if (hide) { toEl.style.visibility = ''; toEl.classList.add('cfx-land'); setTimeout(function () { try { toEl.classList.remove('cfx-land'); } catch (e) { } }, 220); }
        done();
      };
      if (reduced()) { finish(); return; }

      var g = document.createElement('div');
      g.className = 'cfx-ghost';
      g.innerHTML = opts.html || '';
      document.body.appendChild(g);
      var gr = g.getBoundingClientRect();
      var gw = gr.width || (a.w || 40), gh = gr.height || (a.h || 57);
      g.style.left = (a.x - gw / 2) + 'px';
      g.style.top = (a.y - gh / 2) + 'px';

      var ms = opts.ms || 300;
      var spin = (opts.spin == null) ? 1 : opts.spin;      // 회전 바퀴수(0=회전 없음)
      var arc = (opts.arc == null) ? 0.3 : opts.arc;       // 위로 솟는 정도(거리 대비)
      var s0 = opts.scaleFrom || 1;
      var dx = b.x - a.x, dy = b.y - a.y;
      var lift = Math.min(90, Math.hypot(dx, dy) * arc);
      var t0 = null;
      function frame(ts) {
        if (t0 == null) t0 = ts;
        var t = Math.min(1, (ts - t0) / ms);
        var e = 1 - Math.pow(1 - t, 3);                    // easeOutCubic
        var x = dx * e, y = dy * e - lift * Math.sin(Math.PI * e);
        var sc = s0 + (1 - s0) * e;
        g.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + (spin * 360 * e) + 'deg) scale(' + sc + ')';
        if (t < 1) requestAnimationFrame(frame);
        else { try { g.remove(); } catch (er) { } finish(); }
      }
      requestAnimationFrame(frame);
    },

    /* 여러 장을 조금씩 시차를 두고 날린다(공격 카드 먹기 등) */
    flyMany: function (n, from, to, opts) {
      opts = opts || {};
      var gap = opts.gap || 70;
      for (var i = 0; i < Math.min(n, 5); i++) {
        (function (i) {
          setTimeout(function () {
            CFX.fly(from, (i === 0 ? to : centerOf(to)), Object.assign({}, opts, { hideTo: i === 0 && opts.hideTo !== false }));
          }, i * gap);
        })(i);
      }
    },

    /* 도착 강조만 (이동 없이) */
    pop: function (target) {
      var e = el(target); if (!e) return;
      e.classList.add('cfx-land');
      setTimeout(function () { try { e.classList.remove('cfx-land'); } catch (er) { } }, 220);
    }
  };

  function boot() {
    if (!document.getElementById('cfxStyle')) {
      var st = document.createElement('style'); st.id = 'cfxStyle'; st.textContent = CSS;
      document.head.appendChild(st);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.CFX = CFX;
})();
