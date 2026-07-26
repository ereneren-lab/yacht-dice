/**
 * 공통 진행 속도(PACE) — "AI가 너무 빨라 진행을 못 따라간다"를 전 게임 공통으로 해결한다.
 *
 * 설계
 *  - 게임마다 하드코딩돼 있던 AI 딜레이를 `PACE.ms(기본값)`으로 감싸 배수를 먹인다.
 *  - 설정은 한 곳(localStorage `alley_pace`)에만 둔다 — 게임마다 따로 놀지 않게.
 *  - 상단바에 버튼을 **자동으로** 꽂는다(각 HTML 구조를 건드리지 않으려고).
 *    `<script src="pace.js"></script>` 한 줄만 추가하면 된다.
 *  - 계측(analytics.js)과 같은 원칙: 이게 죽어도 게임은 돌아야 한다 → 호출부는 전부 방어적.
 *
 * 기본값이 '보통'이어도 예전보다 느리다(×1.35). 예전 속도가 곧 불만의 원인이었다.
 */
(function (global) {
  var KEY = 'alley_pace';
  var MODES = [
    { k: 'slow',   icon: '🐢', label: '느긋', mult: 2.1,  desc: '한 수씩 눈으로 따라갈 수 있게' },
    { k: 'normal', icon: '🚶', label: '보통', mult: 1.35, desc: '기본' },
    { k: 'fast',   icon: '⚡', label: '빠름', mult: 0.65, desc: '결과만 빨리' }
  ];

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      for (var i = 0; i < MODES.length; i++) if (MODES[i].k === v) return MODES[i];
    } catch (e) {}
    return MODES[1];
  }

  var cur = read();

  function save(m) {
    cur = m;
    try { localStorage.setItem(KEY, m.k); } catch (e) {}
    try { global.dispatchEvent(new CustomEvent('pacechange', { detail: { mode: m.k, mult: m.mult } })); } catch (e) {}
    paintAll();
  }

  var PACE = {
    MODES: MODES,
    mode: function () { return cur.k; },
    mult: function () { return cur.mult; },
    /** 기본 딜레이(ms)에 현재 배수를 먹인다. 게임 코드는 이것만 부르면 된다. */
    ms: function (base) { return Math.round((base || 0) * cur.mult); },
    set: function (k) {
      for (var i = 0; i < MODES.length; i++) if (MODES[i].k === k) { save(MODES[i]); return; }
    },
    cycle: function () {
      var i = MODES.indexOf(cur);
      var n = MODES[(i + 1) % MODES.length];
      save(n);
      toast(n.icon + ' 진행 속도 · ' + n.label);
      return n.k;
    }
  };

  // ── 토스트 (CSS까지 여기서 주입 — 13개 스타일시트를 건드리지 않으려고) ──
  var styled = false;
  function injectCSS() {
    if (styled) return; styled = true;
    var s = document.createElement('style');
    s.textContent =
      '.pace-toast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);' +
      'z-index:9999;pointer-events:none;background:rgba(24,16,8,.94);color:#ffe9b8;border:1.5px solid rgba(196,150,74,.6);' +
      'border-radius:999px;padding:9px 18px;font-size:13.5px;font-weight:800;letter-spacing:.01em;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.45);opacity:0;transition:opacity .18s,transform .18s}' +
      '.pace-toast.on{opacity:1;transform:translateX(-50%) translateY(-4px)}' +
      '@media (prefers-reduced-motion:reduce){.pace-toast{transition:none}}';
    document.head.appendChild(s);
  }

  var toastEl = null, toastT = 0;
  function toast(msg) {
    try {
      injectCSS();
      if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'pace-toast'; document.body.appendChild(toastEl); }
      toastEl.textContent = msg;
      toastEl.classList.add('on');
      clearTimeout(toastT);
      toastT = setTimeout(function () { try { toastEl.classList.remove('on'); } catch (e) {} }, 1400);
    } catch (e) {}
  }
  PACE.toast = toast;

  // ── 상단바 버튼 자동 장착 ──
  var btns = [];
  function paintAll() {
    for (var i = 0; i < btns.length; i++) {
      try {
        btns[i].textContent = cur.icon;
        btns[i].title = '진행 속도 · ' + cur.label + ' (' + cur.desc + ')';
        btns[i].setAttribute('aria-label', '진행 속도 ' + cur.label + ', 눌러서 변경');
      } catch (e) {}
    }
  }

  function mount() {
    try {
      // 상단바의 기존 아이콘 버튼 옆에 같은 모양으로 끼워 넣는다(게임마다 id가 달라 후보를 훑는다)
      var anchor = document.getElementById('helpBtn') || document.getElementById('kbHelp') ||
                   document.getElementById('yutHelp') || document.getElementById('lcrHelp') ||
                   document.getElementById('lightBtn') || document.getElementById('muteBtn') ||
                   document.getElementById('soundBtn');
      if (!anchor || !anchor.parentNode) return;
      if (document.getElementById('paceBtn')) return;
      var b = document.createElement('button');
      b.id = 'paceBtn';
      b.className = anchor.className;          // 게임별 아이콘 버튼 스타일을 그대로 물려받는다
      b.type = 'button';
      b.onclick = function (e) { e.preventDefault(); PACE.cycle(); };
      anchor.parentNode.insertBefore(b, anchor);
      btns.push(b);
      paintAll();
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  /**
   * 설정 키 통일 마이그레이션 (2026-07-26)
   * 소리·닉네임이 게임마다 다른 키를 써서 "허브에서 음소거했는데 카드게임은 소리 남",
   * "게임마다 이름 다시 입력"이 났다. 공통 키로 모으되, 쓰던 값은 한 번만 옮겨 온다.
   */
  (function migrate() {
    try {
      var moves = [
        ['alley_sound', ['seotda_sound', 'bj_sound', 'bc_sound', 'hl_sound', 'ip_sound', 'om_sound', 'oc_sound']],
        ['alley_name',  ['seotda_name', 'alk_name', 'ip_name', 'om_name', 'oc_name']]
      ];
      // 알까기만 의미가 뒤집힌 키('alk_mute' 1=음소거)를 썼다 → 공통 의미(0=음소거)로 변환
      if (localStorage.getItem('alley_sound') == null && localStorage.getItem('alk_mute') != null) {
        localStorage.setItem('alley_sound', localStorage.getItem('alk_mute') === '1' ? '0' : '1');
      }
      for (var i = 0; i < moves.length; i++) {
        var dst = moves[i][0], srcs = moves[i][1];
        if (localStorage.getItem(dst) != null) continue;      // 공통 값이 이미 있으면 그게 정답
        for (var j = 0; j < srcs.length; j++) {
          var v = localStorage.getItem(srcs[j]);
          if (v != null) { localStorage.setItem(dst, v); break; }
        }
      }
    } catch (e) {}
  })();

  global.PACE = PACE;
  // 게임 코드가 짧게 부르는 이름. pace.js가 아예 안 뜨면 각 HTML의 폴백(n=>n)이 대신 들어간다.
  global.PMS = function (n) { try { return PACE.ms(n); } catch (e) { return n; } };
})(typeof window !== 'undefined' ? window : this);
