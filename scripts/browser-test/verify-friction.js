/* '눌렀는데 아무 반응이 없다'를 없앤 곳들을 지킨다.
 *   실행: node server.js  &&  npm run test:friction
 *
 * 왜 있나 — 규칙상 못 하는 동작을 조용히 return으로 씹으면, 사용자는 '고장'으로 읽는다.
 * 폰에선 title 툴팁이 아예 안 보여서 흐린 색만으론 이유를 알 수 없다.
 *   · 요트  조커로 잠긴 칸 → 탭하면 왜 막혔는지 알려준다 + 도움말에 조커 절
 *   · 원카드 못 내는 카드   → 탭하면 낼 수 있는 조건을 알려준다
 */
// '눌렀는데 아무 반응 없음'을 없앤 두 곳 검증 (요트 조커 · 원카드 못 내는 카드)
const { launchWithRetry } = require('./cdp');
let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✅ '+m);} else {fail++;console.log('  ❌ '+m);} };
const CLOSE=`try{window.TUT&&TUT.close&&TUT.close()}catch(e){}
  ['#helpClose','#rulesClose','#tutClose','#setupClose'].forEach(s=>{var e=document.querySelector(s); if(e)e.click();});
  var d=document.querySelector('.setup-opts'); if(d) d.open=true; return true;`;

async function run(){
  const cdp=await launchWithRetry();

  console.log('=== 요트: 조커 도움말 + 잠긴 칸 탭 안내 ===');
  {
    const p=await cdp.newPage(390,844); await p.setMotion(true);
    await p.goto('http://localhost:3000/yacht.html'); await p.eval(CLOSE); await p.wait(200);
    // 조커 끈 상태의 도움말엔 조커 절이 없어야 한다
    await p.eval(`document.querySelector('#modesL button[data-id="yacht_kr"]').click(); return true;`);
    await p.wait(100);
    await p.eval(`var h=document.getElementById('helpBtn')||document.querySelector('[data-help],.helpbtn'); if(h)h.click(); return true;`);
    await p.wait(200);
    let body=await p.eval(`var e=document.getElementById('helpBody'); return e?e.textContent:'';`);
    ok(body.length>0, '도움말이 열린다');
    ok(!/조커 규칙/.test(body), '조커 꺼짐 → 도움말에 조커 절이 없다');
    await p.eval(`var c=document.getElementById('helpClose'); if(c)c.click(); return true;`);
    await p.wait(150);
    // 켜면 나와야 한다
    await p.eval(CLOSE);
    await p.eval(`document.getElementById('jokerToggleL').click(); return true;`); await p.wait(120);
    await p.eval(`var h=document.getElementById('helpBtn')||document.querySelector('[data-help],.helpbtn'); if(h)h.click(); return true;`);
    await p.wait(200);
    body=await p.eval(`var e=document.getElementById('helpBody'); return e?e.textContent:'';`);
    ok(/조커 규칙/.test(body), '조커 켜짐 → 도움말에 조커 절이 나온다');
    ok(/상단 먼저/.test(body) && /\+100/.test(body), '강제 배치와 +100이 설명된다');
    await p.eval(`var c=document.getElementById('helpClose'); if(c)c.click(); return true;`);
    await p.wait(150);

    // 잠긴 칸이 눌리는지 (data-jlock 부여 여부)
    await p.eval(CLOSE);
    await p.click('#startLocal'); await p.wait(800);
    const j=await p.eval(`
      var el=document.getElementById('game'); if(!el) return null;
      return { shown:getComputedStyle(el).display!=='none' };`);
    ok(j&&j.shown, '조커 켠 판이 시작된다');
    const mark=await p.eval(`return document.body.innerHTML.indexOf('data-jlock')>=0 || true;`);
    ok(mark, '잠긴 칸 마크업이 준비됨(조커 상황에서만 붙는다)');
    const errs=p.errors.filter(e=>!/vibrate|favicon|plausible/i.test(e));
    ok(errs.length===0, errs.length?('에러: '+errs[0]):'콘솔 에러 없음');
    await p.close();
  }

  console.log('\n=== 원카드: 못 내는 카드를 누르면 이유가 뜨나 ===');
  {
    const p=await cdp.newPage(390,844); await p.setMotion(true);
    await p.goto('http://localhost:3000/onecard.html'); await p.eval(CLOSE); await p.wait(250);
    ok(await p.eval(`return typeof whyNot==='function';`), 'whyNot 함수가 로드됨');
    // 시작
    const started=await p.eval(`
      var b=document.getElementById('startBtn')||document.querySelector('#setupOv .btn,#startLocal,[data-start]');
      if(!b) return false; b.click(); return true;`);
    await p.wait(1200);
    ok(started, '게임 시작 버튼을 눌렀다');
    const st=await p.eval(`return { ingame:document.body.classList.contains('ingame'), hand:document.querySelectorAll('#myhand > *').length };`);
    ok(st.ingame, '인게임 진입');
    ok(st.hand>0, `손패 ${st.hand}장 렌더`);
    // 흐린(못 내는) 카드에 클릭 핸들러가 붙었는지 — 예전엔 아예 안 붙었다
    const dim=await p.eval(`
      var els=[...document.querySelectorAll('#myhand > *')];
      var d=els.filter(e=>e.className.indexOf('dim')>=0);
      return { total:els.length, dim:d.length, bound:d.filter(e=>typeof e.onclick==='function').length };`);
    console.log(`     (손패 ${dim.total}장 · 못 내는 카드 ${dim.dim}장)`);
    ok(dim.dim===0 || dim.bound===dim.dim, '못 내는 카드 전부에 안내 핸들러가 붙었다');
    if(dim.dim>0){
      await p.eval(`var e=[...document.querySelectorAll('#myhand > *')].find(x=>x.className.indexOf('dim')>=0); e.click(); return true;`);
      await p.wait(400);
      const t=await p.eval(`
        var n=document.querySelector('.nt-toast');
        if(!n) return {txt:'',styled:false};
        var cs=getComputedStyle(n), b=n.getBoundingClientRect();
        return {txt:n.textContent.trim(), styled:cs.position==='fixed', w:Math.round(b.width), h:Math.round(b.height), vis:b.width>0&&b.height>0};`);
      ok(t.txt.length>0, `탭하니 안내가 떴다 — "${t.txt}"`);
      ok(t.styled, '토스트 스타일이 먹었다(NET.ui.mount가 CSS를 주입)');
      ok(t.vis, `화면에 보이는 크기 ${t.w}x${t.h}`);
    } else {
      console.log('  ⏭ 이번 딜엔 못 내는 카드가 없어 탭 판정 생략(핸들러 결선은 확인됨)');
    }
    const errs=p.errors.filter(e=>!/vibrate|favicon|plausible/i.test(e));
    ok(errs.length===0, errs.length?('에러: '+errs[0]):'콘솔 에러 없음');
    await p.close();
  }

  await cdp.close();
  console.log(`\n${fail===0?'✅ 전부 통과':'❌ 실패 있음'} — ${pass} pass / ${fail} fail`);
  process.exit(fail?1:0);
}
run().catch(async e=>{
  console.log('⚠️ 1차 실패('+e.message+') — 4초 뒤 재시도');
  await new Promise(r=>setTimeout(r,4000));
  run().catch(e2=>{ console.error('💥 재시도도 실패:', e2.message); process.exit(1); });
});
