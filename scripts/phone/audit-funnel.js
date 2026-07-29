/**
 * 신규 유저 퍼널 계측 — "앱을 처음 켠 사람이 실제로 한 판 하기까지 몇 번 눌러야 하나".
 *
 * 기존 기기에는 튜토리얼 본 기록(alley_tut_*)·전적이 남아 있어 첫 방문 경험이 가려진다.
 * → localStorage를 비우고 진짜 첫 방문을 재현한다.
 *
 * 사용: node scripts/phone/audit-funnel.js [게임...]
 */
const { attach } = require('./phone-cdp');

const GAMES = [
  { g: 'kb', name: '너클본즈', start: '#startBtn' },
  { g: 'yacht', name: '요트 다이스', start: '#startLocal' },
  { g: 'yut', name: '윷놀이', start: '#startBtn' },
  { g: 'ld', name: '라이어', start: '#startBtn' },
  { g: 'onecard', name: '원카드', start: '#startBtn' },
  { g: 'seotda', name: '섯다', start: '#startBtn' },
];

/* 화면을 가리는 오버레이 — 유저 입장에서 '한 번 더 눌러야 하는 장벽'이다. */
const BLOCKERS = `
var out=[];
[].slice.call(document.querySelectorAll('div,section,aside')).forEach(function(el){
  var cs=getComputedStyle(el);
  if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return;
  if(cs.position!=='fixed'&&cs.position!=='absolute') return;
  var b=el.getBoundingClientRect();
  // 화면의 40% 이상을 덮는 떠 있는 요소만 = 진짜 장벽
  if(b.width*b.height < innerWidth*innerHeight*0.4) return;
  if(b.top>innerHeight||b.bottom<0) return;
  out.push({id:el.id||'', cls:(el.className||'').toString().slice(0,28), z:cs.zIndex,
            cover:Math.round(b.width*b.height/(innerWidth*innerHeight)*100)});
});
return out;
`;

/* 시작 버튼이 실제로 눌리는 위치에 있나 (함정 #21 — 문서 넘침 0이어도 버튼은 밖일 수 있다) */
const startVis = sel => `
var el=document.querySelector(${JSON.stringify(sel)});
if(!el) return {found:false};
var b=el.getBoundingClientRect();
var cs=getComputedStyle(el);
var mid=document.elementFromPoint(Math.round(b.left+b.width/2), Math.round(b.top+b.height/2));
return {found:true, visible:cs.display!=='none'&&cs.visibility!=='hidden',
        top:Math.round(b.top), bottom:Math.round(b.bottom), h:Math.round(b.height), w:Math.round(b.width),
        inView: b.top>=0 && b.bottom<=innerHeight,
        clickable: !!(mid && (mid===el||el.contains(mid))),
        blockedBy: mid&&!(mid===el||el.contains(mid)) ? (mid.id||mid.className||mid.tagName).toString().slice(0,30) : null};
`;

(async () => {
  const only = process.argv.slice(2);
  const games = only.length ? GAMES.filter(x => only.includes(x.g)) : GAMES;
  const p = await attach();

  console.log('\n=== 신규 유저 퍼널 (첫 방문 재현) ===\n');
  const rows = [];

  for (const G of games) {
    // 진짜 첫 방문: 저장소 비우기
    await p.goto('https://localhost/index.html');
    await p.eval('localStorage.clear(); sessionStorage.clear(); return 1');
    await p.goto(`https://localhost/${G.g}.html`);
    await p.wait(1500);

    const blockers = await p.eval(BLOCKERS);
    const sv = await p.eval(startVis(G.start));
    const over = await p.eval('return document.documentElement.scrollHeight-innerHeight');
    const title = await p.eval('document.title');

    // 오버레이를 닫는 데 몇 번 눌러야 하나
    let taps = 0;
    for (let i = 0; i < 4; i++) {
      const closed = await p.eval(`
        var sels=['#tutClose','#tutSkip','.tut-close','#helpClose','#rulesClose','#closeHelp','.ovclose'];
        for(var i=0;i<sels.length;i++){
          var el=document.querySelector(sels[i]);
          if(el&&el.offsetParent){ el.click(); return sels[i]; }
        }
        if(typeof TUT!=='undefined'&&TUT.close){ }
        return null;`);
      if (!closed) break;
      taps++;
      await p.wait(500);
    }
    const svAfter = await p.eval(startVis(G.start));

    rows.push({ ...G, blockers, sv, svAfter, over, taps, title });

    console.log(`▶ ${G.name} (${G.g}.html)`);
    console.log(`   첫 화면 가림막: ${blockers.length ? blockers.map(b => `${b.id || b.cls}(${b.cover}%)`).join(', ') : '없음'}`);
    console.log(`   가림막 닫는 탭: ${taps}회`);
    console.log(`   문서 넘침: ${over}px`);
    if (!sv.found) console.log(`   ⚠️ 시작 버튼(${G.start})을 못 찾음`);
    else {
      console.log(`   시작 버튼 (가림막 전): top=${sv.top} bottom=${sv.bottom} 화면안=${sv.inView ? 'O' : 'X'} 클릭가능=${sv.clickable ? 'O' : 'X'}${sv.blockedBy ? ' ← ' + sv.blockedBy + '가 가림' : ''}`);
      console.log(`   시작 버튼 (가림막 후): top=${svAfter.top} bottom=${svAfter.bottom} 화면안=${svAfter.inView ? 'O' : 'X'} 클릭가능=${svAfter.clickable ? 'O' : 'X'}${svAfter.blockedBy ? ' ← ' + svAfter.blockedBy : ''}`);
    }
    await p.shot(`out/phone/first-${G.g}.png`);
    console.log('');
  }

  console.log('=== 요약 ===');
  console.log('게임        가림막  닫기탭  시작버튼(첫진입)  시작버튼(닫은뒤)');
  rows.forEach(r => {
    const a = r.sv.found ? (r.sv.clickable ? '누를수있음' : (r.sv.inView ? '가려짐' : '화면밖')) : '없음';
    const b = r.svAfter.found ? (r.svAfter.clickable ? '누를수있음' : (r.svAfter.inView ? '가려짐' : '화면밖')) : '없음';
    console.log(`${r.name.padEnd(10)} ${String(r.blockers.length).padStart(4)}  ${String(r.taps).padStart(5)}   ${a.padEnd(14)}  ${b}`);
  });

  p.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
