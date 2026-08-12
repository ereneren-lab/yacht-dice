// 딱세판만 — 서비스워커 등록 + '새 버전' 넛지 (A5)
// 왜 필요한가: sw.js는 cache-first다(잠든 Render 서버·지하철 대비). 그래서 배포 직후에도
// 한 번은 옛 화면이 뜬다. 새 SW가 조용히 배포를 받아 컨트롤을 넘겨받는 순간을 잡아
// "새 버전 있어요 · 탭하여 새로고침" 토스트를 띄운다 — 사용자가 탭하면 새 CACHE(빈 캐시)로
// 리로드되어 최신 내용을 즉시 본다.
(function () {
  if (!('serviceWorker' in navigator)) return;
  // 네이티브 앱(Capacitor)에서는 SW를 쓰지 않는다
  try { if (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) return; } catch (e) {}

  // 로드 시점에 이미 컨트롤러가 있었나? = 재방문(업데이트 감지 대상).
  // 첫 방문이면 컨트롤러가 없다가 설치되며 controllerchange가 한 번 뜨는데, 그건 새 버전이 아니다.
  var hadController = !!navigator.serviceWorker.controller;
  var reloading = false;

  navigator.serviceWorker.register('sw.js').catch(function () {});

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloading) return;
    if (!hadController) { hadController = true; return; } // 첫 설치는 조용히 넘어간다
    showNudge();
  });

  function showNudge() {
    if (document.getElementById('swNudge')) return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', showNudge); return; }

    var t = document.createElement('div');
    t.id = 'swNudge';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.textContent = '✨ 새 버전이 있어요 · 탭하여 새로고침';
    t.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:calc(16px + env(safe-area-inset-bottom, 0px))',
      'transform:translateX(-50%) translateY(12px)',
      'opacity:0',
      'z-index:2147483647',
      'max-width:min(92vw, 420px)',
      'box-sizing:border-box',
      'padding:12px 18px',
      'border-radius:999px',
      'background:var(--panel, #1b2440)',
      'color:var(--ink, #f3ede0)',
      'border:1px solid var(--brand-gold, #ffb454)',
      'box-shadow:0 8px 28px rgba(0,0,0,.38)',
      'font:600 15px/1.2 system-ui, -apple-system, sans-serif',
      'letter-spacing:-.01em',
      'text-align:center',
      'cursor:pointer',
      '-webkit-tap-highlight-color:transparent',
      'user-select:none',
      'transition:transform .28s cubic-bezier(.22,.61,.36,1), opacity .28s ease'
    ].join(';');

    t.addEventListener('click', function () {
      reloading = true;
      try { t.textContent = '새로고침 중…'; } catch (e) {}
      location.reload();
    });

    document.body.appendChild(t);
    requestAnimationFrame(function () {
      t.style.transform = 'translateX(-50%) translateY(0)';
      t.style.opacity = '1';
    });

    // 30초 뒤에도 안 눌렀으면 조용히 접는다 (계속 붙어 성가시지 않게)
    setTimeout(function () {
      if (reloading || !t.parentNode) return;
      t.style.transform = 'translateX(-50%) translateY(12px)';
      t.style.opacity = '0';
      setTimeout(function () { try { t.remove(); } catch (e) {} }, 320);
    }, 30000);
  }
})();
