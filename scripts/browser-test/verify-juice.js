/**
 * juice.js 손맛 레이어 검증 (게임필 확산 ④-2).
 * 실제 크로미움에서 13종 게임 페이지를 하나씩 열어 단언한다:
 *   1) window.JUICE 가 로드되고 tap/pop/celebrate/land 가 함수인가
 *   2) 전역 프레스가 배선됐는가 — 버튼에 pointerdown 시 예외 없이 동작하는가
 *   3) JUICE.celebrate('#resTitle') 를 불러도 예외가 없는가(제목 팝 경로)
 *   4) 페이지 로드~상호작용 동안 콘솔 예외 0
 *
 * 사용: node scripts/browser-test/verify-juice.js  (서버 안 떠 있으면 알아서 띄운다)
 */
const { launchWithRetry, requireServer } = require('./cdp');
const { spawn } = require('child_process');
const path = require('path');

const GAMES = ['yut','yacht','kb','ld','lcr','alkkagi','seotda','oldmaid','blackjack','highlow','baccarat','indianpoker','onecard'];
const BASE = 'http://localhost:3000';

let pass = 0, fail = 0;
function check(name, ok, detail){ console.log(`${ok?'✅':'❌'} ${name}${detail?' — '+detail:''}`); ok?pass++:fail++; }

async function ensureServer(){
  if (await requireServer(BASE + '/')) return null;
  const proc = spawn('node', [path.join(__dirname,'..','..','server.js')], { stdio:'ignore', detached:false });
  for (let i=0;i<40;i++){ if (await requireServer(BASE+'/')) return proc; await new Promise(r=>setTimeout(r,250)); }
  throw new Error('서버 기동 실패');
}

async function run(){
  const srv = await ensureServer();
  const cdp = await launchWithRetry();
  try {
    for (const g of GAMES){
      const page = await cdp.newPage();
      try {
        await page.goto(`${BASE}/${g}.html`);
        await new Promise(r=>setTimeout(r,400));   // 스크립트 부트(DOMContentLoaded 후 boot) 여유

        const api = await page.eval(`
          var J = window.JUICE;
          return JSON.stringify({
            has: !!J,
            fns: J ? ['tap','pop','celebrate','land'].filter(function(k){return typeof J[k]==='function';}) : [],
            styleInjected: !!document.getElementById('juiceStyle')
          });
        `);
        const a = JSON.parse(api);
        check(`${g}: JUICE 로드`, a.has && a.fns.length===4, a.has?`fns=${a.fns.join(',')}`:'JUICE 없음');
        check(`${g}: 프레스 스타일 주입`, a.styleInjected);

        // 전역 프레스: 첫 버튼에 pointerdown/up 디스패치 → 예외 없이 통과하는지
        const press = await page.eval(`
          try {
            var b = document.querySelector('button, [role=button], .btn');
            if (!b) return 'NOBTN';
            b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
            var t1 = b.style.transform;
            b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
            return 'OK:'+(t1||'none');
          } catch(e){ return 'THROW:'+e.message; }
        `);
        check(`${g}: 프레스 무결성`, press.startsWith('OK')||press==='NOBTN', press);

        // 승리 축하 경로: celebrate 호출이 예외를 던지지 않는가
        const cel = await page.eval(`
          try { window.JUICE && JUICE.celebrate('#resTitle'); return 'OK'; }
          catch(e){ return 'THROW:'+e.message; }
        `);
        check(`${g}: celebrate 호출`, cel==='OK', cel);

        const errs = (page.errors||[]).filter(e=>!/favicon|ERR_|net::/.test(e));
        check(`${g}: 콘솔 예외 0`, errs.length===0, errs.slice(0,2).join(' | '));
      } finally {
        await page.close();
      }
    }
  } finally {
    await cdp.close();
    if (srv) try{ process.kill(srv.pid); }catch(e){}
  }
  console.log(`\n${fail===0?'✅ 전부 통과':'❌ 실패 있음'} — pass=${pass} fail=${fail}`);
  process.exit(fail===0?0:1);
}
run().catch(e=>{ console.error(e); process.exit(1); });
