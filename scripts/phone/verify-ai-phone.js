#!/usr/bin/env node
/**
 * 실기기에서 **AI가 실제로 두는가**를 본다 — 엔진(AI)을 고친 뒤의 최종 확인.
 *
 * 왜 필요한가 (2026-08-07)
 *   난이도 작업은 전부 헤드리스 시뮬(가상 시계로 엔진만)로 검증했다. 그 시뮬은 화면을 안 그리고
 *   타이머를 가짜로 돌린다 — **실기기에서 AI 차례가 실제로 오는지**는 증명하지 못한다.
 *   알까기에서 실제로 그런 일이 있었다: 엔진은 멀쩡한데 클라가 AI를 안 깨워 판의 절반이 멈춰 있었다.
 *
 * 무엇을 보나: 게임을 열고 시작 → 15초 동안 **화면이 스스로 바뀌는지**(AI가 두는 증거) ·
 *   콘솔 오류 · 캡처. 사람이 눌러야만 진행되는 게임은 첫 조작 하나만 눌러 준다.
 *
 * 준비: npm run app:deploy 로 최신 APK를 올린 뒤 앱이 떠 있어야 한다.
 * 사용: node scripts/phone/verify-ai-phone.js [게임...]
 */
const { attach } = require('./phone-cdp');

const GAMES = [
  { g: 'seotda',      start: '#startBtn',   poke: ['#betbar .bbtn', '#nextBtn'] },
  { g: 'indianpoker', start: '#startBtn',   poke: ['.bbtn.check', '.bbtn.call', '#nextBtn'] },
  { g: 'ld',          start: '#startBtn',   poke: ['#bidBtn'] },
  /* ⚠️ poke 셀렉터는 **실기기 DOM에서 뽑은 것**이다. 짐작으로 넣었다가 3종이 'AI가 안 둔다'로
     오진됐다 — 실제로는 내 차례에서 기다리는 화면이었다(너클본즈: "줄을 골라"). */
  { g: 'kb',          start: '#startBtn',   poke: ['#rollBtn', '.col.place'] },
  /* 요트 점수 확정은 `td.preview[data-cat]`이다 — `td.val`은 **미리보기 표시용**이라 눌러도 안 먹는다
     (`yacht.html`의 onclick 바인딩이 preview에만 걸려 있다). 0점 칸은 확인창이 떠서 #cfOk까지 눌러 준다. */
  { g: 'yacht',       start: '#startLocal', poke: ['#cfOk', '#sheet td.preview[data-cat]', '#rollBtn'] },   // 확인창 > 확정 칸 > 굴리기 순서
  /* 알까기는 돌을 당겨 튕기는 조작이라 누를 게 없다. AI 선공이면 스스로 두고, 내 선공이면 안 움직이는 게
     정상이다 — 그래서 여기선 판정하지 않는다(전용 회귀는 `npm run test:alkkagi:play`). */
  { g: 'alkkagi',     start: '#startBtn',   poke: [], noJudge: true },
];

/* 화면이 '스스로' 바뀌었는지 — 판 영역 텍스트+캔버스 픽셀 몇 개를 지문으로 삼는다.
   버튼을 누르지 않은 상태에서 이 지문이 바뀌면 AI가 뒀다는 뜻이다. */
const FINGERPRINT = `
  var t = (document.body.innerText||'').replace(/\\s+/g,' ').slice(0, 400);
  var cv = document.querySelector('canvas'); var px = '';
  if (cv) { try { var c = cv.getContext('2d'); var d = c.getImageData(0,0,Math.min(60,cv.width),1).data;
    for (var i=0;i<d.length;i+=40) px += d[i]; } catch(e){} }
  return t + '|' + px;`;

/* ⚠️ 순서가 중요하다: **떠 있는 확인창 버튼을 맨 앞에** 둔다. 뒤에 두면 모달 뒤의 요소를 계속 누르며
   영원히 안 넘어간다(요트 0점 확인창에서 실제로 그랬다).
   ⚠️ 보이는지 판정에 `offsetParent`를 쓰면 안 된다 — **position:fixed 요소는 항상 null**이다.
   섯다·너클본즈의 '판 시작'은 셋업 동안 화면 하단에 fixed로 붙어 있어서, 이 검사로는
   버튼이 멀쩡히 보이는데도 조용히 건너뛴다(2026-08-07에 실제로 4종이 '시작 안 됨'으로 오진됐다). */
const CLICK = (sels) => `
  var list = ${JSON.stringify(sels)};
  for (var i=0;i<list.length;i++){
    var e = document.querySelector(list[i]);
    if (!e || e.disabled) continue;
    var r = e.getBoundingClientRect();
    var st = getComputedStyle(e);
    if (r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none') { e.click(); return list[i]; }
  }
  return null;`;

(async () => {
  const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const list = only.length ? GAMES.filter(x => only.includes(x.g)) : GAMES;
  const p = await attach();
  let fail = 0;
  console.log('게임          AI가 스스로 둔 횟수   조작   오류   캡처');
  console.log('─'.repeat(66));
  for (const G of list) {
    await p.goto('https://localhost/' + G.g + '.html');
    await p.wait(1200);
    p.logs.length = 0;
    await p.eval(`try{ if(window.TUT) TUT.close(); }catch(e){} return true;`);
    await p.eval(CLICK([G.start])).catch(() => null);
    await p.wait(1500);

    /* ⚠️ 누르는 간격을 고정(5초)으로 뒀더니 요트가 시드 운에 따라 통과/실패를 오갔다 —
       사람이 눌러야 넘어가는 게임은 눌러 줘야 **AI 차례가 온다.** 정체되면 바로 누른다. */
    let moves = 0, pokes = 0, stale = 0, last = await p.eval(FINGERPRINT).catch(() => '');
    for (let k = 0; k < 24; k++) {
      await p.wait(900);
      const now = await p.eval(FINGERPRINT).catch(() => last);
      if (now !== last) { moves++; last = now; stale = 0; continue; }
      if (++stale >= 2 && G.poke.length) {
        const hit = await p.eval(CLICK(G.poke)).catch(() => null);
        if (hit) { pokes++; stale = 0; await p.wait(700); last = await p.eval(FINGERPRINT).catch(() => last); }
      }
    }
    const errs = p.logs.filter(l => /error|Uncaught|TypeError|ReferenceError/i.test(l));
    const shot = `out/phone-ai-${G.g}.png`;
    await p.shot(shot);
    const bad = (!G.noJudge && moves < 2) || errs.length > 0;
    if (bad) fail++;
    console.log(`${bad ? '❌' : (G.noJudge ? '➖' : '✅')} ${G.g.padEnd(12)} ${String(moves).padStart(9)}회   ${String(pokes).padStart(3)}회   ${String(errs.length).padStart(3)}건   ${shot}`);
    if (errs.length) console.log('   ' + errs[0].slice(0, 120));
  }
  p.close();
  console.log(`\n${fail ? `❌ ${fail}종에서 AI가 안 두거나 오류가 났다` : '✅ 전부 실기기에서 스스로 진행한다'}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
