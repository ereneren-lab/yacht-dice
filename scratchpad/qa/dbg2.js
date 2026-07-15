const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1200,height:820}})).newPage();
  await p.goto('http://localhost:3121/yut.html',{waitUntil:'networkidle'});
  await p.click('#optMarkers button[data-m="2"]');
  await new Promise(r=>setTimeout(r,200));
  const goals = await p.$$eval('#optGoal button', els=>els.map(e=>({t:e.textContent,on:e.classList.contains('on'),g:e.dataset.g||e.getAttribute('data-goal')})));
  console.log('goal options:', JSON.stringify(goals));
  await b.close();
})();
