const { chromium } = require('playwright');
const DIR = '/Users/jaesung/yacht-dice/scratchpad/qa';
const BASE = 'http://localhost:3125';
const errs = [];
function hook(page, tag){
  page.on('console', m=>{ if(m.type()==='error') errs.push(`[${tag}][console.error] ${m.text()}`); });
  page.on('pageerror', e=>errs.push(`[${tag}][pageerror] ${e.message}`));
  page.on('requestfailed', r=>errs.push(`[${tag}][requestfailed] ${r.url()} ${r.failure()&&r.failure().errorText}`));
  page.on('response', r=>{ if(r.status()>=400) errs.push(`[${tag}][http ${r.status()}] ${r.url()}`); });
}
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
const log = (...a)=>console.log(...a);

async function cardChips(p){
  return await p.$$eval('#players .pcard', els=>els.map(e=>({
    name:e.querySelector('.pnm')?.textContent?.trim(),
    chips:+e.querySelector('.chipn')?.textContent,
    turn:e.classList.contains('turn'), out:e.classList.contains('out')
  })));
}

(async()=>{
  const b = await chromium.launch();

  /* ============ PHASE A: 로컬 4인 완주 + 칩보존 + P4 팟표기 ============ */
  {
    const ctx = await b.newContext({ viewport:{width:900,height:1000} });
    const p = await ctx.newPage(); hook(p,'local4');
    await p.goto(BASE+'/lcr.html'); await sleep(600);
    // 4인, 빠름
    await p.click('#optCount .opt[data-n="4"]');
    await p.click('#optSpeed .opt[data-s="fast"]');
    await p.click('#startBtn'); await sleep(400);
    // AI 이름이 동물명인지 (로컬)
    const cards0 = await cardChips(p);
    log('A local4 names:', cards0.map(c=>c.name).join(' | '));
    // 자동 굴리기 켜서 완주
    await p.check('#autoChk'); await sleep(200);
    // 내 차례 아닐 때도 AI가 굴린다. autoroll이 내 차례 처리. 완주까지 대기 + 중간 칩보존 체크
    let consOK=true, N=4, maxPotSeen=0, sawBlaze=false;
    for(let i=0;i<160;i++){
      const over = await p.$eval('#rollBtn', el=>el.textContent.includes('게임 종료')).catch(()=>false);
      const st = await p.evaluate(()=>({
        pot:+document.getElementById('potN').textContent,
        blaze:document.getElementById('potBox').classList.contains('blaze'),
        result:document.getElementById('resultOv').classList.contains('on')
      }));
      if(st.pot>maxPotSeen) maxPotSeen=st.pot;
      if(st.blaze) sawBlaze=true;
      const cs = await cardChips(p);
      const sum = cs.reduce((a,c)=>a+c.chips,0)+st.pot;
      if(!st.result && sum!==N*3){ consOK=false; log('  !! conservation break sum=',sum,'expected',N*3,'pot',st.pot); }
      if(st.result) break;
      await sleep(180);
    }
    await sleep(500);
    const res = await p.evaluate(()=>({
      title:document.getElementById('resTitle').textContent,
      sub:document.getElementById('resSub').textContent,
      on:document.getElementById('resultOv').classList.contains('on')
    }));
    log('A local4 conservation OK:', consOK, '| maxPotSeen:', maxPotSeen, '| blaze naturally:', sawBlaze);
    log('A local4 result:', res.title, '||', res.sub, '| shown:', res.on);
    await p.screenshot({ path:DIR+'/fin-lcr-A-result.png' });
    await ctx.close();
  }

  /* ============ PHASE B: 로컬 6인 모바일 배지 + 칩보존 ============ */
  {
    const ctx = await b.newContext({ viewport:{width:390,height:840} });
    const p = await ctx.newPage(); hook(p,'local6');
    await p.goto(BASE+'/lcr.html'); await sleep(600);
    await p.click('#optCount .opt[data-n="6"]');
    await p.click('#optSpeed .opt[data-s="fast"]');
    await p.click('#startBtn'); await sleep(500);
    const crowd = await p.$eval('#players', el=>el.classList.contains('crowd'));
    const badges = await p.evaluate(()=>{
      const tf=document.querySelector('#players .pcard .turnflag');
      const me=document.querySelector('#players .pcard .me-tag');
      const tfBefore = tf?getComputedStyle(tf,'::before').content:null;
      return { crowd:document.getElementById('players').classList.contains('crowd'),
        turnflagFont:tf?getComputedStyle(tf).fontSize:null, tfBefore,
        meFont:me?getComputedStyle(me).fontSize:null };
    });
    log('B local6 crowd:', crowd, 'badges:', JSON.stringify(badges));
    await p.screenshot({ path:DIR+'/fin-lcr-B-6p-mobile.png' });
    // 완주 칩보존
    await p.check('#autoChk');
    let consOK=true, N=6;
    for(let i=0;i<220;i++){
      const st = await p.evaluate(()=>({ pot:+document.getElementById('potN').textContent, result:document.getElementById('resultOv').classList.contains('on') }));
      const cs = await cardChips(p);
      const sum = cs.reduce((a,c)=>a+c.chips,0)+st.pot;
      if(!st.result && sum!==N*3){ consOK=false; log('  !! 6p conservation break sum=',sum); }
      if(st.result){ break; }
      await sleep(150);
    }
    const winChip = await p.evaluate(()=>{ const t=document.getElementById('resSub').textContent; return t; });
    log('B local6 conservation OK:', consOK, '| resSub:', winChip);
    await ctx.close();
  }

  /* ============ PHASE C: 팟 빌드업 시각 (blaze) + 이모지 44px + 반응바 위치(데스크톱) ============ */
  {
    const ctx = await b.newContext({ viewport:{width:1000,height:900} });
    const p = await ctx.newPage(); hook(p,'visual');
    await p.goto(BASE+'/lcr.html'); await sleep(500);
    await p.click('#optCount .opt[data-n="4"]');
    await p.click('#startBtn'); await sleep(500);
    // 팟 blaze 시각 강제 (CSS 확인용)
    await p.evaluate(()=>{ const pb=document.getElementById('potBox'); pb.classList.remove('warm','hot'); pb.classList.add('blaze'); document.getElementById('potN').textContent='7'; });
    await sleep(400);
    await p.screenshot({ path:DIR+'/fin-lcr-C-pot-blaze.png' });
    // warm/hot 시각
    await p.evaluate(()=>{ const pb=document.getElementById('potBox'); pb.classList.remove('blaze'); pb.classList.add('hot'); document.getElementById('potN').textContent='5'; });
    await sleep(200); await p.screenshot({ path:DIR+'/fin-lcr-C-pot-hot.png' });
    // 반응바 열기 (데스크톱 → 아래로 펼침)
    await p.click('#reactToggle'); await sleep(400);
    const rb = await p.evaluate(()=>{
      const bar=document.getElementById('reactbar'), tog=document.getElementById('reactToggle'), dice=document.getElementById('dicerow');
      const br=bar.getBoundingClientRect(), tr=tog.getBoundingClientRect(), dr=dice.getBoundingClientRect();
      const btn=bar.querySelector('button');
      const bs=btn.getBoundingClientRect();
      return { barTop:Math.round(br.top), togTop:Math.round(tr.top), diceBottom:Math.round(dr.bottom),
        opensDown: br.top>tr.top, coversDice: br.top<dr.bottom,
        btnW:Math.round(bs.width), btnH:Math.round(bs.height) };
    });
    log('C reactbar:', JSON.stringify(rb));
    await p.screenshot({ path:DIR+'/fin-lcr-C-reactbar-desktop.png' });
    await ctx.close();
  }

  /* ============ PHASE D: seathint 접힘 ============ */
  {
    const ctx = await b.newContext({ viewport:{width:900,height:900} });
    const p = await ctx.newPage(); hook(p,'hint');
    await p.goto(BASE+'/lcr.html'); await sleep(400);
    // 힌트 플래그 제거(첫 판 상황)
    await p.evaluate(()=>{ try{localStorage.removeItem('lcr_hint_seen');}catch(e){} });
    await p.reload(); await sleep(400);
    await p.click('#startBtn'); await sleep(400);
    const first = await p.$eval('#seathint', el=>({folded:el.classList.contains('folded'), fullVisible:getComputedStyle(el.querySelector('.sh-full')).display!=='none'}));
    log('D seathint first game:', JSON.stringify(first));
    // 판 종료까지 → markHintSeen
    await p.check('#autoChk');
    for(let i=0;i<160;i++){ const r=await p.$eval('#resultOv',e=>e.classList.contains('on')).catch(()=>false); if(r)break; await sleep(150); }
    const flag = await p.evaluate(()=>{ try{return localStorage.getItem('lcr_hint_seen');}catch(e){return null;} });
    // 다시 한 판
    await p.click('#againBtn'); await sleep(500);
    const second = await p.$eval('#seathint', el=>({folded:el.classList.contains('folded'), miniVisible:getComputedStyle(el.querySelector('.sh-mini')).display!=='none'}));
    log('D hint_seen flag:', flag, '| second game seathint:', JSON.stringify(second));
    // 접힌 상태 탭 → 펼침
    await p.click('#seathint'); await sleep(200);
    const expanded = await p.$eval('#seathint', el=>el.classList.contains('folded'));
    log('D after tap folded:', expanded, '(expect false)');
    await p.screenshot({ path:DIR+'/fin-lcr-D-seathint.png' });
    await ctx.close();
  }

  /* ============ PHASE E: 자동 굴리기 동작 + 지속 ============ */
  {
    const ctx = await b.newContext({ viewport:{width:900,height:900} });
    const p = await ctx.newPage(); hook(p,'auto');
    await p.goto(BASE+'/lcr.html'); await sleep(400);
    await p.evaluate(()=>{ try{localStorage.removeItem('lcr_auto');}catch(e){} });
    await p.reload(); await sleep(300);
    await p.click('#optCount .opt[data-n="3"]');
    await p.click('#optSpeed .opt[data-s="fast"]');
    await p.click('#startBtn'); await sleep(500);
    // 자동 끄고 몇 초 대기: 내 차례에서 멈춰야 함
    const before = await p.$eval('#rollBtn', e=>e.textContent);
    await p.check('#autoChk'); await sleep(200);
    const persisted = await p.evaluate(()=>{ try{return localStorage.getItem('lcr_auto');}catch(e){return null;} });
    // autoroll이 완주까지 클릭 없이 진행하는지
    let finished=false;
    for(let i=0;i<160;i++){ const r=await p.$eval('#resultOv',e=>e.classList.contains('on')).catch(()=>false); if(r){finished=true;break;} await sleep(150); }
    log('E autoroll persisted localStorage:', persisted, '| finished without manual clicks:', finished);
    await ctx.close();
  }

  /* ============ PHASE F: 온라인 3인(호스트+AI2) — 이름 동물명 + 완주 + endGame 로비복귀 + 골목복귀 ============ */
  {
    const ctx = await b.newContext({ viewport:{width:900,height:1000} });
    const p = await ctx.newPage(); hook(p,'online');
    await p.goto(BASE+'/lcr.html'); await sleep(400);
    await p.click('#tabOnline'); await sleep(200);
    await p.fill('#onName','재성');
    await p.click('#createBtn'); await sleep(900);
    // 로비 대기 → AI 2 추가
    await p.click('#lobbyAddAi'); await sleep(500);
    await p.click('#lobbyAddAi'); await sleep(500);
    const lobbyNames = await p.$$eval('#members .member', els=>els.map(e=>({name:e.querySelector('.mnm')?.textContent, ai:!!e.querySelector('.mhost')})));
    log('F lobby members:', JSON.stringify(lobbyNames));
    await p.screenshot({ path:DIR+'/fin-lcr-F-lobby.png' });
    // 시작
    await p.click('#lobbyStart'); await sleep(800);
    const gameCards = await cardChips(p);
    log('F online game cards:', gameCards.map(c=>c.name).join(' | '));
    // 자동 굴리기로 완주
    await p.check('#autoChk');
    let over=false;
    for(let i=0;i<200;i++){ const r=await p.$eval('#resultOv',e=>e.classList.contains('on')).catch(()=>false); if(r){over=true;break;} await sleep(150); }
    const resTitle = await p.$eval('#resTitle',e=>e.textContent).catch(()=>'?');
    log('F online over:', over, '| resTitle:', resTitle);
    await p.screenshot({ path:DIR+'/fin-lcr-F-result.png' });
    // 다시하기 대신 로비복귀 테스트: rematch 제안 → 자동수락(AI) → 재시작? 여기선 endGame 경로 확인 위해 새 판 시작 후 endBtn
    // 결과창에서 '다시 하기' → rematchPropose (AI 자동수락) → state 재시작
    await p.click('#againBtn'); await sleep(1500);
    const restarted = await p.$eval('#game',e=>e.style.display==='block').catch(()=>false);
    log('F rematch restarted (game visible):', restarted);
    // 호스트 endGame → 로비 복귀
    await p.evaluate(()=>{ const b=document.getElementById('endBtn'); if(b) b.style.display='flex'; });
    // confirm 자동 수락
    p.on('dialog', d=>d.accept());
    await p.evaluate(()=>{ if(window.__lcrEnd){} });
    await p.click('#endBtn').catch(()=>{});
    await sleep(1200);
    const inLobby = await p.$eval('#lobbyOv',e=>e.classList.contains('on')).catch(()=>false);
    log('F endGame → lobby:', inLobby);
    await p.screenshot({ path:DIR+'/fin-lcr-F-lobby-return.png' });
    // 골목 복귀
    await p.click('#lobbyLeave').catch(()=>{});
    await sleep(400);
    await ctx.close();
  }

  await b.close();
  log('\n===== CONSOLE/PAGE ERRORS ('+errs.length+') =====');
  errs.slice(0,40).forEach(e=>log(e));
  process.exit(0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
