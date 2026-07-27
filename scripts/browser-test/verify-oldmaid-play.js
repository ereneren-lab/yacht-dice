/**
 * 도둑잡기 실제 플레이 완주 — 브라우저에서 판이 끝까지 가는가.
 * audit:ux는 레이아웃만, test:stats는 endGame()을 직접 부른다.
 * **플레이 루프 자체를 검증하는 건 이 스크립트뿐이다.**
 *
 * 함정 #16: 게임이 굳어도 단언이 깨지지 않고 '침묵'으로 나타난다
 *   → 실제로 몇 턴 진행됐는지를 로그로 남기고, 0턴이면 실패로 친다.
 * 함정 #18: 페이지 변수는 `typeof S`로 맨 이름 참조 — `window.S`는 undefined다(최상위 let).
 *
 * 사용: node server.js 띄운 뒤  npm run test:oldmaid:play
 */
const { launchWithRetry } = require('./cdp');

async function run(itemsOn, nOpt) {
  const cdp = await launchWithRetry();
  const p = await cdp.newPage(430, 900);
  await p.goto('http://localhost:3000/oldmaid.html');
  await p.wait(900);
  await p.eval(`try{ if(window.TUT) TUT.close(); var c=document.querySelector('#rulesClose'); if(c&&c.offsetParent)c.click(); }catch(e){} return true;`);
  await p.wait(200);
  await p.eval(`document.querySelector('#optN .opt[data-n="${nOpt}"]').click(); return true;`);
  if (itemsOn) await p.eval(`document.querySelector('#optItems .opt[data-items="1"]').click(); return true;`);
  // AI 템포를 줄여 테스트를 빠르게 — 엔진 딜레이는 전부 PMS()를 거친다(로직 경로는 그대로)
  await p.eval(`window.PMS = function(n){ return Math.max(15, Math.round(n*0.12)); }; return true;`);
  // 사람 차례를 자동 처리하는 드라이버를 페이지 안에 심는다
  await p.eval(`
    window.__drv = {turns:0, waits:0, peeks:0, avoided:0};
    window.__tick = function(){
      if(typeof S==='undefined' || !S || S.phase!=='play') return;
      if(S.turn !== S.mySeat){ __drv.waits++; return; }
      var me = S.players[S.mySeat];
      if(me && me.out){ __drv.waits++; return; }
      // 아이템이 있으면 절반은 써본다(아이템 경로도 실제로 밟는다)
      if(S.canPeek && Math.random()<0.5){ __drv.peeks++; engine.action('me',{type:'peek'}); return; }
      var tgt = S.players[S.target];
      if(!tgt || !tgt.count){ __drv.waits++; return; }
      var idx = Math.floor(Math.random()*tgt.count);
      // 조커 위치를 봤으면 피한다 — 사람이 화면 보고 하는 것과 같은 판단
      if(S.myPeek && S.myPeek.targetSeat===S.target && S.myPeek.jokerIdx!=null && tgt.count>1){
        idx = Math.floor(Math.random()*(tgt.count-1));
        if(idx >= S.myPeek.jokerIdx) idx++;
        __drv.avoided++;
      }
      engine.action('me',{type:'draw', idx:idx});
      __drv.turns++;
    };
    window.__iv = setInterval(window.__tick, 60);
    return true;`);
  await p.click('#startBtn');

  /* 판정 기준은 벽시계가 아니라 **진행이 멈췄는가**다(느린 것 ≠ 굳은 것). */
  const STALL_MS = 12000, CAP_MS = 180000;
  let done = false, elapsed = 0, lastSeq = -1, stalled = 0;
  while (elapsed < CAP_MS) {
    await p.wait(500); elapsed += 500;
    const st = await p.eval(`return { phase:(typeof S!=='undefined'&&S)?S.phase:'?',
      over: !!document.getElementById('resultOv').classList.contains('on'),
      seq: (typeof engine!=='undefined'&&engine)?engine.actionSeq:-1,
      drv: window.__drv, title:(document.getElementById('resTitle')||{}).textContent||'' };`);
    if (st.seq !== lastSeq) { lastSeq = st.seq; stalled = 0; } else stalled += 500;
    if (stalled >= STALL_MS && st.phase === 'play') {
      console.log(`  ${nOpt}인 items=${itemsOn?'on ':'off'} → ❌ 진행 정지 (${STALL_MS/1000}초간 actionSeq=${st.seq} 고정) 내턴 ${st.drv.turns}회`);
      break;
    }
    if (st.phase === 'gameover' && st.over) {
      done = true;
      const errs = p.errors.filter(e => !/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
      const d = st.drv;
      console.log(`  ${nOpt}인 items=${itemsOn?'on ':'off'} → ✅ 완주 (${(elapsed/1000).toFixed(1)}s) 내턴 ${d.turns}회 · 👀 ${d.peeks} · 조커회피 ${d.avoided} · 결과 "${st.title}"`);
      if (d.turns === 0) { console.log('  ❌ 내 차례가 0회 — 드라이버가 아무것도 안 했다'); done = false; }
      if (errs.length) { console.log('  ❌ 콘솔 에러: ' + errs[0].slice(0, 140)); done = false; }
      break;
    }
  }
  if (!done && stalled < STALL_MS) {
    const st = await p.eval(`return { phase:(typeof S!=='undefined'&&S)?S.phase:'?', turn:(typeof S!=='undefined'&&S)?S.turn:-1,
      drv: window.__drv, msg:(document.getElementById('msg')||{}).textContent||'' };`);
    console.log(`  ${nOpt}인 items=${itemsOn?'on ':'off'} → ❌ 미완주 phase=${st.phase} turn=${st.turn} drv=${JSON.stringify(st.drv)} msg="${st.msg}"`);
  }
  await p.eval(`clearInterval(window.__iv); return true;`).catch(() => {});
  await p.close(); await cdp.close();
  return done;
}

(async () => {
  let bad = 0;
  for (const n of [3, 4]) for (const it of [false, true]) {
    const ok = await run(it, n); if (!ok) bad++;
  }
  console.log(bad ? `\n❌ 미완주 ${bad}건` : '\n✅ 4조합 전부 브라우저에서 완주');
  process.exit(bad ? 1 : 0);
})();
