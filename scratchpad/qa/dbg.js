const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({viewport:{width:1200,height:820}})).newPage();
  await p.goto('http://localhost:3121/yut.html',{waitUntil:'networkidle'});
  await p.click('#startBtn');
  await p.waitForSelector('#game',{state:'visible'});
  await p.waitForTimeout(500);
  const d = await p.evaluate(()=>{
    const out={};
    out.hasShowSpeech = typeof showSpeech;
    out.hasS = typeof S;
    try{ out.Snull = (S===null); out.players = S&&S.players&&S.players.length; out.pid0 = S&&S.players[0]&&S.players[0].pid; }catch(e){ out.serr=e.message; }
    try{ out.speechKeys = typeof SPEECH!=='undefined' ? Object.keys(SPEECH) : 'no SPEECH'; }catch(e){ out.skerr=e.message; }
    try{ showSpeech(S.players[0].pid,'catch'); out.afterHTML = document.getElementById('speechBubble').outerHTML.slice(0,120); out.afterTop=document.getElementById('speechBubble').style.top; }catch(e){ out.callErr=e.message; }
    return out;
  });
  console.log(JSON.stringify(d,null,1));
  await b.close();
})();
