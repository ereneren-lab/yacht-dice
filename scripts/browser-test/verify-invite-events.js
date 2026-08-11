/**
 * '방만들기'·'초대보내기' 계측이 **실제로 발화하는지** 확인한다.
 *
 * 왜 있나
 *   이 둘은 게임 파일에 호출을 심지 않는다. analytics.js가 한 곳에서 잡는다 —
 *   방 만들기는 나가는 소켓 메시지({t:'create'})를, 초대는 버튼 클릭(capture)을 엿본다.
 *   호출부가 없다는 건 **눈으로는 배선을 확인할 수 없다**는 뜻이다.
 *   게임 쪽이 소켓을 다른 방식으로 열거나 버튼 id를 바꾸면 조용히 0건이 된다.
 *   그 조용한 실패를 여기서만 잡을 수 있다.
 *
 * 어떻게 보나
 *   localhost에선 Plausible이 이벤트를 버리므로 analytics.js가 콘솔에 `[AL] ...`을 찍는다.
 *   `?host=1`(허브 '친구와 하기' 경로)로 방을 열고, 대기실의 초대 버튼을 눌러 그 줄을 받는다.
 *
 * 사용: npm run test:invite   (서버 필요 — node server.js)
 */
const { launchWithRetry, requireServer } = require('./cdp');

/* g: 페이지 · 게임: analytics.js GAMES 표의 이름(props로 나가는 값) · 초대: 대기실 초대 버튼 id
   초대 버튼 id는 세 종류뿐이고 analytics.js의 INVITE_BTN과 짝이다 — 한쪽만 바뀌면 여기서 깨진다. */
const GAMES = [
  { g: 'yut',         게임: '윷놀이',       초대: 'lobbyCopy' },
  { g: 'yacht',       게임: '요트 다이스',  초대: 'copyLink'  },
  { g: 'kb',          게임: '너클본즈',     초대: 'copyLink'  },
  { g: 'ld',          게임: '라이어 다이스', 초대: 'copyLink'  },
  { g: 'lcr',         게임: '좌·중·우',     초대: 'lobbyCopy' },
  { g: 'alkkagi',     게임: '알까기',       초대: 'lobbyCopy' },
  { g: 'seotda',      게임: '섯다',         초대: 'ntInvite'  },
  { g: 'indianpoker',게임: '인디언 포커',   초대: 'ntInvite'  },
  { g: 'onecard',     게임: '원카드',       초대: 'ntInvite'  },
  { g: 'oldmaid',     게임: '도둑잡기',     초대: 'ntInvite'  },
];

/** page.logs에서 `[AL] <이름> {...}` 줄을 찾아 props까지 맞는지 본다.
 *  이름만 맞고 게임이 '허브'로 찍히는 사고가 예전에 있었다(2026-07-29) — 그래서 props도 본다. */
function fired(logs, name, 게임) {
  return logs.some(l => l.indexOf('[AL] ' + name) >= 0 && l.indexOf('"게임":"' + 게임 + '"') >= 0);
}
function firedAnyProps(logs, name) {
  return logs.some(l => l.indexOf('[AL] ' + name) >= 0);
}

(async () => {
  await requireServer();
  const cdp = await launchWithRetry();
  let fail = 0;

  console.log('\n════════ 방만들기 · 초대보내기 · 초대입장 실제 발화 ════════');
  console.log('게임          방만들기  초대보내기  초대입장  비고');
  console.log('─'.repeat(66));

  for (const G of GAMES) {
    const page = await cdp.newPage(390, 844);
    let 방 = false, 초대 = false, 비고 = '';
    try {
      // 앞 게임이 남긴 방으로 재접속(rejoin)해 버리면 create가 안 나간다 — 매번 비운다
      await page.goto('http://localhost:3000/');
      await page.eval('try{ localStorage.clear(); sessionStorage.clear(); }catch(e){} return 1;');

      await page.goto(`http://localhost:3000/${G.g}.html?host=1`);
      // host-link.js가 최대 7초까지 버튼을 눌러본다 — 넉넉히 기다린다
      for (let i = 0; i < 20 && !방; i++) {
        await page.wait(400);
        방 = fired(page.logs, '방만들기', G.게임);
      }
      if (!방 && firedAnyProps(page.logs, '방만들기')) 비고 = "발화했으나 '게임' 값이 다르다";

      /* 초대 버튼 — 대기실이 떠야 눌린다. 방이 안 열렸으면 버튼도 없다.
         navigator.share·clipboard가 헤드리스에서 실패해도 계측은 capture 단계라 먼저 지나간다. */
      /* ⚠️ offsetParent로 '보인다'를 판정하면 안 된다 — position:fixed 요소는 늘 null이다.
         대기실은 게임마다 고정 오버레이일 수 있어 멀쩡한 버튼을 '없다'로 볼 수 있다. 실제 크기로 본다. */
      const 있나 = await page.eval(
        `var e=document.getElementById(${JSON.stringify(G.초대)});
         if(!e) return false;
         var r=e.getBoundingClientRect();
         return r.width>2 && r.height>2 && getComputedStyle(e).visibility!=='hidden';`).catch(() => false);
      if (!있나) {
        비고 = 비고 || `#${G.초대} 이 화면에 없다(대기실이 안 떴거나 id가 바뀌었다)`;
      } else {
        await page.click('#' + G.초대);
        await page.wait(400);
        초대 = fired(page.logs, '초대보내기', G.게임);
        if (!초대 && firedAnyProps(page.logs, '초대보내기')) 비고 = "발화했으나 '게임' 값이 다르다";
      }
    } catch (e) {
      비고 = 비고 || String(e.message || e).slice(0, 40);
    } finally { await page.close(); }

    /* 초대입장 — 받은 링크를 여는 쪽. 방이 실제로 있을 필요는 없다(페이지 로드 시점에 센다).
       없는 코드로 열면 게임은 "방 없음"을 띄우겠지만 계측은 그 전에 지나간다. */
    let 입장 = false;
    const p2 = await cdp.newPage(390, 844);
    try {
      await p2.goto('http://localhost:3000/');
      await p2.eval('try{ localStorage.clear(); sessionStorage.clear(); }catch(e){} return 1;');
      await p2.goto(`http://localhost:3000/${G.g}.html?room=ZZZZ`);
      await p2.wait(600);
      입장 = fired(p2.logs, '초대입장', G.게임);
      if (!입장 && firedAnyProps(p2.logs, '초대입장')) 비고 = 비고 || "발화했으나 '게임' 값이 다르다";
    } catch (e) {
      비고 = 비고 || String(e.message || e).slice(0, 40);
    } finally { await p2.close(); }

    const ok = 방 && 초대 && 입장;
    if (!ok) fail++;
    console.log(
      `${ok ? '✅' : '❌'} ${G.g.padEnd(12)} ${방 ? '  발화  ' : '  없음  '}  ${초대 ? '  발화   ' : '  없음   '}  ${입장 ? ' 발화  ' : ' 없음  '}  ${비고}`
    );
  }

  console.log(
    `\n${fail
      ? `❌ ${fail}/${GAMES.length}종에서 친구 부르기 계측이 조용히 죽어 있다`
      : `✅ ${GAMES.length}종 전부 방만들기·초대보내기·초대입장이 실제로 발화한다`}`
  );
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
