/**
 * 번들 빌드 콘텐츠 건전성 — 스토어용 **번들 앱**(capacitor.config에 server.url 없음)이 깨질 만한
 * 것을 빌드 전에 잡는다. `npm run test:bundle`
 *
 * 원리
 *   `npx cap sync`는 `public/`를 앱 안에 **루트(/)** 로 굽는다(웹 배포의 github.io 서브경로 변환 없이).
 *   dev 서버(node server.js)도 `public/`를 루트로 서빙하므로 **번들 레이아웃과 같다.**
 *   그래서 "루트 서빙에서 로컬 자산 404·콘솔 에러가 없는가"를 14개 페이지에서 확인하면,
 *   `/yacht-dice/` 같은 서브경로를 가정한 절대경로가 번들에서 깨지는 걸 미리 잡는다.
 *
 * 여기서 확인 못 하는 것(실기기 몫): APK 빌드/서명, https://localhost 스킴·WebView 동작,
 *   앱에서 Render 소켓 연결, 오프라인(SW) 동작. → 폰에서 `npm run app:release` 후 직접.
 *
 * ⚠️ 외부 호스트(gc.zgo.at 계측 등)는 이 환경에서 프록시에 막혀 실패한다 — 그건 번들 문제가 아니라
 *    샌드박스 아티팩트라 걸러낸다(계측은 실패해도 게임에 무해하게 설계됨).
 */
const { ensureServer } = require('./yut-drive');
const { launchWithRetry } = require('./cdp');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PAGES = ['/', '/yut.html', '/yacht.html', '/kb.html', '/ld.html', '/lcr.html', '/alkkagi.html',
  '/seotda.html', '/indianpoker.html', '/onecard.html', '/oldmaid.html', '/blackjack.html', '/baccarat.html', '/highlow.html'];

// 외부 호스트/샌드박스 차단·계측 실패는 번들 문제가 아니다 → 제외
const IGNORE = /vibrate|AudioContext|goatcounter|gc\.zgo\.at|plausible|onrender|ERR_BLOCKED|Failed to fetch|net::ERR_(INTERNET|NAME|CONNECTION|PROXY|TUNNEL|CERT|SSL)/i;

const results = [];
const check = (name, ok, detail) => { results.push({ ok }); console.log(`${ok ? '✅' : '❌'} ${name}${!ok && detail ? ' — ' + detail : ''}`); };

async function run() {
  await ensureServer();
  const cdp = await launchWithRetry();
  try {
    for (const pg of PAGES) {
      const p = await cdp.newPage();
      const bad404 = [];
      await p.s('Network.enable');
      p.cdp.on('Network.responseReceived', (q, sid) => {
        if (sid !== p.sessionId) return;
        const u = q.response.url, st = q.response.status;
        if (st >= 400 && /localhost:3000\//.test(u) && !/\.map$/.test(u)) bad404.push(st + ' ' + u.replace('http://localhost:3000', ''));
      });
      try { await p.goto('http://localhost:3000' + pg); } catch (e) {}
      await sleep(500);
      const errs = p.errors.filter(e => !IGNORE.test(e));
      check(`${pg.padEnd(18)} 자산404 ${bad404.length} · 콘솔에러 ${errs.length}`, bad404.length === 0 && errs.length === 0,
        (bad404.length ? bad404.slice(0, 2).join(' ; ') : '') + (errs.length ? ' | ' + errs.slice(0, 1).join('') : ''));
      await p.close();
    }
  } finally { await cdp.close(); }
  const fail = results.filter(r => !r.ok).length;
  console.log(`\n${fail ? `❌ ${fail}/${PAGES.length} 페이지에 문제 — 번들에서 깨질 수 있다` : '✅ 14개 전부 통과 — 번들 콘텐츠 건전(절대경로·로컬 자산 문제 없음)'}`);
  return fail ? 1 : 0;
}
(async () => {
  try { process.exit(await run()); }
  catch (e) {
    console.error('실행 실패:', (e.message || '').split('\n')[0], '— 재시도');
    results.length = 0; await new Promise(r => setTimeout(r, 4000));
    try { process.exit(await run()); } catch (e2) { console.error('실행 실패:', e2.message); process.exit(1); }
  }
})();
