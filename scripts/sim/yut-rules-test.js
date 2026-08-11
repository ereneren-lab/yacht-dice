/* 새 규칙 셋을 엔진에 직접 물어본다(연출·타이머 없이 상태만).
   ① 부스터로 늪에 얹히면 빠지나 ② 이벤트가 연달아 붙으면 다 먹나 ③ 0과 29가 같은 칸으로 잡히나 */
const { YutEngine } = require('/Users/jaesung/yacht-dice/public/yut-core.js');
const mk = () => new YutEngine({ players:[{pid:'a',name:'A'},{pid:'b',name:'B'}], markers:4, goal:4,
  decideOrder:false, pit:true, rng:()=>0.5, onState(){}, aiMs:0, manualAI:true });

function show(t, cond, extra) { console.log((cond?'✅':'❌')+' '+t+(extra?('  '+extra):'')); return cond; }
let ok = true;

// ① 부스터 → 늪
{
  const e = mk();
  /* ⚠️ 5·10은 지름길 모서리라 +3이 중앙으로 꺾인다 — 시험 칸으로 쓰면 안 된다.
     6에 부스터를 두고 +3 → 9(늪). 말은 '착지한 칸'에 실제로 세워야 한다(_shiftGroup은 말 위치에서 민다). */
  e.pitNode = 9; e.eventTiles = { 6: 'boost' };
  const p = e.players[0].pieces[0];
  p.out = true; p.node = 6; p.route = 'outer';
  e._resolveTile([p], 6, 'outer', 0, e.players[0], 0);
  ok &= show('부스터로 늪에 얹히면 빠진다', p.out === false && p.node === 0,
    `(말 상태: out=${p.out} node=${p.node})`);
}
// ② 이벤트 연쇄 — 부스터(5)+3 → 8에 또 부스터 → 11에 보너스
{
  const e = mk();
  e.pitNode = -1; e.eventTiles = { 6:'boost', 9:'boost', 12:'bonus' };   // 6 →(+3) 9 →(+3) 12
  const p = e.players[0].pieces[0];
  p.out = true; p.node = 6; p.route = 'outer';
  const before = e.throwsLeft;
  e._resolveTile([p], 6, 'outer', 0, e.players[0], 0);
  ok &= show('부스터가 연달아 발동하고 마지막 보너스까지 먹는다',
    p.node === 12 && e.throwsLeft === before + 1, `(도착 ${p.node}칸 · 던질 기회 +${e.throwsLeft-before})`);
}
// ③ 0 ≡ 29 잡기
{
  const e = mk();
  const mine = e.players[0].pieces[0], theirs = e.players[1].pieces[0];
  theirs.out = true; theirs.node = 29; theirs.route = 'outer';    // 상대가 종착점에 서 있다
  mine.out = true; mine.node = 0; mine.route = 'outer';           // 내가 후퇴로 시작점에 떨어졌다
  const caught = e._captureAt(0, 0, e.players[0]);
  ok &= show('시작점(0)에 떨어져도 종착점(29) 말을 잡는다', caught && theirs.out === false);
}
// ③-b 반대 방향
{
  const e = mk();
  const mine = e.players[0].pieces[0], theirs = e.players[1].pieces[0];
  theirs.out = true; theirs.node = 0; theirs.route = 'outer';
  const caught = e._captureAt(29, 0, e.players[0]);
  ok &= show('종착점(29)에 서도 시작점(0) 말을 잡는다', caught && theirs.out === false);
}
// ③-c 대기 말은 안 잡힌다(회귀)
{
  const e = mk();
  const theirs = e.players[1].pieces[0];                          // out=false, node=0 (대기)
  const caught = e._captureAt(0, 0, e.players[0]);
  ok &= show('아직 안 나온 대기 말은 안 잡힌다', !caught && theirs.out === false);
}
// ④ 연쇄 상한 — 부스터가 자기 자신으로 돌아오는 고리를 만들어도 멈추나
{
  const e = mk();
  e.pitNode = -1; e.eventTiles = {}; [1,2,3,4,6,7,8,9,11,12,13,14].forEach(n=>e.eventTiles[n]='boost');
  const p = e.players[0].pieces[0];
  p.out = true; p.node = 0; p.route = 'outer';
  const t0 = Date.now();
  e._resolveTile([p], 1, 'outer', 0, e.players[0], 0);
  ok &= show('부스터가 온 판에 깔려 있어도 멈춘다(무한루프 없음)', Date.now()-t0 < 1000, `(${Date.now()-t0}ms · 최종 ${p.done?'완주':p.node+'칸'})`);
}
process.exit(ok ? 0 : 1);
