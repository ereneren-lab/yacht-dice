/**
 * `?host=1` 검증 — 허브 '친구와 하기'로 넘어갔을 때 **정말 방이 열리나**를 10종 전부에서 잰다.
 *
 * 왜 이 검증이 필수인가:
 *   `host-link.js`는 게임마다 다른 버튼(#createBtn · #createRoom · #ntCreate / #onlineBtn · #tabOnline)을
 *   순서대로 눌러보는 방식이다. **못 찾으면 조용히 포기한다** — 게임을 안 망가뜨리려고 일부러 그렇게 만들었다.
 *   그 말은 실패해도 화면상 아무 일도 안 일어난다는 뜻이라, 자동 검증이 없으면
 *   "친구와 하기가 되는 줄 알았는데 아니었다"를 아무도 모르게 된다.
 *
 * 성공 판정: 방에 들어가면 게임이 `{ns}_room`에 4자리 코드를 저장한다(게임 공통).
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/verify-host-link.js
 */
const { launchWithRetry, requireServer } = require('./cdp');

/* 게임 → 자리 저장 키 접두사(ns). 요트만 파일명과 다르다.
   ⚠️ 이 대조가 없으면 **앞 게임이 남긴 방을 보고 성공으로 찍는다** — 처음 돌렸을 때 실제로
      10종 중 9종이 요트의 `yd_room`(같은 코드)으로 '열림'이 됐다. localStorage는 게임끼리 공유된다. */
const GAMES = [
  { g: 'kb', ns: 'kb' }, { g: 'yacht', ns: 'yd' }, { g: 'ld', ns: 'ld' }, { g: 'lcr', ns: 'lcr' },
  { g: 'yut', ns: 'yut' }, { g: 'alkkagi', ns: 'alkkagi' }, { g: 'seotda', ns: 'sd' },
  { g: 'indianpoker', ns: 'ip' }, { g: 'onecard', ns: 'oc' }, { g: 'oldmaid', ns: 'om' },
];

const ROOM = `
  var out=null;
  try{
    for(var s=0;s<2;s++){
      var st = s? localStorage : sessionStorage;
      for(var i=0;i<st.length;i++){
        var k=st.key(i);
        if(k && k.slice(-5)==='_room'){
          var v=(st.getItem(k)||'').replace(/"/g,'');
          if(/^[A-Z0-9]{4}$/.test(v)) out={key:k, code:v};
        }
      }
    }
  }catch(e){}
  return out;`;

(async () => {
  await requireServer();
  const cdp = await launchWithRetry();
  let fail = 0;
  console.log('게임        방 열림  코드   저장 키');
  console.log('─'.repeat(46));

  for (const { g, ns } of GAMES) {
    const page = await cdp.newPage(390, 844);
    let got = null;
    try {
      // 앞 게임이 남긴 방을 보고 성공으로 착각하지 않게 매번 비운다
      await page.goto('http://localhost:3000/');
      await page.wait(300);
      await page.eval(`try{ localStorage.clear(); sessionStorage.clear(); }catch(e){} return true;`);
      await page.goto(`http://localhost:3000/${g}.html?host=1`);
      // host-link.js는 최대 7초까지 시도한다 — 그보다 넉넉히 기다린다
      for (let i = 0; i < 20; i++) {
        await page.wait(500);
        got = await page.eval(ROOM).catch(() => null);
        if (got && got.key.indexOf(ns + '_') !== 0) got = null;   // 다른 게임이 남긴 키는 안 센다
        if (got) break;
      }
    } catch (e) { /* 아래에서 실패로 찍힌다 */ }
    finally { await page.close(); }

    if (got) console.log(`✅ ${g.padEnd(12)} 열림     ${got.code}   ${got.key}`);
    else { fail++; console.log(`❌ ${g.padEnd(12)} 안 열림  —      (버튼을 못 찾았거나 서버가 방을 안 만들었다)`); }
  }

  console.log(`\n${fail ? `❌ ${fail}/${GAMES.length}종에서 '친구와 하기'가 방을 못 만든다` : `✅ 10종 전부 ?host=1로 방이 열린다`}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
