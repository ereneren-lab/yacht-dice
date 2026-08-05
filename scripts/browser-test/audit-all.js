/**
 * 전 게임 1차 감사 — 실제 크로미움(폰 뷰포트)에서 로드하고
 *  ① 콘솔 에러 ② 가로/세로 넘침 ③ 작은 탭 타깃 ④ 첫 화면 버튼 목록 을 수집한다.
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/audit-all.js
 */
const { launchWithRetry, requireServer } = require('./cdp');

const GAMES = ['index','kb','yacht','yut','ld','lcr','alkkagi','seotda','blackjack','indianpoker','highlow','oldmaid','baccarat','onecard'];
const W = 390, H = 844;   // 아이폰 세로

const PROBE = `
  var de=document.documentElement, b=document.body;
  var hOver = Math.max(de.scrollWidth, b.scrollWidth) - window.innerWidth;
  var vOver = Math.max(de.scrollHeight, b.scrollHeight) - window.innerHeight;
  var small=[], btns=[];
  document.querySelectorAll('button,a.gcard,[role=button],.btn,.chip,.iconbtn').forEach(function(e){
    var r=e.getBoundingClientRect(); var st=getComputedStyle(e);
    if(st.display==='none'||st.visibility==='hidden'||!r.width||!r.height) return;
    var t=(e.textContent||'').trim().replace(/\s+/g,' ').slice(0,18);
    if(r.width<40||r.height<40) small.push((e.id||e.className.split(' ')[0]||e.tagName)+'['+t+'] '+Math.round(r.width)+'x'+Math.round(r.height));
    if(r.top<window.innerHeight) btns.push((e.id?'#'+e.id:'.'+e.className.split(' ')[0])+' "'+t+'"');
  });
  return {hOver:hOver, vOver:vOver, small:small.slice(0,8), smallN:small.length, btns:btns.slice(0,14)};
`;

(async () => {
  await requireServer();   // 서버가 없으면 감사는 '전부 통과'로 거짓말을 한다 — cdp.js requireServer 주석 참고
  const cdp = await launchWithRetry();
  const rows = [];
  for (const g of GAMES) {
    const page = await cdp.newPage(W, H);
    let r = {};
    try {
      await page.goto('http://localhost:3000/' + (g === 'index' ? '' : g + '.html'));
      await page.wait(900);
      r = await page.eval(PROBE);
    } catch (e) { r.err = e.message; }
    const errs = page.errors.filter(e => !/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
    rows.push({ g, ...r, errs });
    console.log(`\n=== ${g}  ${errs.length ? '❌ 에러 ' + errs.length : '✅ 에러0'}`);
    if (r.err) console.log('   실행실패: ' + r.err);
    else {
      console.log(`   넘침: 가로 ${r.hOver}px · 세로 ${r.vOver}px | 작은버튼 ${r.smallN}개`);
      if (r.smallN) console.log('   작은: ' + r.small.join(' | '));
      console.log('   버튼: ' + (r.btns || []).join(' | '));
    }
    errs.slice(0, 4).forEach(e => console.log('   ‼ ' + e.slice(0, 200)));
    await page.close();
  }
  await cdp.close();
  console.log('\n──── 요약 ────');
  rows.forEach(r => console.log(`${(r.errs && r.errs.length) ? '❌' : (r.hOver > 0 ? '⚠️' : '✅')} ${r.g.padEnd(12)} hOver=${r.hOver} vOver=${r.vOver} small=${r.smallN} err=${r.errs ? r.errs.length : '?'}`));
})();
