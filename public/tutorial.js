/* 공용 튜토리얼 (window.TUT) — v1.227
 *
 * 왜 공용인가. 단계별 튜토리얼이 너클본즈·라이어·좌중우·섯다 4종에만 있고
 * 나머지 9종(윷·요트·알까기·블랙잭·바카라·인디언포커·원카드·하이로우·도둑잡기)엔 없었다.
 * 9개 HTML에 오버레이 마크업을 복붙하면 중복이 심하니, pace.js·stats.js처럼 모듈로 만들었다.
 *
 * 쓰는 법 — 각 게임 HTML의 `</title>` 직후에 두 줄만 넣는다.
 *   <script src="tutorial.js"></script>
 *   <script>TUT.init({ game:'yut', steps:[{art:'🎲', title:'…', body:'…'}, …] })</script>
 *
 *   ⚠️ `</title>` 직후여야 한다 — 13개 HTML 모두 analytics.js가 '계측 보류' 주석 안에 있어서
 *      그 뒤에 스크립트를 넣으면 주석에 갇혀 조용히 안 뜬다(다음단계.md 함정).
 *
 * 특징
 *  - 마크업·CSS를 스스로 주입한다. 게임별 .ov/.sheet 클래스에 의존하지 않는다.
 *  - 색은 게임의 CSS 변수(--panel/--ink/--brass/…)를 쓰되 폴백을 둬서 테마가 달라도 깨지지 않는다.
 *  - 상단바(.topbar/.kbtop)에 📖 버튼을 스스로 달고, 없으면 화면 우상단에 띄운다.
 *  - 첫 방문 1회 자동 오픈(alley_tut_<game>). 판이 깔린 뒤(ingame)에는 자동으로 안 뜬다.
 *  - localStorage가 막혀 있어도(사파리 프라이빗 등) 그냥 자동 오픈만 안 되고 동작은 유지된다.
 */
(function () {
  'use strict';

  var CSS = [
    '.tut-ov{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;',
    '  padding:16px;background:rgba(0,0,0,.62);backdrop-filter:blur(2px)}',
    '.tut-ov.on{display:flex}',
    '.tut-box{background:var(--panel,#1c1712);color:var(--ink,#f0e6d8);border:1px solid var(--line,#3a2f24);',
    '  border-radius:18px;padding:20px 20px 16px;width:100%;max-width:390px;text-align:center;',
    '  box-shadow:0 20px 60px rgba(0,0,0,.55);max-height:calc(100dvh - 32px);overflow-y:auto;',
    '  font-family:inherit;box-sizing:border-box}',
    '.tut-art{font-size:44px;line-height:1;min-height:52px;display:flex;align-items:center;justify-content:center;gap:6px}',
    '.tut-t{font-size:18px;font-weight:800;margin:8px 0 6px;color:var(--brass,#d9a441)}',
    '.tut-b{font-size:13.5px;line-height:1.65;color:var(--ink,#f0e6d8);margin:0;min-height:58px}',
    '.tut-b b{color:var(--brass,#d9a441)}',
    '.tut-dots{display:flex;gap:6px;justify-content:center;margin:13px 0 2px}',
    '.tut-dots i{width:7px;height:7px;border-radius:50%;background:var(--line,#3a2f24);transition:.15s}',
    '.tut-dots i.on{background:var(--brass,#d9a441);transform:scale(1.25)}',
    '.tut-row{display:flex;gap:8px;margin-top:13px}',
    '.tut-btn{flex:1;padding:12px;border-radius:11px;border:none;cursor:pointer;font-family:inherit;',
    '  font-weight:800;font-size:14px;background:var(--brass,#d9a441);color:var(--bg,#15110d)}',
    '.tut-btn.ghost{background:transparent;color:var(--muted,#a89684);border:1px solid var(--line,#3a2f24)}',
    '.tut-btn:disabled{opacity:.35;cursor:default}',
    '.tut-skip{margin-top:10px;background:none;border:none;cursor:pointer;font-family:inherit;',
    '  font-size:12.5px;font-weight:700;color:var(--muted,#a89684);text-decoration:underline}',
    /* 가로로 돌린 폰: 높이가 360~390px뿐이라 그림을 줄이고 좌우로 넓게 쓴다 */
    '@media (orientation:landscape) and (max-height:520px){',
    '  .tut-box{max-width:min(560px,94vw);padding:12px 16px 10px}',
    '  .tut-art{font-size:30px;min-height:32px}',
    '  .tut-t{font-size:15px;margin:4px 0 4px}',
    '  .tut-b{font-size:12.5px;line-height:1.5;min-height:0}',
    '  .tut-row{margin-top:9px}.tut-btn{padding:9px}.tut-dots{margin:8px 0 0}',
    '}',
    '@media (prefers-reduced-motion:reduce){.tut-dots i{transition:none}}'
  ].join('');

  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  var T = {
    _steps: [], _i: 0, _game: '', _el: null, _label: '',

    init: function (opts) {
      opts = opts || {};
      this._steps = (opts.steps || []).filter(function (s) { return s && (s.title || s.body); });
      this._game = opts.game || 'game';
      this._label = opts.label || '📖';
      var self = this;
      if (!this._steps.length) return;
      ready(function () {
        self._build();
        self._mountButton();
        /* 첫 방문 자동 오픈은 걷어냈다 (2026-07-29).
         *   실측: 첫 방문 시 6/6 게임에서 '시작' 버튼이 전체화면 오버레이 2겹(튜토리얼+규칙)에 덮여 있었다.
         *   보드게임은 한 판 해보는 게 설명보다 빠르다 — 읽을거리를 먼저 들이밀면
         *   "뭘 눌러야 하지"가 아니라 "이거 닫는 게 먼저네"가 첫 경험이 된다.
         *   대신 📖 버튼은 늘 상단바에 있고, 첫 판이 끝나면 TUT.nudge()로 한 번 권한다.
         * opts.auto:true를 **명시**하면 예전처럼 자동으로 뜬다(끈 게 아니라 기본값을 뒤집었다). */
        if (opts.auto === true && !LS.get('alley_tut_' + self._game) && !document.body.classList.contains('ingame')) {
          setTimeout(function () {
            if (!document.body.classList.contains('ingame')) self.open();
          }, 550);
        }
      });
    },

    _build: function () {
      if (this._el) return;
      var st = document.createElement('style');
      st.id = 'tutCss'; st.textContent = CSS;
      document.head.appendChild(st);

      var ov = document.createElement('div');
      ov.className = 'tut-ov'; ov.id = 'tutOverlay';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.setAttribute('aria-label', '게임 방법 튜토리얼');
      ov.innerHTML =
        '<div class="tut-box">' +
        '<div class="tut-art" id="tutOArt"></div>' +
        '<h3 class="tut-t" id="tutOT"></h3>' +
        '<p class="tut-b" id="tutOB"></p>' +
        '<div class="tut-dots" id="tutODots"></div>' +
        '<div class="tut-row">' +
        '<button class="tut-btn ghost" id="tutOPrev">이전</button>' +
        '<button class="tut-btn" id="tutONext">다음 ▶</button>' +
        '</div>' +
        '<button class="tut-skip" id="tutOSkip">건너뛰기</button>' +
        '</div>';
      document.body.appendChild(ov);
      this._el = ov;

      var self = this;
      ov.querySelector('#tutOPrev').onclick = function () { self.go(-1); };
      ov.querySelector('#tutONext').onclick = function () { self.go(1); };
      ov.querySelector('#tutOSkip').onclick = function () { self.close(); };
      // 바깥을 눌러도 닫힌다 (게임을 막지 않는 게 중요)
      ov.addEventListener('click', function (e) { if (e.target === ov) self.close(); });
      document.addEventListener('keydown', function (e) {
        if (!ov.classList.contains('on')) return;
        if (e.key === 'Escape') self.close();
        else if (e.key === 'ArrowRight') self.go(1);
        else if (e.key === 'ArrowLeft') self.go(-1);
      });
    },

    /* 상단바에 📖 버튼을 단다. 각 게임의 .iconbtn 스타일을 그대로 물려받게 클래스를 붙인다.
       규칙('?') 버튼 앞에 끼워 넣어 '설명' 계열이 나란히 보이게 한다. */
    _mountButton: function () {
      if (document.getElementById('tutOpenBtn')) return;
      var bar = document.querySelector('.topbar, .kbtop');
      var b = document.createElement('button');
      b.id = 'tutOpenBtn'; b.type = 'button';
      b.className = 'iconbtn'; b.title = '게임 방법 · 튜토리얼';
      b.setAttribute('aria-label', '게임 방법 튜토리얼');
      b.textContent = this._label;
      var self = this;
      b.onclick = function () { self.open(); };
      if (bar) {
        var help = bar.querySelector('#helpBtn, #kbHelp, #yutHelp, #lcrHelp');
        if (help) bar.insertBefore(b, help); else bar.appendChild(b);
      } else {
        // 상단바가 없는 화면 — 우상단에 떠 있게(레이아웃을 밀지 않도록 fixed)
        b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:8000;width:36px;height:36px;' +
          'border-radius:9px;border:1px solid var(--line,#3a2f24);background:var(--panel,#1c1712);' +
          'color:var(--ink,#f0e6d8);cursor:pointer;font-size:15px';
        document.body.appendChild(b);
      }
    },

    open: function () {
      this._build();
      this._i = 0; this._render();
      this._el.classList.add('on');
      LS.set('alley_tut_' + this._game, '1');
      try { window.AL && window.AL.ev('튜토리얼_열기', { 게임: this._game }); } catch (e) {}
    },

    close: function () {
      if (this._el) this._el.classList.remove('on');
      LS.set('alley_tut_' + this._game, '1');
    },

    /* 한 판이 끝난 뒤 한 번만 권하는 작은 띠.
       자동 오버레이를 걷어낸 대신 여기서 규칙을 안내한다 — 판을 막지 않고, 무시해도 그만이다.
       이미 튜토리얼을 본 사람에겐 뜨지 않는다. */
    nudge: function () {
      try {
        if (!this._steps || !this._steps.length) return;
        if (LS.get('alley_tut_' + this._game)) return;          // 이미 봤다
        if (LS.get('alley_tutnudge_' + this._game)) return;     // 이미 권했다
        if (document.getElementById('tutNudge')) return;
        LS.set('alley_tutnudge_' + this._game, '1');

        var self = this;
        var w = document.createElement('div');
        w.id = 'tutNudge';
        w.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:8500;' +
          'display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:14px;' +
          'border:1px solid var(--line,#3a2f24);background:var(--panel,#1c1712);' +
          'box-shadow:0 10px 30px rgba(0,0,0,.45);font-size:13px;font-weight:700;' +
          'color:var(--ink,#f0e6d8);max-width:min(92vw,420px)';
        w.innerHTML = '<span>📖 규칙을 한 번 볼래?</span>' +
          '<button id="tutNudgeGo" style="min-height:36px;padding:0 12px;border-radius:9px;border:none;' +
          'background:var(--brass,#e0a23c);color:var(--brass-ink,#15110d);font-weight:800;cursor:pointer;font-family:inherit">볼래</button>' +
          '<button id="tutNudgeNo" style="min-height:36px;padding:0 10px;border-radius:9px;' +
          'border:1px solid var(--line,#3a2f24);background:transparent;color:var(--muted,#9b8b78);' +
          'font-weight:700;cursor:pointer;font-family:inherit">괜찮아</button>';
        document.body.appendChild(w);

        var kill = function () { if (w.parentNode) w.parentNode.removeChild(w); };
        w.querySelector('#tutNudgeGo').onclick = function () { kill(); self.open(); };
        w.querySelector('#tutNudgeNo').onclick = kill;
        setTimeout(kill, 12000);   // 대답 안 해도 알아서 사라진다
      } catch (e) { }
    },

    go: function (d) {
      var n = this._i + d;
      if (n < 0) return;
      if (n >= this._steps.length) { this.close(); return; }
      this._i = n; this._render();
    },

    _render: function () {
      var s = this._steps[this._i] || {};
      var q = function (id) { return document.getElementById(id); };
      q('tutOArt').textContent = s.art || '🎲';
      q('tutOT').textContent = s.title || '';
      q('tutOB').innerHTML = s.body || '';          // <b> 강조를 쓰므로 innerHTML
      var last = this._i === this._steps.length - 1;
      q('tutONext').textContent = last ? '✅ 알겠어' : '다음 ▶';
      q('tutOPrev').disabled = this._i === 0;
      var dots = '';
      for (var i = 0; i < this._steps.length; i++) dots += '<i class="' + (i === this._i ? 'on' : '') + '"></i>';
      q('tutODots').innerHTML = dots;
    }
  };

  window.TUT = T;
})();
