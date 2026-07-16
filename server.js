// 요트 다이스 — 정적 서버 + server-authoritative 온라인 멀티플레이
// 실행: npm install && node server.js  →  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { WebSocketServer } = require('ws');
const { GameEngine } = require('./public/game-core.js');
const { KBEngine } = require('./public/kb-core.js');
const { LDEngine } = require('./public/ld-core.js');
const { LCREngine } = require('./public/lcr-core.js');
const { YutEngine } = require('./public/yut-core.js');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css', '.png':'image/png', '.ico':'image/x-icon', '.json':'application/json', '.webmanifest':'application/manifest+json' };
const COLORS = ['#aef359','#ff5d8f','#4ec3ff','#ffb14e','#c98bff','#5ee0a8'];
const AVA = ['🦊','🐸','🐼','🦁','🐰','🐵'];

// ---------- static ----------
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); }   // 잘못된 % 인코딩이 서버를 죽이지 않게
  catch(e){ res.writeHead(400); return res.end('Bad Request'); }
  // 방 코드 → 게임 조회 (허브의 "방 코드로 참가"가 올바른 게임으로 라우팅하도록)
  if (p === '/api/room') {
    const code = (new URLSearchParams(req.url.split('?')[1] || '').get('code') || '').toUpperCase();
    const r = rooms.get(code);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(r ? { ok:true, game:r.game, phase:r.phase } : { ok:false }));
  }
  if (p === '/') p = '/index.html';
  const fp = path.join(PUBLIC, path.normalize(p));
  if (fp !== PUBLIC && !fp.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(fp), type = TYPES[ext] || 'application/octet-stream';
    const headers = { 'Content-Type': type };
    // 불변 애셋은 길게 캐시, HTML은 매번 재검증(배포 즉시 반영)
    if (/\.(png|ico|webp|jpe?g|svg|woff2?)$/.test(ext)) headers['Cache-Control'] = 'public, max-age=604800';
    else if (ext === '.html') headers['Cache-Control'] = 'no-cache';
    else headers['Cache-Control'] = 'public, max-age=3600';
    // 텍스트류 gzip 압축(HTML/JS/JSON — 무압축 200KB+를 70~80% 절감)
    const textual = /text|javascript|json|manifest|svg/.test(type);
    const ae = req.headers['accept-encoding'] || '';
    if (textual && /\bgzip\b/.test(ae) && data.length > 1024) {
      zlib.gzip(data, (gzErr, gz) => {
        if (gzErr) { res.writeHead(200, headers); return res.end(data); }
        headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers); res.end(gz);
      });
    } else { res.writeHead(200, headers); res.end(data); }
  });
});

// ---------- rooms ----------
const wss = new WebSocketServer({ server });
const rooms = new Map(); // code -> Room
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rid = () => Math.random().toString(36).slice(2, 12);
const newCode = () => { let c; do { c = Array.from({length:4}, () => CODE_CHARS[Math.random()*CODE_CHARS.length|0]).join(''); } while (rooms.has(c)); return c; };
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function recolor(room){ room.members.forEach((m,i)=>{ m.color = COLORS[i % COLORS.length]; }); }
function hostPid(room){ const h = room.members.find(m=>!m.ai && m.connected) || room.members.find(m=>m.connected) || room.members[0]; return h ? h.pid : null; }
function broadcast(room, o){ room.members.forEach(m => send(m.ws, o)); }
function lobbyPayload(room){
  const hp = hostPid(room);
  return { t:'lobby', room:{ code:room.code, game:room.game, mode:room.mode, difficulty:room.difficulty, spotOn:room.spotOn, aiFast:!!room.aiFast, phase:room.phase, min:minPlayers(room), cap:capOf(room),
    markers:room.markers, goal:room.goal, timer:room.timer, diceCount:room.diceCount, wild:room.wild, startChips:room.startChips,
    members: room.members.map((m,i)=>({ pid:m.pid, name:m.name, color:m.color, avatar:m.avatar||AVA[i%AVA.length], ai:m.ai, connected:m.connected, waiting:!!m.waiting, host:m.pid===hp, team:m.team, spectator:!!m.spectator })), teamMode:!!room.teamMode } };
}
function sendLobby(room){ broadcast(room, lobbyPayload(room)); }

// 게임별 최소 인원. lcr은 좌/우가 서로 다른 사람이어야 성립하므로 3인부터.
const MIN_PLAYERS = { lcr: 3 };
function minPlayers(room){ return MIN_PLAYERS[room.game] || 2; }
function playableCount(room){ return room.members.filter(m=>!m.spectator).length; }
// 게임별 정원(사람+AI). yut 팀전은 4, 개인전 6. 관전은 정원 위로 SPECTATOR_SLACK명까지.
const CAP = { kb:2, ld:4, lcr:6, yut:6, yacht:8 };
const SPECTATOR_SLACK = 8;
const MAX_ROOMS = 500;
function capOf(room){ return room.game==='yut' ? (room.teamMode?4:6) : (CAP[room.game]||8); }
// 관전자 승격: 정원 여유가 있으면 관전자를 플레이어로 편입 ("다음 판부터 참여" 약속 이행)
function promoteSpectators(room){ const seats = capOf(room); let active = room.members.filter(m=>!m.spectator).length;
  for (const m of room.members){ if (m.spectator && active < seats){ m.spectator=false; active++; } } }
function clearGameTimer(room){ if(room.gameTimer){ clearTimeout(room.gameTimer); room.gameTimer=null; } }
// 방 파괴: 모든 타이머 해제 + 엔진 정리 후 rooms에서 제거
function destroyRoom(room){ clearGameTimer(room); if(room.cleanupTimer){clearTimeout(room.cleanupTimer);room.cleanupTimer=null;} if(room.rematch&&room.rematch.timer){clearTimeout(room.rematch.timer);} if(room.engine){ try{room.engine.destroy();}catch(e){} } rooms.delete(room.code); }
// 소켓이 새 방으로 이동하기 전, 이전 방 멤버십 정리(유령 멤버·좀비 방 누수 방지)
function detachFromRoom(ws){
  const code = ws.meta && ws.meta.code; const prev = code ? rooms.get(code) : null;
  if (!prev) return;
  const pid = ws.meta.pid;
  if (prev.phase === 'lobby'){ prev.members = prev.members.filter(x=>x.pid!==pid); recolor(prev); }
  else { const mm = prev.members.find(x=>x.pid===pid); if(mm){ mm.connected=false; mm.ws=null; } }
  ws.meta = { code:null, pid:null };
  if (!prev.members.some(x=>!x.ai)) { destroyRoom(prev); }        // 사람 아무도 없음 → 즉시 파괴
  else if (prev.phase === 'lobby'){ sendLobby(prev); }
  else { if(prev.engine) prev.engine.setConnected(pid, false); sendLobby(prev); scheduleCleanup(prev); }
}

function startEngine(room){
  if (room.rematch){ if(room.rematch.timer) clearTimeout(room.rematch.timer); room.rematch=null; }
  if (room.engine) room.engine.destroy();
  promoteSpectators(room);
  room.members.forEach(m=>{ m.waiting=false; });
  room.phase = 'play';
  const players = room.members.filter(m=>!m.spectator).map((m,i)=>({ pid:m.pid, name:m.name, color:m.color, avatar:m.avatar||AVA[i%AVA.length], ai:m.ai, connected:m.connected, aiDiff:room.difficulty, team:m.team }));
  if (room.game === 'kb'){
    const onState = (s)=> broadcast(room, { t:'state', state:s });
    room.engine = new KBEngine({ aiFast:!!room.aiFast, players, onState,
      onRoll: (seat, value)=> broadcast(room, { t:'kbroll', seat, value }) });
  } else if (room.game === 'ld'){
    // 숨김정보: 멤버마다 자기 시점 상태를 따로 보냄
    const onState = ()=> room.members.forEach(mm=> send(mm.ws, { t:'state', state: room.engine.serialize(mm.pid) }));
    room.engine = new LDEngine({ aiFast:!!room.aiFast, players, spotOn:room.spotOn!==false, diceCount:([3,5].includes(room.diceCount)?room.diceCount:5), wild:room.wild!==false, turnMs:45000, onState });
  } else if (room.game === 'lcr'){
    const onState = ()=> broadcast(room, { t:'state', state: room.engine.serialize() });
    room.engine = new LCREngine({ aiFast:!!room.aiFast, players, startChips:([3,4,5].includes(room.startChips)?room.startChips:3), turnMs:45000, aiMs:1400, onState });
  } else if (room.game === 'yut'){
    const onState = ()=> broadcast(room, { t:'state', state: room.engine.serialize() });
    room.engine = new YutEngine({ aiFast:!!room.aiFast, players, markers:room.markers||4, goal:(room.goal||room.markers||4), teamMode:!!room.teamMode, limitMs:(room.timer||0)*60000, turnMs:60000, aiMs:1100, onState });
  } else {
    const onState = (s)=> broadcast(room, { t:'state', state:s });
    room.engine = new GameEngine({ mode:room.mode, difficulty:room.difficulty, aiFast:!!room.aiFast, players, onState,
      onRoll: (indices, values)=> broadcast(room, { t:'roll', indices, values }) });
  }
  room.engine.start();
  if (room.gameTimer) { clearTimeout(room.gameTimer); room.gameTimer = null; }
  if (room.timer && room.timer > 0 && room.engine.timeUp) {
    room.gameTimer = setTimeout(() => { try { if (room.engine && room.engine.phase !== 'over') room.engine.timeUp(); } catch(e){} }, room.timer * 60000);
  }
}

// ---------- 재경기 투표 ----------
function rematchAskPayload(room){
  const r=room.rematch; const proposer=room.members.find(m=>m.pid===r.proposer);
  return { t:'rematchAsk', proposer: proposer?proposer.name:'?', proposerPid:r.proposer,
    voters: room.members.filter(m=>!m.ai && m.connected).map(m=>({ pid:m.pid, name:m.name, vote:r.votes[m.pid]||null })) };
}
function broadcastRematch(room){ if(room.rematch) broadcast(room, rematchAskPayload(room)); }
function checkRematchComplete(room){
  if(!room.rematch) return;
  const humans = room.members.filter(m=>!m.ai && m.connected);
  if(humans.every(m=>room.rematch.votes[m.pid])) resolveRematch(room);
}
function resolveRematch(room){
  if(!rooms.has(room.code)) return;   // 이미 파괴된 방에서 타이머가 뒤늦게 발화하는 경우 방어
  const r=room.rematch; if(!r) return;
  if(r.timer) clearTimeout(r.timer);
  const votes=r.votes;
  // 끊긴 사람(재경기 창에 잠깐 이탈)은 좌석 보존 → 재접속 가능. 접속 상태로 명시 거절한 사람만 제외.
  const accepted = room.members.filter(m => m.ai || !m.connected || votes[m.pid]==='accept');
  const removed  = room.members.filter(m => !m.ai && m.connected && votes[m.pid]!=='accept');
  room.rematch=null;
  removed.forEach(m=>{ send(m.ws, { t:'rematchKicked' }); });
  room.members = accepted;
  recolor(room);
  promoteSpectators(room);   // 재경기 시작 전 관전자 승격
  const humanCount = room.members.filter(m=>!m.ai && m.connected).length;
  if(playableCount(room)>=minPlayers(room) && humanCount>=1){
    startEngine(room);            // 수락자끼리 새 게임
  } else {
    clearGameTimer(room);
    if(room.engine){ room.engine.destroy(); room.engine=null; }
    room.phase='lobby';
    broadcast(room, { t:'rematchCancelled' });
    sendLobby(room);
  }
}

function scheduleCleanup(room){
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
  const anyHuman = room.members.some(m=>!m.ai && m.connected);
  if (!anyHuman){
    room.cleanupTimer = setTimeout(()=>{
      if (!room.members.some(m=>!m.ai && m.connected)){ destroyRoom(room); }
    }, 120000); // 2분 내 아무도 안 돌아오면 정리
  }
}

wss.on('connection', (ws) => {
  ws.meta = { code:null, pid:null };
  ws._rlStart = 0; ws._rlCount = 0;
  ws.on('error', (e)=> console.error('[ws]', e && e.message));

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch(e){ return; }
    // 소켓당 초당 메시지 상한(스팸/DoS 완화)
    const now = Date.now();
    if (now - ws._rlStart > 1000){ ws._rlStart = now; ws._rlCount = 0; }
    if (++ws._rlCount > 40) return;
    try {
    const room = rooms.get(ws.meta.code);

    if (m.t === 'create') {
      if (rooms.size >= MAX_ROOMS) return send(ws, { t:'error', code:'busy', msg:'서버가 혼잡해요. 잠시 후 다시 시도해줘.' });
      detachFromRoom(ws);   // 이전 방 정리(반복 생성 시 유령 방 누수 방지)
      const game = (m.game === 'kb') ? 'kb' : (m.game === 'ld') ? 'ld' : (m.game === 'lcr') ? 'lcr' : (m.game === 'yut') ? 'yut' : 'yacht';
      const code = newCode(), pid = rid();
      const r = { code, game, members:[{ pid, name:((m.name||'').trim()||'호스트').slice(0,12), avatar:(['pig','dog','sheep','cow','horse'].includes(m.avatar)?m.avatar:AVA[0]), ai:false, connected:true, ws, team:0 }], mode: game==='kb'?'kb':game==='ld'?'ld':game==='lcr'?'lcr':game==='yut'?'yut':'yacht_kr', difficulty:'normal', spotOn:(m.spotOn!==false), markers:([2,3,4].includes(m.markers)?m.markers:4), goal:([2,3,4].includes(m.goal)?m.goal:0), teamMode:!!m.teamMode, timer:([0,10,15].includes(m.timer)?m.timer:0), diceCount:([3,5].includes(m.diceCount)?m.diceCount:5), wild:(m.wild!==false), startChips:([3,4,5].includes(m.startChips)?m.startChips:3), aiFast:false, phase:'lobby', engine:null, cleanupTimer:null, gameTimer:null };
      recolor(r); rooms.set(code, r); ws.meta = { code, pid };
      send(ws, { t:'me', pid, code }); sendLobby(r);

    } else if (m.t === 'join') {
      const code = (m.code||'').toUpperCase(); const r = rooms.get(code);
      if (!r) return send(ws, { t:'error', code:'no-room', msg:'방을 찾을 수 없어요.' });
      const cap = capOf(r);
      if (r.members.length >= cap + SPECTATOR_SLACK) return send(ws, { t:'error', code:'full', msg:'방이 가득 찼어요 (관전 포함).' });
      if (ws.meta.code !== code) detachFromRoom(ws);   // 다른 방에 있던 소켓이면 그 방 정리
      const pid = rid();
      const spectator = r.members.length >= cap;   // 정원 초과 → 관전자
      const waiting = spectator || r.phase !== 'lobby';   // 관전자 또는 진행 중 입장
      const t0=r.members.filter(x=>x.team===0).length, t1=r.members.filter(x=>x.team===1).length; r.members.push({ pid, name:((m.name||'').trim()||'게스트').slice(0,12), avatar:(['pig','dog','sheep','cow','horse'].includes(m.avatar)?m.avatar:AVA[r.members.length%AVA.length]), ai:false, connected:true, ws, waiting, spectator, team:(t0<=t1?0:1) });
      recolor(r); ws.meta = { code, pid };
      send(ws, { t:'me', pid, code });
      if (r.engine) send(ws, { t:'state', state:r.engine.serialize(pid) });  // 관전자에게 현재 판 (라이어는 자기 시점)
      sendLobby(r);

    } else if (m.t === 'rejoin') {
      const code = (m.code||'').toUpperCase(); const r = rooms.get(code);
      if (!r) return send(ws, { t:'error', code:'no-room', msg:'방이 사라졌어요.' });
      const mem = r.members.find(x=>x.pid===m.pid);
      if (!mem) return send(ws, { t:'error', code:'no-seat', msg:'자리를 찾을 수 없어요.' });
      mem.ws = ws; mem.connected = true; ws.meta = { code, pid:m.pid };
      if (r.cleanupTimer){ clearTimeout(r.cleanupTimer); r.cleanupTimer=null; }
      send(ws, { t:'me', pid:m.pid, code });
      if (r.engine){ r.engine.setConnected(m.pid, true); send(ws, { t:'state', state:r.engine.serialize(m.pid) }); }
      sendLobby(r);

    } else if (!room) {
      return; // 이후 명령은 방이 있어야 함

    } else if (m.t === 'rename') {
      const me = room.members.find(x=>x.pid===ws.meta.pid);
      if (me){ me.name=((m.name||'').trim()||me.name).slice(0,12); if(room.engine){ const s=room.engine.players.find(p=>p.pid===me.pid); if(s){s.name=me.name; room.engine._emit&&room.engine._emit();} } sendLobby(room); }

    } else if (m.t === 'setAvatar') {
      const me = room.members.find(x=>x.pid===ws.meta.pid);
      const emo = (m.emoji||'').slice(0,4);
      if (me && emo){ me.avatar=emo; if(room.engine){ const p=room.engine.players.find(pp=>pp.pid===me.pid); if(p){ p.avatar=emo; room.engine._emit&&room.engine._emit(); } } sendLobby(room); }

    } else if (m.t === 'setMode') {
      if (ws.meta.pid===hostPid(room) && room.phase==='lobby' && ['yacht_kr','yahtzee','yacht_og'].includes(m.mode)){ room.mode=m.mode; sendLobby(room); }

    } else if (m.t === 'setDiff') {
      if (ws.meta.pid===hostPid(room) && ['easy','normal','hard'].includes(m.d)){ room.difficulty=m.d; sendLobby(room); }

    } else if (m.t === 'setSpot') {
      if (ws.meta.pid===hostPid(room) && room.phase==='lobby'){ room.spotOn=!!m.v; sendLobby(room); }
    } else if (m.t === 'setTeam') {
      if (room.phase==='lobby' && room.teamMode && (m.team===0||m.team===1)){ const me=room.members.find(x=>x.pid===ws.meta.pid); if(me){ me.team=m.team; sendLobby(room); } }

    } else if (m.t === 'setFast') {
      if (ws.meta.pid===hostPid(room)){ room.aiFast=!!m.v; sendLobby(room); }

    } else if (m.t === 'addAI') {
      const cap = capOf(room);
      if (ws.meta.pid===hostPid(room) && room.phase==='lobby' && room.members.length<cap){
        const n=room.members.filter(x=>x.ai).length+1;
        const at0=room.members.filter(x=>x.team===0).length, at1=room.members.filter(x=>x.team===1).length; room.members.push({ pid:'ai_'+rid(), name:'AI '+n, avatar:AVA[room.members.length%AVA.length], ai:true, connected:true, ws:null, team:(at0<=at1?0:1) });
        recolor(room); sendLobby(room);
      }

    } else if (m.t === 'removeAI') {
      if (ws.meta.pid===hostPid(room) && room.phase==='lobby'){
        const idx=room.members.findIndex(x=>x.ai && x.pid===m.pid);
        if (idx>=0){ room.members.splice(idx,1); recolor(room); sendLobby(room); }
      }

    } else if (m.t === 'start') {
      if (ws.meta.pid===hostPid(room)) promoteSpectators(room);   // 시작 전 관전자 승격(정원 여유 시)
      if (ws.meta.pid===hostPid(room) && playableCount(room)>=minPlayers(room)){ startEngine(room); }
      else if (ws.meta.pid===hostPid(room)){ sendLobby(room); send(ws, { t:'error', msg:`${minPlayers(room)}명부터 시작할 수 있어요` }); }

    } else if (m.t === 'rematchPropose') {
      // 누구나 제안 가능. 게임이 존재하고(로비가 아니고) 진행중 투표가 없을 때만
      if (room && room.engine && !room.rematch) {
        room.rematch = { proposer: ws.meta.pid, votes: {} };
        room.rematch.votes[ws.meta.pid] = 'accept';                                   // 제안자 자동 수락
        room.members.forEach(mm=>{ if(mm.ai) room.rematch.votes[mm.pid]='accept'; });  // AI 자동 수락
        broadcastRematch(room);
        room.rematch.timer = setTimeout(()=>resolveRematch(room), 30000);              // 30초 무응답 → 처리(=제외)
        checkRematchComplete(room);
      }

    } else if (m.t === 'rematchVote') {
      if (room && room.rematch && !room.rematch.votes[ws.meta.pid]) {
        room.rematch.votes[ws.meta.pid] = (m.v==='accept') ? 'accept' : 'decline';
        broadcastRematch(room);
        checkRematchComplete(room);
      }

    } else if (m.t === 'rematchCancel') {
      // 제안자 또는 방장이 재경기 제안을 취소 → 모두 로비/결과로 복귀
      if (room && room.rematch && (ws.meta.pid===room.rematch.proposer || ws.meta.pid===hostPid(room))) {
        if (room.rematch.timer) clearTimeout(room.rematch.timer);
        room.rematch = null;
        broadcast(room, { t:'rematchCancelled' });
        sendLobby(room);
      }

    } else if (m.t === 'action') {
      if (room.engine && m.a && typeof m.a === 'object' && typeof m.a.type === 'string') room.engine.action(ws.meta.pid, m.a);

    } else if (m.t === 'reaction') {
      const emo = (m.emoji || '').slice(0, 12);
      if (emo) broadcast(room, { t: 'reaction', pid: ws.meta.pid, emoji: emo });

    } else if (m.t === 'chat') {
      const txt = (m.text || '').slice(0, 200).trim();
      if (txt) {
        const mem = room.members.find(x=>x.pid===ws.meta.pid);
        broadcast(room, { t: 'chat', pid: ws.meta.pid, name: mem ? mem.name : '?', text: txt });
      }

    } else if (m.t === 'skip') {
      if (ws.meta.pid === hostPid(room) && room.engine) room.engine.skipNow();

    } else if (m.t === 'endGame') {
      // 호스트는 언제든 판을 끝내 로비로. 그 외 참가자는 '이미 끝난 판'일 때만 허용
      // (진행 중인 게임을 게스트가 중단시키는 건 막고, 승부가 난 뒤 로비 복귀는 누구나 가능).
      const isHost = ws.meta.pid === hostPid(room);
      const gameOver = !room.engine || room.engine.phase === 'over';
      if (isHost || gameOver) {
        clearGameTimer(room);
        if (room.engine) { room.engine.destroy(); room.engine = null; }
        room.phase = 'lobby';
        sendLobby(room);
      }
    }
    } catch(err){ console.error('[msg handler]', err && err.stack || err); }
  });

  ws.on('close', () => {
    const r = rooms.get(ws.meta.code); if (!r) return;
    const mem = r.members.find(x=>x.pid===ws.meta.pid); if (!mem) return;
    mem.connected = false; mem.ws = null;
    if (r.phase === 'lobby'){
      r.members = r.members.filter(x=>x.pid!==ws.meta.pid);
      recolor(r);
      if (!r.members.some(x=>!x.ai)){ destroyRoom(r); return; }   // 사람 0명(AI만 남아도) → 방 파괴
      sendLobby(r);
    } else {
      if (r.engine) r.engine.setConnected(ws.meta.pid, false);
      if (r.rematch) checkRematchComplete(r);   // 투표 중 이탈 시 남은 사람만으로 완료 판정
      sendLobby(r);
      scheduleCleanup(r);
    }
  });
});

// 마지막 방어선: 예외가 프로세스를 죽이지 않게 로깅만 하고 계속 살아있게
process.on('uncaughtException', (e)=> console.error('[uncaughtException]', e && e.stack || e));
process.on('unhandledRejection', (e)=> console.error('[unhandledRejection]', e && e.stack || e));
server.on('clientError', (err, socket)=>{ try{ socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); }catch(e){} });
wss.on('error', (e)=> console.error('[wss]', e && e.message));

server.listen(PORT, () => console.log('요트 다이스 → http://localhost:' + PORT));
