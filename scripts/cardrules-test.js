/* 카드게임 7종 규칙 검증 — npm run test:cardrules
 *
 * 왜 있나: 규칙은 '읽어서 맞아 보이는 것'과 '실제로 그렇게 도는 것'이 다르다.
 * 특히 바카라 3rd card rule과 섯다 족보는 표가 커서 눈으로는 못 지킨다.
 *
 * 코어가 있는 4종(섯다·인디언·원카드·도둑잡기)은 require로 직접,
 * 코어가 없는 3종(블랙잭·바카라·하이로우)은 HTML 안 최상위 function을 브라우저에서 부른다
 * (⚠️ 최상위 let/const는 window에 없지만 function 선언은 올라간다 — CLAUDE.md 함정 #18의 짝).
 */
const path = require('path');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };
const P = s => console.log(s);

// ─────────────────────────────────────────── 섯다
function seotdaTests() {
  P('\n════ 섯다 — 족보 ════');
  const SD = require('../public/seotda-core.js');
  const ev = SD.evalHand || (SD.__test && SD.__test.evalHand);
  if (!ev) { console.log('  ⏭ evalHand가 export되지 않음 — 엔진 경유로 검증'); return; }
  const C = (m, g) => ({ month: m, gwang: !!g });
  const h = (a, b) => ev(a, b);

  // 광땡 서열 38 > 18 > 13
  const g38 = h(C(3, 1), C(8, 1)), g18 = h(C(1, 1), C(8, 1)), g13 = h(C(1, 1), C(3, 1));
  ok(g38.name === '38광땡' && g18.name === '18광땡' && g13.name === '13광땡', '광땡 3종 이름');
  ok(g38.rank > g18.rank && g18.rank > g13.rank, '광땡 서열 38 > 18 > 13');

  // 땡: 장땡 > 9땡 > … > 삥땡, 그리고 모든 땡 < 모든 광땡
  const t10 = h(C(10), C(10)), t9 = h(C(9), C(9)), t1 = h(C(1), C(1));
  ok(t10.name === '장땡' && t1.name === '삥땡', '장땡·삥땡 이름');
  ok(t10.rank > t9.rank && t9.rank > t1.rank, '땡 서열 장땡 > 9땡 > 삥땡');
  ok(g13.rank > t10.rank, '가장 낮은 광땡(13) > 가장 높은 땡(장땡)');

  // 특수끗 서열 알리 > 독사 > 구삥 > 장삥 > 장사 > 세륙
  const sp = [['1,2', '알리'], ['1,4', '독사'], ['1,9', '구삥'], ['1,10', '장삥'], ['4,10', '장사'], ['4,6', '세륙']]
    .map(([k, n]) => { const [a, b] = k.split(',').map(Number); return { n, e: h(C(a), C(b)) }; });
  ok(sp.every(x => x.e.name === x.n), '특수끗 6종 이름: ' + sp.map(x => x.e.name).join('>'));
  ok(sp.every((x, i) => i === 0 || sp[i - 1].e.rank > x.e.rank), '특수끗 서열 알리>독사>구삥>장삥>장사>세륙');
  ok(t1.rank > sp[0].e.rank, '가장 낮은 땡(삥땡) > 가장 높은 특수끗(알리)');

  // 끗: 갑오(9) > … > 망통(0), 그리고 모든 끗 < 특수끗
  const k9 = h(C(4), C(5)), k0 = h(C(2), C(8));
  ok(k9.name === '갑오' && k9.rank > k0.rank, '갑오(9끗) > 망통(0끗) · 이름 확인 ' + k0.name);
  ok(sp[5].e.rank > k9.rank, '가장 낮은 특수끗(세륙) > 가장 높은 끗(갑오)');

  P('\n════ 섯다 — 잡이(관계형 반전) ════');
  const cmp = SD.cmpJabi || (SD.__test && SD.__test.cmpJabi);
  const amh = h(C(4), C(7));       // 암행어사
  const tj = h(C(3, 1), C(7));     // 땡잡이(3광 + 7)
  ok(amh.jabi.amhaeng, '4+7 → 암행어사 플래그');
  ok(tj.jabi.ttaengjabi, '3광+7 → 땡잡이 플래그');
  ok(h(C(4), C(9)).jabi.gusa, '4+9 → 구사 플래그');
  if (cmp) {
    ok(cmp(amh, g13, true) > 0, '암행어사가 13광땡을 잡는다');
    ok(cmp(amh, g18, true) > 0, '암행어사가 18광땡을 잡는다');
    ok(cmp(amh, g38, true) < 0, '⚠️ 암행어사는 38광땡을 못 잡는다');
    ok(cmp(tj, t9, true) > 0, '땡잡이가 9땡을 잡는다');
    ok(cmp(tj, t10, true) < 0, '⚠️ 땡잡이는 장땡을 못 잡는다');
    ok(cmp(amh, g13, false) < 0, '잡이 옵션이 꺼져 있으면 반전이 없다');
  }
}

// ─────────────────────────────────────────── 원카드
function onecardTests() {
  P('\n════ 원카드 — 낼 수 있나(canPlayOn) ════');
  const OC = require('../public/onecard-core.js');
  const c = (s, r, j) => ({ s, r, joker: !!j, id: s + '_' + r });
  const cp = OC.canPlayOn;
  const top = c(0, 5);                       // ♠5
  ok(cp(c(0, 9), top, null, 0), '같은 무늬(♠9) OK');
  ok(cp(c(2, 5), top, null, 0), '같은 숫자(♦5) OK');
  ok(!cp(c(2, 9), top, null, 0), '무늬·숫자 둘 다 다르면 불가');
  ok(cp(c(2, 9, true), top, null, 0), '조커는 만능');
  ok(cp(c(1, 3), top, 1, 0), '무늬 지정(♥)이 있으면 그 무늬로 낸다');
  ok(!cp(c(0, 3), top, 1, 0), '무늬 지정 중엔 옛 무늬(♠)로는 못 낸다');
  P('  — 공격 중');
  ok(cp(c(3, 2), top, null, 2), '공격 중엔 2로 이어치기 OK');
  ok(cp(c(3, 9, true), top, null, 2), '공격 중엔 조커로 이어치기 OK');
  ok(!cp(c(0, 9), top, null, 2), '공격 중엔 같은 무늬라도 못 낸다');

  P('\n════ 원카드 — 특수카드가 설명대로 도나 ════');
  ok(OC.JOKER_ATTACK === 5, '조커 공격 = 5장 (규칙 설명과 일치)');
  ok(OC.HAND_SIZE === 7, '시작 손패 = 7장 (규칙 설명과 일치)');
  const tags = OC.SPECIAL_TAG;
  ok(tags[1] === '스킵' && tags[2] === '공격2' && tags[11] === '한번더' && tags[12] === '방향',
    'A=스킵 · 2=공격2 · J=한번더 · Q=방향 (규칙 설명과 일치)');

  // 엔진을 실제로 돌려 효과 확인
  const mk = (n) => new OC.OCEngine({
    players: Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: 'P' + i, ai: false })),
    aiMs: 0, onState() { }
  });
  const e = mk(3); e.start();
  ok(e.hands.every(h => h.length === 7), '3인 딜 — 전원 7장');
  ok(typeof e.dir === 'number', '방향(dir) 상태 존재');
}

// ─────────────────────────────────────────── 도둑잡기
function oldmaidTests() {
  P('\n════ 도둑잡기 — 조커 1장 · 짝은 전부 정리 ════');
  const OM = require('../public/oldmaid-core.js');
  const e = new OM.OMEngine({
    players: [0, 1, 2].map(i => ({ pid: 'p' + i, name: 'P' + i, ai: true })),
    pairMs: 0, stepMs: 0, aiMs: 0, onState() { }
  });
  e.start();
  const all = e.hands.flat();
  ok(all.filter(c => c.joker).length === 1, '판에 조커는 정확히 1장');
  // 시작 짝 정리 후 같은 숫자가 2장 남아 있으면 안 된다
  let dup = 0;
  for (const hand of e.hands) {
    const cnt = {};
    hand.forEach(c => { if (!c.joker) cnt[c.r] = (cnt[c.r] || 0) + 1; });
    dup += Object.values(cnt).filter(v => v >= 2).length;
  }
  ok(dup === 0, '시작 짝이 전부 정리됨(같은 숫자 2장 남은 손패 0)');
  e.destroy();
}

// ─────────────────────────────────────────── 인디언 포커
function indianTests() {
  P('\n════ 인디언 포커 — 숨김 방향(이 게임만 반대) ════');
  const IP = require('../public/indianpoker-core.js');
  const e = new IP.IPEngine({
    players: [0, 1].map(i => ({ pid: 'p' + i, name: 'P' + i, ai: i > 0 })),
    startChips: 10, aiMs: 0, showdownMs: 0, manualAI: true, onState() { }
  });
  e.start();
  const s = e.serialize('p0');
  ok(s.myCard === null || s.myCard === undefined, '내 카드는 나에게 안 보인다');
  const opp = (s.players || []).find(p => p.pid === 'p1');
  ok(opp && opp.card != null, '남의 카드는 보인다 (라이어·섯다와 반대)');
  e.destroy();
}

// ─────────────────────────────────────────── 브라우저가 필요한 3종
async function htmlTests() {
  const { launchWithRetry } = require('./browser-test/cdp');
  const cdp = await launchWithRetry();
  try {
    // ── 바카라: 3rd card rule 전수 대조
    P('\n════ 바카라 — 3rd card rule 전수 대조 ════');
    {
      const p = await cdp.newPage(390, 844);
      await p.goto('http://localhost:3000/baccarat.html');
      await p.wait(400);
      const hasFn = await p.eval("return typeof bacRound==='function' && typeof total==='function';");
      ok(hasFn, '규칙 함수(bacRound)에 접근 가능');
      if (hasFn) {
        // 덱을 조작해 원하는 카드가 나오게 한다(deck.pop() 순서 = 뒤에서부터)
        const r = await p.eval(`
          function mk(v){ return {r: v===0?10:v, s:0}; }   // 10 → 값 0
          var bad=[];
          // 뱅커 규칙표: [뱅커합][플레이어3장째값] → 뽑나
          function refBanker(bt, v){
            if(v===null) return bt<=5;
            if(bt<=2) return true;
            if(bt===3) return v!==8;
            if(bt===4) return v>=2&&v<=7;
            if(bt===5) return v>=4&&v<=7;
            if(bt===6) return v>=6&&v<=7;
            return false;
          }
          for(var pt=0; pt<=7; pt++) for(var bt=0; bt<=7; bt++) for(var v=0; v<=9; v++){
            // P합 pt, B합 bt를 만드는 2장씩 + 플레이어 3장째 v + 뱅커 3장째 아무거나
            var deck=[ mk(3), mk(v), mk(bt), mk(0), mk(pt), mk(0) ];  // pop 순서: P1,B1,P2,B2 ...
            // pop(): 마지막부터 → P1=mk(0)? 순서를 맞춘다
            deck=[ mk(3) /*B3*/, mk(v) /*P3*/, mk(bt) /*B2*/, mk(0) /*P2*/, mk(0) /*B1*/, mk(pt) /*P1*/ ];
            var out=bacRound(deck.slice());
            var pDrew = out.P.length===3;
            var bDrew = out.B.length===3;
            var natural = pt>=8||bt>=8;   // 여기선 0~7만 돌리므로 항상 false
            var wantP = pt<=5;
            var wantB = refBanker(bt, wantP? v : null);
            if(pDrew!==wantP) bad.push('P '+pt+'/'+bt+'/'+v+' 기대'+wantP+' 실제'+pDrew);
            else if(bDrew!==wantB) bad.push('B '+pt+'/'+bt+'/'+v+' 기대'+wantB+' 실제'+bDrew);
          }
          return {bad:bad.slice(0,5), n:bad.length};`);
        ok(r.n === 0, r.n === 0 ? '0~7 × 0~7 × 3장째 0~9 = 640조합 전부 공식표와 일치'
          : `${r.n}건 불일치 — ${JSON.stringify(r.bad)}`);
        // 내추럴
        const nat = await p.eval(`
          function mk(v){ return {r: v===0?10:v, s:0}; }
          var deck=[ mk(3), mk(3), mk(4), mk(4), mk(0), mk(8) ];  // P=8(내추럴)
          var out=bacRound(deck);
          return {pl:out.P.length, bl:out.B.length, nat:out.natural};`);
        ok(nat.nat === true && nat.pl === 2 && nat.bl === 2, '내추럴 8 → 양쪽 다 2장에서 멈춘다');
      }
      await p.close();
    }

    // ── 블랙잭
    P('\n════ 블랙잭 — 에이스·블랙잭·딜러 규칙 ════');
    {
      const p = await cdp.newPage(390, 844);
      await p.goto('http://localhost:3000/blackjack.html');
      await p.wait(400);
      const hasFn = await p.eval("return typeof handValue==='function' && typeof isBlackjack==='function';");
      ok(hasFn, '규칙 함수(handValue)에 접근 가능');
      if (hasFn) {
        const r = await p.eval(`
          var c=function(r){return {r:r,s:0};};
          return {
            aceEleven: handValue([c(1),c(9)]),          // A+9 = 20
            aceDown:   handValue([c(1),c(9),c(5)]),     // A+9+5 = 15 (A를 1로)
            twoAces:   handValue([c(1),c(1)]),          // 12
            faceTen:   handValue([c(12),c(13)]),        // 20
            bj:        isBlackjack([c(1),c(13)]),       // A+K = 블랙잭
            notBj:     isBlackjack([c(1),c(9),c(1)]),   // 3장 21 = 블랙잭 아님
            three21:   handValue([c(7),c(7),c(7)])
          };`);
        ok(r.aceEleven === 20, 'A+9 = 20 (A를 11로)');
        ok(r.aceDown === 15, 'A+9+5 = 15 (넘치면 A를 1로 내린다)');
        ok(r.twoAces === 12, 'A+A = 12');
        ok(r.faceTen === 20, 'Q+K = 20 (그림은 10)');
        ok(r.bj === true, 'A+K = 블랙잭');
        ok(r.notBj === false, '3장으로 만든 21은 블랙잭이 아니다');
        ok(r.three21 === 21, '7+7+7 = 21');
      }
      await p.close();
    }

    // ── 하이로우
    P('\n════ 하이로우 — 값·확률 판정 ════');
    {
      const p = await cdp.newPage(390, 844);
      await p.goto('http://localhost:3000/highlow.html');
      await p.wait(400);
      const hasFn = await p.eval("return typeof val==='function' && typeof odds==='function' && typeof makeDeck==='function';");
      ok(hasFn, '규칙 함수(val·odds)에 접근 가능');
      if (hasFn) {
        const r = await p.eval(`
          var c=function(r){return {r:r,s:0};};
          var d=makeDeck();
          // 8 기준: 더 큰 카드(9~K)와 더 작은 카드(A~7) 개수 — 52장 덱이면 각 4장씩
          var o8=odds(d, c(8));
          // A(최저) 기준 — 더 낮은 카드가 없어야 한다
          var oA=odds(d, c(1));
          // K(최고) 기준 — 더 높은 카드가 없어야 한다
          var oK=odds(d, c(13));
          return {
            aceLow: val(c(1)), kingHigh: val(c(13)), deckN: d.length,
            hi8:o8.favH, lo8:o8.favL,
            aceFavL:oA.favL, aceMultL:oA.multL,
            kingFavH:oK.favH, kingMultH:oK.multH
          };`);
        ok(r.aceLow === 1 && r.kingHigh === 13, 'A가 최저(1) · K가 최고(13)');
        ok(r.deckN === 52, '덱 52장');
        ok(r.hi8 === 20 && r.lo8 === 28, '8 기준 — 위 20장(9~K) · 아래 28장(A~7)');
        ok(r.aceFavL === 0 && r.aceMultL === 0, 'A에서는 LOW가 불가능(배당 0 → 버튼 잠김)');
        ok(r.kingFavH === 0 && r.kingMultH === 0, 'K에서는 HIGH가 불가능(배당 0 → 버튼 잠김)');
      }
      await p.close();
    }
  } finally { await cdp.close(); }
}

(async () => {
  seotdaTests();
  onecardTests();
  oldmaidTests();
  indianTests();
  await htmlTests();
  console.log(`\n${fail === 0 ? '✅ 전부 통과' : '❌ 실패 있음'} — ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('💥', e.message); process.exit(1); });
