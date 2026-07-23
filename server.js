// 요트 다이스 — 정적 서버 + server-authoritative 온라인 멀티플레이
// 실행: npm install && node server.js  →  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { GameEngine } = require('./public/game-core.js');
const { KBEngine } = require('./public/kb-core.js');
const { LDEngine } = require('./public/ld-core.js');
const { LCREngine } = require('./public/lcr-core.js');
const { YutEngine } = require('./public/yut-core.js');
const { AlkkagiEngine } = require('./public/alkkagi-core.js');

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
  serveFile(fp, req, res);
});

/* 정적 파일 캐시: 요청마다 디스크를 읽고 gzip을 다시 돌리면
   276KB짜리 yut.html 하나에도 Render 무료 티어 CPU가 눈에 띄게 소모된다.
   mtime+size가 그대로면 원본과 gzip 결과를 재사용한다. */
const fileCache = new Map();   // fp -> { mtimeMs, size, data, gz, etag, type }
function serveFile(fp, req, res) {
  fs.stat(fp, (statErr, st) => {
    if (statErr || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const hit = fileCache.get(fp);
    if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return sendCached(hit, req, res);
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      const ext = path.extname(fp), type = TYPES[ext] || 'application/octet-stream';
      const etag = '"' + crypto.createHash('sha1').update(data).digest('base64').slice(0, 22) + '"';
      const entry = { mtimeMs: st.mtimeMs, size: st.size, data, gz: null, etag, type, ext };
      const textual = /text|javascript|json|manifest|svg/.test(type);
      if (textual && data.length > 1024) {
        zlib.gzip(data, (gzErr, gz) => { if (!gzErr) entry.gz = gz; fileCache.set(fp, entry); sendCached(entry, req, res); });
      } else { fileCache.set(fp, entry); sendCached(entry, req, res); }
    });
  });
}
function sendCached(e, req, res) {
  const headers = { 'Content-Type': e.type, 'ETag': e.etag };
  // 불변 애셋은 길게 캐시, HTML은 매번 재검증(배포 즉시 반영)
  if (/\.(png|ico|webp|jpe?g|svg|woff2?)$/.test(e.ext)) headers['Cache-Control'] = 'public, max-age=604800';
  else if (e.ext === '.html') headers['Cache-Control'] = 'no-cache';
  else headers['Cache-Control'] = 'public, max-age=3600';
  // ETag가 맞으면 본문 없이 304 — no-cache(매번 재검증)라도 재전송을 막는다.
  // 기존엔 검증자가 없어 변경이 없어도 매번 전체(gzip 후 79KB)를 다시 보냈다.
  if ((req.headers['if-none-match'] || '').split(/,\s*/).includes(e.etag)) {
    res.writeHead(304, headers); return res.end();
  }
  const ae = req.headers['accept-encoding'] || '';
  if (e.gz && /\bgzip\b/.test(ae)) {
    headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding';
    res.writeHead(200, headers); return res.end(e.gz);
  }
  res.writeHead(200, headers); res.end(e.data);
}

// ---------- rooms ----------
// maxPayload: ws 기본값이 100MiB라 거대 프레임 한 방으로 메모리를 밀어넣을 수 있다.
// 이 게임의 메시지는 수 KB를 넘지 않으므로 64KB로 조인다.
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
const rooms = new Map(); // code -> Room
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// pid는 '자리 소유권'을 증명하는 값이다(rejoin이 code+pid만 맞으면 좌석을 넘겨준다).
// Math.random은 예측 가능하므로 암호학적 난수를 쓴다.
const rid = () => crypto.randomBytes(9).toString('base64url');
const newCode = () => {
  let c;
  do {
    const b = crypto.randomBytes(4);
    c = Array.from(b, x => CODE_CHARS[x % CODE_CHARS.length]).join('');
  } while (rooms.has(c));
  return c;
};
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function recolor(room){ room.members.forEach((m,i)=>{ m.color = COLORS[i % COLORS.length]; }); }
function hostPid(room){ const h = room.members.find(m=>!m.ai && m.connected) || room.members.find(m=>m.connected) || room.members[0]; return h ? h.pid : null; }
function broadcast(room, o){ room.members.forEach(m => send(m.ws, o)); }
function lobbyPayload(room){
  const hp = hostPid(room);
  return { t:'lobby', room:{ code:room.code, game:room.game, mode:room.mode, difficulty:room.difficulty, spotOn:room.spotOn, aiFast:!!room.aiFast, phase:room.phase, min:minPlayers(room), cap:capOf(room),
    markers:room.markers, goal:room.goal, timer:room.timer, diceCount:room.diceCount, wild:room.wild, startChips:room.startChips, preset:room.preset, surface:room.surface, decideOrder:room.decideOrder!==false, itemBattle:!!room.itemBattle, speedStart:!!room.speedStart, pit:room.pit!==false, eventTypes:room.eventTypes, dailyOn:room.dailyOn!==false,
    members: room.members.map((m,i)=>({ pid:m.pid, name:m.name, color:m.color, avatar:m.avatar||AVA[i%AVA.length], ai:m.ai, connected:m.connected, waiting:!!m.waiting, host:m.pid===hp, team:m.team, spectator:!!m.spectator })), teamMode:!!room.teamMode } };
}
function sendLobby(room){ broadcast(room, lobbyPayload(room)); }

// 게임별 최소 인원. lcr은 좌/우가 서로 다른 사람이어야 성립하므로 3인부터.
const MIN_PLAYERS = { lcr: 3 };
function minPlayers(room){ return MIN_PLAYERS[room.game] || 2; }
function playableCount(room){ return room.members.filter(m=>!m.spectator).length; }
// 게임별 정원(사람+AI). yut 팀전은 4, 개인전 6. 관전은 정원 위로 SPECTATOR_SLACK명까지.
const CAP = { kb:2, ld:4, lcr:6, yut:6, yacht:8, alkkagi:2 };
const SPECTATOR_SLACK = 8;
const MAX_ROOMS = 500;
function capOf(room){ return room.game==='yut' ? (room.teamMode?4:6) : (CAP[room.game]||8); }
// 관전자 승격: 정원 여유가 있으면 관전자를 플레이어로 편입 ("다음 판부터 참여" 약속 이행)
function promoteSpectators(room){ const seats = capOf(room); let active = room.members.filter(m=>!m.spectator).length;
  for (const m of room.members){ if (m.spectator && active < seats){ m.spectator=false; active++; } } }
function clearGameTimer(room){ if(room.gameTimer){ clearTimeout(room.gameTimer); room.gameTimer=null; } }
// 방 파괴: 모든 타이머 해제 + 엔진 정리 후 rooms에서 제거
function destroyRoom(room){
  clearGameTimer(room);
  if(room.cleanupTimer){clearTimeout(room.cleanupTimer);room.cleanupTimer=null;}
  if(room.rematch&&room.rematch.timer){clearTimeout(room.rematch.timer);}
  if(room.engine){ try{room.engine.destroy();}catch(e){} }
  // 남은 소켓의 meta를 비운다. 안 그러면 죽은 code를 들고 있다가 이후 모든 명령이
  // 조용히 무시돼(클라는 아무 피드백 없이 먹통) 원인을 알 수 없다.
  room.members.forEach(m=>{ if(m.ws && m.ws.meta && m.ws.meta.code===room.code){ m.ws.meta = { code:null, pid:null }; } });
  rooms.delete(room.code);
}
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
    room.engine = new YutEngine({ aiFast:!!room.aiFast, players, markers:room.markers||4, goal:(room.goal||room.markers||4), teamMode:!!room.teamMode, decideOrder:room.decideOrder!==false, itemBattle:!!room.itemBattle, speedStart:!!room.speedStart, pit:room.pit!==false, eventTypes:room.eventTypes||undefined, dailyRule:(room.dailyOn===false?false:undefined), limitMs:(room.timer||0)*60000, turnMs:60000, aiMs:1100, onState });
  } else if (room.game === 'alkkagi'){
    const onState = ()=> broadcast(room, { t:'state', state: room.engine.serialize() });
    room.engine = new AlkkagiEngine({ aiFast:!!room.aiFast, players, preset:(['mini','standard','battle'].includes(room.preset)?room.preset:'standard'), surface:room.surface, aiMs:900, onState });
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
  ws.isAlive = true;
  ws.on('pong', ()=>{ ws.isAlive = true; });
  ws.on('error', (e)=> console.error('[ws]', e && e.message));

  ws.on('message', (raw) => {
    // 레이트리밋을 JSON.parse보다 '먼저' 본다. 뒤에 두면 상한에 걸리기 전에 파싱 비용을 다 치른다.
    const now = Date.now();
    if (now - ws._rlStart > 1000){ ws._rlStart = now; ws._rlCount = 0; }
    if (++ws._rlCount > 40) return;
    // JSON.parse('null')·'[]'·'42'는 예외 없이 통과하므로 객체인지 확인해야 한다.
    let m; try { m = JSON.parse(raw); } catch(e){ return; }
    if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.t !== 'string') return;
    // 문자열로 와야 하는 필드가 숫자/객체로 오면 .toUpperCase 등에서 터진다 → 여기서 정규화
    if (m.code != null) m.code = String(m.code);
    if (m.pid != null) m.pid = String(m.pid);
    if (m.name != null) m.name = String(m.name);
    try {
    const room = rooms.get(ws.meta.code);
    if (room) room.lastActivity = now;          // 유휴 방 정리(idleSweep) 판정용

    if (m.t === 'create') {
      if (rooms.size >= MAX_ROOMS) return send(ws, { t:'error', code:'busy', msg:'서버가 혼잡해요. 잠시 후 다시 시도해줘.' });
      detachFromRoom(ws);   // 이전 방 정리(반복 생성 시 유령 방 누수 방지)
      const game = (m.game === 'kb') ? 'kb' : (m.game === 'ld') ? 'ld' : (m.game === 'lcr') ? 'lcr' : (m.game === 'yut') ? 'yut' : (m.game === 'alkkagi') ? 'alkkagi' : 'yacht';
      const code = newCode(), pid = rid();
      const r = { code, game, members:[{ pid, name:((m.name||'').trim()||'호스트').slice(0,12), avatar:(['pig','dog','sheep','cow','horse'].includes(m.avatar)?m.avatar:AVA[0]), ai:false, connected:true, ws, team:0 }], mode: game==='kb'?'kb':game==='ld'?'ld':game==='lcr'?'lcr':game==='yut'?'yut':game==='alkkagi'?'alkkagi':'yacht_kr', difficulty:'normal', spotOn:(m.spotOn!==false), markers:([2,3,4].includes(m.markers)?m.markers:4), goal:([2,3,4].includes(m.goal)?m.goal:0), teamMode:!!m.teamMode, timer:([0,10,15].includes(m.timer)?m.timer:0), decideOrder:(m.decideOrder!==false), itemBattle:!!m.itemBattle, speedStart:!!m.speedStart,
        dailyOn:(m.dailyOn!==false), pit:(m.pit!==false), eventTypes:(Array.isArray(m.eventTypes)?m.eventTypes.filter(t=>['boost','bonus','back','gold'].includes(t)).slice(0,4):null), diceCount:([3,5].includes(m.diceCount)?m.diceCount:5), wild:(m.wild!==false), startChips:([3,4,5].includes(m.startChips)?m.startChips:3), preset:(['mini','standard','battle'].includes(m.preset)?m.preset:'standard'), surface:(['board','ice','grass'].includes(m.surface)?m.surface:'board'), aiFast:false, phase:'lobby', engine:null, cleanupTimer:null, gameTimer:null };
      r.lastActivity = Date.now();
      recolor(r); rooms.set(code, r); ws.meta = { code, pid };
      send(ws, { t:'me', pid, code }); sendLobby(r);

    } else if (m.t === 'join') {
      const code = (m.code||'').toUpperCase(); const r = rooms.get(code);
      if (!r) return send(ws, { t:'error', code:'no-room', msg:'방을 찾을 수 없어요.' });
      const cap = capOf(r);
      if (r.members.length >= cap + SPECTATOR_SLACK) return send(ws, { t:'error', code:'full', msg:'방이 가득 찼어요 (관전 포함).' });
      // 같은 방이라도 반드시 정리한다. 건너뛰면 참가 버튼 더블클릭 시 소켓 하나가 멤버 두 개를 점유하고,
      // ws.meta.pid가 새 pid로 덮여 옛 멤버가 connected:true인 유령으로 영구히 남는다(정원 계산·방장 선정 오염).
      detachFromRoom(ws);
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
      // 옛 소켓이 아직 살아 있으면 명시적으로 닫는다(중복 연결 방지).
      // close 핸들러의 소유권 검사 덕에 이 close가 새 소켓을 끊지는 않는다.
      if (mem.ws && mem.ws !== ws) { try { mem.ws.close(); } catch(e){} }
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

    } else if (m.t === 'closeRoom') {
      // 방 파하기 — 호스트만. 모두에게 알린 뒤 방을 없앤다(재접속용 자리도 사라진다).
      // destroyRoom이 소켓 meta까지 비우므로, 알림은 반드시 파괴 '전에' 보내야 한다.
      if (ws.meta.pid === hostPid(room)) {
        broadcast(room, { t: 'roomClosed' });
        destroyRoom(room);
      }

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
    // ⚠️ 이 close가 '현재 연결된 소켓'의 것인지 확인한다.
    // 모바일 슬립으로 죽은 소켓 A의 close가 뒤늦게 오는 사이 소켓 B로 이미 rejoin했다면,
    // 이 검사가 없으면 정상 접속된 B를 connected=false로 끊어버려 화면이 멈춘다.
    if (mem.ws && mem.ws !== ws) return;
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

/* ---------- 하트비트 ----------
   ⚠️ 이게 없으면 서버가 서서히 죽는다.
   모바일 화면 잠금이나 NAT 타임아웃으로 TCP가 조용히 끊기면 'close' 이벤트가 영영 오지 않는다.
   그러면 mem.connected가 true로 고정 → scheduleCleanup의 '사람 0명' 조건이 영원히 거짓 →
   방이 rooms에서 절대 제거되지 않는다. MAX_ROOMS(500)를 채우면 이후 모든 방 생성이
   'busy'로 영구 실패하고, 재시작해야만 복구된다.
   30초마다 ping을 보내고 응답 없는 소켓을 terminate해서 close 경로를 정상적으로 태운다. */
/* 유휴 방 정리: scheduleCleanup은 '사람이 0명'일 때만 동작한다.
   호스트가 로비를 열어두고 자리를 뜨면(소켓은 살아 있음) 방이 무한정 남는다.
   마지막 메시지로부터 IDLE_MS 넘게 아무 활동이 없으면 정리한다. */
const IDLE_MS = Number(process.env.IDLE_MS) || 45 * 60 * 1000;
const idleSweep = setInterval(() => {
  const now = Date.now();
  for (const room of Array.from(rooms.values())) {
    const last = room.lastActivity || 0;
    if (last && now - last > IDLE_MS) {
      broadcast(room, { t:'error', code:'idle', msg:'오래 움직임이 없어 방을 정리했어요.' });
      destroyRoom(room);
    }
  }
}, 5 * 60 * 1000);
idleSweep.unref?.();

const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS) || 30000;   // 테스트에서 짧게 덮어쓸 수 있게
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { try { ws.terminate(); } catch(e){} return; }
    ws.isAlive = false;
    try { ws.ping(); } catch(e){ try { ws.terminate(); } catch(e2){} }
  });
}, HEARTBEAT_MS);
heartbeat.unref?.();
wss.on('close', ()=> clearInterval(heartbeat));

// 마지막 방어선: 예외가 프로세스를 죽이지 않게 로깅만 하고 계속 살아있게
process.on('uncaughtException', (e)=> console.error('[uncaughtException]', e && e.stack || e));
process.on('unhandledRejection', (e)=> console.error('[unhandledRejection]', e && e.stack || e));
server.on('clientError', (err, socket)=>{ try{ socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); }catch(e){} });
wss.on('error', (e)=> console.error('[wss]', e && e.message));

server.listen(PORT, () => console.log('요트 다이스 → http://localhost:' + PORT));
