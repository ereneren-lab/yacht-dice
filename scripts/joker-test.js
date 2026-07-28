/* 🃏 조커 규칙 토글 검증 — 요트 다이스·야찌에서 켜고 끌 수 있는지.
 *   실행: npm run test:joker   (브라우저 불필요 · 서버는 스스로 띄운다)
 *
 * 여기서 보는 것: 엔진 판정/배치제한/보너스 + 온라인 경로(방생성→로비→모드변경→엔진).
 * UI(토글이 보이고 눌리는지)는 브라우저로 따로 확인했다 — eng이 IIFE 안이라
 * CDP로는 엔진 상태를 못 읽는다(CLAUDE.md 함정 #13). 그래서 이 파일이 엔진을 직접 본다.
 */
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = Number(process.env.TEST_PORT) || 3157;
const URL = 'ws://localhost:' + PORT;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };
const up = () => new Promise(r => { const q = http.get(`http://localhost:${PORT}/index.html`, x => { x.resume(); r(x.statusCode === 200); }); q.on('error', () => r(false)); });

// 조커 규칙 토글 검증 — 엔진 직접 구동
const { GameEngine } = require('../public/game-core.js');

function mk(mode, joker){
  const e=new GameEngine({mode, joker, players:[{pid:'me',name:'나'}], turnMs:0, onState(){}, onRoll(){}});
  e.start(); return e;
}
// 주사위를 강제로 세팅하고 굴린 상태로 만든다
function setDice(e, vals){ e.dice=vals.map(v=>({value:v,held:false})); e.rolled=true; e.rollsLeft=0; }

console.log('=== 1. 기본값 — 기존 동작이 보존되는가 ===');
ok(mk('yahtzee',   undefined).joker===true,  '야찌는 기본 켜짐(정통 규칙)');
ok(mk('yacht_kr',  undefined).joker===false, '요트 다이스는 기본 꺼짐(기존과 동일)');
ok(mk('yacht_og',  undefined).joker===false, '오리지널은 기본 꺼짐');
ok(mk('yacht_og',  true).joker===false,      '오리지널은 켜달라고 해도 안 켜진다(1938 규칙엔 조커 없음)');
ok(mk('yahtzee',   false).joker===false,     '야찌도 끌 수 있다 ← 이번에 새로 가능해진 것');
ok(mk('yacht_kr',  true).joker===true,       '요트 다이스도 켤 수 있다 ← 이번에 새로 가능해진 것');

console.log('\n=== 2. 요트 다이스에서 조커가 실제로 발동하는가 (칸 id가 yacht) ===');
{
  const e=mk('yacht_kr', true);
  const p=e.players[0];
  setDice(e,[5,5,5,5,5]);
  ok(e._jokerInfo()===null, '요트 칸이 비어 있으면 조커 아님');
  p.scores.yacht=50;                       // 요트를 50점으로 채웠다
  setDice(e,[5,5,5,5,5]);
  const ji=e._jokerInfo();
  ok(ji && ji.face===5, '요트 칸 50점 뒤 55555 → 조커 발동(눈 5)');
  ok(JSON.stringify(ji.legal)===JSON.stringify(['fives']), '상단 펜타가 비었으면 거기에만 넣을 수 있다');
  p.scores.fives=25;                       // 상단도 채운다
  setDice(e,[5,5,5,5,5]);
  const ji2=e._jokerInfo();
  ok(ji2.legal.indexOf('sStraight')>=0 && ji2.legal.indexOf('aces')<0,
     '상단이 차면 하단 아무 칸(상단은 불가)');
  ok(e._scoreCat(0,'sStraight',[5,5,5,5,5])===15, '조커 스몰 스트레이트 = 요트 다이스 값 15');
  ok(e._scoreCat(0,'lStraight',[5,5,5,5,5])===30, '조커 라지 스트레이트 = 요트 다이스 값 30');
}

console.log('\n=== 3. 야찌 모드는 그대로인가 (회귀) ===');
{
  const e=mk('yahtzee', true);
  const p=e.players[0];
  p.scores.yahtzee=50; p.scores.fives=25;
  setDice(e,[5,5,5,5,5]);
  ok(e._scoreCat(0,'sStraight',[5,5,5,5,5])===30, '조커 스몰 = 야찌 값 30');
  ok(e._scoreCat(0,'lStraight',[5,5,5,5,5])===40, '조커 라지 = 야찌 값 40');
}

console.log('\n=== 4. 조커를 끄면 제한도 보너스도 사라지는가 ===');
{
  const e=mk('yahtzee', false);
  const p=e.players[0];
  p.scores.yahtzee=50;
  setDice(e,[5,5,5,5,5]);
  ok(e._jokerInfo()===null, '조커 꺼짐 → 조커 상태 없음');
  ok(e._legalCats(0,[5,5,5,5,5]).indexOf('aces')>=0, '배치 제한 없음(상단 아무 칸 가능)');
  ok(e._scoreCat(0,'sStraight',[5,5,5,5,5])===0, '스트레이트는 패턴 없으면 0점');
}

console.log('\n=== 5. 추가 보너스 +100 — 켜졌을 때만 ===');
for (const [mode,on,want] of [['yahtzee',true,100],['yahtzee',false,0],['yacht_kr',true,100],['yacht_kr',false,0]]){
  const e=mk(mode,on); const p=e.players[0];
  p.scores[mode==='yahtzee'?'yahtzee':'yacht']=50;
  if(mode==='yahtzee') p.scores.fives=25; else p.scores.fives=25;
  setDice(e,[5,5,5,5,5]);
  const cat=e._legalCats(0,[5,5,5,5,5])[0];
  e.action('me',{type:'pick',cat});
  ok((p.yBonus||0)===want, `${mode} joker=${on} → 추가 보너스 ${p.yBonus||0} (기대 ${want})`);
}

console.log('\n=== 6. serialize에 jokerOn이 실리는가 ===');
{
  const s=mk('yacht_kr',true).serialize('me');
  ok(s.jokerOn===true, 'jokerOn:true 실림');
  ok(mk('yacht_kr',false).serialize('me').jokerOn===false, 'jokerOn:false 실림');
}

console.log('\n=== 7. 완주 — 조커 on/off x 3모드, 교착 없이 끝나는가 (사람 2인 동기 구동) ===');
for (const mode of ['yacht_kr','yahtzee','yacht_og']){
  for (const on of [true,false]){
    let turns=0;
    const e=new GameEngine({mode, joker:on, turnMs:0,
      players:[{pid:'a',name:'A'},{pid:'b',name:'B'}], onState(){}, onRoll(){}});
    e.start();
    let guard=0;
    while(e.phase!=='over' && guard++<1000){
      const seat=e.current, pid=e.players[seat].pid;
      if(!e.rolled) e.action(pid,{type:'roll'});
      const legal=e._legalCats(seat,e.dice.map(x=>x.value));
      e.action(pid,{type:'pick',cat:legal[0]}); turns++;
    }
    const cats=e.rule.cats.length;
    ok(e.phase==='over' && turns===cats*2, `${mode} joker=${on} → 완주 ${turns}턴 (기대 ${cats*2})`);
    e.destroy();
  }
}

async function aiRun(mode,on){
  return await new Promise(res=>{
    const e=new GameEngine({mode, joker:on, pace:0.01, difficulty:'normal', turnMs:0,
      players:[{pid:'a',name:'A',ai:true},{pid:'b',name:'B',ai:true}],
      onState(){ if(e.phase==='over'){ e.destroy(); res(true); } }, onRoll(){}});
    e.start();
    setTimeout(()=>{ const over=e.phase==='over'; e.destroy(); res(over); }, 30000);
  });
}
async function aiSection(){
  console.log('\n=== 8. AI도 조커 상태에서 막히지 않는가 (async 실구동) ===');
  for (const mode of ['yacht_kr','yahtzee']){
    for (const on of [true,false]){
      ok(await aiRun(mode,on), `AI 2인 ${mode} joker=${on} → 완주`);
    }
  }
}

function conn(){ return new Promise(r=>{ const ws=new WebSocket(URL); ws.on('open',()=>r(ws)); }); }
function next(ws,t,ms=4000){ return new Promise((res,rej)=>{
  const to=setTimeout(()=>rej(new Error('timeout '+t)),ms);
  const h=raw=>{ const m=JSON.parse(raw); if(m.t===t){ clearTimeout(to); ws.off('message',h); res(m); } };
  ws.on('message',h); }); }

async function online(){
  // --- 1. 방 생성 시 기본값
  let ws=await conn();
  ws.send(JSON.stringify({t:'create',game:'yacht',name:'호스트'}));
  let lob=await next(ws,'lobby');
  ok(lob.room.mode==='yacht_kr', '방 생성 기본 모드 yacht_kr');
  ok(lob.room.joker===false, '요트 다이스 방 기본 조커 꺼짐');
  const code=lob.room.code;

  // --- 2. 호스트가 조커를 켠다
  ws.send(JSON.stringify({t:'setJoker',v:true}));
  lob=await next(ws,'lobby');
  ok(lob.room.joker===true, 'setJoker → 로비에 joker:true 반영');

  // --- 3. 모드를 야찌로 → 기본값(켜짐)으로 되돌아감
  ws.send(JSON.stringify({t:'setMode',mode:'yahtzee'}));
  lob=await next(ws,'lobby');
  ok(lob.room.joker===true, '야찌로 바꾸면 조커 기본 켜짐');

  // --- 4. 오리지널로 → 조커는 꺼지고, 켜달라 해도 안 켜짐
  ws.send(JSON.stringify({t:'setMode',mode:'yacht_og'}));
  lob=await next(ws,'lobby');
  ok(lob.room.joker===false, '오리지널로 바꾸면 조커 꺼짐');
  ws.send(JSON.stringify({t:'setJoker',v:true}));
  lob=await next(ws,'lobby');
  ok(lob.room.joker===false, '오리지널에선 setJoker(true)를 서버가 거부');

  // --- 5. 요트 다이스로 되돌리고 조커 켜서 실제 게임 시작 → 엔진에 반영됐나
  ws.send(JSON.stringify({t:'setMode',mode:'yacht_kr'}));
  await next(ws,'lobby');
  ws.send(JSON.stringify({t:'setJoker',v:true}));
  await next(ws,'lobby');
  ws.send(JSON.stringify({t:'addAI'}));
  await next(ws,'lobby');
  ws.send(JSON.stringify({t:'start'}));
  const st=await next(ws,'state',6000);
  ok(st.state.jokerOn===true, '게임 시작 후 스냅샷 jokerOn:true — 엔진까지 전달됨');
  ok(st.state.mode==='yacht_kr', '모드도 yacht_kr로 시작');

  // --- 6. 조커 끈 방은 jokerOn:false
  const ws2=await conn();
  ws2.send(JSON.stringify({t:'create',game:'yacht',name:'호스트2'}));
  await next(ws2,'lobby');
  ws2.send(JSON.stringify({t:'setMode',mode:'yahtzee'}));
  await next(ws2,'lobby');
  ws2.send(JSON.stringify({t:'setJoker',v:false}));
  const l2=await next(ws2,'lobby');
  ok(l2.room.joker===false, '야찌에서 조커 끄기 가능 ← 이번에 새로 가능해진 것');
  ws2.send(JSON.stringify({t:'addAI'}));
  await next(ws2,'lobby');
  ws2.send(JSON.stringify({t:'start'}));
  const st2=await next(ws2,'state',6000);
  ok(st2.state.jokerOn===false, '야찌인데 조커 꺼진 판 — 엔진 스냅샷 jokerOn:false');

  // --- 7. 비호스트는 못 바꾼다
  const ws3=await conn();
  ws3.send(JSON.stringify({t:'create',game:'yacht',name:'호스트3'}));
  const l3=await next(ws3,'lobby');
  const ws4=await conn();
  ws4.send(JSON.stringify({t:'join',code:l3.room.code,name:'게스트'}));
  await next(ws4,'lobby');
  ws4.send(JSON.stringify({t:'setJoker',v:true}));
  await new Promise(r=>setTimeout(r,400));
  ws3.send(JSON.stringify({t:'setMode',mode:'yacht_kr'}));
  const l4=await next(ws3,'lobby');
  ok(l4.room.joker===false, '비호스트의 setJoker는 무시된다');

  [ws,ws2,ws3,ws4].forEach(w=>w.close());
}

(async () => {
  const proc = spawn('node', [path.join(__dirname, '..', 'server.js')],
    { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, PORT } });
  try {
    for (let i = 0; i < 60; i++) { if (await up()) break; await new Promise(r => setTimeout(r, 250)); }
    await aiSection();
    await online();
  } finally { proc.kill(); }
  console.log(`\n${fail === 0 ? '✅ 전부 통과' : '❌ 실패 있음'} — ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
