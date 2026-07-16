// 주사위 골목 서비스워커 — network-first + 오프라인 폴백
// 배포마다 CACHE 버전을 올리면 활성화 시 옛 캐시를 정리한다.
const CACHE = 'alley-v2';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

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
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 외부 요청은 그대로
  if (url.pathname.startsWith('/api/')) return;       // 동적 API는 캐싱하지 않음(오래된 방 오답 방지)

  e.respondWith(
    fetch(req).then(res => {
      // 정상 응답만 캐시에 복사(오류/부분응답 저장 안 함)
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      }
      return res;
    }).catch(async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      // 네비게이션인데 캐시도 없으면 허브로 폴백
      if (req.mode === 'navigate') return caches.match('/index.html');
      return Response.error();
    })
  );
});
