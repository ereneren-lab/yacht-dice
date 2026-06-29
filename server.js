// 요트 다이스 — 정적 파일 + 온라인 멀티플레이(WebSocket 릴레이) 서버
// 실행: npm install && node server.js  →  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.ico':'image/x-icon' };

// ---- static server ----
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---- websocket relay ----
const wss = new WebSocketServer({ server });
const rooms = new Map(); // code -> { members: [ {id,name,host,ws} ] }
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rid = () => Math.random().toString(36).slice(2, 10);
const newCode = () => { let c; do { c = Array.from({length:4}, () => CODE_CHARS[Math.random()*CODE_CHARS.length|0]).join(''); } while (rooms.has(c)); return c; };

function memberList(room){ return room.members.map(m => ({ id:m.id, name:m.name, host:m.host })); }
function broadcastMembers(code){ const room = rooms.get(code); if(!room) return;
  const msg = JSON.stringify({ t:'members', members: memberList(room) });
  room.members.forEach(m => { if(m.ws.readyState===1) m.ws.send(msg); });
}
function send(ws, obj){ if(ws.readyState===1) ws.send(JSON.stringify(obj)); }

wss.on('connection', (ws) => {
  ws.meta = { code:null, id:null };

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch(e) { return; }

    if (m.t === 'create') {
      const code = newCode(), id = rid();
      rooms.set(code, { members: [{ id, name:(m.name||'호스트').slice(0,12), host:true, ws }] });
      ws.meta = { code, id };
      send(ws, { t:'created', id, code });
      broadcastMembers(code);

    } else if (m.t === 'join') {
      const code = (m.code||'').toUpperCase();
      const room = rooms.get(code);
      if (!room) return send(ws, { t:'error', msg:'방을 찾을 수 없어요.' });
      if (room.members.length >= 6) return send(ws, { t:'error', msg:'방이 가득 찼어요. (최대 6명)' });
      const id = rid();
      room.members.push({ id, name:(m.name||'게스트').slice(0,12), host:false, ws });
      ws.meta = { code, id };
      send(ws, { t:'joined', id, code });
      broadcastMembers(code);

    } else if (m.t === 'msg') {
      const room = rooms.get(m.code);
      if (!room) return;
      const out = JSON.stringify({ t:'msg', from: ws.meta.id, payload: m.payload });
      room.members.forEach(mem => { if (mem.ws !== ws && mem.ws.readyState===1) mem.ws.send(out); });
    }
  });

  ws.on('close', () => {
    const { code, id } = ws.meta;
    const room = rooms.get(code);
    if (!room) return;
    const wasHost = room.members.find(m => m.id===id)?.host;
    room.members = room.members.filter(m => m.id !== id);
    if (room.members.length === 0) { rooms.delete(code); return; }
    if (wasHost) room.members[0].host = true; // promote next member
    broadcastMembers(code);
  });
});

server.listen(PORT, () => console.log(`요트 다이스 → http://localhost:${PORT}`));
