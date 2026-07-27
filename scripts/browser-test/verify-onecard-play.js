/**
 * 원카드 실제 플레이 완주 — 브라우저에서 판이 끝까지 가는가.
 * audit:ux는 레이아웃만, test:stats는 endGame()을 직접 부른다.
 * **플레이 루프 자체를 검증하는 건 이 스크립트뿐이다.**
 *
 * 함정 #16: 게임이 굳어도 단언이 깨지지 않고 '침묵'으로 나타난다
 *   → 실제로 몇 턴 진행됐는지를 로그로 남기고, 0턴이면 실패로 친다.
 * 함정 #18: 페이지 변수는 `typeof S`로 맨 이름 참조 — `window.S`는 undefined다(최상위 let).
 *
 * 사용: node server.js 띄운 뒤  npm run test:onecard:play
 */
const { launchWithRetry } = require('./cdp');

async function run(itemsOn, nOpt){
  const cdp = await launchWithRetry();
  const p = await cdp.newPage(430,900);
  await p.goto('http://localhost:3000/onecard.html');
  await p.wait(900);
  await p.eval(`try{ if(window.TUT) TUT.close(); var c=document.querySelector('#rulesClose'); if(c&&c.offsetParent)c.click(); }catch(e){} return true;`);
  await p.wait(200);
  await p.eval(`document.querySelector('#optN .opt[data-n="${nOpt}"]').click(); return true;`);
  if(itemsOn) await p.eval(`document.querySelector('#optItems .opt[data-items="1"]').click(); return true;`);
  // AI 생각 시간을 줄여 테스트를 빠르게 — 엔진은 aiMs:PMS(780)으로 만들어지므로 PMS를 갈아끼운다.
  // 연출/로직 경로는 그대로 탄다(딜레이 값만 짧아진다).
  await p.eval(`window.PMS = function(n){ return Math.max(20, Math.round(n*0.12)); }; return true;`);
  // 사람 차례를 자동으로 처리하는 드라이버를 페이지 안에 심는다
  await p.eval(`
    window.__drv = {turns:0, waits:0, shields:0, jokers:0, draws:0, takes:0};
    window.__tick = function(){
      if(typeof S==='undefined' || !S || S.phase!=='play'){ return; }
      if(S.turn !== S.mySeat){ __drv.waits++; return; }
      var va = S.validActions||[];
      // 🛡 있으면 절반의 확률로 써본다(아이템 경로도 실제로 밟는다)
      if(S.canShield && Math.random()<0.5){ __drv.shields++; engine.action('me',{type:'shield'}); __drv.turns++; return; }
      var playable=(S.myHand||[]).filter(function(c){return c.playable;});
      if(playable.length){
        var c=playable[0];
        if(c.joker){ __drv.jokers++; engine.action('me',{type:'play',cardId:c.id,suit:0}); }
        else engine.action('me',{type:'play',cardId:c.id});
        __drv.turns++; return;
      }
      if(va.indexOf('pass')>=0){ engine.action('me',{type:'pass'}); __drv.turns++; return; }
      if(va.indexOf('take')>=0){ __drv.takes++; engine.action('me',{type:'take'}); __drv.turns++; return; }
      if(va.indexOf('draw')>=0){ __drv.draws++; engine.action('me',{type:'draw'}); __drv.turns++; return; }
      __drv.waits++;
    };
    window.__iv = setInterval(window.__tick, 60);
    return true;`);
  await p.click('#startBtn');
  /* 판정 기준은 벽시계가 아니라 **진행이 멈췄는가**다.
     원카드는 판 길이 편차가 크다(시뮬 실측 평균 45스텝 · 최장 246스텝) — 그냥 긴 판을
     '굳었다'로 오진하면 안 된다. 그래서 actionSeq가 STALL_MS 동안 안 오르면 그때만 실패로 친다. */
  const STALL_MS = 12000, CAP_MS = 180000;
  let done=false, elapsed=0, lastSeq=-1, stalled=0;
  while(elapsed<CAP_MS){
    await p.wait(500); elapsed+=500;
    const st = await p.eval(`return { phase: (typeof S!=='undefined'&&S)?S.phase:'?', over: !!document.getElementById('resultOv').classList.contains('on'),
                                      seq: (typeof engine!=='undefined'&&engine)?engine.actionSeq:-1,
                                      drv: window.__drv, title: (document.getElementById('resTitle')||{}).textContent||'' };`);
    if(st.seq!==lastSeq){ lastSeq=st.seq; stalled=0; } else { stalled+=500; }
    if(stalled>=STALL_MS && st.phase==='play'){
      const d=st.drv;
      console.log(`  ${nOpt}인 items=${itemsOn?'on ':'off'} → ❌ 진행 정지 (${STALL_MS/1000}초간 actionSeq=${st.seq} 고정) 내턴 ${d.turns}회`);
      break;
    }
    if(st.phase==='gameover' && st.over){ done=true;
      const errs = p.errors.filter(e=>!/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
      console.log(`  ${nOpt}인 items=${itemsOn?'on ':'off'} → ✅ 완주 (${(elapsed/1000).toFixed(1)}s) 내턴 ${st.drv.turns}회 · 뽑기 ${st.drv.draws} · 받기 ${st.drv.takes} · 🛡 ${st.drv.shields} · 조커 ${st.drv.jokers} · 결과 "${st.title}"`);
      if(st.drv.turns===0) { console.log('  ❌ 내 차례가 0회 — 드라이버가 아무것도 안 했다'); done=false; }
      if(errs.length) { console.log('  ❌ 콘솔 에러: '+errs[0].slice(0,140)); done=false; }
      break;
    }
  }
  if(!done){
    const st = await p.eval(`return { phase: (typeof S!=='undefined'&&S)?S.phase:'?', turn:(typeof S!=='undefined'&&S)?S.turn:-1, drv: window.__drv,
                                      msg:(document.getElementById('msg')||{}).textContent||'' };`);
    console.log(`  ${nOpt}인 items=${itemsOn?'on ':'off'} → ❌ 미완주 phase=${st.phase} turn=${st.turn} drv=${JSON.stringify(st.drv)} msg="${st.msg}"`);
  }
  await p.eval(`clearInterval(window.__iv); return true;`).catch(()=>{});
  await p.close(); await cdp.close();
  return done;
}

(async()=>{
  let bad=0;
  for(const n of [2,3,4]) for(const it of [false,true]){
    const okk = await run(it,n); if(!okk) bad++;
  }
  console.log(bad? `\n❌ 미완주 ${bad}건` : '\n✅ 6조합 전부 브라우저에서 완주');
  process.exit(bad?1:0);
})();
