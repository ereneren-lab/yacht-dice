#!/usr/bin/env node
/* online-test.js — 온라인 멀티플레이 e2e (브라우저 불필요, 의존성은 ws만)
 *
 * 5종 전부: 방 생성 → 참가 → 로비 동기화 → 게임 시작 → 상태 수신 → 판 종료/로비 복귀
 * 윷은 추가로 실제 액션을 주고받아 판을 끝까지 진행한다.
 *
 * 사용: npm run test:online
 * 헤드리스 브라우저가 불안정한 환경에서도 서버·엔진 회귀를 잡을 수 있는 안전망이다.
 */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const PORT = Number(process.env.TEST_PORT) || 3151;
const wait = ms => new Promise(r => setTimeout(r, ms));
const ping = () => new Promise(r => {
  const q = http.get(`http://localhost:${PORT}/index.html`, x => { x.resume(); r(x.statusCode === 200); });
  q.on('error', () => r(false));
  q.setTimeout(700, () => { q.destroy(); r(false); });
});

function client() {
  const w = new WebSocket('ws://localhost:' + PORT);
  const c = { ws: w, pid: null, code: null, state: null, lobby: null, errors: [] };
  w.on('error', () => {});
  w.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'me') { c.pid = m.pid; c.code = m.code; }
    else if (m.t === 'state') c.state = m.state;
    else if (m.t === 'lobby') c.lobby = m.room;
    else if (m.t === 'error') c.errors.push(m.code);
  });
  c.send = o => { if (w.readyState === 1) w.send(JSON.stringify(o)); };
  c.open = new Promise(r => w.once('open', r));
  c.close = () => { try { w.close(); } catch (e) {} };
  return c;
}
const until = async (fn, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await wait(60); }
  return false;
};

const results = [];
const ok = (n, pass, d) => { results.push({ n, pass }); console.log(`${pass ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`); };

async function runGame(game, playFully) {
  const A = client(), B = client();
  await A.open; await B.open;
  try {
    A.send({ t: 'create', game, name: '호스트', markers: 2, goal: 2, decideOrder: false, startChips: 3 });
    if (!await until(() => A.code)) return ok(`[${game}] 방 생성`, false);

    B.send({ t: 'join', code: A.code, name: '게스트' });
    if (!await until(() => B.pid)) return ok(`[${game}] 참가`, false);
    if (!await until(() => A.lobby && A.lobby.members.length === 2)) return ok(`[${game}] 로비 동기화`, false);

    // lcr·도둑잡기는 3명부터라 AI를 하나 채운다
    if (game === 'lcr' || game === 'oldmaid') { A.send({ t: 'addAI' }); await until(() => A.lobby && A.lobby.members.length >= 3, 3000); }

    A.send({ t: 'start' });
    if (!await until(() => A.state && B.state)) return ok(`[${game}] 게임 시작·상태 수신`, false);
    ok(`[${game}] 방 생성 → 참가 → 시작 → 상태 동기화`, true, `인원 ${A.lobby.members.length}`);

    if (playFully) {
      let acts = 0, guard = 0;
      while (guard++ < 900) {
        const st = A.state;
        if (!st || st.phase === 'over') break;
        const cur = st.players && st.players[st.turn];
        if (!cur) { await wait(50); continue; }
        const me = cur.pid === A.pid ? A : cur.pid === B.pid ? B : null;
        if (!me) { await wait(50); continue; }
        if (st.phase === 'throw' || st.phase === 'order') { me.send({ t: 'action', a: { type: 'throw', power: 0.5 } }); acts++; }
        else if (st.phase === 'move') {
          const mv = (st.players[st.turn].pieces || []).find(x => !x.done);
          if (mv) { me.send({ t: 'action', a: { type: 'move', pieceId: mv.id, pendingIndex: 0 } }); acts++; }
        }
        await wait(70);
      }
      const over = A.state && A.state.phase === 'over';
      ok(`[${game}] 판 끝까지 진행`, over, `액션 ${acts}회`);
      ok(`[${game}] 두 클라 상태 일치`, !!(A.state && B.state && A.state.phase === B.state.phase));
      if (over) {
        A.send({ t: 'endGame' });
        ok(`[${game}] 판 종료 → 로비 복귀`,
          await until(() => A.lobby && A.lobby.phase === 'lobby' && B.lobby && B.lobby.phase === 'lobby', 5000));
      }
    }
    /* 숨김정보 게임은 **사람마다 다른 스냅샷**을 받아야 한다.
       둘이 똑같은 걸 받으면 그건 브로드캐스트로 새고 있다는 뜻이다. */
    if (HIDDEN_INFO[game]) {
      await wait(400);
      const chk = HIDDEN_INFO[game](A.state, B.state);
      ok(`[${game}] 숨김정보 — ${chk.what}`, chk.pass, chk.detail || '');
    }
    ok(`[${game}] 클라 에러 없음`, A.errors.length + B.errors.length === 0, [...A.errors, ...B.errors].join(','));
  } finally { A.close(); B.close(); await wait(200); }
}

/* 게임별 숨김정보 판정 — '남의 것이 내 스냅샷에 실려 오나'를 본다.
   화면에서 안 그리는 걸론 부족하다. 스냅샷에 있으면 그게 곧 누출이다. */
const HIDDEN_INFO = {
  // 인디언 포커만 방향이 반대다: 남의 카드는 보이고 **내 카드만** 안 보인다
  indianpoker: (a, b) => {
    if (!a || !b) return { pass:false, what:'스냅샷 없음' };
    const aMe = a.players.find(p => p.pid === a.players[0].pid);
    const mineHidden = a.myCard == null && b.myCard == null;
    const oppVisible = a.players.some(p => p.card != null);
    return { pass: mineHidden && oppVisible, what:'내 카드만 가려짐(남의 카드는 보임)',
             detail:`A.myCard=${a.myCard} B.myCard=${b.myCard} 남의카드보임=${oppVisible}` };
  },
  onecard: (a, b) => {
    if (!a || !b) return { pass:false, what:'스냅샷 없음' };
    const blob = JSON.stringify(a);
    const noHands = !/"hands"\s*:/.test(blob) && !/"draw"\s*:\s*\[/.test(blob);
    const different = JSON.stringify(a.myHand) !== JSON.stringify(b.myHand);
    return { pass: noHands && different, what:'남의 손패·더미 미포함 · 둘의 손패가 다름',
             detail:`hands/draw없음=${noHands} 손패다름=${different}` };
  },
  // 섯다 — 판이 끝나기 전엔 남의 패가 안 보여야 한다
  seotda: (a, b) => {
    if (!a || !b) return { pass:false, what:'스냅샷 없음' };
    const myCards = p => (p.players.find(x => x.pid === p.players[p.mySeat!=null?p.mySeat:0].pid)||{});
    const mineA = JSON.stringify(a.players.map(p => p.cards));
    const mineB = JSON.stringify(b.players.map(p => p.cards));
    // 두 사람이 받는 players[].cards가 서로 달라야 한다(각자 자기 것만 보임)
    return { pass: mineA !== mineB, what:'사람마다 보이는 패가 다름', detail:`동일=${mineA===mineB}` };
  },
  oldmaid: (a, b) => {
    if (!a || !b) return { pass:false, what:'스냅샷 없음' };
    const strip = s => JSON.stringify(Object.assign({}, s, { myHand:null, myPeek:null, myJoker:null, initialPairs:null }));
    const noJoker = !/"joker"\s*:\s*true/.test(strip(a)) && !/"joker"\s*:\s*true/.test(strip(b));
    const noOtherHand = a.players.every(p => p.seat === a.mySeat || p.hand == null);
    const different = JSON.stringify(a.myHand) !== JSON.stringify(b.myHand);
    return { pass: noJoker && noOtherHand && different, what:'조커 위치 미노출 · 남의 손패 미포함',
             detail:`조커안보임=${noJoker} 남의손패없음=${noOtherHand} 손패다름=${different}` };
  },
};

/* 재접속 시나리오 — 모바일 화면 잠금으로 소켓이 죽은 뒤 새 소켓으로 돌아오는 흐름.
   서버의 close 소유권 검사(v1.128)가 없으면 '재접속했는데 화면이 안 움직임'이 된다. */
async function runReconnect() {
  const A = client(), B = client();
  await A.open; await B.open;
  try {
    A.send({ t: 'create', game: 'yut', name: '호스트', markers: 2, goal: 2, decideOrder: false });
    if (!await until(() => A.code)) return ok('[재접속] 준비', false);
    B.send({ t: 'join', code: A.code, name: '모바일' });
    await until(() => B.pid);
    await until(() => A.lobby && A.lobby.members.length === 2);
    A.send({ t: 'start' });
    if (!await until(() => A.state && B.state)) return ok('[재접속] 게임 시작', false);

    const bPid = B.pid, code = A.code;
    for (let i = 0; i < 6; i++) {          // 몇 턴 진행해 판을 굴려둔다
      const st = A.state; if (!st || st.phase === 'over') break;
      const me = st.players[st.turn].pid === A.pid ? A : B;
      if (st.phase === 'throw') me.send({ t: 'action', a: { type: 'throw', power: 0.5 } });
      else if (st.phase === 'move') { const mv = (st.players[st.turn].pieces || []).find(x => !x.done); if (mv) me.send({ t: 'action', a: { type: 'move', pieceId: mv.id, pendingIndex: 0 } }); }
      await wait(150);
    }

    /* ⚠️ 순서가 핵심이다.
       모바일 슬립에선 TCP가 조용히 죽어 서버가 한동안 모른다. 클라가 깨어나 새 소켓으로
       rejoin한 '뒤에' 옛 소켓의 close가 뒤늦게 도착한다.
       그래서 여기서도 rejoin을 먼저 하고 그 다음에 옛 소켓을 끊어야 실제 버그가 재현된다.
       (terminate를 먼저 하면 서버가 close를 이미 처리해버려 이 회귀 테스트가 무력해진다 — 실제로 겪음) */
    const B2 = client(); await B2.open;
    B2.send({ t: 'rejoin', code, pid: bPid });
    ok('[재접속] 자리 복원', await until(() => B2.pid === bPid && B2.state));

    B.ws.terminate();                       // 💥 이제서야 옛 소켓의 close가 서버에 도착
    await wait(900);

    const before = JSON.stringify(B2.lobby || {});
    A.send({ t: 'rename', name: '호스트2' });
    ok('[재접속] 이후 브로드캐스트 수신', await until(() => JSON.stringify(B2.lobby || {}) !== before, 4000));

    let played = false;
    for (let i = 0; i < 40 && !played; i++) {
      const st = B2.state; if (!st || st.phase === 'over') break;
      const mine = st.players[st.turn].pid === bPid;
      const me = mine ? B2 : A;
      const snap = JSON.stringify(st);
      if (st.phase === 'throw') me.send({ t: 'action', a: { type: 'throw', power: 0.5 } });
      else if (st.phase === 'move') { const mv = (st.players[st.turn].pieces || []).find(x => !x.done); if (mv) me.send({ t: 'action', a: { type: 'move', pieceId: mv.id, pendingIndex: 0 } }); }
      if (mine && await until(() => JSON.stringify(B2.state) !== snap, 3000)) played = true;
      await wait(120);
    }
    ok('[재접속] 플레이 계속 가능', played);
    B2.close();
  } finally { A.close(); B.close(); await wait(200); }
}

(async () => {
  const proc = spawn('node', [path.join(__dirname, '..', 'server.js')], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, PORT } });
  let stderr = '';
  proc.stderr.on('data', d => stderr += d.toString());
  const kill = () => { try { proc.kill('SIGKILL'); } catch (e) {} };
  process.once('exit', kill);
  process.once('SIGINT', () => { kill(); process.exit(130); });

  for (let i = 0; i < 30 && !(await ping()); i++) await wait(300);
  if (!(await ping())) { console.error('서버 기동 실패'); kill(); process.exit(1); }

  for (const g of ['yut', 'yacht', 'kb', 'ld', 'lcr', 'indianpoker', 'onecard', 'oldmaid', 'seotda']) {
    await runGame(g, g === 'yut');   // 윷만 끝까지 플레이(액션 형식이 게임마다 달라서)
  }
  await runReconnect();

  const hErr = (stderr.match(/\[msg handler\]/g) || []).length;
  const crash = (stderr.match(/uncaughtException|unhandledRejection/g) || []).length;
  ok('서버 핸들러 예외 0', hErr === 0, hErr ? `${hErr}건` : '');
  ok('uncaughtException 0', crash === 0, crash ? `${crash}건` : '');

  kill();
  const failed = results.filter(r => !r.pass).length;
  console.log(failed ? `\n실패 ${failed}건` : '\n전부 통과');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('실행 실패:', e.message); process.exit(1); });
