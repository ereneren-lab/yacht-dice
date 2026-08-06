/**
 * 알까기 실플레이 검증 — **AI가 선공인 판이 멈추지 않는가**가 핵심이다.
 *
 * 왜 이게 필요한가 (2026-08-06):
 *   엔진은 `manualAI`라 스스로 두지 않는다(사람 리플레이와 겹치면 화면이 튀어서).
 *   대신 클라가 리플레이가 끝날 때 `scheduleAiTurn()`을 부르는데, **판 시작에는 앞선 리플레이가 없다.**
 *   선공은 `rng()<0.5`로 정해지므로 **판의 절반이 "컴퓨터가 조준 중…"에서 멈춘 채 시작**했다.
 *   입력을 안 주면 16초 동안 돌이 하나도 안 움직였다(실측). 사용자에겐 그냥 '멈춘 게임'이다.
 *
 * 이 게임은 버튼이 없다(돌을 당겨 튕긴다). 그래서 다른 verify-*-play와 달리
 * **캔버스 픽셀에서 돌을 찾아** 마우스 이벤트로 조작한다 — 사람이 하는 것과 같은 경로다.
 *
 * 사용: node server.js 띄운 뒤  npm run test:alkkagi:play
 */
const { launchWithRetry, requireServer } = require('./cdp');

const WHO = `var w=document.getElementById('whoTurn'); return w?(w.textContent||'').replace(/\\s+/g,' ').trim():'';`;
const OVER = `var o=document.getElementById('resOv');
  return { on: !!(o&&o.classList.contains('on')), t:(document.getElementById('resTitle')||{}).textContent||'' };`;

/* 돌 찾기 — 내 돌은 파랑, 상대는 빨강. 색으로 뭉쳐 중심을 낸다. */
const FIND = `
  var cv=document.getElementById('board'); if(!cv) return null;
  var ctx=cv.getContext('2d'), W=cv.width, H=cv.height;
  var d; try{ d=ctx.getImageData(0,0,W,H).data; }catch(e){ return null; }
  var pb=[], pr=[];
  for(var y=0;y<H;y+=3)for(var x=0;x<W;x+=3){
    var i=(y*W+x)*4; if(d[i+3]<200) continue;
    if(d[i+2]>150 && d[i]<110 && d[i+1]>110) pb.push([x,y]);
    else if(d[i]>150 && d[i+1]<90 && d[i+2]<90) pr.push([x,y]);
  }
  function cl(l){ var cs=[], rad=Math.max(10,W*0.05);
    l.forEach(function(p){ for(var i=0;i<cs.length;i++){ var c=cs[i];
      if(Math.hypot(p[0]-c.x,p[1]-c.y)<rad){ c.n++;c.sx+=p[0];c.sy+=p[1];c.x=c.sx/c.n;c.y=c.sy/c.n;return; } }
      cs.push({x:p[0],y:p[1],sx:p[0],sy:p[1],n:1}); });
    return cs.filter(function(c){ return c.n>=6; }); }
  var s=cv.getBoundingClientRect().width/W;
  return { b: cl(pb).map(function(c){return {x:c.x*s,y:c.y*s};}),
           r: cl(pr).map(function(c){return {x:c.x*s,y:c.y*s};}) };`;

const shoot = (m, o, pull) => `
  var cv=document.getElementById('board'), r=cv.getBoundingClientRect();
  var sx=r.left+${m.x}, sy=r.top+${m.y};
  var vx=${o.x}-${m.x}, vy=${o.y}-${m.y}, L=Math.hypot(vx,vy)||1;
  var ex=sx-(vx/L)*${pull}, ey=sy-(vy/L)*${pull};
  function ev(t,tg,x,y){ tg.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y})); }
  ev('mousedown',cv,sx,sy); ev('mousemove',window,ex,ey); ev('mouseup',window,ex,ey);
  return true;`;

async function playOne(cdp, idx) {
  const p = await cdp.newPage(390, 844);
  const rec = { aiFirst: false, firstMoveSec: null, turns: [], over: null, errs: [] };
  try {
    await p.goto('http://localhost:3000/alkkagi.html');
    await p.wait(900);
    await p.eval(`try{ if(window.TUT) TUT.close(); }catch(e){} return true;`);
    await p.click('#startBtn');
    await p.wait(700);

    const who0 = await p.eval(WHO);
    rec.aiFirst = who0.indexOf('나') < 0;

    // ① AI 선공이면 첫 수가 실제로 나오는지 잰다(예전엔 16초 넘게 멈췄다)
    if (rec.aiFirst) {
      const s0 = await p.eval(FIND);
      const key = s0 ? JSON.stringify(s0) : '';
      for (let k = 0; k < 24; k++) {
        await p.wait(500);
        const s = await p.eval(FIND).catch(() => null);
        if (s && JSON.stringify(s) !== key) { rec.firstMoveSec = ((k + 1) * 0.5).toFixed(1); break; }
      }
    }

    // ② 끝까지 둔다 — 차례가 번갈아 가는지, 결과창이 뜨는지
    let last = '';
    for (let i = 0; i < 70; i++) {
      const who = await p.eval(WHO).catch(() => '');
      if (who && who !== last) { rec.turns.push(who); last = who; }
      if (who.indexOf('나') >= 0) {
        const f = await p.eval(FIND).catch(() => null);
        if (f && f.b.length && f.r.length) {
          let best = null;
          f.b.forEach(m => f.r.forEach(o => { const d = Math.hypot(o.x - m.x, o.y - m.y); if (!best || d < best.d) best = { m, o, d }; }));
          await p.eval(shoot(best.m, best.o, 60)).catch(() => {});
        }
      }
      await p.wait(900);
      const ov = await p.eval(OVER).catch(() => ({}));
      if (ov.on) { rec.over = ov.t; break; }
    }
    rec.errs = (p.errors || []).filter(e => !/favicon|plausible|vibrate|net::/i.test(e));
  } finally { await p.close(); }
  return rec;
}

(async () => {
  await requireServer();
  const cdp = await launchWithRetry();
  const N = +(process.argv.find(a => a.startsWith('--n=')) || '--n=6').slice(4);
  let fail = 0, aiFirst = 0;
  for (let i = 1; i <= N; i++) {
    const r = await playOne(cdp, i);
    const dup = r.turns.filter((t, k) => k && t === r.turns[k - 1]).length;
    const bad = [];
    if (r.aiFirst) {
      aiFirst++;
      if (!r.firstMoveSec) bad.push('AI 선공인데 12초 동안 첫 수가 없다');
      else if (+r.firstMoveSec > 4) bad.push(`AI 첫 수까지 ${r.firstMoveSec}초`);
    }
    if (!r.over) bad.push('결과창까지 못 감');
    if (dup) bad.push(`같은 차례가 연속 ${dup}회`);
    if (r.errs.length) bad.push('콘솔 오류: ' + r.errs[0].slice(0, 80));
    if (bad.length) { fail++; console.log(`❌ ${i}판 (${r.aiFirst ? 'AI 선공' : '내 선공'}) — ${bad.join(' · ')}`); }
    else console.log(`✅ ${i}판 (${r.aiFirst ? 'AI 선공' : '내 선공'})` +
      (r.firstMoveSec ? ` 첫 수 ${r.firstMoveSec}초` : '') + ` · 차례 ${r.turns.length}번 · 결과 "${r.over}"`);
  }
  console.log(`\n${fail ? `❌ ${fail}/${N}판 문제` : `✅ ${N}판 전부 정상 (그중 AI 선공 ${aiFirst}판)`}`);
  if (!aiFirst) console.log('⚠️ 이번 실행엔 AI 선공 판이 없었다 — 선공은 무작위다. 다시 돌려볼 것.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
