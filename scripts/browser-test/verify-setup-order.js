/**
 * 셋업 재배치 검증 — '결정'이 위, '성취'가 아래인가. 그리고 시작 버튼이 뭔가를 덮지 않나.
 *
 * 왜 있나 (2026-07-29)
 *   너클본즈 셋업은 384x748에서 892px이라 잘렸고, 그 위쪽 188px이 레벨·전적·업적이었다.
 *   신규 유저에겐 전부 0·잠김이다. setup-order.js가 이걸 '시작' 아래로 내린다.
 *   그리고 fit-setup.js의 sticky 바가 #itemWrap을 덮던 문제도 여기서 잡는다
 *   — audit-ux ①은 '화면 안에 있나'만 봐서 이 가림을 못 봤다.
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/verify-setup-order.js
 */
const { launchWithRetry } = require('./cdp');

const GAMES = [
  { g: 'kb', start: 'startBtn', name: '너클본즈' },
  { g: 'ld', start: 'startBtn', name: '라이어' },
  { g: 'lcr', start: 'startBtn', name: '좌중우' },
  { g: 'yut', start: 'startBtn', name: '윷놀이' },
  { g: 'yacht', start: 'startLocal', name: '요트' },
  { g: 'alkkagi', start: 'startBtn', name: '알까기' },
];

// 신규 유저 기준 뷰포트 — 갤A16 앱 웹뷰 실측
const VIEWS = [
  { n: '384x748 갤A16앱', w: 384, h: 748 },
  { n: '360x640 소형폰', w: 360, h: 640 },
  { n: '390x844 아이폰', w: 390, h: 844 },
];

const CHECK = start => `
var b=document.getElementById(${JSON.stringify(start)});
if(!b) return {none:true};
var rc=b.getBoundingClientRect();
var hit=document.elementFromPoint(Math.round(rc.left+rc.width/2), Math.round(rc.top+rc.height/2));

/* 성취계가 첫 화면을 막지 않나.
   '시작 버튼 아래로 갔나'만 보면 안 된다 — 요트는 v1.239부터 <details>로 접어두는 방식이라
   위치는 위지만 접혀 있어 아무것도 막지 않는다. 접힌 것도 통과로 친다. */
var below=[], above=[], folded=[];
['levelBar','statsbar','achbar'].forEach(function(id){
  var e=document.getElementById(id); if(!e) return;
  var d=e.closest('details');
  if(d && !d.open){ folded.push(id); return; }
  (e.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING) ? below.push(id) : above.push(id);
});

/* 시작 버튼(또는 다른 무엇)이 선택지를 덮고 있나.
   ⚠️ '중앙점이 대상이 아니면 가림'으로 판정하면 오탐한다 — flex 컨테이너는 자식 사이가 비어 있어
      중앙점이 **조상**에 맞는다(알까기 #optMode가 그랬다: 히트=#setup, 실제로는 아무도 안 덮음).
      조상이 잡히는 건 '내 박스 안 빈칸'이지 가림이 아니다. 진짜 가림은 조상도 자손도 아닌 남이다. */
var covered=[];
['optMode','diffWrap','itemWrap','matchWrap','optItems'].forEach(function(id){
  var t=document.getElementById(id); if(!t) return;
  var tb=t.getBoundingClientRect(); if(tb.height<2) return;
  if(tb.bottom<0||tb.top>innerHeight) return;          // 화면 밖은 가림이 아니라 스크롤 문제
  var h2=document.elementFromPoint(Math.round(tb.left+tb.width/2), Math.round(tb.top+tb.height/2));
  if(!h2) return;
  if(h2===t || t.contains(h2) || h2.contains(t)) return;   // 자기 자신·자손·조상은 가림이 아니다
  covered.push(id+'←'+(h2.id?'#'+h2.id:h2.tagName.toLowerCase()));
});

return {top:Math.round(rc.top), bottom:Math.round(rc.bottom),
        inView: rc.top>=0 && rc.bottom<=innerHeight,
        clickable: !!(hit && (hit===b||b.contains(hit))),
        pinned: b.classList.contains('fs-pinned'),
        above:above, below:below, folded:folded, covered:covered};
`;

(async () => {
  const cdp = await launchWithRetry();
  let fail = 0, checked = 0;

  for (const V of VIEWS) {
    console.log(`\n════════ ${V.n} ════════`);
    for (const G of GAMES) {
      const page = await cdp.newPage(V.w, V.h);
      try {
        await page.setMotion(true);
        await page.goto(`http://localhost:3000/${G.g}.html`);
        // 진짜 첫 방문
        await page.eval('localStorage.clear(); sessionStorage.clear(); return 1');
        await page.goto(`http://localhost:3000/${G.g}.html`);
        await new Promise(r => setTimeout(r, 1800));
        await page.eval(`['#helpClose','#rulesClose','#tutClose','#tutOSkip','#tutSkip'].forEach(function(s){
          var e=document.querySelector(s); if(e&&e.offsetParent) e.click(); });
          if(typeof TUT!=='undefined'&&TUT.close){try{TUT.close()}catch(e){}} return 1`);
        await new Promise(r => setTimeout(r, 900));

        const r = await page.eval(CHECK(G.start));
        checked++;
        if (r.none) { console.log(`  ⚠️  ${G.name} 시작 버튼(#${G.start}) 없음`); fail++; continue; }

        const bad = [];
        if (!r.inView) bad.push('시작 화면밖');
        if (!r.clickable) bad.push('시작 눌림막힘');
        if (r.above.length) bad.push('성취계가 위에: ' + r.above.join(','));
        if (r.covered.length) bad.push('가림: ' + r.covered.join(' '));

        if (bad.length) { fail++; console.log(`  ❌ ${G.name.padEnd(7)} ${bad.join(' · ')}`); }
        else console.log(`  ✅ ${G.name.padEnd(7)} 시작 ${r.top}~${r.bottom}${r.pinned ? ' (고정)' : ''} · 성취계 아래 ${r.below.length} 접힘 ${r.folded.length}`);
      } catch (e) {
        fail++; console.log(`  ❌ ${G.name} 예외: ${e.message.slice(0, 80)}`);
      } finally { await page.close(); }
    }
  }

  await cdp.close();
  console.log(`\n${fail ? '❌' : '✅'} ${checked - fail}/${checked} 통과`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
