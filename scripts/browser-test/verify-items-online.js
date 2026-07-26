/**
 * 온라인 아이템 옵션 검증 (raw ws, 브라우저 없이)
 *  ① 기본은 꺼짐 — 비호스트가 켜려 해도 무시 ② 호스트가 켜면 전원에게 동기화
 *  ③ 꺼진 방에서 reroll 액션은 엔진이 무시 ④ 켠 방에서는 먹는다
 */
const WebSocket = require('ws');
const URL = 'ws://localhost:3000';
const wait = ms => new Promise(r => setTimeout(r, ms));
function conn() {
  const ws = new WebSocket(URL); ws.msgs = [];
  ws.on('message', d => { try { ws.msgs.push(JSON.parse(d)); } catch (e) {} });
  return new Promise(r => ws.on('open', () => r(ws)));
}
const last = (ws, t) => [...ws.msgs].reverse().find(m => m.t === t);
const send = (ws, o) => ws.send(JSON.stringify(o));

(async () => {
  let bad = 0; const fail = m => { bad++; console.log('❌ ' + m); };
  // 방 만들기(너클본즈 2인)
  const a = await conn(), b = await conn();
  send(a, { t: 'create', game: 'kb', name: '호스트' });
  await wait(300);
  const code = last(a, 'lobby').room.code;
  send(b, { t: 'join', code, name: '손님' });
  await wait(300);

  const def = last(a, 'lobby').room.itemsOn;
  if (def) fail('기본값이 켜짐 — 꺼져 있어야 한다'); else console.log('✅ 기본 꺼짐');

  send(b, { t: 'setItems', v: true });     // 비호스트
  await wait(250);
  if (last(a, 'lobby').room.itemsOn) fail('비호스트가 켤 수 있다'); else console.log('✅ 비호스트 무시');

  send(a, { t: 'setItems', v: true });     // 호스트
  await wait(250);
  if (!last(a, 'lobby').room.itemsOn || !last(b, 'lobby').room.itemsOn) fail('호스트가 켰는데 동기화 안 됨');
  else console.log('✅ 호스트가 켜면 양쪽 로비에 동기화');

  // 꺼진 방에서 reroll 무시되는지 — 다시 끄고 시작
  send(a, { t: 'setItems', v: false });
  await wait(200);
  send(a, { t: 'start' });
  await wait(500);
  let st = last(a, 'state');
  const turnWs = st.state.turn === 0 ? a : b;
  send(turnWs, { t: 'action', a: { type: 'roll' } });
  await wait(400);
  const die1 = last(a, 'state').state.die;
  for (let i = 0; i < 10; i++) { send(turnWs, { t: 'action', a: { type: 'reroll' } }); await wait(60); }
  await wait(300);
  const die2 = last(a, 'state').state.die;
  if (die1 !== die2) fail(`아이템 꺼진 방에서 reroll이 먹었다 (${die1}→${die2})`);
  else console.log(`✅ 꺼진 방: reroll 10회 무시 (눈 ${die1} 유지)`);

  a.close(); b.close();

  // 켠 방에서는 먹는지
  const c = await conn(), d = await conn();
  send(c, { t: 'create', game: 'kb', name: '호스트2' });
  await wait(300);
  const code2 = last(c, 'lobby').room.code;
  send(d, { t: 'join', code: code2, name: '손님2' });
  await wait(300);
  send(c, { t: 'setItems', v: true });
  await wait(200);
  send(c, { t: 'start' });
  await wait(500);
  const st2 = last(c, 'state');
  const tw = st2.state.turn === 0 ? c : d;
  send(tw, { t: 'action', a: { type: 'roll' } });
  await wait(400);
  const d1 = last(c, 'state').state.die;
  let changed = false;
  for (let i = 0; i < 25 && !changed; i++) {
    send(tw, { t: 'action', a: { type: 'reroll' } });
    await wait(90);
    if (last(c, 'state').state.die !== d1) changed = true;
  }
  const phase = last(c, 'state').state.phase;
  if (!changed) fail('켠 방인데 reroll이 25번 시도해도 눈이 안 바뀐다');
  else console.log(`✅ 켠 방: reroll 동작 (눈 ${d1}→${last(c,'state').state.die}, phase=${phase})`);
  c.close(); d.close();

  console.log(bad ? `\n❌ 문제 ${bad}건` : '\n✓ 온라인 아이템은 호스트가 켠 방에서만 먹는다');
  process.exit(bad ? 1 : 0);
})();
