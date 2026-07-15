const { chromium } = require('playwright');
const BASE = 'http://localhost:3121/yut.html';
(async () => {
  const browser = await chromium.launch();
  for (const vp of [{name:'desktop',w:1200,h:820},{name:'mobile',w:430,h:900}]) {
    const ctx = await browser.newContext({ viewport:{width:vp.w,height:vp.h}, deviceScaleFactor:1 });
    const page = await ctx.newPage();
    const errs=[]; page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
    await page.goto(BASE,{waitUntil:'networkidle'});
    // 개인전 시작
    await page.click('#startBtn');
    await page.waitForSelector('#game', {state:'visible'});
    await page.waitForTimeout(600);
    // 말풍선 강제 표시
    // showSpeech가 실제로 하는 배치 로직을 그대로 재현(보드 상단 기준)
    await page.evaluate(()=>{
      const el=document.getElementById('speechBubble');
      el.innerHTML='<img alt=""><span class="sb-body"><b>테스트</b><span>잡았다! 한 번 더!</span></span>';
      const bd=document.getElementById('board'); if(bd){ const br=bd.getBoundingClientRect(); if(br.width){ el.style.top=(br.top+8)+'px'; el.style.left=(br.left+br.width/2)+'px'; } }
      el.classList.add('show');
    });
    await page.waitForTimeout(200);
    const geo = await page.evaluate(()=>{
      const r=el=>{ if(!el)return null; const b=el.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),bottom:Math.round(b.bottom),right:Math.round(b.right)}; };
      return { strip:r(document.getElementById('playersStrip')), bubble:r(document.getElementById('speechBubble')), board:r(document.getElementById('board')) };
    });
    // 겹침 판정
    const s=geo.strip, b=geo.bubble;
    const overlap = s&&b && !(b.right<s.x || b.x>s.right || b.bottom<s.y || b.y>s.bottom);
    console.log(`[${vp.name}] strip=`,JSON.stringify(s),' bubble=',JSON.stringify(b),' board.y=',geo.board&&geo.board.y,' OVERLAP=',overlap);
    await page.screenshot({path:`/Users/jaesung/yacht-dice/scratchpad/qa/measure-${vp.name}.png`});
    console.log(`[${vp.name}] console errors:`, errs.length, errs.slice(0,3));
    await ctx.close();
  }
  await browser.close();
})();
