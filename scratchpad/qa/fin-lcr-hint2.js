const { chromium } = require('playwright');
const BASE='http://localhost:3125';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:900,height:900}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/lcr.html'); await sleep(300);
  // localStorage 동작 자체 확인
  const lsTest = await p.evaluate(()=>{ try{ localStorage.setItem('__t','1'); const v=localStorage.getItem('__t'); localStorage.removeItem('__t'); return v; }catch(e){ return 'ERR:'+e.message; } });
  console.log('localStorage write/read:', lsTest);
  await p.evaluate(()=>{try{localStorage.removeItem('lcr_hint_seen');}catch(e){}});
  await p.reload(); await sleep(300);
  await p.click('#optCount .opt[data-n="3"]');
  await p.click('#optSpeed .opt[data-s="fast"]');
  await p.click('#startBtn'); await sleep(300);
  await p.check('#autoChk');
  let over=false;
  for(let i=0;i<400;i++){ if(await p.$eval('#resultOv',e=>e.classList.contains('on')).catch(()=>false)){over=true;break;} await sleep(150); }
  const flag = await p.evaluate(()=>{try{return localStorage.getItem('lcr_hint_seen');}catch(e){return 'ERR';}});
  const hintSeenVar = await p.evaluate(()=>{ // 간접: seathint folded 상태로 유추 불가하니 새 판 열어봄
    return null; });
  console.log('over:', over, '| flag after finishing game:', flag);
  await b.close(); process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
