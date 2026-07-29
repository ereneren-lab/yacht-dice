/**
 * 실기기 허브 화면 계측 — "첫 화면에서 유저가 무엇을 볼 수 있나"를 숫자로 잰다.
 *
 * 헤드리스 audit-ux는 게임 내부(셋업/인게임)를 보지만 허브의 '첫인상'은 아무도 안 쟀다.
 * 사용: node scripts/phone/audit-hub.js   (adb forward 선행)
 */
const { attach } = require('./phone-cdp');

const MEASURE = `
var vw=innerWidth, vh=innerHeight;
var r=function(el){var b=el.getBoundingClientRect();return {t:Math.round(b.top+scrollY),l:Math.round(b.left),w:Math.round(b.width),h:Math.round(b.height)};};

// 게임 카드 — 허브의 핵심 자산
var cards=[].slice.call(document.querySelectorAll('a[href$=".html"], .card, .gamecard'));
cards=cards.filter(function(c){return c.offsetWidth>100 && c.offsetHeight>40;});
var seen={}, list=[];
cards.forEach(function(c){
  var t=(c.querySelector('h2,h3,.name,.title')||{}).textContent||c.textContent||'';
  t=t.trim().split('\\n')[0].slice(0,20);
  var href=c.getAttribute('href')||'';
  if(seen[href+t]) return; seen[href+t]=1;
  var b=r(c); list.push({name:t, href:href, top:b.t, h:b.h});
});

// 첫 화면(above the fold)에 완전히 들어오는 카드 수
var fold=list.filter(function(c){return c.top+c.h<=vh;}).length;
var firstTop=list.length?list[0].top:null;

// 탭 타깃 — 44px 미만은 손가락으로 누르기 어렵다(WCAG 2.5.5 / Apple HIG)
var tappable=[].slice.call(document.querySelectorAll('button,a,input,select,[role=button],.chip,.tab'));
var small=[];
tappable.forEach(function(el){
  if(!el.offsetParent) return;
  var b=el.getBoundingClientRect();
  if(b.width<1||b.height<1) return;
  if(b.height<44||b.width<44){
    small.push({tag:el.tagName.toLowerCase(), id:el.id||'', cls:(el.className||'').toString().slice(0,30),
                txt:(el.textContent||'').trim().slice(0,14), w:Math.round(b.width), h:Math.round(b.height)});
  }
});

// 텍스트 크기 — 13px 미만은 폰에서 읽기 힘들다
var tiny=[];
[].slice.call(document.querySelectorAll('*')).forEach(function(el){
  if(el.children.length) return;
  var t=(el.textContent||'').trim(); if(!t) return;
  var fs=parseFloat(getComputedStyle(el).fontSize);
  if(fs<13) tiny.push({txt:t.slice(0,20), fs:fs});
});

return {
  vw:vw, vh:vh,
  docH:document.documentElement.scrollHeight,
  screens:+(document.documentElement.scrollHeight/vh).toFixed(1),
  cardCount:list.length,
  firstCardTop:firstTop,
  firstCardPct: firstTop==null?null:Math.round(firstTop/vh*100),
  cardsInFold:fold,
  cards:list,
  smallTargets:small.slice(0,25), smallCount:small.length,
  tinyText:tiny.slice(0,15), tinyCount:tiny.length
};
`;

(async () => {
  const p = await attach();
  await p.goto('https://localhost/index.html');
  await p.wait(1200);
  const m = await p.eval(MEASURE);

  console.log(`\n📱 뷰포트 ${m.vw}×${m.vh} · 문서 ${m.docH}px = ${m.screens}화면\n`);
  console.log(`게임 카드 ${m.cardCount}개`);
  console.log(`첫 카드 시작 y=${m.firstCardTop}px (첫 화면의 ${m.firstCardPct}% 지점)`);
  console.log(`첫 화면에 온전히 보이는 카드: ${m.cardsInFold}개\n`);

  console.log('게임별 스크롤 깊이 (몇 번째 화면에서 보이나)');
  m.cards.forEach((c, i) => {
    const scr = (c.top / m.vh).toFixed(1);
    console.log(`  ${String(i + 1).padStart(2)}. ${c.name.padEnd(12)} y=${String(c.top).padStart(5)} → ${scr}번째 화면  ${c.href}`);
  });

  console.log(`\n👆 44px 미만 탭 타깃: ${m.smallCount}개`);
  m.smallTargets.forEach(s => console.log(`   ${s.w}×${s.h}  <${s.tag}> ${s.id ? '#' + s.id : ''} "${s.txt}" .${s.cls}`));

  console.log(`\n🔤 13px 미만 텍스트: ${m.tinyCount}개`);
  m.tinyText.forEach(t => console.log(`   ${t.fs}px  "${t.txt}"`));

  await p.shot('out/phone/hub-fold.png');
  p.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
