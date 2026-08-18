/**
 * 계측 **실측** 검증 — 실사이트처럼(비-DEV) 돌 때 beacon이 진짜 나가는지 본다.
 *
 * 왜 (2026-08-18, #1 de-risk)
 *   기존 verify-analytics.js는 **localhost=DEV**라 이벤트가 console.log('[AL]')로만 찍힌다 —
 *   실제 전송 경로(send()→goatcounter.count→gc.zgo.at)를 못 본다. 그 파일도 스스로 적어놨다:
 *   "남은 확인은 하나 — 배포 후 대시보드에 실제로 찍히는지 눈으로 볼 것."
 *   재성님이 대시보드를 보기 전에, **앱이 올바른 beacon을 올바른 엔드포인트로 쏘는지**를 여기서 못 박는다.
 *
 * 트릭
 *   analytics.js의 문지기: LOCAL_HOST = /^(localhost|127\.|0\.0\.0\.0|::1)/.test(hostname).
 *   컨테이너 비-loopback IP(192.0.2.2)로 페이지를 열면 이 정규식에 안 걸려 **DEV=false**가 된다
 *   → github.io에서와 같은 '진짜 전송' 경로가 돈다.
 *   count.js(gc.zgo.at)는 이 샌드박스 프록시가 막으므로(HTTP 000) 스텁이 이벤트를 큐에 쌓는다.
 *   → window.goatcounter.count를 스파이로 갈아끼우면 analytics의 flush 인터벌이 큐를 스파이로 흘려보낸다.
 *   그 페이로드({path,title,event})를 그대로 단언한다.
 *
 * 여기서 확인 못 하는 것(정직하게): count.js가 실제로 로드돼 sepan.goatcounter.com **서버가 수신**하는지.
 *   두 호스트가 프록시에 막혀 있다 → 그건 **실기기 + 대시보드**로만 확인된다. 이 스크립트는 앱 쪽까지다.
 *
 * 사용: node scripts/browser-test/verify-analytics-send.js
 */
const fs = require('fs');
const path = require('path');
const { ensureServer } = require('./yut-drive');
const { launchWithRetry } = require('./cdp');

const HOST = '192.0.2.2';           // 컨테이너 비-loopback IP → DEV 정규식에 안 걸림
const PORT = process.env.PORT || 3000;
const ORIGIN = `http://${HOST}:${PORT}`;

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 스파이 주입 + 큐 flush를 기다린 뒤 잡힌 beacon 목록을 돌려준다.
const SPY = `
  window.__beacons = window.__beacons || [];
  window.goatcounter = window.goatcounter || {};
  window.goatcounter.count = function (o) {
    o = o || {};
    window.__beacons.push({
      path: (typeof o.path === 'function') ? '<pageview-fn>' : o.path,
      title: o.title || null,
      event: !!o.event
    });
  };
  return true;
`;
const readBeacons = (page) => page.eval('return JSON.stringify(window.__beacons || [])').then(JSON.parse);

async function run() {
  await ensureServer();
  const cdp = await launchWithRetry();
  try {
    // ── 1) 게임 페이지: 비-DEV 전송 경로 (pageview + 게임시작) ──
    {
      const page = await cdp.newPage();
      // count.js(gc.zgo.at) 로드를 브라우저가 실제로 **시도**하는지 네트워크로 본다(막혀도 시도는 남는다)
      const netUrls = [];
      await page.s('Network.enable');
      page.cdp.on('Network.requestWillBeSent', (p, sid) => {
        if (sid === page.sessionId && p.request && p.request.url) netUrls.push(p.request.url);
      });

      await page.goto(ORIGIN + '/yut.html');
      await page.eval(SPY);          // count.js가 막혀 스텁이 큐에 쌓아둔 걸 스파이로 받는다
      await sleep(500);              // analytics의 flush 인터벌(250ms)이 큐를 흘리도록

      let bx = await readBeacons(page);
      // (a) pageview가 실제 전송 경로로 갔다 = DEV였다면 console.log만 하고 여기 안 왔다
      const pv = bx.find(b => b.path === '<pageview-fn>' && !b.event);
      check('비-DEV 판정 — pageview가 goatcounter.count로 전송됨(문지기가 열림)', !!pv,
            pv ? '' : 'pageview beacon 없음 → DEV로 잘못 막혔거나 전송 경로 끊김 / ' + JSON.stringify(bx));

      // (b) 게임시작: body.ingame 관찰 → AL.start() → 이름에 게임명이 붙는다
      await page.eval('document.body.classList.add("ingame"); return true;');
      await sleep(300);
      bx = await readBeacons(page);
      const gs = bx.find(b => b.event && b.path === '게임시작-윷놀이');
      check('게임시작 — beacon 발화 & 이름 규칙(게임시작-윷놀이)', !!gs,
            gs ? JSON.stringify(gs) : '없음 / ' + JSON.stringify(bx.filter(b => b.event)));
      check('게임시작 — event:true & title 보존', !!gs && gs.event === true && gs.title === '게임시작',
            gs ? `title=${gs.title} event=${gs.event}` : '');

      // (c) 브라우저가 count.js(전송기)를 실제로 불러오려 했나
      const triedCount = netUrls.some(u => /gc\.zgo\.at\/count\.js/.test(u));
      check('전송기 로드 시도 — 브라우저가 gc.zgo.at/count.js를 요청함(태그가 살아있음)', triedCount,
            triedCount ? '(이 샌드박스는 프록시가 막아 실제 수신은 대시보드로만 확인)' : 'count.js 요청 없음 → 태그 누락 의심');

      await page.close();
    }

    // ── 2) 초대입장: ?room= 링크를 연 순간 ──
    {
      const page = await cdp.newPage();
      await page.goto(ORIGIN + '/yut.html?room=TEST01');
      await page.eval(SPY);
      await sleep(500);
      const bx = await readBeacons(page);
      const enter = bx.find(b => b.event && b.path === '초대입장-윷놀이');
      check('초대입장 — ?room= 진입 시 beacon 발화', !!enter,
            enter ? JSON.stringify(enter) : '없음 / ' + JSON.stringify(bx.filter(b => b.event)));
      await page.close();
    }

    // ── 3) 방만들기: 나가는 소켓 {t:'create'}를 엿본다 ──
    {
      const page = await cdp.newPage();
      await page.goto(ORIGIN + '/yut.html');
      await page.eval(SPY);
      await sleep(300);
      // WebSocket.prototype.send가 analytics에 의해 패치돼 있다. 실제 서버로 안 붙어도
      // send 호출 자체가 {t:'create'}를 엿보므로 beacon이 뜬다.
      await page.eval(`
        try {
          var ws = Object.create(WebSocket.prototype);   // 실제 연결 없이 프로토타입 send만 호출
          WebSocket.prototype.send.call(ws, JSON.stringify({t:'create', mode:'yut'}));
        } catch(e) { /* readyState 등으로 원래 send가 던져도 엿보기는 이미 끝났다 */ }
        return true;
      `);
      await sleep(200);
      const bx = await readBeacons(page);
      const made = bx.find(b => b.event && b.path === '방만들기-윷놀이');
      check('방만들기 — 소켓 {t:create} 엿보기 → beacon', !!made,
            made ? JSON.stringify(made) : '없음 / ' + JSON.stringify(bx.filter(b => b.event)));
      await page.close();
    }

    // ── 4) 정적 감사: 13종+허브 전부 같은 엔드포인트/설정 (한 곳이라도 누락되면 그 페이지는 조용히 샌다) ──
    {
      const dir = path.join(__dirname, '../../public');
      const pages = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
      let withAL = 0, bad = [];
      for (const f of pages) {
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        if (!/<script src="analytics\.js"/.test(src)) continue;
        withAL++;
        const okEndpoint = /data-goatcounter="https:\/\/sepan\.goatcounter\.com\/count"/.test(src);
        const okScript = /gc\.zgo\.at\/count\.js/.test(src);
        const okOpts = /no_onload"?\s*:\s*true/.test(src) && /allow_local"?\s*:\s*true/.test(src);
        if (!(okEndpoint && okScript && okOpts)) bad.push(f + (okEndpoint ? '' : ' [엔드포인트]') + (okScript ? '' : ' [count.js]') + (okOpts ? '' : ' [설정]'));
      }
      check(`정적 — analytics.js 실은 ${withAL}개 페이지 전부 sepan 엔드포인트+설정 일치`, bad.length === 0,
            bad.length ? '어긋남: ' + bad.join(' · ') : `${withAL}개 일치`);
    }
  } finally {
    await cdp.close();
  }

  const fail = results.filter(r => !r.ok);
  console.log(`\n${fail.length ? '❌' : '✓'} ${results.length - fail.length}/${results.length} 통과`);
  if (!fail.length) console.log('→ 앱 쪽 전송은 정상. 남은 건 대시보드 수신(실기기에서만 확인 — gc.zgo.at·sepan이 샌드박스에선 막힘).');
  return fail.length ? 1 : 0;
}

(async () => {
  try { process.exit(await run()); }
  catch (e) {
    console.error('실행 실패:', (e.message || '').split('\n')[0], '— 재시도');
    results.length = 0;
    await new Promise(r => setTimeout(r, 4000));
    try { process.exit(await run()); }
    catch (e2) { console.error('실행 실패:', e2.message); process.exit(1); }
  }
})();
