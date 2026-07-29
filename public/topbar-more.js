/* topbar-more.js — 상단바가 붐비면 보조 버튼을 '⋯ 더보기'로 접는다.
 *
 * 왜 있나 (2026-07-29, 384x748 실측)
 *   topbar-fit.js로 flex를 고쳐도 윷·요트는 제목이 계속 잘렸다. 없는 공간은 못 만든다 —
 *     윷   : 버튼 8개 294px / 바 368px → 제목에 20px  ("윷놀이" 도 못 보여준다)
 *     요트 : 버튼 7개 252px / 바 360px → 제목에 60px  (필요 82px)
 *   그리고 아이콘만 7개 늘어놓으면 ←와 ✕의 차이, 🚶의 의미를 알 수 없다.
 *
 * 무엇을 하나
 *   제목이 잘리는 동안 **보조 버튼을 뒤에서부터 하나씩** 메뉴로 옮긴다(필요한 만큼만).
 *   메뉴 안에서는 아이콘 옆에 **title/aria-label을 글자로** 보여준다 → 의미가 드러난다.
 *
 * 남기는 것 (게임 진행에 바로 필요한 것)
 *   ← 골목으로 · ? 규칙 · 나가기/항복 같은 판 제어 버튼.
 * 접는 것
 *   테마·소리·BGM·튜토리얼·속도 — 한 판 도중에 자주 누르지 않는다.
 *
 * ⚠️ 버튼 **노드를 그대로 옮긴다.** 각 게임이 id로 찾아 붙인 핸들러가 그대로 살아 있어야 하므로
 *    복제하거나 새로 만들지 않는다.
 * ⚠️ 접힌 버튼은 offsetParent가 null이 된다 — '보이나'로 단언하는 테스트가 있으면 깨진다.
 *    그래서 규칙 버튼은 **절대 접지 않는다**(audit:ux ④가 인게임 룰 접근을 단언한다).
 */
(function () {
  'use strict';

  // 접어도 되는 것 — 판 진행과 무관한 설정류
  var FOLDABLE = ['lightBtn', 'muteBtn', 'bgmBtn', 'tutOpenBtn', 'paceBtn', 'dailyBadge'];
  // 절대 안 접는 것 — 규칙은 판 도중에 필요하다
  var KEEP = /^(helpBtn|yutHelp|kbHelp|lcrHelp|ldHelp|hubLink|endBtn|leaveBtn|skipBtn)$/;

  var CSS =
    '.tbm-wrap{position:relative;flex:0 0 auto}' +
    '.tbm-btn{flex:0 0 auto}' +
    '.tbm-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:9500;display:none;' +
    'min-width:172px;padding:6px;border-radius:12px;' +
    'border:1px solid var(--line,#3a2f24);background:var(--panel,#1c1712);' +
    'box-shadow:0 12px 32px rgba(0,0,0,.5)}' +
    '.tbm-pop.on{display:block}' +
    /* 안에 들어간 버튼은 '아이콘 + 이름' 한 줄로 — 아이콘만으론 뜻을 모른다 */
    '.tbm-pop>*{display:flex !important;align-items:center;gap:9px;width:100%;' +
    'min-height:44px;margin:0;padding:0 10px;border:none !important;background:none !important;' +
    'border-radius:9px;color:var(--ink,#f0e6d8);font-size:13.5px;font-weight:700;' +
    'font-family:inherit;cursor:pointer;text-align:left;justify-content:flex-start;' +
    'box-shadow:none !important;width:auto !important;height:auto !important}' +
    '.tbm-pop>*:hover{background:var(--panel2,#241d16) !important}' +
    '.tbm-pop>* .tbm-lbl{font-size:13.5px;font-weight:700;color:inherit;white-space:nowrap}';

  function labelOf(el) {
    return (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
  }

  function clipped(t) { return t && t.scrollWidth > t.clientWidth + 1; }

  function build(bar) {
    var wrap = document.createElement('div');
    wrap.className = 'tbm-wrap';
    var btn = document.createElement('button');
    btn.className = 'iconbtn tbm-btn';
    btn.id = 'tbmBtn';
    btn.type = 'button';
    btn.textContent = '⋯';
    btn.setAttribute('aria-label', '설정 더보기');
    btn.setAttribute('title', '설정 더보기');
    btn.setAttribute('aria-expanded', 'false');
    var pop = document.createElement('div');
    pop.className = 'tbm-pop';
    pop.id = 'tbmPop';
    wrap.appendChild(btn); wrap.appendChild(pop);
    bar.appendChild(wrap);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var on = pop.classList.toggle('on');
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    // 바깥을 누르면 닫힌다. 메뉴 안 버튼을 누르면 그 동작 후 닫는다.
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) { pop.classList.remove('on'); btn.setAttribute('aria-expanded', 'false'); }
    });
    pop.addEventListener('click', function () {
      setTimeout(function () { pop.classList.remove('on'); btn.setAttribute('aria-expanded', 'false'); }, 60);
    });
    return pop;
  }

  function run() {
    try {
      var bar = document.querySelector('.topbar, .kbtop');
      if (!bar) return;
      // kb·ld는 .title이 아니라 <h2>다 — 한쪽만 보면 그 게임엔 조용히 아무 일도 안 일어난다
      var title = bar.querySelector('.title, h1, h2');
      if (!title) return;
      if (!clipped(title)) return;                 // 안 잘리면 아무것도 하지 않는다

      var pop = document.getElementById('tbmPop');
      if (!pop) pop = build(bar);

      // 뒤에서부터 하나씩 옮기며 '잘림이 사라질 때까지'만
      for (var i = FOLDABLE.length - 1; i >= 0; i--) {
        if (!clipped(title)) break;
        var el = document.getElementById(FOLDABLE[i]);
        if (!el || KEEP.test(el.id)) continue;
        if (pop.contains(el)) continue;
        if (!bar.contains(el)) continue;
        var lb = labelOf(el);
        if (lb && !el.querySelector('.tbm-lbl')) {
          var s = document.createElement('span');
          s.className = 'tbm-lbl';
          s.textContent = lb;
          el.appendChild(s);
        }
        pop.appendChild(el);
      }
    } catch (e) { }
  }

  function boot() {
    try {
      if (!document.getElementById('tbmStyle')) {
        var st = document.createElement('style'); st.id = 'tbmStyle'; st.textContent = CSS;
        document.head.appendChild(st);
      }
      // 상단바는 판이 깔린 뒤에 채워지는 게임이 있다 → 몇 번 더 본다
      var n = 0, t = setInterval(function () { run(); if (++n > 12) clearInterval(t); }, 350);
      run();
      var rt = null;
      addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(run, 120); });
      addEventListener('orientationchange', function () { setTimeout(run, 200); });
    } catch (e) { }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
