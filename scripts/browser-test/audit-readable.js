/**
 * 읽힘 감사 — 상단바가 붐비지 않나 · 글자가 너무 작지 않나.
 *
 * 왜 있나 (2026-07-29)
 *   요트 인게임 상단바에 아이콘이 7개라 **제목이 "요트 다…"로 잘렸다.**
 *   그리고 허브에서만 13px 미만 텍스트가 135개(최소 10.5px)였다.
 *   둘 다 "에러는 안 나는데 읽기 힘든" 종류라 기존 감사가 안 봤다.
 *
 * 재는 것
 *   ① 상단바 — 버튼 수 · 제목이 잘렸나(scrollWidth > clientWidth) · 아이콘에 레이블이 있나
 *   ② 작은 글씨 — 화면에 실제로 보이는 텍스트 중 기준 미만인 것 (숨은 요소 제외)
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/audit-readable.js [게임...]
 */
const { launchWithRetry, requireServer } = require('./cdp');

const MIN_PX = 12;               // 이보다 작으면 폰에서 읽기 힘들다고 본다

/* 일부러 작게 두는 것 — '그래픽에 붙은 글자'다. 키우면 카드·주사위가 깨진다.
   ⚠️ 이 목록은 '봐줄 것'이지 '못 본 것'이 아니다. 새로 추가할 땐 정말 그래픽인지 확인할 것. */
const GRAPHIC = ['cs', 'idx', 'cr'];   // 카드 구석 무늬 · 주사위 눈 번호 · 카드 얼굴 글자
const VIEW = { w: 384, h: 748 }; // 갤A16 앱 웹뷰 실측

const GAMES = ['kb', 'yut', 'ld', 'lcr', 'yacht', 'alkkagi', 'seotda',
  'blackjack', 'indianpoker', 'highlow', 'oldmaid', 'baccarat', 'onecard'];

const START = { yacht: 'startLocal' };   // 나머지는 startBtn

const MEASURE = `
function visible(el){
  var cs=getComputedStyle(el);
  if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)<0.05) return false;
  var b=el.getBoundingClientRect();
  return b.width>0 && b.height>0;
}

// ① 상단바
var bar=document.querySelector('.topbar,.kbtop,.top,header');
var barInfo=null;
if(bar && visible(bar)){
  var btns=[].slice.call(bar.querySelectorAll('button,a')).filter(visible);
  /* 제목은 .title로 명시해서 잡는다.
     ⚠️ 처음엔 '버튼이 아닌 가장 긴 텍스트 블록'으로 추론했는데, topbar-more.js가 넣은
        '⋯ 더보기' 래퍼(안에 메뉴 항목 글자가 들어 있다)를 제목으로 오인했다.
        추론은 UI가 바뀌면 조용히 틀린다 — 셀렉터로 못 박는다. */
  var title=bar.querySelector('.title, h1, h2');   // kb·ld는 .title이 아니라 <h2>를 쓴다
  if(title && !visible(title)) title=null;
  var clipped=null;
  if(title){
    // 잘림: 내용 폭이 보이는 폭보다 크거나, text-overflow로 …가 붙는 상태
    clipped = title.scrollWidth > title.clientWidth+1;
  }
  barInfo={
    buttons: btns.length,
    labeled: btns.filter(function(b){
      return (b.getAttribute('aria-label')||'').trim() || (b.getAttribute('title')||'').trim();
    }).length,
    titleText: title?((title.textContent||'').trim().slice(0,20)):null,
    titleClipped: clipped,
    barW: Math.round(bar.getBoundingClientRect().width),
    btnsW: btns.reduce(function(s,b){return s+b.getBoundingClientRect().width;},0)|0
  };
}

// ② 작은 글씨 — 실제로 보이는 리프 텍스트만
var tiny=[];
[].slice.call(document.querySelectorAll('*')).forEach(function(el){
  if(el.children.length) return;
  var t=(el.textContent||'').trim();
  if(!t) return;
  if(!visible(el)) return;
  var b=el.getBoundingClientRect();
  if(b.bottom<0||b.top>innerHeight*4) return;       // 한참 아래는 제외(과도한 수집 방지)
  var fs=parseFloat(getComputedStyle(el).fontSize);
  if(fs >= ${MIN_PX}) return;
  var cls=(el.className||'').toString().split(' ')[0];
  var pcls=el.parentElement?((el.parentElement.className||'').toString().split(' ')[0]):'';
  var graphic=${JSON.stringify(GRAPHIC)};
  if(graphic.indexOf(cls)>=0 || graphic.indexOf(pcls)>=0) return;   // 의도된 그래픽은 제외
  tiny.push({fs:+fs.toFixed(1), txt:t.slice(0,18), cls:cls.slice(0,18), tag:el.tagName.toLowerCase()});
});
// 클래스별로 묶어 보고 (같은 규칙이 원인이면 한 곳만 고치면 된다)
var byCls={};
tiny.forEach(function(x){ var k=(x.cls||x.tag)+'@'+x.fs; byCls[k]=(byCls[k]||0)+1; });

return {bar:barInfo, tinyCount:tiny.length,
        tinyMin: tiny.length?Math.min.apply(null,tiny.map(function(x){return x.fs;})):null,
        groups:Object.keys(byCls).map(function(k){return k+' x'+byCls[k];}).sort()};
`;

(async () => {
  const only = process.argv.slice(2);
  const list = only.length ? GAMES.filter(g => only.includes(g)) : GAMES;
  await requireServer();   // 서버가 없으면 감사는 '전부 통과'로 거짓말을 한다 — cdp.js requireServer 주석 참고
  const cdp = await launchWithRetry();
  const rows = [];

  for (const g of list) {
    const page = await cdp.newPage(VIEW.w, VIEW.h);
    try {
      await page.setMotion(true);
      await page.goto(`http://localhost:3000/${g}.html`);
      await page.eval('localStorage.clear(); sessionStorage.clear(); return 1');
      await page.goto(`http://localhost:3000/${g}.html`);
      await page.wait(1500);
      // 판을 깔아야 인게임 상단바가 나온다
      await page.eval(`var b=document.getElementById('${START[g] || 'startBtn'}'); if(b) b.click(); return 1`);
      await page.wait(2200);
      const r = await page.eval(MEASURE);
      rows.push({ g, ...r });
    } catch (e) {
      rows.push({ g, err: e.message.slice(0, 60) });
    }
    await page.close();
  }
  await cdp.close();

  console.log(`\n════════ ① 인게임 상단바 (${VIEW.w}x${VIEW.h}) ════════`);
  console.log('게임          버튼  레이블  제목            잘림  버튼폭/바폭');
  rows.forEach(r => {
    if (r.err) { console.log(`${r.g.padEnd(12)} 예외 ${r.err}`); return; }
    if (!r.bar) { console.log(`${r.g.padEnd(12)} 상단바 없음`); return; }
    const b = r.bar;
    const flag = b.titleClipped ? '❌' : '  ';
    console.log(`${flag} ${r.g.padEnd(11)}${String(b.buttons).padStart(3)}  ${String(b.labeled).padStart(3)}/${b.buttons}   ${String(b.titleText || '-').padEnd(14)} ${b.titleClipped ? '잘림' : ' -  '}  ${b.btnsW}/${b.barW}`);
  });

  console.log(`\n════════ ② ${MIN_PX}px 미만 텍스트 ════════`);
  rows.forEach(r => {
    if (r.err || r.tinyCount == null) return;
    const flag = r.tinyCount ? '⚠️ ' : '✅ ';
    console.log(`${flag}${r.g.padEnd(12)} ${String(r.tinyCount).padStart(3)}개 (최소 ${r.tinyMin ?? '-'}px)`);
    if (r.tinyCount) console.log('     ' + r.groups.slice(0, 8).join('  '));
  });

  const clipped = rows.filter(r => r.bar && r.bar.titleClipped).length;
  const tinyTotal = rows.reduce((s, r) => s + (r.tinyCount || 0), 0);
  console.log(`\n제목 잘린 게임 ${clipped}종 · ${MIN_PX}px 미만 텍스트 합계 ${tinyTotal}개`);
  process.exit(0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
