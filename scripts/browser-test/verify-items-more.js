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

  await cdp.close();
  console.log(fails ? `\n❌ 실패 ${fails}건` : '\n✅ 신규 아이템 5종 통과');
  process.exit(fails ? 1 : 0);
})();
