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
            fns: J ? ['tap','pop','celebrate','land','turnCue'].filter(function(k){return typeof J[k]==='function';}) : [],
            styleInjected: !!document.getElementById('juiceStyle')
          });
        `);
        const a = JSON.parse(api);
        check(`${g}: JUICE 로드`, a.has && a.fns.length===5, a.has?`fns=${a.fns.join(',')}`:'JUICE 없음');

        // 턴 큐 엣지: false→true 로 바뀔 때만 .juice-turn 이 붙는가(반복 true 는 안 붙어야).
        const turn = await page.eval(`
          try {
            var d = document.createElement('div'); document.body.appendChild(d);
            JUICE.turnCue(d, false);
            var afterFalse = d.classList.contains('juice-turn');
            JUICE.turnCue(d, true);
            var afterEdge = d.classList.contains('juice-turn');
            d.classList.remove('juice-turn');
            JUICE.turnCue(d, true);   // 같은 true 반복 — 다시 붙으면 안 됨
            var afterRepeat = d.classList.contains('juice-turn');
            d.remove();
            return JSON.stringify({afterFalse:afterFalse, afterEdge:afterEdge, afterRepeat:afterRepeat});
          } catch(e){ return 'THROW:'+e.message; }
        `);
        const t = turn.startsWith('THROW') ? null : JSON.parse(turn);
        check(`${g}: 턴 큐 엣지`, !!t && !t.afterFalse && t.afterEdge && !t.afterRepeat, turn);

        // 배선 게임은 펄스 타깃 요소가 실제로 존재해야 한다.
        const wiredSel = { onecard:'#acts', indianpoker:'#betbar', ld:'#controls',
                           yut:'#throwBtn', kb:'#rollBtn', lcr:'#rollBtn', seotda:'#betbar' }[g];
        if (wiredSel){
          const hasTarget = await page.eval(`return !!document.querySelector('${wiredSel}');`);
          check(`${g}: 턴 큐 타깃 ${wiredSel}`, hasTarget===true);
        }
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

        // 결과창 등장: 오버레이에 .on 을 걸면 내부 패널에 juiceRise 애니메이션이 붙는가.
        // yacht 는 #overlay.show(차분 유지)라 의도적으로 안 걸려야 한다.
        const rise = await page.eval(`
          var ov = document.getElementById('resultOv') || document.getElementById('resOv') || document.getElementById('overlay');
          if(!ov) return 'NOOV';
          ov.classList.add('on');
          var panel = ov.querySelector('.card, .resbox') || ov.firstElementChild;
          var name = panel ? getComputedStyle(panel).animationName : 'nopanel';
          ov.classList.remove('on');
          return name;
        `);
        const wantRise = (g !== 'yacht');
        check(`${g}: 결과창 등장 ${wantRise?'모션':'제외(차분)'}`,
          wantRise ? rise==='juiceRise' : rise!=='juiceRise', `animation=${rise}`);

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
