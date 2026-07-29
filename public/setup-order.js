/* setup-order.js — 셋업 화면에서 '결정'을 먼저, '성취'를 나중으로 재배치한다.
 *
 * 왜 있나 (2026-07-29, Galaxy A16 실측)
 *   너클본즈 셋업은 384x748 웹뷰에서 내용이 892px이라 185px이 잘린다.
 *   그 잘린 자리에 레벨(72px)·전적(18px)·업적(98px) = 188px이 **맨 위에** 있었다.
 *   신규 유저에게 이 188px은 전부 'LV1 · 0/60 XP · 🔒×6' — 아직 아무것도 없는 칸이다.
 *   즉 처음 온 사람이 **자기가 못 가진 것부터 보고**, 정작 고를 것(상대·난이도)과
 *   '시작'은 화면 밖으로 밀린다.
 *
 * 왜 버튼 고정이 아니라 순서인가
 *   fit-setup.js가 '시작'을 sticky로 하단에 붙여 화면 밖 문제는 막았지만,
 *   sticky 바는 스크롤되는 콘텐츠 **위에 뜬다.** 실측: 도착 시점(scroll=0)에
 *   #itemWrap(아이템전 설정)이 #startBtn에 덮여 눌리지 않았다(끝까지 스크롤하면 닿음).
 *   → 바를 띄우는 한 무언가는 계속 가려진다. 시트가 뷰포트에 **들어가게** 만드는 게 맞다.
 *
 *   재배치 후 '시작' 위에 남는 것: 제목·설명 + 규칙/튜토리얼 + 테마 + 상대·난이도·아이템·매치.
 *   = 결정에 필요한 것만. 레벨·전적·업적은 '시작' 아래로 내려가 스크롤하면 나온다.
 *   (성취는 리텐션 장치다 — 첫 판을 막는 자리가 아니라 첫 판 뒤에 보일 자리가 맞다.)
 *
 * 원칙
 *   - DOM만 옮긴다. 게임 로직·렌더 함수는 건드리지 않는다(각 게임이 id로 찾아 쓰므로 그대로 동작).
 *   - 멱등 — 여러 번 돌아도 한 번만 옮긴다.
 *   - 판이 시작되면(body.ingame) 아무것도 하지 않는다.
 */
(function () {
  'use strict';

  // 셋업의 '시작' 버튼 — 게임마다 id가 다르다
  var START = ['startBtn', 'startLocal'];
  // 아래로 내릴 블록 (성취·기록계)
  var MOVE = ['levelBar', 'statsbar', 'achbar'];

  /* ⚠️ offsetParent(=지금 보이나)로 거르지 말 것.
     셋업 시트는 첫 방문에 규칙·튜토리얼 오버레이에 덮여 있거나 display:none인 채로 시작한다.
     보일 때까지 기다리면 재시도가 먼저 끝나 재배치가 조용히 안 일어난다(실기기에서 그랬다).
     DOM을 옮기는 일은 화면에 보이든 말든 안전하므로 존재만 확인한다. */
  function startEl() {
    for (var i = 0; i < START.length; i++) {
      var e = document.getElementById(START[i]);
      if (e) return e;
    }
    return null;
  }

  function run() {
    try {
      if (document.body.classList.contains('ingame')) return;
      var btn = startEl();
      if (!btn) return;

      /* 옮길 곳 = 셋업 시트 자체의 맨 끝.
         ⚠️ '시작 버튼과 같은 부모'로 한정하면 안 된다 — 좌·중·우와 윷은 성취계가 .sheet 직속인데
            #startBtn은 그 안쪽 박스(#localBox 등)에 있어 부모가 다르다. 그래서 조용히 건너뛰었다.
            시트 끝으로 보내면 어느 구조든 '시작' 뒤로 간다. 스타일 조상(.sheet)도 그대로 유지된다. */
      var sheet = btn.closest('.sheet') || document.getElementById('setup') ||
        document.getElementById('setupOv') || btn.parentElement;
      if (!sheet) return;

      var moved = 0;
      for (var i = 0; i < MOVE.length; i++) {
        var el = document.getElementById(MOVE[i]);
        if (!el || el.dataset.soMoved) continue;
        if (!sheet.contains(el)) continue;                    // 셋업 밖이면 손대지 않는다
        /* 이미 접혀 있으면(<details> 안) 첫 화면을 막지 않는다 → 그대로 둔다.
           요트가 이 경우다(v1.239의 #setupExtra). 굳이 두 번 손대면 접기 UX가 깨진다. */
        if (el.closest('details')) { el.dataset.soMoved = 'details'; continue; }
        if (el.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_PRECEDING) { el.dataset.soMoved = 'already'; continue; }

        el.dataset.soMoved = '1';
        // fit-setup.js가 넣는 .fs-spacer보다는 앞에 둔다
        var sp = sheet.querySelector(':scope > .fs-spacer');
        if (sp) sheet.insertBefore(el, sp); else sheet.appendChild(el);
        moved++;
      }

      if (moved && !document.getElementById('soStyle')) {
        var st = document.createElement('style');
        st.id = 'soStyle';
        // 내려간 블록 앞에 구분선 — '여기부터는 기록'임을 알린다
        st.textContent =
          '#levelBar[data-so-moved]{margin-top:18px;padding-top:16px;' +
          'border-top:1px solid var(--line,rgba(255,255,255,.12))}' +
          'body.ingame #levelBar[data-so-moved],body.ingame #statsbar[data-so-moved],' +
          'body.ingame #achbar[data-so-moved]{display:none}';
        document.head.appendChild(st);
      }
    } catch (e) { }
  }

  function boot() {
    try {
      run();
      /* 셋업을 나중에 그리는 게임이 있다 → 다 옮길 때까지 재시도.
         옮길 게 남아 있지 않으면 바로 멈춘다(최대 8초 = 32회). */
      var n = 0, t = setInterval(function () {
        run();
        var left = MOVE.some(function (id) {
          var e = document.getElementById(id);
          return e && !e.dataset.soMoved;
        });
        if (!left || ++n > 32) clearInterval(t);
      }, 250);
    } catch (e) { }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
