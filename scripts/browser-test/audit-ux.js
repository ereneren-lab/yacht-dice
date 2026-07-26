/**
 * UX 감사 — "초보가 스크롤 없이, 룰을 보면서 플레이할 수 있나"를 여러 화면폭에서 잰다.
 *
 * 기존 감사와의 차이:
 *   audit-all.js  … 첫 화면만 · 1440x900 데스크톱만
 *   audit-play.js … 인게임만 · 390x844 모바일만
 *   이 파일        … 셋업/인게임 × 5개 폭 × 룰 오버레이까지 (빠진 조합을 메운다)
 *
 * 재는 것
 *   ① 셋업 화면 넘침      — 시작 버튼까지 스크롤 없이 닿나
 *   ② 룰 오버레이 넘침    — 룰 글이 화면 밖으로 나가나 (내부 스크롤은 허용, 페이지 스크롤은 실패)
 *   ③ 인게임 넘침         — 판이 스크롤 없이 다 보이나
 *   ④ 인게임 룰 접근성    — 플레이 중에 룰 버튼이 보이고 눌리나
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/audit-ux.js
 *       node scripts/browser-test/audit-ux.js kb yut     (일부만)
 */
const { launchWithRetry } = require('./cdp');

/* 레티나 496px는 CLAUDE.md 함정 #4 — macOS에서 실제로 이 폭으로 떨어진다.
   가로(landscape)는 폭이 넓은 대신 높이가 360~430px밖에 안 돼 세로 조합보다 훨씬 가혹하다.
   → 세로만 통과해도 '폰 돌리면 깨지는' 상태일 수 있으므로 반드시 함께 잰다. */
const VIEWS = [
  { n: '360x640 소형폰', w: 360, h: 640 },
  { n: '390x844 아이폰', w: 390, h: 844 },
  { n: '496x900 레티나', w: 496, h: 900 },
  { n: '768x1024 태블릿', w: 768, h: 1024 },
  { n: '1440x900 데스크톱', w: 1440, h: 900 },
  { n: '640x360 소형폰가로', w: 640, h: 360 },
  { n: '844x390 아이폰가로', w: 844, h: 390 },
  { n: '1024x768 태블릿가로', w: 1024, h: 768 },
];

const GAMES = [
  { g: 'kb',          start: '#startBtn',   help: '#kbHelp',   ov: '#helpOv',  tut: '#setupTut' },
  { g: 'yut',         start: '#startBtn',   help: '#yutHelp',  ov: '#helpOv',  tut: null },
  { g: 'ld',          start: '#startBtn',   help: '#kbHelp',   ov: '#helpOv',  tut: '#setupTut' },
  { g: 'lcr',         start: '#startBtn',   help: '#lcrHelp',  ov: '#helpOv',  tut: '#setupTut' },
  { g: 'yacht',       start: '#startLocal', help: '#helpBtn',  ov: '#helpOv',  tut: null },
  { g: 'alkkagi',     start: '#startBtn',   help: '#helpBtn',  ov: '#rulesOv', tut: null },
  { g: 'seotda',      start: '#startBtn',   help: '#helpBtn',  ov: '#rulesOv', tut: '#tutBtn' },
  { g: 'blackjack',   start: '#startBtn',   help: '#helpBtn',  ov: '#rulesOv', tut: null },
  { g: 'indianpoker', start: '#startBtn',   help: '#helpBtn',  ov: '#rulesOv', tut: null },
  { g: 'highlow',     start: '#startBtn',   help: '#helpBtn',  ov: '#rulesOv', tut: null },
  { g: 'oldmaid',     start: '#startBtn',   help: '#helpBtn',  ov: '#rulesOv', tut: null },
  { g: 'baccarat',    start: '#startBtn',   help: '#helpBtn',  ov: '#rulesOv', tut: null },
  { g: 'onecard',     start: '#startBtn',   help: '#helpBtn',  ov: '#rulesOv', tut: null },
];

// 페이지 전체 넘침(= 스크롤해야 다 보임)
const OVER = `var de=document.documentElement,b=document.body;
  return {h:Math.max(de.scrollWidth,b.scrollWidth)-window.innerWidth,
          v:Math.max(de.scrollHeight,b.scrollHeight)-window.innerHeight,
          ingame:b.classList.contains('ingame')};`;

/* 가로로 잘려나간 조작 요소 — body{overflow-x:hidden}이 걸린 페이지에서는
   페이지 넘침(hOver)으로 드러나지 않고 버튼만 조용히 사라진다(실제로 kb 상단바 '?'가 그랬다).
   그래서 넘침 수치와 별개로, 버튼/링크가 뷰포트를 벗어났는지 직접 본다. */
const CLIPPED = `var out=[];
  Array.prototype.forEach.call(document.querySelectorAll('button,a,input,select'),function(e){
    var st=getComputedStyle(e);
    if(st.display==='none'||st.visibility==='hidden'||+st.opacity<0.05) return;
    var r=e.getBoundingClientRect();
    if(!r.width||!r.height) return;
    if(r.right>window.innerWidth+1 || r.left<-1){
      out.push((e.id?'#'+e.id:(e.className&&typeof e.className==='string'?'.'+e.className.split(' ')[0]:e.tagName))
        +' ['+(e.textContent||'').trim().slice(0,10)+'] right='+Math.round(r.right)+'/'+window.innerWidth);
    }
  });
  return out;`;

// 요소가 눈에 보이고 탭할 만한가
const visFn = sel => `var e=document.querySelector(${JSON.stringify(sel)});
  if(!e) return {found:false};
  var st=getComputedStyle(e), r=e.getBoundingClientRect();
  return {found:true, shown: st.display!=='none' && st.visibility!=='hidden' && +st.opacity>0.05 && r.width>0 && r.height>0,
          w:Math.round(r.width), h:Math.round(r.height),
          inView: r.top>=-2 && r.left>=-2 && r.bottom<=window.innerHeight+2 && r.right<=window.innerWidth+2};`;

// 오버레이 안쪽이 '내부 스크롤'로 감당되나 — 페이지를 늘려버리면 실패
const ovFn = sel => `var e=document.querySelector(${JSON.stringify(sel)});
  if(!e) return {found:false};
  var st=getComputedStyle(e), r=e.getBoundingClientRect();
  var open = st.display!=='none' && st.visibility!=='hidden' && +st.opacity>0.05;
  // 내용이 넘치는데 그 요소가 스크롤도 안 되면 '읽을 수 없게 잘린' 것 → 실패로 센다
  var tallest=0;
  Array.prototype.forEach.call(e.querySelectorAll('*'), function(x){
    var over = x.scrollHeight - x.clientHeight;
    if(over<=2) return;
    if(!/auto|scroll/.test(getComputedStyle(x).overflowY)) tallest=Math.max(tallest, over);
  });
  return {found:true, open:open, cutOff:tallest, boxH:Math.round(r.height), boxTop:Math.round(r.top)};`;

const ONLY = process.argv.slice(2).filter(a => !a.startsWith('-'));
const LIST = ONLY.length ? GAMES.filter(x => ONLY.includes(x.g)) : GAMES;

(async () => {
  const cdp = await launchWithRetry();
  const rows = [];

  for (const G of LIST) {
    for (const V of VIEWS) {
      const page = await cdp.newPage(V.w, V.h);
      const rec = { g: G.g, view: V.n };
      try {
        // 연출을 켜둔 실제 조건으로 본다 (CLAUDE.md 함정 #7 — 헤드리스 기본은 reduce)
        if (page.setMotion) await page.setMotion(true);
        await page.goto('http://localhost:3000/' + G.g + '.html');
        await page.wait(900);
        // 첫 방문 튜토리얼/규칙 오버레이가 떠 있으면 먼저 닫는다 — 안 닫으면 시작 클릭이 막힌다
        await page.eval(`try{ if(window.TUT) TUT.close();
          var t=document.getElementById('tutOverlay'); if(t) t.classList.remove('on');
        }catch(e){} return true;`);
        await page.wait(250);

        rec.setup = await page.eval(OVER);
        rec.startBtn = await page.eval(visFn(G.start));
        /* 튜토리얼 버튼 — 자체 구현(G.tut)이 있으면 그걸, 없으면 공용 모듈이 다는 #tutOpenBtn을 본다.
           v1.227에서 9종에 공용 튜토리얼이 붙었는데 이 표를 안 고쳐서 "튜토리얼 없음"으로 잘못 나왔다. */
        rec.tutBtn = await page.eval(visFn(G.tut || '#tutOpenBtn'));
        if (!G.tut && (!rec.tutBtn || !rec.tutBtn.found)) rec.tutBtn = await page.eval(visFn('#tutOpenBtn'));

        // ── 룰 오버레이 (셋업에서)
        rec.helpBtn = await page.eval(visFn(G.help));
        if (rec.helpBtn.found && rec.helpBtn.shown) {
          try {
            await page.click(G.help); await page.wait(420);
            rec.ovSetup = await page.eval(ovFn(G.ov));
            rec.ovOver = await page.eval(OVER);
            // 닫기 — ESC가 안 먹는 게임은 닫기 버튼
            await page.eval(`var c=document.querySelector('#helpClose,#rulesClose'); if(c) c.click(); return true;`);
            await page.wait(300);
          } catch (e) { rec.ovErr = e.message.slice(0, 60); }
        }

        // ── 인게임
        const before = page.errors.length;
        try { await page.click(G.start); } catch (e) { rec.startErr = e.message.slice(0, 60); }
        await page.wait(2200);
        rec.play = await page.eval(OVER);
        rec.helpIn = await page.eval(visFn(G.help));   // 플레이 중에도 룰 버튼이 보이나
        rec.clipped = await page.eval(CLIPPED);        // 가로로 잘린 버튼(overflow-x:hidden에 숨는 버그)
        rec.errs = page.errors.slice(before).filter(e => !/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
      } catch (e) { rec.fail = e.message.slice(0, 100); }
      rows.push(rec);
      await page.close();
    }
    // 게임별 한 줄 요약
    const mine = rows.filter(r => r.g === G.g);
    const bad = mine.filter(r => r.fail || (r.play && r.play.v > 0) || (r.setup && r.setup.v > 0));
    console.log(`${bad.length ? '⚠️ ' : '✅'} ${G.g.padEnd(12)} ` +
      mine.map(r => `${r.view.split(' ')[0]}:셋업${r.setup ? r.setup.v : '?'}/판${r.play ? r.play.v : '?'}`).join('  '));
  }

  // ───────── 리포트
  const P = s => console.log(s);
  P('\n════════ ① 셋업 화면: 시작 버튼까지 스크롤 없이 닿나 ════════');
  for (const G of LIST) {
    const mine = rows.filter(r => r.g === G.g);
    const bad = mine.filter(r => r.setup && r.setup.v > 0);
    if (!bad.length) { P(`✅ ${G.g.padEnd(12)} 전 폭 OK`); continue; }
    P(`⚠️  ${G.g.padEnd(12)} ` + bad.map(r => `${r.view} +${r.setup.v}px`).join(' · '));
    bad.forEach(r => { if (r.startBtn && !r.startBtn.inView) P(`      └ ${r.view}: 시작 버튼이 화면 밖`); });
  }

  P('\n════════ ② 룰 오버레이: 글이 잘리지 않나 ════════');
  for (const G of LIST) {
    const mine = rows.filter(r => r.g === G.g);
    const miss = mine.filter(r => r.helpBtn && !r.helpBtn.found);
    if (miss.length) { P(`❌ ${G.g.padEnd(12)} 룰 버튼(${G.help}) 없음`); continue; }
    const cut = mine.filter(r => r.ovSetup && r.ovSetup.cutOff > 2);
    const pageGrew = mine.filter(r => r.ovOver && r.ovOver.v > 0);
    if (!cut.length && !pageGrew.length) { P(`✅ ${G.g.padEnd(12)} 전 폭 OK`); continue; }
    P(`⚠️  ${G.g.padEnd(12)} ` +
      (cut.length ? '잘림: ' + cut.map(r => `${r.view} ${r.ovSetup.cutOff}px`).join(' · ') : '') +
      (pageGrew.length ? ' | 페이지 늘어남: ' + pageGrew.map(r => `${r.view} +${r.ovOver.v}px`).join(' · ') : ''));
  }

  P('\n════════ ③ 인게임: 판이 스크롤 없이 다 보이나 ════════');
  for (const G of LIST) {
    const mine = rows.filter(r => r.g === G.g);
    const bad = mine.filter(r => r.play && r.play.v > 0);
    const notIn = mine.filter(r => r.play && !r.play.ingame && r.g !== 'yacht');
    if (!bad.length) P(`✅ ${G.g.padEnd(12)} 전 폭 OK` + (notIn.length ? ` (ingame 클래스 없음: ${notIn.length}개 폭)` : ''));
    else P(`⚠️  ${G.g.padEnd(12)} ` + bad.map(r => `${r.view} +${r.play.v}px`).join(' · '));
  }

  P('\n════════ ④ 플레이 중 룰 접근 + 튜토리얼 유무 ════════');
  for (const G of LIST) {
    const mine = rows.filter(r => r.g === G.g);
    const okIn = mine.filter(r => r.helpIn && r.helpIn.shown && r.helpIn.inView).length;
    const shown = mine.some(r => r.tutBtn && r.tutBtn.shown);
    const tut = shown ? ('튜토리얼 있음' + (G.tut ? '(자체)' : '(공용 tutorial.js)'))
                      : `튜토리얼 버튼(${G.tut || '#tutOpenBtn'}) 안 보임`;
    P(`${okIn === mine.length ? '✅' : '⚠️ '} ${G.g.padEnd(12)} 인게임 룰버튼 ${okIn}/${mine.length} 폭에서 접근 가능 · ${tut}`);
  }

  P('\n════════ ⑤ 가로로 잘린 버튼 (overflow-x:hidden에 숨는 버그) ════════');
  for (const G of LIST) {
    const bad = rows.filter(r => r.g === G.g && r.clipped && r.clipped.length);
    if (!bad.length) { P(`✅ ${G.g.padEnd(12)} 전 폭 OK`); continue; }
    P(`⚠️  ${G.g.padEnd(12)} ` + bad.map(r => r.view.split(' ')[0]).join(' · '));
    bad.slice(0, 2).forEach(r => r.clipped.slice(0, 3).forEach(c => P(`      └ ${r.view}: ${c}`)));
  }

  const errRows = rows.filter(r => (r.errs && r.errs.length) || r.fail || r.startErr);
  if (errRows.length) {
    P('\n════════ ⑥ 에러 ════════');
    errRows.forEach(r => P(`❌ ${r.g} ${r.view}: ${r.fail || r.startErr || ''} ${(r.errs || []).slice(0, 2).join(' | ').slice(0, 200)}`));
  }

  await cdp.close();
})();
