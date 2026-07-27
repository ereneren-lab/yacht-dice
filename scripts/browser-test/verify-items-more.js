/**
 * 아이템전 5종 검증 — 라이어 '훔쳐보기' · 좌중우 '칩 지키기' · 섯다 '한 장 다시'
 *                      · 알까기 '한 번 더 튕기기' · 인디언 포커 '내 카드 보기'.
 *  ① 아이템전을 끄면 버튼이 아예 안 보인다
 *  ② 켜면 버튼이 남은 개수와 함께 보인다
 *  ③ 누르면 개수가 줄고 효과가 실제로 반영된다
 *  ④ 다 쓰면 버튼이 사라진다
 *  ⑤ 콘솔 에러가 없다
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/verify-items-more.js
 */
const { launchWithRetry } = require('./cdp');

let fails = 0;
const bad = m => { fails++; console.log('   ❌ ' + m); };
const ok = m => console.log('   ✅ ' + m);

// 첫 방문 튜토리얼이 떠 있으면 시작 버튼을 가린다 → 먼저 닫는다
const CLOSE_TUT = `try{ if(window.TUT) TUT.close();
  var t=document.getElementById('tutOverlay'); if(t) t.classList.remove('on');
  var c=document.querySelector('#helpClose,#rulesClose'); if(c&&c.offsetParent) c.click();
}catch(e){} return true;`;

(async () => {
  const cdp = await launchWithRetry();

  /* ───────────── 라이어 다이스 — 훔쳐보기 ───────────── */
  console.log('\n=== 라이어 다이스 · 훔쳐보기 ===');
  for (const on of [false, true]) {
    const p = await cdp.newPage(430, 900);
    try {
      await p.goto('http://localhost:3000/ld.html');
      await p.wait(900); await p.eval(CLOSE_TUT); await p.wait(200);
      if (on) await p.eval(`var _S=(typeof S!=='undefined')?S:null;document.getElementById('itemsToggle').click(); return true;`);
      const armed = await p.eval(`var _S=(typeof S!=='undefined')?S:null;return document.getElementById('itemsToggle').classList.contains('on');`);
      if (armed !== on) bad(`ld: 토글 상태가 ${armed} (기대 ${on})`);
      await p.click('#startBtn'); await p.wait(1800);

      const s1 = await p.eval(`var _S=(typeof S!=='undefined')?S:null;var b=document.getElementById('itemPeek');
        return { has:!!b, txt:b?b.textContent:'', itemsOn:!!(_S&&_S.itemsOn) };`);
      if (!on) {
        if (s1.has) bad('ld: 아이템전을 껐는데 훔쳐보기 버튼이 보인다'); else ok('꺼짐 → 버튼 없음');
      } else {
        if (!s1.has) { bad('ld: 켰는데 훔쳐보기 버튼이 없다 (내 차례가 아닐 수 있음)'); }
        else {
          ok('켜짐 → 버튼 "' + s1.txt.trim() + '"');
          /* ld는 S가 IIFE 안이라 CDP에서 변수로 못 읽는다 → 사용자가 실제로 보는 DOM으로 단언한다.
             (이게 더 정직한 검증이기도 하다 — 화면에 안 나오면 실패여야 한다) */
          const n0 = +(s1.txt.match(/\((\d+)\)/) || [])[1];
          await p.click('#itemPeek'); await p.wait(800);
          const after = await p.eval(`var b=document.getElementById('itemPeek');
            var info=document.getElementById('peekInfo');
            return { txt:b?b.textContent:'', info: info?info.textContent.trim():'' };`);
          const n1 = +(after.txt.match(/\((\d+)\)/) || [])[1];
          if (!(n1 === n0 - 1)) bad(`ld: 눌렀는데 남은 개수가 ${n0}→${isNaN(n1) ? '(버튼 사라짐)' : n1}`);
          else ok(`사용 → 남은 개수 ${n0}→${n1}`);
          if (!after.info || !/의/.test(after.info)) bad('ld: 훔쳐본 결과가 화면에 안 나온다 (#peekInfo)');
          else ok('결과가 화면에 표시됨 — "' + after.info + '"');
        }
      }
      const errs = p.errors.filter(e => !/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
      if (errs.length) bad('ld 콘솔 에러: ' + errs[0].slice(0, 140));
    } catch (e) { bad('ld 예외: ' + e.message.slice(0, 110)); }
    await p.close();
  }

  /* ───────────── 좌·중·우 — 칩 지키기 ───────────── */
  console.log('\n=== 좌·중·우 · 칩 지키기 ===');
  for (const on of [false, true]) {
    const p = await cdp.newPage(430, 900);
    try {
      await p.goto('http://localhost:3000/lcr.html');
      await p.wait(900); await p.eval(CLOSE_TUT); await p.wait(200);
      if (on) await p.eval(`var _S=(typeof S!=='undefined')?S:null;document.querySelector('#optItems .opt[data-items="1"]').click(); return true;`);
      await p.click('#startBtn'); await p.wait(1500);

      const s1 = await p.eval(`var _S=(typeof S!=='undefined')?S:null;var b=document.getElementById('itemShield');
        return { shown: !!b && getComputedStyle(b).display!=='none', txt:b?b.textContent:'',
                 itemsOn:!!(_S&&_S.itemsOn), items:(_S&&_S.items)?S.items.slice():null };`);
      if (!on) {
        if (s1.shown) bad('lcr: 껐는데 칩 지키기 버튼이 보인다'); else ok('꺼짐 → 버튼 숨김');
      } else {
        if (!s1.shown) bad('lcr: 켰는데 버튼이 안 보인다 (내 차례가 아닐 수 있음)');
        else {
          ok('켜짐 → 버튼 "' + s1.txt.trim() + '"');
          // lcr도 S가 IIFE 안이라 DOM으로 단언한다
          const n0 = +(s1.txt.match(/\((\d+)\)/) || [])[1];
          await p.click('#itemShield'); await p.wait(600);
          const s2 = await p.eval(`var b=document.getElementById('itemShield');
            return { txt:b?b.textContent:'', disabled: b?!!b.disabled:false };`);
          if (!/켜짐/.test(s2.txt)) bad(`lcr: 예약이 화면에 반영되지 않았다 — 버튼이 "${s2.txt.trim()}"`);
          else ok('예약됨 → "' + s2.txt.trim() + '" (개수 ' + n0 + '개에서 1 소모)');
          if (!s2.disabled) bad('lcr: 예약 후에도 버튼이 또 눌린다(중복 소모 위험)');
          else ok('중복 예약 차단됨');
          // 굴린 뒤 예약이 해제되어 버튼이 다시 '칩 지키기 (n-1)'로 돌아오나
          await p.click('#rollBtn'); await p.wait(1200);
          const s3 = await p.eval(`var b=document.getElementById('itemShield');
            var log=document.getElementById('rolllog');
            return { txt:b?b.textContent:'(버튼없음)', shown:b?getComputedStyle(b).display!=='none':false,
                     log:log?log.textContent.trim().slice(0,80):'' };`);
          if (/켜짐/.test(s3.txt)) bad('lcr: 굴린 뒤에도 예약이 남아 있다');
          else ok('굴린 뒤 예약 해제됨');
          console.log('   · 굴림 기록: ' + (s3.log || '(없음)'));
        }
      }
      const errs = p.errors.filter(e => !/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
      if (errs.length) bad('lcr 콘솔 에러: ' + errs[0].slice(0, 140));
    } catch (e) { bad('lcr 예외: ' + e.message.slice(0, 110)); }
    await p.close();
  }

  /* ───────────── 섯다 — 한 장 다시 ───────────── */
  console.log('\n=== 섯다 · 한 장 다시 (로컬 전용) ===');
  for (const on of [false, true]) {
    const p = await cdp.newPage(430, 900);
    try {
      await p.goto('http://localhost:3000/seotda.html');
      await p.wait(900); await p.eval(CLOSE_TUT); await p.wait(200);
      if (on) await p.eval(`var _S=(typeof S!=='undefined')?S:null;document.querySelector('#optRules .opt[data-r="itemsOn"]').click(); return true;`);
      await p.click('#startBtn'); await p.wait(2600);

      const s1 = await p.eval(`var _S=(typeof S!=='undefined')?S:null;
        var btns=[].filter.call(document.querySelectorAll('#betbar .bbtn'),function(b){return /다시/.test(b.textContent)});
        return { n:btns.length, txt:btns[0]?btns[0].textContent:'',
                 itemsOn:!!(_S&&_S.itemsOn), items:(_S&&_S.items)?S.items.slice():null,
                 turn:(_S||{}).turn, phase:(_S||{}).phase };`);
      if (!on) {
        if (s1.n) bad('섯다: 껐는데 "한 장 다시" 버튼이 있다'); else ok('꺼짐 → 버튼 없음');
      } else {
        if (!s1.itemsOn) bad('섯다: itemsOn이 엔진에 전달되지 않았다');
        else ok('itemsOn 전달됨 · items=' + JSON.stringify(s1.items));
        if (!s1.n) console.log('   · 버튼 미표시 (지금 내 차례가 아님 · phase=' + s1.phase + ' turn=' + s1.turn + ')');
        else {
          ok('버튼 "' + s1.txt.trim() + '"');
          const before = await p.eval(`var _S=(typeof S!=='undefined')?S:null;return { items:(_S&&_S.items)?S.items.slice():null,
            cards:JSON.stringify((((_S||{}).players||[])[0]||{}).cards||null) };`);
          await p.eval(`var _S=(typeof S!=='undefined')?S:null;var b=[].filter.call(document.querySelectorAll('#betbar .bbtn'),function(x){return /다시/.test(x.textContent)})[0]; b.click(); return true;`);
          await p.wait(700);
          const after = await p.eval(`var _S=(typeof S!=='undefined')?S:null;return { items:(_S&&_S.items)?S.items.slice():null,
            cards:JSON.stringify((((_S||{}).players||[])[0]||{}).cards||null) };`);
          if (after.items && before.items && after.items[0] >= before.items[0]) bad('섯다: 개수가 안 줄었다');
          else ok(`개수 ${before.items[0]}→${after.items[0]}`);
          if (after.cards === before.cards) bad('섯다: 패가 안 바뀌었다');
          else ok('패가 바뀌었다');
        }
      }
      const errs = p.errors.filter(e => !/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
      if (errs.length) bad('섯다 콘솔 에러: ' + errs[0].slice(0, 140));
    } catch (e) { bad('섯다 예외: ' + e.message.slice(0, 110)); }
    await p.close();
  }

  /* ───────────── 알까기 — 한 번 더 튕기기 ───────────── */
  console.log('\n=== 알까기 · 한 번 더 튕기기 ===');
  for (const on of [false, true]) {
    const p = await cdp.newPage(430, 900);
    try {
      await p.goto('http://localhost:3000/alkkagi.html');
      await p.wait(1100); await p.eval(CLOSE_TUT); await p.wait(250);
      if (on) await p.eval(`document.querySelector('#optItems .opt[data-items="1"]').click(); return true;`);
      await p.click('#startBtn'); await p.wait(2000);
      const s1 = await p.eval(`var b=document.getElementById('itemExtra');
        return { shown: !!b && getComputedStyle(b).display!=='none', txt:b?b.textContent:'' };`);
      if (!on) {
        if (s1.shown) bad('알까기: 껐는데 버튼이 보인다'); else ok('꺼짐 → 버튼 숨김');
      } else if (!s1.shown) bad('알까기: 켰는데 버튼이 안 보인다');
      else {
        ok('켜짐 → 버튼 "' + s1.txt.trim() + '"');
        const n0 = +(s1.txt.match(/\((\d+)\)/) || [])[1];
        await p.click('#itemExtra'); await p.wait(600);
        const s2 = await p.eval(`var b=document.getElementById('itemExtra');
          return { txt:b.textContent, dis:!!b.disabled };`);
        if (!/예약됨/.test(s2.txt)) bad(`알까기: 예약이 화면에 안 반영됨 — "${s2.txt.trim()}"`);
        else ok(`예약됨 → "${s2.txt.trim()}" (개수 ${n0}에서 1 소모)`);
        if (!s2.dis) bad('알까기: 예약 후에도 또 눌린다(중복 소모)'); else ok('중복 예약 차단됨');
      }
      const errs = p.errors.filter(e => !/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
      if (errs.length) bad('알까기 콘솔 에러: ' + errs[0].slice(0, 140));
    } catch (e) { bad('알까기 예외: ' + e.message.slice(0, 110)); }
    await p.close();
  }

  /* ───────────── 인디언 포커 — 내 카드 보기 ─────────────
     이 게임만 숨김정보가 거꾸로다(남의 카드는 다 보이고 내 것만 안 보임).
     그래서 단언도 반대로 한다 — 아이템을 쓰면 '내 카드'가 앞면이 되어야 한다. */
  console.log('\n=== 인디언 포커 · 내 카드 보기 ===');
  for (const on of [false, true]) {
    const p = await cdp.newPage(430, 900);
    try {
      await p.goto('http://localhost:3000/indianpoker.html');
      await p.wait(900); await p.eval(CLOSE_TUT); await p.wait(200);
      if (on) await p.eval(`document.querySelector('#optItems .opt[data-items="1"]').click(); return true;`);
      await p.click('#startBtn'); await p.wait(1500);

      // 남의 카드는 판이 깔리면 늘 보여야 한다(이 게임의 핵심)
      const opp = await p.eval(`return document.querySelectorAll('#opps .fc:not(.back)').length;`);
      if (!opp) bad('인디언: 상대 카드가 안 보인다(이 게임은 남의 카드가 보여야 한다)');
      else ok('상대 카드 ' + opp + '장 공개됨');

      const s1 = await p.eval(`var b=document.getElementById('itemPeek');
        return { has:!!b, txt:b?b.textContent:'', myBack: !!document.querySelector('#mine .fc.back') };`);
      if (!s1.myBack) bad('인디언: 아이템 쓰기 전인데 내 카드가 앞면이다');
      if (!on) {
        if (s1.has) bad('인디언: 껐는데 "내 카드 보기" 버튼이 보인다'); else ok('꺼짐 → 버튼 없음');
      } else if (!s1.has) {
        bad('인디언: 켰는데 버튼이 없다 (내 차례가 아닐 수 있음)');
      } else {
        ok('켜짐 → 버튼 "' + s1.txt.trim() + '"');
        const n0 = +(s1.txt.match(/\((\d+)\)/) || [])[1];
        await p.click('#itemPeek'); await p.wait(700);
        const s2 = await p.eval(`var b=document.getElementById('itemPeek');
          var mine=document.querySelector('#mine .fc'); var hint=document.querySelector('#mine .myhint');
          return { still:!!b, face: mine?!mine.classList.contains('back'):false,
                   num: mine?(mine.querySelector('.num')||{}).textContent||'':'',
                   hint: hint?hint.textContent.trim():'' };`);
        if (!s2.face) bad('인디언: 아이템을 썼는데 내 카드가 그대로 뒷면이다');
        else ok('내 카드가 공개됨 — ' + s2.num + ' · "' + s2.hint + '"');
        if (s2.still) bad('인디언: 한 판에 두 번 쓸 수 있다(버튼이 남아 있음)');
        else ok(`한 판 1회 제한 — 버튼 사라짐 (${n0}개에서 1 소모)`);
      }
      const errs = p.errors.filter(e => !/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
      if (errs.length) bad('인디언 콘솔 에러: ' + errs[0].slice(0, 140));
    } catch (e) { bad('인디언 예외: ' + e.message.slice(0, 110)); }
    await p.close();
  }

  /* ───────────── 원카드 — 공격 막기 ─────────────
     🛡은 '공격이 쌓였고 + 내 차례 + 이어칠 2·조커가 없을 때'만 뜬다. 그냥 두면
     한 판에 몇 번 올까 말까 한 상태라 자연 플레이로는 표본이 안 잡힌다
     (함정 #16: 표본을 못 모은 것과 단언이 깨진 것은 다른 사건이다 — 여기선 아예
      "판정 불가"가 되어 통과로 위장될 위험이 있다).
     → 엔진을 직접 그 상태로 세워놓고 검증한다. 화이트박스지만 **엔진이 실제로 돌린
       상태**라서 규칙을 우회하지는 않는다. AI 타이머는 manualAI로 멈춰 상태를 고정한다. */
  console.log('\n=== 원카드 · 공격 막기 ===');
  // 공격 5장이 쌓였고 내 손엔 이어칠 카드(2·조커)가 없는 상태로 엔진을 세운다
  const OC_FORCE = `
    engine.manualAI = true;                    // AI 타이머 정지 — 상태를 고정한다
    engine.attack = 5; engine.turn = 0; engine.pendingDrawn = null;
    engine.hands[0] = engine.hands[0].filter(function(c){ return !(c.joker || c.r === 2); });
    if (!engine.hands[0].length) engine.hands[0] = [{r:7,s:0,joker:false,id:900}];
    engine._emit();
    return { hand: engine.hands[0].length, attack: engine.attack };`;

  for (const on of [false, true]) {
    const p = await cdp.newPage(430, 900);
    try {
      await p.goto('http://localhost:3000/onecard.html');
      await p.wait(900); await p.eval(CLOSE_TUT); await p.wait(200);
      if (on) await p.eval(`document.querySelector('#optItems .opt[data-items="1"]').click(); return true;`);
      await p.click('#startBtn'); await p.wait(1400);

      const base = await p.eval(`return { itemsOn: !!(S&&S.itemsOn), items: S?S.items.slice():null,
                                          hand: S?S.myHand.length:0 };`);
      if (on) {
        // 전원 같은 개수 지급 (돈으로 유리해지지 않게 — 5종 공통 규약)
        const uniq = Array.from(new Set(base.items || []));
        if (!base.itemsOn) bad('원카드: itemsOn이 엔진에 전달되지 않았다');
        else if (uniq.length !== 1 || uniq[0] !== 2) bad('원카드: 지급이 불균등하거나 2개가 아니다 — ' + JSON.stringify(base.items));
        else ok('전원 동일 지급 · items=' + JSON.stringify(base.items));
      } else {
        if (base.items && base.items.some(x => x !== 0)) bad('원카드: 껐는데 아이템이 지급됐다 — ' + JSON.stringify(base.items));
        else ok('꺼짐 → 지급 0');
      }

      const f = await p.eval(OC_FORCE); await p.wait(300);
      const s1 = await p.eval(`var b=document.getElementById('shieldBtn');
        return { has: !!b, txt: b?b.textContent:'', attack: S?S.attack:0, canShield: S?S.canShield:false };`);

      if (!on) {
        if (s1.has) bad('원카드: 아이템전을 껐는데 🛡 버튼이 보인다'); else ok('꺼짐 → 공격 5장이 쌓여도 버튼 없음');
      } else if (!s1.has) {
        bad(`원카드: 켰는데 🛡 버튼이 없다 (attack=${s1.attack} canShield=${s1.canShield})`);
      } else {
        ok('공격 ' + s1.attack + '장 상황 → 버튼 "' + s1.txt.trim() + '"');
        const before = { hand: f.hand, items: (await p.eval(`return S.items.slice();`)) };
        await p.click('#shieldBtn'); await p.wait(500);
        const s2 = await p.eval(`return { attack:S.attack, items:S.items.slice(), hand:S.myHand.length,
                                          turn:S.turn, shield:S.lastShield?S.lastShield.blocked:null,
                                          btn: !!document.getElementById('shieldBtn') };`);
        if (s2.attack !== 0) bad(`원카드: 🛡을 썼는데 공격이 남아 있다 (${s2.attack}장)`);
        else ok('공격 스택 5 → 0');
        // 핵심 — 막았으면 카드를 먹지 않아야 한다. 여기가 '받기'와 갈리는 지점이다.
        if (s2.hand !== before.hand) bad(`원카드: 🛡을 썼는데 카드를 먹었다 (${before.hand}→${s2.hand}장)`);
        else ok(`카드를 먹지 않음 (${s2.hand}장 그대로)`);
        if (!(s2.items[0] === before.items[0] - 1)) bad(`원카드: 개수가 안 줄었다 (${before.items[0]}→${s2.items[0]})`);
        else ok(`남은 개수 ${before.items[0]}→${s2.items[0]}`);
        if (s2.turn === 0) bad('원카드: 🛡을 썼는데 차례가 안 넘어갔다');
        else ok('차례가 다음 사람에게 넘어감 (seat ' + s2.turn + ')');
        if (s2.shield !== 5) bad('원카드: lastShield.blocked가 5가 아니다 — ' + s2.shield);
        else ok('연출용 lastShield 기록됨 (blocked=5)');

        // 두 번째 사용 → 0개가 되고, 그 다음엔 버튼이 사라져야 한다
        await p.eval(OC_FORCE); await p.wait(300);
        await p.click('#shieldBtn').catch(() => {}); await p.wait(500);
        const s3 = await p.eval(`return { items:S.items.slice() };`);
        if (s3.items[0] !== 0) bad(`원카드: 두 번째 사용 후 0이 아니다 (${s3.items[0]})`);
        else ok('두 번째 사용 → 0개');
        await p.eval(OC_FORCE); await p.wait(300);
        const s4 = await p.eval(`return { btn: !!document.getElementById('shieldBtn'), canShield:S.canShield };`);
        if (s4.btn) bad('원카드: 다 썼는데 🛡 버튼이 남아 있다');
        else ok('다 쓰면 버튼 사라짐');
      }
      const errs = p.errors.filter(e => !/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
      if (errs.length) bad('원카드 콘솔 에러: ' + errs[0].slice(0, 140));
    } catch (e) { bad('원카드 예외: ' + e.message.slice(0, 110)); }
    await p.close();
  }

  /* ───────────── 도둑잡기 — 살짝 보기 ─────────────
     조커가 어디 있는지가 이 게임의 전부라, 아이템 검증도 거기에 맞춘다:
     ① 쓰기 전엔 상대 부채가 전부 밋밋한 뒷면이고 ② 쓰면 조커 자리에만 표시가 붙고
     ③ 그 표시가 **실제 조커 위치와 일치**해야 한다(엔진 내부와 대조).
     ④ 그리고 남의 화면엔 절대 안 새야 한다. */
  console.log('\n=== 도둑잡기 · 살짝 보기 ===');
  for (const on of [false, true]) {
    const p = await cdp.newPage(430, 900);
    try {
      await p.goto('http://localhost:3000/oldmaid.html');
      await p.wait(900); await p.eval(CLOSE_TUT); await p.wait(200);
      if (on) await p.eval(`document.querySelector('#optItems .opt[data-items="1"]').click(); return true;`);
      await p.click('#startBtn'); await p.wait(1600);

      const base = await p.eval(`return { itemsOn:!!(S&&S.itemsOn), items:S?S.items.slice():null,
                                          turn:S?S.turn:-1, mySeat:S?S.mySeat:-1 };`);
      if (on) {
        const uniq = Array.from(new Set(base.items || []));
        if (!base.itemsOn) bad('도둑잡기: itemsOn이 엔진에 전달되지 않았다');
        else if (uniq.length !== 1 || uniq[0] !== 2) bad('도둑잡기: 지급 불균등/2개 아님 — ' + JSON.stringify(base.items));
        else ok('전원 동일 지급 · items=' + JSON.stringify(base.items));
      } else if ((base.items || []).some(x => x !== 0)) {
        bad('도둑잡기: 껐는데 지급됨 — ' + JSON.stringify(base.items));
      } else ok('꺼짐 → 지급 0');

      /* 내 차례로 세워두고, **조커를 대상 손에 심는다.**
         안 심으면 대상이 조커를 안 들고 있는 판이 걸려서 '조커 없음' 분기만 밟고 끝난다
         — 정작 제일 중요한 단언(표시 위치 == 실제 조커 위치)이 조용히 안 돌아간다.
         (함정 #16: 표본을 못 모은 것과 단언이 통과한 것은 다른 사건이다.) */
      await p.eval(`
        engine.manualAI = true;
        if(S.turn!==S.mySeat){ engine._beginTurn(S.mySeat); }
        var t = engine.target;
        var js = engine.hands.findIndex(function(h){return h.some(function(c){return c.joker;});});
        if(js !== t && js >= 0 && t >= 0){
          var i = engine.hands[js].findIndex(function(c){return c.joker;});
          var jk = engine.hands[js].splice(i,1)[0];
          engine.hands[t].splice(Math.floor(engine.hands[t].length/2), 0, jk);   // 끝자리 말고 가운데
        }
        engine._emit();
        return true;`);
      await p.wait(300);

      const s1 = await p.eval(`var b=document.getElementById('peekBtn');
        return { has:!!b, txt:b?b.textContent:'', canPeek:S.canPeek,
                 hints: document.querySelectorAll('#opps .mc.back.jokerhint, #opps .mc.back.safehint').length };`);
      if (s1.hints) bad('도둑잡기: 아이템을 쓰기도 전에 조커 힌트가 보인다 (정보 누출)');
      else ok('쓰기 전 → 힌트 없음');

      if (!on) {
        if (s1.has) bad('도둑잡기: 껐는데 👀 버튼이 보인다'); else ok('꺼짐 → 버튼 없음');
      } else if (!s1.has) {
        bad(`도둑잡기: 켰는데 버튼이 없다 (canPeek=${s1.canPeek})`);
      } else {
        ok('켜짐 → 버튼 "' + s1.txt.trim() + '"');
        const n0 = +(s1.txt.match(/\((\d+)\)/) || [])[1];
        await p.click('#peekBtn'); await p.wait(600);
        const s2 = await p.eval(`
          var t = S.target;
          var realJoker = engine.hands[t].findIndex(function(c){return c.joker;});
          var hinted = document.querySelector('#opps .seat[data-seat="'+t+'"] .mc.back.jokerhint');
          var hintIdx = hinted ? +hinted.dataset.i : null;
          return { items:S.items.slice(), peek:S.myPeek, realJoker:realJoker,
                   hintIdx:hintIdx, btn:!!document.getElementById('peekBtn'),
                   msg:(document.getElementById('msg')||{}).textContent||'' };`);
        if (!(s2.items[0] === n0 - 1)) bad(`도둑잡기: 개수가 안 줄었다 (${n0}→${s2.items[0]})`);
        else ok(`남은 개수 ${n0}→${s2.items[0]}`);
        if (!s2.peek) bad('도둑잡기: myPeek이 스냅샷에 없다');
        else {
          const realIdx = s2.realJoker >= 0 ? s2.realJoker : null;
          // 핵심 — 알려준 위치가 실제 조커 위치와 같아야 한다(거짓 정보면 아이템이 무의미)
          if (realIdx == null) bad('도둑잡기: 조커를 심었는데 대상이 안 들고 있다 — 양성 케이스를 못 밟았다');
          else if (s2.peek.jokerIdx !== realIdx) bad(`도둑잡기: 알려준 조커 위치 ${s2.peek.jokerIdx} ≠ 실제 ${realIdx}`);
          else ok(`정확: 조커가 ${realIdx}번째임을 맞게 알려줌`);
          if (realIdx != null && s2.hintIdx !== realIdx) bad(`도둑잡기: 화면 표시(${s2.hintIdx})가 실제(${realIdx})와 다르다`);
          else if (realIdx != null) ok('화면에도 그 자리에 🃏 표시됨');
          if (!s2.msg || !/조커/.test(s2.msg)) bad('도둑잡기: 결과가 안내문에 안 나온다 — "' + s2.msg + '"');
          else ok('안내문 — "' + s2.msg.trim() + '"');
        }
        if (s2.btn) bad('도둑잡기: 한 차례에 두 번 쓸 수 있다(버튼이 남아 있음)');
        else ok('한 차례 1회 제한 — 버튼 사라짐');

        // 남의 스냅샷엔 절대 안 실려야 한다
        const leak = await p.eval(`
          var other = engine.players.find(function(p){return p.pid!=='me';});
          var s = engine.serialize(other.pid);
          return { myPeek: s.myPeek, jokerInBlob: /"joker":true/.test(JSON.stringify(
            Object.assign({}, s, {myHand:null, myPeek:null, myJoker:null}))) };`);
        if (leak.myPeek) bad('도둑잡기: 내가 훔쳐본 결과가 남의 스냅샷에 실렸다');
        else if (leak.jokerInBlob) bad('도둑잡기: 남의 스냅샷에 조커 카드가 노출됐다');
        else ok('남의 스냅샷엔 누출 없음');
      }
      const errs = p.errors.filter(e => !/favicon|vibrate|plausible|ERR_BLOCKED|net::/i.test(e));
      if (errs.length) bad('도둑잡기 콘솔 에러: ' + errs[0].slice(0, 140));
    } catch (e) { bad('도둑잡기 예외: ' + e.message.slice(0, 110)); }
    await p.close();
  }

  await cdp.close();
  console.log(fails ? `\n❌ 실패 ${fails}건` : '\n✅ 신규 아이템 7종 통과');
  process.exit(fails ? 1 : 0);
})();
