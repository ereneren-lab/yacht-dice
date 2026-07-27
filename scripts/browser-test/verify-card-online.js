/**
 * 카드 3종 온라인 2탭 e2e — 탭 2개 = 사람 2명.
 * 방 생성 → 참가 → 대기실 → 시작 → 숨김정보 → 판 종료 후 로비 복귀(함정 #3)까지.
 *
 * 공용 모듈 net.js를 쓰는 3종이 대상이다. 기존 6종은 verify-online.js가 본다.
 * 함정 #18: 페이지 변수는 typeof로 맨 이름 참조 — window.S는 undefined다(최상위 let).
 *
 * 사용: node server.js 띄운 뒤  npm run test:cardonline
 */
const { launchWithRetry } = require('./cdp');
const CLOSE=`try{ if(window.TUT) TUT.close(); var c=document.querySelector('#rulesClose'); if(c&&c.offsetParent)c.click(); }catch(e){} return true;`;
let bad=0;
const ok=(m,c,d)=>{ if(!c)bad++; console.log((c?'   ✅ ':'   ❌ ')+m+(d?' — '+d:'')); };

async function run(game, opts){
  console.log('\n=== '+opts.label+' ===');
  const cdp=await launchWithRetry();
  const A=await cdp.newPage(430,900), B=await cdp.newPage(430,900);
  try{
    for(const p of [A,B]){ await p.goto('http://localhost:3000/'+game+'.html'); await p.wait(700); await p.eval(CLOSE); }
    await A.eval(`document.getElementById('ntName').value='호스트'; return true;`);
    await A.click('#onlineBtn'); await A.wait(300);
    await A.click('#ntCreate'); await A.wait(2500);
    const code=await A.eval(`return (typeof NET!=='undefined'&&NET.code)||null;`);
    ok('방 생성', !!code, '코드 '+code);
    if(!code) throw new Error('방 코드 없음');
    await B.eval(`document.getElementById('ntName').value='게스트'; return true;`);
    await B.click('#onlineBtn'); await B.wait(300);
    await B.eval(`document.getElementById('ntCode').value=${JSON.stringify(code)}; return true;`);
    await B.click('#ntJoin'); await B.wait(2000);
    const lob=await A.eval(`return NET.lobby?NET.lobby.members.length:0;`);
    ok('참가 → 로비 동기화', lob===2, '인원 '+lob);
    ok('게스트 대기실 표시', await B.eval(`return document.getElementById('ntLobbyOv').classList.contains('on');`));
    if(opts.addAI){ await A.click('#ntAddAi'); await A.wait(1200); }
    await A.click('#ntStart'); await A.wait(2500);
    const st=await A.eval(`return { phase:(typeof S!=='undefined'&&S)?S.phase:'?', ingameCls:document.body.classList.contains('ingame') };`);
    const st2=await B.eval(`return { phase:(typeof S!=='undefined'&&S)?S.phase:'?' };`);
    ok('게임 시작 — 양쪽 상태 수신', st.phase===opts.phase&&st2.phase===opts.phase, `phase ${st.phase}/${st2.phase}`);
    ok('인게임 화면 전환', st.ingameCls);
    const leak=await opts.hidden(A,B);
    ok('숨김정보 — '+leak.what, leak.pass, leak.detail||'');
    await A.eval(`NET.endGame(); return true;`); await A.wait(2000);
    const sel=opts.setupSel||'#setupOv';
    const back=await A.eval(`var e=document.querySelector(${JSON.stringify('#setupOv')}), f=document.querySelector(${JSON.stringify('#setup')});
      var shown = e ? e.classList.contains('on') : (f ? getComputedStyle(f).display!=='none' : false);
      return { setup:shown, inGame:NET.inGame(), ingameCls:document.body.classList.contains('ingame') };`);
    ok('판 종료 → 셋업 복귀 (함정 #3)', back.setup && !back.inGame && !back.ingameCls, JSON.stringify(back));
    for(const [n,p] of [['A',A],['B',B]]){
      const e=p.errors.filter(x=>!/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(x));
      ok(n+' 콘솔 에러 없음', e.length===0, e[0]||'');
    }
  }catch(e){ bad++; console.log('   ❌ 예외: '+e.message.slice(0,160)); }
  await A.close(); await B.close(); await cdp.close();
}

(async()=>{
  await run('onecard', { label:'원카드 온라인', phase:'play',
    hidden: async(A,B)=>{
      const a=await A.eval(`return JSON.stringify(S.myHand.map(c=>c.id));`);
      const b=await B.eval(`return JSON.stringify(S.myHand.map(c=>c.id));`);
      return { pass:a!==b, what:'두 사람 손패가 다름' };
    }});
  await run('oldmaid', { label:'도둑잡기 온라인', phase:'play', addAI:true,
    hidden: async(A,B)=>{
      const a=await A.eval(`return JSON.stringify(S.myHand.map(c=>c.id));`);
      const b=await B.eval(`return JSON.stringify(S.myHand.map(c=>c.id));`);
      const j=await A.eval(`var s=Object.assign({},S,{myHand:null,myPeek:null,myJoker:null,initialPairs:null}); return /"joker":true/.test(JSON.stringify(s));`);
      return { pass:a!==b && !j, what:'손패 다름 · 조커 위치 미노출', detail:`조커노출=${j}` };
    }});
  // 인디언만 방향이 반대다 — 내 카드는 안 보이고 남의 카드는 보인다
  await run('indianpoker', { label:'인디언 포커 온라인', phase:'bet',
    hidden: async(A,B)=>{
      const a=await A.eval(`return { mine:S.myCard, opp:S.players.filter(p=>p.pid!==NET.pid).map(p=>p.card) };`);
      const b=await B.eval(`return { mine:S.myCard, opp:S.players.filter(p=>p.pid!==NET.pid).map(p=>p.card) };`);
      return { pass:a.mine===null&&b.mine===null&&a.opp.some(c=>c!=null),
               what:'내 카드만 가려짐(남의 카드는 보임)', detail:`A.myCard=${a.mine} 남의카드=${JSON.stringify(a.opp)}` };
    }});
  // 섯다 — 셋업 컨테이너가 #setup(오버레이가 아니라 카드)이라 복귀 판정이 다르다
  await run('seotda', { label:'섯다 온라인', phase:'bet', setupSel:'#setup',
    hidden: async(A,B)=>{
      const a=await A.eval(`return JSON.stringify(S.players.map(p=>p.cards));`);
      const b=await B.eval(`return JSON.stringify(S.players.map(p=>p.cards));`);
      return { pass:a!==b, what:'사람마다 보이는 패가 다름' };
    }});
  console.log(bad ? `\n❌ 실패 ${bad}건` : '\n✅ 온라인 카드 4종 전부 통과');
  process.exit(bad?1:0);
})();
