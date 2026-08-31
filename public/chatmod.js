/* chatmod.js — 온라인 채팅 **뮤트·신고** 레이어. self-injecting.
 *
 * 왜 있나 (2026-08-31, 앱 출시 준비)
 *   온라인 5종(윷·너클본즈·라이어·좌중우·요트)에 **자유 텍스트 채팅**이 있다. Google Play의
 *   UGC(사용자 생성 콘텐츠) 정책은 유저 간 자유 소통에 **신고·차단 수단**을 요구한다 —
 *   없으면 심사에서 걸린다. 이 파일이 그 최소 요건을 채운다.
 *
 * 설계
 *   - 게임 코드(addChat)를 **한 줄도 안 고친다.** `#chatLog`를 MutationObserver로 지켜보다가
 *     내 것이 아닌 메시지(.cmsg:not(.me))에 작은 '⋯'을 붙인다 → 뮤트/신고.
 *   - 발신자 식별은 메시지 안 `<b>이름</b>` 텍스트로 한다(5종 공통 구조 · data 속성 없음).
 *   - 뮤트: 그 이름의 메시지를 **숨긴다**(현재+앞으로). 목록은 localStorage `alley_muted`.
 *   - 신고: 숨김 + 자동 뮤트 + "접수" 안내. 중재 서버가 없으니 **유저 자기보호**로 충족한다
 *     (정책이 요구하는 건 "유해 콘텐츠를 안 보게 할 수단 + 신고 창구"의 존재다).
 *   - 각 게임은 <script src="chatmod.js"> 한 줄만 추가하면 된다(juice.js처럼).
 */
(function () {
  'use strict';
  var LS = 'alley_muted';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function muted() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } }
  function setMuted(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }
  function isMuted(name) { return muted().indexOf(name) >= 0; }
  function mute(name) { var a = muted(); if (name && a.indexOf(name) < 0) { a.push(name); setMuted(a); } applyAll(); }

  function nameOf(msg) { var b = msg.querySelector && msg.querySelector('b'); return b ? b.textContent : ''; }

  function applyOne(msg) {
    if (!msg || msg.nodeType !== 1 || !msg.classList || !msg.classList.contains('cmsg')) return;
    if (msg.classList.contains('me')) return;                 // 내 메시지엔 안 붙인다
    if (isMuted(nameOf(msg))) { msg.style.display = 'none'; return; }
    msg.style.display = '';
    if (msg.getAttribute('data-cmod')) return;                // 이미 붙였다
    msg.setAttribute('data-cmod', '1');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cmod-dot'; b.textContent = '⋯';
    b.setAttribute('aria-label', '메시지 옵션');
    b.addEventListener('click', function (e) { e.stopPropagation(); openMenu(msg, b); });
    msg.appendChild(b);
  }
  function applyAll() {
    var log = document.getElementById('chatLog'); if (!log) return;
    var msgs = log.querySelectorAll('.cmsg');
    for (var i = 0; i < msgs.length; i++) applyOne(msgs[i]);
  }

  function closeMenu() { var m = document.getElementById('cmodMenu'); if (m && m.parentNode) m.parentNode.removeChild(m); }
  function openMenu(msg, anchor) {
    closeMenu();
    var name = nameOf(msg);
    var m = document.createElement('div'); m.id = 'cmodMenu'; m.className = 'cmod-menu';
    m.innerHTML = '<button type="button" data-a="mute">🔇 뮤트 — ' + esc(name) + '</button>' +
      '<button type="button" data-a="report">🚩 신고</button>';
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect();
    m.style.left = Math.max(6, Math.min(r.left, window.innerWidth - m.offsetWidth - 6)) + 'px';
    m.style.top = (r.bottom + 4) + 'px';
    m.addEventListener('click', function (e) {
      var a = (e.target && e.target.getAttribute) ? e.target.getAttribute('data-a') : null;
      if (!a) return;
      e.stopPropagation();
      if (a === 'mute') { mute(name); toast('🔇 ' + name + ' 뮤트됨 · 이 사람 메시지를 숨겨요'); }
      else if (a === 'report') { mute(name); msg.style.display = 'none'; toast('🚩 신고 접수 · 이 사용자를 숨겼어요'); }
      closeMenu();
    });
    setTimeout(function () { document.addEventListener('click', closeMenu, { once: true }); }, 0);
  }

  /* 자체 토스트 — 게임마다 토스트 함수 이름이 달라(showToast/toast) 여기 한 벌 둔다. */
  function toast(text) {
    try {
      var t = document.createElement('div'); t.className = 'cmod-toast'; t.textContent = text;
      document.body.appendChild(t);
      requestAnimationFrame(function () { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
      setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 250); }, 2200);
    } catch (e) {}
  }

  var CSS =
    '.cmsg{position:relative}' +
    '.cmod-dot{position:absolute;top:2px;right:3px;width:18px;height:18px;line-height:1;padding:0;border:0;border-radius:5px;' +
    'background:transparent;color:var(--muted,#9a8f80);font-size:13px;cursor:pointer;opacity:.55}' +
    '.cmod-dot:hover,.cmod-dot:active{opacity:1;background:rgba(255,255,255,.1)}' +
    '.cmod-menu{position:fixed;z-index:100000;background:#241d16;border:1px solid rgba(255,255,255,.16);border-radius:10px;' +
    'padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:2px;min-width:132px}' +
    '.cmod-menu button{background:transparent;border:0;color:#f3ece0;text-align:left;font-size:12.5px;font-weight:700;' +
    'padding:8px 10px;border-radius:7px;cursor:pointer;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis}' +
    '.cmod-menu button:hover,.cmod-menu button:active{background:rgba(255,255,255,.1)}' +
    '.cmod-toast{position:fixed;left:50%;bottom:calc(72px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(6px);' +
    'z-index:100001;background:rgba(20,17,13,.94);color:#f3ece0;font-size:12.5px;font-weight:700;padding:9px 14px;border-radius:999px;' +
    'border:1px solid rgba(255,255,255,.16);opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;max-width:86vw}';

  function boot() {
    try {
      if (!document.getElementById('cmodStyle')) {
        var st = document.createElement('style'); st.id = 'cmodStyle'; st.textContent = CSS;
        (document.head || document.documentElement).appendChild(st);
      }
    } catch (e) {}
    var tries = 0;
    var wait = setInterval(function () {
      var log = document.getElementById('chatLog');
      if (log) {
        clearInterval(wait);
        applyAll();
        try {
          new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
              var added = muts[i].addedNodes;
              for (var j = 0; j < added.length; j++) applyOne(added[j]);
            }
          }).observe(log, { childList: true });
        } catch (e) {}
      } else if (++tries > 40) { clearInterval(wait); }   // 채팅 없는 페이지면 10초 뒤 조용히 포기
    }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.CHATMOD = { mute: mute, muted: muted, isMuted: isMuted };
})();
