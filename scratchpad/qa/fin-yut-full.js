const { chromium } = require('playwright');
const BASE = 'http://localhost:3121/yut.html';
const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function newPage(browser, w=1200, h=820){
  const ctx = await browser.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:1 });
  const page = await ctx.newPage();
  const errs=[]; page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  page.on('pageerror',e=>errs.push('PAGEERR:'+e.message));
  page.errs=errs;
  return {ctx,page};
}

async function testTeamColors(browser){
  const {ctx,page}=await newPage(browser);
  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.click('#optMode button[data-t="1"]');   // 팀전 2:2
  await page.click('#optCount button[data-n="4"]').catch(()=>{});
  await page.click('#startBtn');
  await page.waitForSelector('#game',{state:'visible'});
  await sleep(500);
  const dots = await page.$$eval('#pieceTray .tray-name .dotc', els=>els.map(e=>getComputedStyle(e).backgroundColor));
  console.log('[TEAM] tray dot colors:', JSON.stringify(dots));
  // 팀색: 청 rgb(74,144,217), 홍 rgb(224,104,60). i%2 → 0청,1홍,2청,3홍
  const blue='rgb(74, 144, 217)', red='rgb(224, 104, 60)';
  const ok = dots.length>=4 && dots[0]===blue && dots[1]===red && dots[2]===blue && dots[3]===red;
  console.log('[TEAM] team-colored dots correct:', ok, ' errs:', page.errs.length);
  await page.screenshot({path:'/Users/jaesung/yacht-dice/scratchpad/qa/team-tray.png'});
  await ctx.close();
  return ok;
}

async function testChance(browser){
  const {ctx,page}=await newPage(browser);
  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.click('#startBtn');   // 개인전 기본
  await page.waitForSelector('#game',{state:'visible'});
  await sleep(400);
  // 내 차례 throw 단계 대기
  await page.waitForFunction(()=>document.getElementById('powerGauge').classList.contains('on'), {timeout:5000}).catch(()=>{});
  const btn = await page.$('#throwBtn');
  const box = await btn.boundingBox();
  await page.mouse.move(box.x+box.width/2, box.y+box.height/2);
  await page.mouse.down();
  // 게이지 폭이 66~80% 될 때(찬스 구간 64~82%) 떼기
  let hit=false;
  for(let i=0;i<400;i++){
    const w = await page.evaluate(()=>parseFloat(document.getElementById('powerFill').style.width)||0);
    if(w>=66 && w<=80){ hit=true; break; }
    await sleep(4);
  }
  await page.mouse.up();
  await sleep(60);
  const res = await page.evaluate(()=>({
    chance: document.getElementById('powerGauge').classList.contains('chance'),
    toast: Array.from(document.querySelectorAll('.toast')).some(t=>t.textContent.includes('찬스')),
  }));
  console.log('[CHANCE] released-in-band:', hit, ' gauge.chance:', res.chance, ' toast찬스:', res.toast, ' errs:', page.errs.length);
  await page.screenshot({path:'/Users/jaesung/yacht-dice/scratchpad/qa/chance.png'});
  await ctx.close();
  return hit && res.chance && res.toast;
}

async function testFullPlay(browser){
  const {ctx,page}=await newPage(browser);
  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.click('#optMarkers button[data-m="2"]');       // 말 2개
  await page.click('#optAiDiff button[data-ad="easy"]');     // 초보
  await page.click('#optAiSpeed button[data-af="1"]');       // 빠름
  // 승리조건 최소값(첫 옵션)
  const g0 = await page.$('#optGoal button'); if(g0) await g0.click();
  await page.click('#startBtn');
  await page.waitForSelector('#game',{state:'visible'});
  await sleep(400);

  let sawFirstHint=false, sawFinishTag=false, over=false, sawSwampLabel=false;
  const start=Date.now(); let lastLog=0;
  while(Date.now()-start < 150000){
    if(Date.now()-lastLog>15000){ lastLog=Date.now();
      const prog=await page.evaluate(()=>Array.from(document.querySelectorAll('.pchip .pdone')).map(e=>e.textContent).join(' | '));
      console.log('   ...progress @'+Math.round((Date.now()-start)/1000)+'s:', prog);
    }
    // 첫 말 힌트
    const ti = await page.evaluate(()=>document.getElementById('turnInfo').textContent);
    if(ti.includes('아래 내 말')) sawFirstHint=true;
    // 완주 태그
    const tag = await page.evaluate(()=>Array.from(document.querySelectorAll('.tray-tag')).map(t=>t.textContent).join('|'));
    if(/[1-9]\/\d+\s*완주/.test(tag)) sawFinishTag=true;
    // 늪 라벨 존재
    if(!sawSwampLabel){ sawSwampLabel = await page.evaluate(()=>Array.from(document.querySelectorAll('#boardLayer text')).some(t=>t.textContent==='늪')); }
    // 결과창?
    over = await page.evaluate(()=>{ const r=document.getElementById('resultOv'); return r && r.classList.contains('on'); });
    if(over) break;
    // 내 차례 진행
    const st = await page.evaluate(()=>{ try{ const g=document.getElementById('game'); return {phase:(document.getElementById('turnInfo').textContent), gaugeOn:document.getElementById('powerGauge').classList.contains('on'), movable:document.querySelectorAll('.tp.movable, [role=button][aria-label=\"말 이동\"]').length }; }catch(e){ return {}; } });
    if(st.gaugeOn){
      const btn=await page.$('#throwBtn'); const b=await btn.boundingBox();
      if(b){ await page.mouse.move(b.x+b.width/2,b.y+b.height/2); await page.mouse.down(); await sleep(120); await page.mouse.up(); }
      await sleep(500);
    } else if(st.movable>0){
      const el = await page.$('.tp.movable') || await page.$('[aria-label="말 이동"]');
      if(el){ await el.click().catch(()=>{}); }
      await sleep(400);
    } else {
      await sleep(400); // AI 차례 대기
    }
  }
  console.log('[PLAY] firstHint:',sawFirstHint,' finishTag:',sawFinishTag,' swampLabel:',sawSwampLabel,' gameOver:',over,' errs:',page.errs.length, page.errs.slice(0,3));
  if(over){
    const rh = await page.evaluate(()=>{ const h=document.querySelector('.rank-head'); return h?h.textContent:null; });
    const rhTitles = await page.evaluate(()=>Array.from(document.querySelectorAll('.rank-head .rh-stat')).map(s=>s.getAttribute('title')));
    console.log('[PLAY] rank-head text:', JSON.stringify(rh), ' titles:', JSON.stringify(rhTitles));
    await page.screenshot({path:'/Users/jaesung/yacht-dice/scratchpad/qa/result.png'});
    // 골목 복귀: hubx 링크
    const hub = await page.evaluate(()=>{ const a=document.querySelector('a.hubx'); return a?a.getAttribute('href'):null; });
    console.log('[PLAY] hubx href:', hub);
  }
  console.log('[PLAY] final console errors:', page.errs.length);
  await ctx.close();
  return {over, sawFirstHint, errs:page.errs.length};
}

(async()=>{
  const browser=await chromium.launch();
  const only=process.env.ONLY||'all';
  let t1,t2,t3;
  if(only==='all'||only==='team') t1=await testTeamColors(browser);
  if(only==='all'||only==='chance') t2=await testChance(browser);
  if(only==='all'||only==='play') t3=await testFullPlay(browser);
  console.log('\n=== SUMMARY ===');
  console.log('team dots:', t1, '| chance:', t2, '| play:', t3&&JSON.stringify(t3));
  await browser.close();
})();
