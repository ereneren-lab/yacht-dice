// 딱세판만 서비스워커 — network-first + 오프라인 폴백
// 배포마다 CACHE 버전을 올리면 활성화 시 옛 캐시를 정리한다.
const CACHE = 'alley-v17';
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
const SHARED = ['/wallet.js','/stats.js','/pace.js','/analytics.js','/topbar-more.js','/topbar-fit.js','/ws-url.js','/share-url.js',
  '/text-floor.js','/chars.js','/fit-setup.js','/tutorial.js','/shop.js','/setup-order.js',
  '/landscape.css','/net.js','/monetize.js','/host-link.js','/cardfx.js','/game-core.js',
  '/invite-cta.js','/tokens.css','/sw-reg.js','/juice.js','/chatmod.js','/snd.js','/bgm.js'];

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
  // 앱 셸 프리캐시(실패해도 설치는 진행 — 오프라인 첫 진입 대비).
  // ⚠️ addAll은 HTTP 캐시를 타 낡은 HTML을 담을 수 있어 no-cache로 직접 받는다(위 런타임 핸들러와 같은 이유).
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    SHELL.map(u => fetch(u, { cache: 'no-cache' }).then(r => { if (r && r.ok) return c.put(u, r); }).catch(()=>{}))
  )));
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

  /* 🟢 2026-08-12 — 전략 재조정: **네트워크 우선 + 짧은 타임아웃 → 캐시 폴백**.
     배경: 예전 cache-first는 잠든 Render(21.6초)를 피하려 캐시를 먼저 줬는데, 그 대가로
     **배포해도 한 박자 늦게 반영**됐다(옛 화면 + 넛지 탭 후에야 최신). github.io처럼 항상
     빠른 호스트에서도 늦어 테스트가 괴로웠다.
     → HTML·JS·CSS는 **네트워크를 먼저, 단 2.5초만 기다린다**:
        · github.io / 깨어있는 Render(0.26초) → 항상 최신, 지연 0
        · 잠든 Render(21.6초) → 2.5초 뒤 캐시로 폴백 → 오프라인·지하철 이점 유지
     이미지·기타는 무거우니 cache-first(+뒤에서 갱신) 그대로. */
  const url2 = new URL(req.url);
  const isNav = req.mode === 'navigate';
  const isCode = /\.(?:js|css)$/i.test(url2.pathname);
  const opts = isNav ? { ignoreSearch: true } : undefined;

  /* ⚠️ 2026-09-03 — HTML은 HTTP 캐시를 우회해 받는다.
     게임 13종·허브는 **인라인 JS를 담은 단일 .html**이라 콘텐츠 핫픽스가 대부분 HTML 변경이다.
     그런데 이 HTML엔 해시버스팅(?v=)이 안 붙고 GitHub Pages가 max-age=600을 준다 →
     network-first의 fetch(req)조차 WebView HTTP 캐시에서 낡은 HTML을 "신선한 응답"으로 받아
     배포 후 최대 10분 지연됐다(실기기 확인). JS/CSS는 해시라 URL이 바뀌어 즉시 갱신되지만 HTML만 뒤처진다.
     → HTML은 no-store 요청으로 HTTP 캐시를 건너뛴다. 오프라인 경로(캐시 폴백)는 그대로라 무해하다. */
  const isHTML = isNav || /\.html?$/i.test(url2.pathname);
  const netFetch = () => isHTML
    ? fetch(new Request(url2.href, { cache: 'no-store', credentials: 'same-origin', redirect: 'follow' }))
    : fetch(req);

  const putCache = (res) => {
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
    }
    return res;
  };

  if (isNav || isCode) {
    // 네트워크 우선(2.5초 타임아웃) → 실패/지연 시 캐시
    e.respondWith((async () => {
      const cached = await caches.match(req, opts);
      try {
        const res = await Promise.race([
          netFetch().then(putCache),
          new Promise((_, rej) => setTimeout(() => rej(new Error('sw-timeout')), 2500))
        ]);
        if (res && res.ok) return res;      // 신선한 응답
        if (cached) return cached;          // 404 등은 캐시로 대체
        return res;
      } catch (e2) {
        if (cached) return cached;          // 타임아웃/오프라인 → 캐시
        if (isNav) { const shell = await caches.match('/index.html'); if (shell) return shell; }
        return Response.error();
      }
    })());
    return;
  }

  // 그 외(이미지·폰트 등): cache-first + 뒤에서 조용히 갱신
  e.respondWith((async () => {
    const cached = await caches.match(req, opts);
    const fromNet = fetch(req).then(putCache).catch(() => null);
    if (cached) return cached;
    const res = await fromNet;
    if (res) return res;
    return Response.error();
  })());
});
