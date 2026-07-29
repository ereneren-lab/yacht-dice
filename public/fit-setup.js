/* fit-setup.js — 셋업의 '시작' 버튼이 첫 화면에 안 보이면 화면 하단에 고정한다.
 *
 * 왜 있나 (2026-07-28, 실기기에서 발견)
 *   재성님 Galaxy A16 앱 웹뷰는 384x748이다. 거기서 윷·너클본즈·라이어·좌중우는
 *   '게임 시작'이 첫 화면 밖에 있었다 — 레벨·전적·도전과제·테마를 다 지나야 나온다.
 *   처음 온 사람이 "시작을 어떻게 하지?"에서 막히는 자리다.
 *
 * 왜 audit:ux가 못 잡았나
 *   판정이 '문서 넘침(scrollHeight-innerHeight)'만 봤다. 윷·좌중우는 셋업 시트가
 *   **안쪽에서** 스크롤돼 문서는 안 넘친다 → 넘침 0인데 버튼은 화면 밖.
 *   그래서 이 모듈의 기준도 넘침이 아니라 **'버튼이 실제로 보이나'** 다.
 *
 * 왜 fixed가 아니라 sticky인가 (한 번 틀렸다가 실기기에서 잡힘)
 *   처음엔 position:fixed로 만들었다. 그런데 셋업 오버레이(.ov)에 backdrop-filter가 걸려 있으면
 *   그 안의 fixed는 뷰포트가 아니라 **그 요소**를 기준으로 잡힌다(transform·filter와 같은 계열).
 *   오버레이를 스크롤 가능하게 만들자 버튼이 같이 밀려 올라갔다 — 폰에서 y=492로 찍혀 드러났다.
 *   sticky는 스크롤 컨테이너 기준이라 이 함정을 안 탄다.
 *   ⚠️ 대신 sticky는 마지막 자식이면 움직일 여유가 0이라 아무 일도 안 한다(CLAUDE.md 함정 #9).
 *      #startBtn이 정확히 마지막 자식이라 → 뒤에 .fs-spacer를 넣어 여유를 만든다.
 *
 * 원칙
 *   - 이미 보이는 게임(요트·알까기·섯다 등)은 **아무것도 하지 않는다.**
 *   - 게임이 시작되면(body.ingame) 사라진다.
 *   - 회전·리사이즈마다 원래 자리로 되돌리고 다시 판정한다(고정이 눌러앉지 않게).
 */
(function () {
  'use strict';
  /* position:sticky를 쓴다. fixed가 아니다 —
     .ov에 backdrop-filter가 걸려 있으면 그 안의 fixed는 '뷰포트'가 아니라 그 요소를 기준으로 잡힌다
     (transform·filter와 같은 계열의 함정). 오버레이가 스크롤되기 시작하자 버튼이 같이 밀려서 실측으로 드러났다.
     sticky는 스크롤 컨테이너 기준이라 이 함정을 타지 않는다.
     ⚠️ 다만 sticky는 마지막 자식이면 움직일 여유가 0이라 아무 일도 안 한다(CLAUDE.md 함정 #9)
        → 버튼 뒤에 여백 블록을 하나 넣어 여유를 만든다. */
  var CSS =
    '.fs-pinned{position:sticky !important;bottom:10px;z-index:60;' +
    'box-shadow:0 8px 24px rgba(0,0,0,.45)}' +
    /* sticky는 '부모 박스 안'에서만 움직인다 — 셋업이 아주 길면(윷 가로 1419px) 부모가 화면 밖까지
       뻗어 있어서 버튼도 화면 밖에 머문다(844x390에서 367~414, 뷰포트 390). 그런 경우엔 fixed가 맞다.
       ⚠️ 단 조상에 backdrop-filter/transform/filter가 있으면 fixed의 기준이 뷰포트가 아니라 그 요소가 된다
          (함정 21-b, 실기기에서 버튼이 같이 밀려 올라갔다) → 그럴 땐 sticky를 그대로 쓴다. */
    '.fs-fixed{position:fixed !important;left:50%;transform:translateX(-50%);' +
    'bottom:12px;z-index:60;width:min(340px,calc(100vw - 36px));' +
    'box-shadow:0 8px 24px rgba(0,0,0,.45)}' +
    '.fs-spacer{height:14px;flex:none}' +
    'body.ingame .fs-pinned,body.ingame .fs-fixed{display:none !important}' +
    'body.ingame .fs-spacer{display:none !important}';

  /* fixed의 기준을 뷰포트가 아니게 만드는 조상이 있나 — 있으면 fixed를 쓰면 안 된다 */
  function fixedIsSafe(el) {
    for (var p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      var cs = getComputedStyle(p);
      if ((cs.transform && cs.transform !== 'none') ||
        (cs.filter && cs.filter !== 'none') ||
        (cs.backdropFilter && cs.backdropFilter !== 'none') ||
        (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none') ||
        (cs.perspective && cs.perspective !== 'none') ||
        (cs.contain && /paint|layout|strict|content/.test(cs.contain))) return false;
    }
    return true;
  }

  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.height > 0 && r.top >= -2 && r.bottom <= (window.innerHeight || 0) + 2;
  }
  /* 버튼이 속한 스크롤 컨테이너(없으면 body)에 여백을 줘서 마지막 옵션이 바 밑에 안 깔리게.
     ⚠️ '지금 넘치는가'로 찾으면 안 된다 — 버튼을 고정한 순간 흐름에서 빠져 넘침이 사라지므로
        컨테이너를 못 찾고 body에 여백을 준다(실기기에서 좌·중·우 '시작 칩' 줄이 바 밑에 깔렸다).
        넘침 여부와 무관하게 '스크롤되는 조상'을 찾는다. */
  function padHost(btn, on) {
    /* 여백은 '버튼이 들어 있던 블록'에 준다. 그리고 sticky가 움직일 여유를 만들려면
       버튼 뒤에 형제가 하나 있어야 한다(함정 #9) → fs-spacer를 넣는다. */
    var host = btn.parentElement || document.body;
    var sp = host.querySelector(':scope > .fs-spacer');
    if (on) {
      if (!host.dataset.fsPad) { host.dataset.fsPad = host.style.paddingBottom || ''; host.style.paddingBottom = '10px'; }
      if (!sp) { sp = document.createElement('div'); sp.className = 'fs-spacer'; host.appendChild(sp); }
    } else {
      if (host.dataset.fsPad !== undefined) { host.style.paddingBottom = host.dataset.fsPad; delete host.dataset.fsPad; }
      if (sp) sp.remove();
    }
  }

  function unpin(el) {
    if (!el) return;
    el.classList.remove('fs-pinned'); el.classList.remove('fs-fixed');
    padHost(el, false);
  }

  function run() {
    try {
      /* 대상은 '지금 화면의 주요 시작 버튼'이다.
       * 처음엔 #startBtn만 봤는데, 온라인 경로에는 그게 없다 —
       * 2026-07-29 감사에서 윷의 '방 만들기'(#createBtn)가 y=1034(뷰포트 748)에 있었다.
       * 시트가 1366px이라 286px 넘게 스크롤해야 나온다. 혼자 하는 경로만 지켜주고
       * 친구를 부르는 경로는 안 지켜준 셈이었다. */
      var b = null;
      var ids = ['startBtn', 'createBtn', 'createRoom', 'startOnline', 'startLocal'];
      for (var k = 0; k < ids.length; k++) {
        var cand = document.getElementById(ids[k]);
        if (cand && cand.offsetParent) { b = cand; break; }   // 지금 보이는 것 하나만
      }
      if (!b) return;
      if (document.body.classList.contains('ingame')) { unpin(b); return; }
      // 먼저 원상복구하고 다시 잰다 — 고정된 상태로 재면 늘 '보인다'가 나온다.
      // ⚠️ 후보 버튼 **전부** 풀어야 한다 — 탭을 오가면 이전에 고정한 버튼이 남는다.
      ids.forEach(function (id) { var e = document.getElementById(id); if (e) unpin(e); });
      var cs = getComputedStyle(b);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return;
      if (inView(b)) return;

      b.classList.add('fs-pinned'); padHost(b, true);
      /* sticky로 붙였는데도 여전히 화면 밖이면(부모 박스가 화면 밖까지 뻗은 경우) fixed로 올린다.
         '먼저 sticky, 안 되면 fixed' 순서가 중요하다 — fixed는 문서 흐름에서 빠지므로
         가능하면 안 쓰는 게 레이아웃에 안전하다. */
      if (!inView(b) && fixedIsSafe(b)) { b.classList.remove('fs-pinned'); b.classList.add('fs-fixed'); }
    } catch (e) { }
  }

  function boot() {
    try {
      if (!document.getElementById('fsStyle')) {
        var st = document.createElement('style'); st.id = 'fsStyle'; st.textContent = CSS;
        document.head.appendChild(st);
      }
      // ⚠️ run()이 class·style을 만지므로 그 변경이 다시 관찰돼 무한 루프가 된다.
      //    돌린 뒤 takeRecords()로 '내가 만든 기록'을 버려야 멈춘다.
      var obs = null;
      var cycle = function () { run(); if (obs) obs.takeRecords(); };
      cycle();
      var t = null, redo = function () { clearTimeout(t); t = setTimeout(cycle, 80); };
      addEventListener('resize', redo);
      addEventListener('orientationchange', function () { setTimeout(cycle, 180); });
      // 셋업은 탭 전환·옵션 접기로 높이가 계속 바뀐다 → 변화를 관찰해 다시 판정
      if (window.MutationObserver) {
        obs = new MutationObserver(redo);
        obs.observe(document.body, { attributes: true, childList: true, subtree: true });
      }
    } catch (e) { }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
