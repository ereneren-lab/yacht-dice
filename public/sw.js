// 딱세판만 서비스워커 — network-first + 오프라인 폴백
// 배포마다 CACHE 버전을 올리면 활성화 시 옛 캐시를 정리한다.
const CACHE = 'alley-v6';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

/* 게임 13종은 **전부 브라우저에서 도는 정적 파일**이다(서버는 온라인 대전에만 쓴다).
   허브를 한 번 연 뒤 백그라운드로 받아 두면, 잠든 서버든 지하철이든 바로 놀 수 있다.
   ⚠️ 합쳐 약 1.5MB다 — 데이터 절약 모드나 2G에서는 받지 않는다(남의 데이터를 함부로 쓰지 않는다). */
const GAMES = ['/kb.html','/yacht.html','/ld.html','/lcr.html','/yut.html','/alkkagi.html',
  '/seotda.html','/indianpoker.html','/onecard.html','/oldmaid.html','/blackjack.html',
  '/baccarat.html','/highlow.html'];

/* ⚠️ HTML만 받아 두면 소용이 적다 — 실측(2초 지연 서버)에서 페이지는 캐시로 떴는데
   딸린 스크립트가 서버를 때려 5초가 걸렸다. **13종이 공통으로 부르는 것들**을 같이 받는다.
   (`grep src=|href=`로 전 13종에서 뽑은 목록이다. 새 공용 스크립트를 추가하면 여기도 같이 넣을 것.) */
const SHARED = ['/wallet.js','/stats.js','/pace.js','/analytics.js','/topbar-more.js','/topbar-fit.js',
  '/text-floor.js','/chars.js','/fit-setup.js','/tutorial.js','/shop.js','/setup-order.js',
  '/landscape.css','/net.js','/monetize.js','/host-link.js','/cardfx.js','/game-core.js'];

async function warmGames() {
  try {
    const c = self.navigator && self.navigator.connection;
    if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return;   // 아껴야 할 회선이면 건너뛴다
    const cache = await caches.open(CACHE);
    const todo = SHARED.concat(GAMES);          // 공용 자원을 먼저 — 그래야 첫 게임이 바로 뜬다
    /* 하나씩 받으면 왕복이 31번이다. 느린 회선에서 실측(2초 지연): 하나씩 62초 · 4개씩 16초.
       동시에 너무 많이 열면 정작 사람이 누른 페이지가 뒤로 밀리므로 4로 둔다. */
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const u = todo[i++];
        try {
          if (await cache.match(u)) continue;
          const r = await fetch(u, { cache: 'no-cache' });
          if (r && r.ok) await cache.put(u, r);
        } catch (e) {}
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  } catch (e) {}
}

self.addEventListener('install', e => {
  self.skipWaiting();
  // 앱 셸 프리캐시(실패해도 설치는 진행 — 오프라인 첫 진입 대비)
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(()=>{})));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))); // 옛 캐시 정리
    await self.clients.claim();
    warmGames();          // 설치를 막지 않게 기다리지 않는다
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 외부 요청은 그대로
  if (url.pathname.startsWith('/api/')) return;       // 동적 API는 캐싱하지 않음(오래된 방 오답 방지)

  /* 🔴 2026-08-07 — 예전엔 **network-first**였다. 그런데 이 사이트는 Render 무료 티어라
     15분 놀면 잠들고, 깨우는 데 **실측 21.6초**가 걸린다(첫바이트 기준. 깨어 있으면 0.26초).
     network-first면 **이미 와 본 사람도 그 21초를 그대로 기다린다** — 캐시를 갖고도 못 쓴다.
     13종 게임은 전부 브라우저에서 도는 정적 파일이라 서버가 없어도 놀 수 있는데도 그랬다.
     → 캐시가 있으면 **먼저 내주고**(즉시 실행), 새 버전은 뒤에서 조용히 받아 다음 방문에 반영한다.
     대가: 배포 직후 한 번은 옛 화면을 볼 수 있다. 그 대신 잠든 서버와 지하철에서도 게임이 뜬다. */
  e.respondWith((async () => {
    // 주소에 ?host=1 같은 게 붙어도 같은 파일이다 — 네비게이션은 쿼리를 빼고 찾는다
    const opts = req.mode === 'navigate' ? { ignoreSearch: true } : undefined;
    const cached = await caches.match(req, opts);

    const fromNet = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      }
      return res;
    }).catch(() => null);

    if (cached) return cached;              // 있으면 기다리지 않는다
    const res = await fromNet;
    if (res) return res;
    if (req.mode === 'navigate') {          // 처음 온 사람이 오프라인이면 허브로
      const shell = await caches.match('/index.html');
      if (shell) return shell;
    }
    return Response.error();
  })());
});
