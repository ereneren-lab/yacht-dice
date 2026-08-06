/**
 * 조작 타깃 감사 — **판이 도는 중에** 눌러야 하는 것이 손가락에 맞는 크기인가.
 *
 * 기존 감사와 다른 점:
 *   `audit-landscape` ⑤는 가로 화면의 **아이콘 버튼**만 본다(32px 등).
 *   여기는 세로 화면에서 **게임 진행에 필요한 요소**를 본다 — 카드·말·칸처럼 겹쳐 깔리는 것들.
 *
 * 왜 '노출 폭'인가:
 *   카드를 부채꼴로 겹쳐 깔면 카드 자체는 38px여도 **이웃에 가려지고 남는 폭은 6px**일 수 있다.
 *   실제로 누를 수 있는 건 그 남는 부분뿐이라, 카드 크기가 아니라 **이웃과 겹치지 않는 폭**을 잰다.
 *   (2026-08-06 도둑잡기에서 상대 카드 21장이 노출 폭 중앙값 18px·최소 6px로 깔려 있었다.
 *    도둑잡기는 '상대 카드 한 장을 뽑는 것'이 게임의 전부다.)
 *
 * 기준: 44px(애플 HIG·구글 머티리얼 공통 권장). 24px 미만은 실패, 24~43px은 경고.
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/audit-tap.js
 */
const { launchWithRetry, requireServer } = require('./cdp');

const GAMES = [
  { g: 'kb',          start: '#startBtn'   },
  { g: 'yacht',       start: '#startLocal' },
  { g: 'ld',          start: '#startBtn'   },
  { g: 'lcr',         start: '#startBtn'   },
  { g: 'yut',         start: '#startBtn'   },
  { g: 'alkkagi',     start: '#startBtn'   },
  { g: 'seotda',      start: '#startBtn'   },
  { g: 'indianpoker', start: '#startBtn'   },
  { g: 'onecard',     start: '#startBtn'   },
  { g: 'oldmaid',     start: '#startBtn'   },
  { g: 'blackjack',   start: '#startBtn'   },
  { g: 'baccarat',    start: '#startBtn'   },
  { g: 'highlow',     start: '#startBtn'   },
];

/* 누를 수 있는 것 판정 — ⚠️ 처음엔 'cursor:pointer면 타깃'으로 봤다가 **거의 다 가짜**가 나왔다.
   버튼 안의 작은 span(.pip·.cs·.bi…)이 pointer를 **상속**받아 9px짜리 타깃으로 잡혔는데,
   실제로 손가락이 누르는 건 그 부모 버튼이다. 그래서:
     · 자기 핸들러가 있거나 BUTTON/[role=button]이면 타깃
     · cursor:pointer만으로 볼 땐 **부모가 pointer가 아닐 때만**(상속이 아니라 자기 것일 때만)
     · 겹치면 **바깥쪽**을 남긴다(안쪽 자식이 아니라 부모가 진짜 타깃이다) */
const MEASURE = `
var vw=innerWidth, vh=innerHeight;
var cand=[].slice.call(document.querySelectorAll('*')).filter(function(e){
  if(e.closest('.topbar,.tb,header')) return false;
  var r=e.getBoundingClientRect();
  if(r.width<2||r.height<2||r.bottom<0||r.top>vh) return false;
  var st=getComputedStyle(e);
  if(st.visibility==='hidden'||st.display==='none'||+st.opacity<0.1) return false;
  if(e.disabled) return false;
  var own = !!(e.onclick || e.getAttribute('onclick') || e.tagName==='BUTTON' || e.getAttribute('role')==='button');
  if(own) return true;
  if(st.cursor!=='pointer') return false;
  var p=e.parentElement;
  return !(p && getComputedStyle(p).cursor==='pointer');   // 상속받은 pointer는 타깃이 아니다
});
/* 겹치면 바깥쪽을 남긴다 — 자식은 부모 버튼의 일부일 뿐이다 */
cand = cand.filter(function(e){ return !cand.some(function(o){ return o!==e && o.contains(e); }); });

/* ⚠️ 요소 크기만 재면 **히트 영역 확장을 못 본다.**
   요트의 물음표(.qh)는 보이는 원이 15px이지만 ::before로 44px 히트 영역을 덧댔다 —
   화면상 15px이어도 손가락은 44px 안 어디를 눌러도 닿는다.
   그래서 중심에서 바깥으로 점을 찍어 **elementFromPoint가 여전히 이 요소를 가리키는지**로 잰다. */
function hitRadius(e, r){
  var cx=(r.left+r.right)/2, cy=(r.top+r.bottom)/2, max=0;
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){
    var far=0;
    for(var k=4;k<=24;k+=4){
      var el=document.elementFromPoint(cx+d[0]*k, cy+d[1]*k);
      if(el===e || e.contains(el)) far=k; else break;
    }
    max=Math.max(max,far);
  });
  return max*2;   // 지름
}
function exposed(e){
  var r=e.getBoundingClientRect();
  var w=r.width, h=r.height;
  // 같은 줄에 겹쳐 깔린 이웃이 가리는 만큼을 뺀다
  cand.forEach(function(o){
    if(o===e) return;
    var b=o.getBoundingClientRect();
    var vOverlap = Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top);
    if(vOverlap < Math.min(r.height,b.height)*0.5) return;   // 세로로 안 겹치면 무관
    if(b.left>r.left && b.left<r.right) w=Math.min(w, b.left-r.left);   // 오른쪽 이웃이 덮는다
  });
  var hit=hitRadius(e,r);
  w=Math.max(w, Math.min(hit, 48)); h=Math.max(h, Math.min(hit, 48));
  return {w:Math.round(w), h:Math.round(h), full:Math.round(r.width),
    label:(e.id?'#'+e.id:(e.className&&e.className.toString().trim().split(/\\s+/).slice(0,2).map(function(c){return '.'+c}).join('')))||e.tagName};
}
var out = cand.map(exposed).filter(function(x){ return x.h>6; });
out.sort(function(a,b){ return Math.min(a.w,a.h)-Math.min(b.w,b.h); });
return { total: out.length, worst: out.slice(0,5) };`;

(async () => {
  await requireServer();
  const cdp = await launchWithRetry();
  const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const list = only.length ? GAMES.filter(x => only.includes(x.g)) : GAMES;
  let fail = 0, warn = 0;

  console.log('게임          누를 수 있는 것   가장 작은 타깃(노출 기준)');
  console.log('─'.repeat(74));
  for (const G of list) {
    const page = await cdp.newPage(390, 844);
    try {
      await page.goto('http://localhost:3000/' + G.g + '.html');
      await page.wait(900);
      await page.eval(`try{ if(window.TUT) TUT.close(); }catch(e){} return true;`);
      try { await page.click(G.start); } catch (e) {}
      await page.wait(6000);            // 판이 깔리고 손패가 늘어난 뒤에 잰다
      const m = await page.eval(MEASURE);
      const w = m.worst[0];
      if (!w) { console.log(`✅ ${G.g.padEnd(12)} —`); continue; }
      const min = Math.min(w.w, w.h);
      const mark = min < 24 ? '❌' : (min < 44 ? '⚠️ ' : '✅');
      if (min < 24) fail++; else if (min < 44) warn++;
      console.log(`${mark} ${G.g.padEnd(12)} ${String(m.total).padStart(3)}개          ` +
        `${String(min + 'px').padStart(6)}  ${w.label} (원래 폭 ${w.full}px)` +
        (m.worst[1] ? ` · 다음 ${Math.min(m.worst[1].w, m.worst[1].h)}px ${m.worst[1].label}` : ''));
    } finally { await page.close(); }
  }
  console.log(`\n24px 미만 ${fail}종 · 24~43px ${warn}종  (권장 44px)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
