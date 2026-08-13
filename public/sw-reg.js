// 딱세판만 — 서비스워커 등록 + '새 버전' 넛지 (A5)
// 왜 필요한가: sw.js는 HTML·JS·CSS를 네트워크 우선(2.5초 타임아웃)으로 준다(2026-08-12 개편).
// 깨어있는 호스트(github.io·깨어난 Render)에선 항상 최신이라 넛지가 필요 없지만,
// 잠든 Render(21.6초)에서 타임아웃돼 캐시로 폴백한 경우엔 옛 화면이 뜰 수 있다 — 그때
// 새 SW가 컨트롤을 넘겨받는 순간을 잡아 "새 버전 있어요 · 탭하여 새로고침"을 띄운다.
// updateViaCache:'none' — sw.js 업데이트 감지를 HTTP 캐시로 늦추지 않는다.
(function () {
  if (!('serviceWorker' in navigator)) return;

  /* 2026-08-13 — 앱에서도 서비스워커를 켠다. 예전엔 여기서 네이티브를 걸러냈다.
     그때는 맞았다: 앱이 자산을 APK 안에 넣고 https://localhost 커스텀 스킴으로 띄워서
     SW 등록이 반드시 실패했고(오프라인은 APK 자산이 해결했다) 콘솔 오류만 남겼다.
     OTA로 바꾸면서(#23) 앱이 github.io를 원격으로 받는다 -> APK 안 자산이 없어졌다.
     실측: 앱에서 SW 등록 0, 캐시 0이라 한 번도 안 열어본 게임은 오프라인에서
     '웹페이지를 사용할 수 없음'이 떴다. 예전 앱은 13종이 전부 오프라인에서 됐으니 후퇴다.
     이제 원점이 정상 https라 SW가 정상 등록된다 -> warmGames가 13종을 미리 받아 오프라인 복원. */

  // 로드 시점에 이미 컨트롤러가 있었나? = 재방문(업데이트 감지 대상).
  // 첫 방문이면 컨트롤러가 없다가 설치되며 controllerchange가 한 번 뜨는데, 그건 새 버전이 아니다.
  var hadController = !!navigator.serviceWorker.controller;
  var reloading = false;

  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function () {});

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
