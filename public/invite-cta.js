/* === invite-cta.js — 로컬/AI 대전 결과 화면 재초대 CTA (window.INVITECTA) ===
 *
 * 왜 있나 (2026-08-11, Phase 2 UX 전략 §9-5 신규 제안 — 사용자 승인).
 *   온라인 대기실엔 "🔗 초대 링크 보내기"가 있지만, 로컬/AI로 혼자 플레이한 사람의
 *   결과 화면에는 "친구를 부르자"는 신호가 전혀 없었다. 이 서비스의 핵심 가치
 *   (친구와 하기)를 아직 안 써본 사람이 가장 큰 성장 사각지대라는 발견에 대한 처방.
 *
 * 설계 원칙 (tutorial.js·net.js와 같은 계열)
 *   · 마크업·CSS를 스스로 주입한다. 게임의 기존 CSS 클래스에 기대지 않는다
 *     (게임마다 `.btn`/`.nt-btn` 등 정의가 미묘하게 달라 재사용하면 드리프트 위험).
 *   · **트리거는 결과 오버레이의 class 토글 하나뿐이다.** 10개 게임을 조사한 결과
 *     "판이 끝나면 결과 엘리먼트에 활성 클래스(on/show)를 붙인다"는 게 유일하게
 *     공통인 신호였다(showResult 같은 함수 이름·내부 구조는 게임마다 다 다르다).
 *     그래서 게임 로직을 부르는 대신 MutationObserver로 그 class를 지켜본다.
 *   · **재초대 진입은 새 로직을 만들지 않는다.** 이미 검증된 `?host=1` + `host-link.js`
 *     흐름(허브 "🔗 친구와 하기"가 쓰는 것과 동일, `npm run test:hostlink`가 10종 검증)을
 *     그대로 재사용한다 — 게임마다 다른 "온라인 열기" 버튼 id를 이 파일이 또 알 필요가 없다.
 *   · 실패는 조용히 삼킨다. **이 파일이 죽어도 게임은 절대 죽지 않는다**(전부 try/catch).
 *
 * 쓰는 법 — 게임 HTML의 **메인 스크립트 맨 끝, `online`(또는 그 함수) 선언 이후**에 한 줄:
 *
 *   <script src="invite-cta.js"></script>   (</title> 직후, tutorial.js와 같은 자리)
 *   ...
 *   <script>                                 (메인 스크립트 맨 끝)
 *   try{ INVITECTA.watch({
 *     game:'kb', gname:'너클본즈',
 *     resultSel:'#resultOv', activeClass:'on',
 *     mountSel:'#resultBtns',
 *     online: ()=>online()          // 게임의 온라인 여부 게터 — 반드시 클로저로 넘길 것
 *   }); }catch(e){}
 *
 *   ⚠️ **왜 클로저로 넘기나** — `online`이 다른 <script> 태그의 최상위 let/const라도
 *      브라우저는 클래식 스크립트 사이에 렉시컬 스코프를 공유하긴 하지만, 선언 시점(TDZ) 전에
 *      참조하면 깨진다. 호출부를 "online 선언 이후"에 두고 화살표 함수로 감싸면
 *      실제 호출(오버레이가 열리는 그 순간)까지 평가가 미뤄져 항상 최신값을 읽는다.
 *
 * opts:
 *   game, gname        — 계측용 식별자. gname은 analytics.js GAMES 표의 한국어 이름과 맞출 것.
 *   resultSel          — 결과 오버레이 루트 셀렉터 (기본 '#resultOv')
 *   activeClass        — 그 오버레이가 열렸을 때 붙는 클래스 (기본 'on')
 *   mountSel           — CTA를 마지막 자식으로 붙일 컨테이너 셀렉터 (필수)
 *   online             — () => boolean. true면 CTA를 띄우지 않는다(이미 친구와 하는 중).
 *   disguise           — () => boolean. true면 CTA를 절대 띄우지 않는다
 *                         (요트 엑셀/포토샵 위장 모드 — 컬러 배너가 위장을 깬다).
 *   ensureScrollable    — 결과 오버레이 wrapper 셀렉터(선택). 지정하면 CTA를 띄우는 순간에만
 *                         overflow-y:auto + align-items:flex-start를 **인라인 스타일로** 걸어준다.
 *                         일부 게임(요트·알까기·섯다)의 결과 오버레이가 원래
 *                         overflow 보호가 없어 내용이 늘어나면 화면 밖으로 잘릴 수 있다
 *                         (CLAUDE.dice-alley.md 함정 21-c와 동일 계열). 원본 CSS는 건드리지 않는다.
 */
(function (root) {
  'use strict';

  var CSS = [
    '.ic-cta{margin-top:14px;padding-top:14px;border-top:1px dashed color-mix(in srgb,var(--brand-gold,var(--accent,#d9a441)) 35%,var(--line,rgba(255,255,255,.14)));',
    '  display:flex;flex-direction:column;align-items:stretch;gap:8px;width:100%;box-sizing:border-box}',
    '.ic-cta .ic-txt{font-size:12.5px;line-height:1.4;color:var(--muted,#a89a86);text-align:center}',
    '.ic-cta .ic-btn{display:block;width:100%;box-sizing:border-box;text-align:center;text-decoration:none;',
    '  font-family:inherit;font-weight:900;font-size:14.5px;cursor:pointer;border:none;border-radius:12px;',
    '  padding:13px 16px;min-height:44px;line-height:18px;',
    '  background:linear-gradient(180deg,color-mix(in srgb,var(--brand-gold,var(--accent,#d9a441)) 82%,#fff 18%),var(--brand-gold,var(--accent,#d9a441)));',
    '  color:var(--brand-gold-ink,var(--accent-ink,#15110d));',
    '  box-shadow:0 4px 12px rgba(0,0,0,.22)}',
    '.ic-cta .ic-btn:hover{filter:brightness(1.06)}',
    '.ic-cta .ic-btn:active{transform:translateY(1px)}',
    '.ic-cta .ic-btn:focus-visible{outline:2px solid var(--brand-gold,var(--accent,#d9a441));outline-offset:2px}'
  ].join('');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var noop = function () { return false; };

  var IC = {
    _styled: false,

    watch: function (opts) {
      try {
        opts = opts || {};
        var game = opts.game;
        var gname = opts.gname || game;
        var resultSel = opts.resultSel || '#resultOv';
        var activeClass = opts.activeClass || 'on';
        var mountSel = opts.mountSel;
        var onlineFn = (typeof opts.online === 'function') ? opts.online : noop;
        var disguiseFn = (typeof opts.disguise === 'function') ? opts.disguise : noop;
        var scrollSel = opts.ensureScrollable || null;

        // 설정이 불완전하면 아무것도 하지 않는다 — 이 파일 하나 때문에 게임이 막히면 안 된다.
        if (!game || !mountSel) return;
        var target = document.querySelector(resultSel);
        if (!target) return;

        if (!this._styled) {
          var st = document.createElement('style');
          st.id = 'icStyle';
          st.textContent = CSS;
          document.head.appendChild(st);
          this._styled = true;
        }

        var banner = null;

        function build() {
          var mount = document.querySelector(mountSel);
          if (!mount) return null;
          var b = document.createElement('div');
          b.className = 'ic-cta';
          b.id = 'icCta_' + game;
          var href = location.pathname + '?host=1';
          b.innerHTML =
            '<div class="ic-txt">친구랑 하면 더 재밌어요</div>' +
            '<a class="ic-btn" href="' + esc(href) + '">🔗 친구랑 하기</a>';
          mount.appendChild(b);
          var a = b.querySelector('.ic-btn');
          if (a) a.addEventListener('click', function () {
            try { window.AL && AL.ev('재초대_클릭', { 게임: gname }); } catch (e) {}
          });
          return b;
        }

        function sync() {
          try {
            var showing = target.classList.contains(activeClass);
            if (!showing) { if (banner) banner.style.display = 'none'; return; }
            if (disguiseFn()) { if (banner) banner.style.display = 'none'; return; }  // 위장 모드 — 절대 노출 금지
            if (onlineFn()) { if (banner) banner.style.display = 'none'; return; }     // 이미 온라인 — 불필요

            if (scrollSel) {
              var ov = document.querySelector(scrollSel);
              if (ov) { ov.style.overflowY = 'auto'; ov.style.alignItems = 'flex-start'; ov.style.webkitOverflowScrolling = 'touch'; }
            }
            if (!banner) banner = build();
            if (banner) banner.style.display = 'flex';
          } catch (e) { /* CTA 실패가 게임을 막으면 안 된다 */ }
        }

        new MutationObserver(sync).observe(target, { attributes: true, attributeFilter: ['class'] });
        sync();  // 이미 열려 있는 채로 스크립트가 늦게 실린 경우 대비
      } catch (e) { /* 조용히 포기 — 원칙: 실패가 게임을 죽이면 안 된다 */ }
    }
  };

  root.INVITECTA = IC;
})(typeof self !== 'undefined' ? self : this);
