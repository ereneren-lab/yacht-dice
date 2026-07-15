const { chromium } = require('playwright');
const BASE='http://localhost:3125';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:900,height:900}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/lcr.html'); await sleep(300);
  await p.evaluate(()=>{try{localStorage.removeItem('lcr_hint_seen');}catch(e){}});
  await p.reload(); await sleep(300);
  await p.click('#optSpeed .opt[data-s="fast"]');
  await p.click('#startBtn'); await sleep(300);
  console.log('first folded:', await p.$eval('#seathint',e=>e.classList.contains('folded')));
  await p.check('#autoChk');
  let over=false;
  for(let i=0;i<160;i++){ if(await p.$eval('#resultOv',e=>e.classList.contains('on')).catch(()=>false)){over=true;break;} await sleep(150); }
  const flag = await p.evaluate(()=>{try{return localStorage.getItem('lcr_hint_seen');}catch(e){return 'ERR';}});
  console.log('over:', over, '| localStorage flag after over:', flag);
  // 완전 새 세션(리로드)로 지속성 확인
  await p.reload(); await sleep(300);
  const flagAfterReload = await p.evaluate(()=>{try{return localStorage.getItem('lcr_hint_seen');}catch(e){return 'ERR';}});
  await p.click('#startBtn'); await sleep(400);
  console.log('after reload flag:', flagAfterReload, '| new game folded:', await p.$eval('#seathint',e=>e.classList.contains('folded')));
  console.log('errors:', errs.length);
  await b.close(); process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
