/**
 * 온라인 진입 경로 감사 — "친구랑 하려면 뭘 눌러야 하나"가 막히지 않나.
 *
 * 왜 있나 (2026-07-29)
 *   이 앱의 핵심은 '링크로 친구를 부르는 것'인데, 지금까지 감사는 전부 **혼자 하는 경로**만 봤다
 *   (셋업/인게임/룰). 방 만들기·참가·대기실은 한 번도 재본 적이 없다.
 *
 * 재는 것 (온라인 10종 × 폰 뷰포트)
 *   ① 온라인 진입 버튼이 셋업에서 보이고 눌리나
 *   ② 누른 뒤 '방 만들기'가 화면 안에서 눌리나
 *   ③ 방을 만들면 **방 코드가 화면에 보이나** (친구에게 알려줄 값)
 *   ④ 초대 수단(링크 복사/공유)이 있나
 *   ⑤ 대기실에서 넘침이 없나
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/audit-online-entry.js
 */
const { launchWithRetry, requireServer } = require('./cdp');
const fs = require('fs');

// cdp.shot()은 디렉토리를 안 만든다 — 없으면 ENOENT로 측정 결과까지 통째로 가려진다
fs.mkdirSync('out/online', { recursive: true });

const VIEW = { w: 384, h: 748 };

/* 온라인 10종. 진입 방식이 두 갈래다:
   · net.js 4종(카드) — '🌐 온라인' 버튼을 NET.ui가 주입한다
   · 기존 6종 — 셋업 안의 탭/버튼(#tabOnline, #optMode의 '온라인' 등) */
const GAMES = [
  { g: 'yut', name: '윷놀이' },
  { g: 'yacht', name: '요트' },
  { g: 'kb', name: '너클본즈' },
  { g: 'ld', name: '라이어' },
  { g: 'lcr', name: '좌중우' },
  { g: 'alkkagi', name: '알까기' },
  { g: 'seotda', name: '섯다' },
  { g: 'indianpoker', name: '인디언' },
  { g: 'onecard', name: '원카드' },
  { g: 'oldmaid', name: '도둑잡기' },
];

// 화면에 실제로 보이고 눌리는 요소를 텍스트로 찾는다 (id가 게임마다 다르므로)
const findByText = `
function vis(el){
  var cs=getComputedStyle(el);
  if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)<0.05) return false;
  var b=el.getBoundingClientRect();
  return b.width>2 && b.height>2;
}
function hit(el){
  var b=el.getBoundingClientRect();
  var cx=Math.round(b.left+b.width/2), cy=Math.round(b.top+b.height/2);
  if(cx<0||cy<0||cx>innerWidth||cy>innerHeight) return {inView:false, clickable:false};
  var h=document.elementFromPoint(cx,cy);
  return {inView:true, clickable: !!(h && (h===el||el.contains(h)))};
}
function findBtn(re){
  var all=[].slice.call(document.querySelectorAll('button,a,[role=button],.opt,.tab,.chip'));
  for(var i=0;i<all.length;i++){
    var t=(all[i].textContent||'').trim();
    if(re.test(t) && vis(all[i])) return all[i];
  }
  return null;
}
`;

(async () => {
  await requireServer();   // 서버가 없으면 감사는 '전부 통과'로 거짓말을 한다 — cdp.js requireServer 주석 참고
  const cdp = await launchWithRetry();
  const rows = [];

  for (const G of GAMES) {
    const page = await cdp.newPage(VIEW.w, VIEW.h);
    const row = { ...G };
    try {
      await page.setMotion(true);
      await page.goto(`http://localhost:3000/${G.g}.html`);
      await page.eval('localStorage.clear(); sessionStorage.clear(); return 1');
      await page.goto(`http://localhost:3000/${G.g}.html`);
      await page.wait(1700);

      // ① 온라인 진입 버튼
      const s1 = await page.eval(`${findByText}
        var b=findBtn(/온라인|🌐/);
        if(!b) return {found:false};
        var h=hit(b);
        return {found:true, txt:(b.textContent||'').trim().slice(0,14), inView:h.inView, clickable:h.clickable};`);
      row.enter = s1;
      if (!s1.found) { rows.push(row); await page.close(); continue; }

      await page.eval(`${findByText} var b=findBtn(/온라인|🌐/); if(b)b.click(); return 1`);
      await page.wait(1400);

      // ② 방 만들기
      const s2 = await page.eval(`${findByText}
        var b=findBtn(/방 만들기|방만들기|만들기|생성/);
        if(!b) return {found:false};
        var h=hit(b);
        return {found:true, txt:(b.textContent||'').trim().slice(0,14), inView:h.inView, clickable:h.clickable};`);
      row.create = s2;
      if (!s2.found) { rows.push(row); await page.close(); continue; }

      await page.eval(`${findByText} var b=findBtn(/방 만들기|방만들기|만들기|생성/); if(b)b.click(); return 1`);
      await page.wait(2600);   // 서버 왕복

      // ③④⑤ 대기실
      const s3 = await page.eval(`${findByText}
        /* 방 코드 — 알려진 자리를 먼저 본다.
           ⚠️ '4글자 대문자'를 DOM 순서로 훑으면 엉뚱한 걸 집는다:
              섯다에서 베팅 옵션 '1000'(.opt)이 실제 방 코드 'ECKL'(.nt-code)보다 앞에 있어서
              그걸 방 코드로 보고했다. 추론보다 셀렉터가 먼저다. */
        var code=null;
        var known=document.querySelector('#ntRoomCode,.nt-code,#lobbyCode,#roomCode,.roomcode');
        if(known && vis(known)){
          var kt=(known.textContent||'').trim();
          if(/^[A-Z0-9]{4}$/.test(kt)) code=kt;
        }
        if(!code){
          var all=[].slice.call(document.querySelectorAll('*'));
          for(var i=0;i<all.length;i++){
            var el=all[i]; if(el.children.length) continue;
            var t=(el.textContent||'').trim();
            if(/^[A-Z]{2}[A-Z0-9]{2}$/.test(t) && vis(el)){ code=t; break; }
          }
        }
        // 대기실의 주요 행동(게임 시작)이 화면 안에서 눌리나
        var startBtn=document.getElementById('ntStart')||document.getElementById('startOnline')||findBtn(/게임 시작|시작하기/);
        var st=startBtn?hit(startBtn):null;
        /* 혼자 있는 대기실에 '게임 시작'이 없는 건 정상이다 —
           윷은 버튼 대신 "현재 1명 · 최소 2명 (1명 더 필요) / 친구를 기다리거나 AI를 추가해…"를 보여준다.
           그게 더 친절하다. 사람이 모자란 상태를 안내하고 있으면 통과로 친다. */
        var waitMsg=/명 더 필요|명부터 시작|기다리|친구를 초대/.test(document.body.textContent||'');
        /* 초대 수단: 버튼 텍스트뿐 아니라 '눌러서 복사'처럼 **코드 박스 자체가 버튼**인 경우도 인정한다.
           net.js 대기실이 그렇다 — 버튼 텍스트만 찾다가 '초대 수단 없음'으로 오탐했다. */
        var share=findBtn(/복사|공유|초대|링크/);
        if(!share){
          var codeEl=document.getElementById('ntRoomCode');
          if(codeEl && vis(codeEl) && /복사|공유/.test(document.body.textContent||'')) share=codeEl;
        }
        var sh=share?hit(share):null;
        return {code:code,
                shareFound:!!share, shareTxt:share?(share.textContent||'').trim().slice(0,14):null,
                shareInView:sh?sh.inView:null, shareClickable:sh?sh.clickable:null,
                startFound:!!startBtn, startClickable:st?st.clickable:null, waitMsg:waitMsg,
                vOver:document.documentElement.scrollHeight-innerHeight,
                hOver:document.documentElement.scrollWidth-innerWidth};`);
      row.room = s3;
      await page.shot(`out/online/${G.g}.png`);
    } catch (e) {
      row.err = e.message.slice(0, 70);
    }
    rows.push(row);
    await page.close();
  }
  await cdp.close();

  console.log(`\n════════ 온라인 진입 경로 (${VIEW.w}x${VIEW.h}) ════════`);
  /* ⚠️ 합격 기준에서 '문서 넘침'은 뺐다.
     요트 대기실은 세로로 395px 넘치지만 방 코드(y=293)도 '게임 시작'(y=690)도 화면 안이다 —
     아래에 옵션이 더 있을 뿐 막힌 게 아니다. 넘침은 참고로만 찍는다.
     대기실에서 진짜 중요한 건 **코드가 보이나 · 초대할 수단이 있나 · 시작이 눌리나**다. */
  console.log('게임      온라인버튼      방만들기        방코드  초대수단    시작    넘침(참고)');
  let fail = 0;
  rows.forEach(r => {
    if (r.err) { console.log(`❌ ${r.name.padEnd(8)} 예외 ${r.err}`); fail++; return; }
    const e = r.enter, c = r.create, m = r.room;
    const eS = !e || !e.found ? '없음' : (e.clickable ? '누름O' : (e.inView ? '가려짐' : '화면밖'));
    const cS = !c ? '-' : (!c.found ? '없음' : (c.clickable ? '누름O' : (c.inView ? '가려짐' : '화면밖')));
    const kS = !m ? '-' : (m.code || '❌없음');
    const sS = !m ? '-' : (!m.shareFound ? '❌없음' : (m.shareClickable ? '누름O' : (m.shareInView ? '가려짐' : '화면밖')));
    const stS = !m ? '-' : (!m.startFound ? (m.waitMsg ? '대기안내' : '❌없음') : (m.startClickable ? '누름O' : '막힘'));
    const oS = !m ? '-' : (`${m.vOver > 0 ? '세로+' + m.vOver : ''}${m.hOver > 0 ? ' 가로+' + m.hOver : ''}` || '0');
    const bad = eS !== '누름O' || (c && cS !== '누름O')
      || (m && (!m.code || !m.shareFound || m.hOver > 0
                || (!m.startFound && !m.waitMsg)          // 시작도 없고 안내도 없으면 막힌 것
                || m.startClickable === false));
    if (bad) fail++;
    console.log(`${bad ? '❌' : '✅'} ${r.name.padEnd(8)} ${eS.padEnd(14)} ${cS.padEnd(14)} ${String(kS).padEnd(6)} ${sS.padEnd(10)} ${stS.padEnd(6)} ${oS}`);
  });
  /* ⑥ 허브가 **온라인 10종을 다 아는가** — 세 곳이 따로 놀면 조용히 어긋난다.
   *
   * 2026-08-04에 실제로 어긋나 있었다:
   *   · 방 코드 라우팅 화이트리스트가 5종뿐이라 **섯다·알까기·인디언·원카드·도둑잡기 방은
   *     코드가 맞아도 "그런 방이 없어요"로 거절**됐다. 방은 서버에 멀쩡히 있었는데.
   *     친구가 코드를 알려줘도 허브로는 못 들어갔다(게임 페이지 직접 참가·?room= 링크로만 됐다).
   *   · 카드의 '온라인' pill도 5장만 있어서, 절반은 온라인이 되는 줄도 모르게 돼 있었다.
   *   · '이어하기' 배너도 5종만 봤다.
   * 위 ①~⑤는 **게임 페이지**만 보기 때문에 이걸 못 잡는다. 허브는 별도로 봐야 한다. */
  {
    const path = require('path');
    const P = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
    const server = P('server.js'), hub = P('public/index.html');
    const online = (server.match(/ONLINE_GAMES = new Set\(\[([^\]]*)\]/) || [])[1] || '';
    const want = (online.match(/'(\w+)'/g) || []).map(s => s.replace(/'/g, ''));

    const route = (hub.match(/var GAMES=\{([^}]*)\}/) || [])[1] || '';
    const missRoute = want.filter(g => !new RegExp('\\b' + g + '\\s*:').test(route));
    if (missRoute.length) { fail++; console.log(`❌ 허브 방코드 라우팅에 빠진 게임: ${missRoute.join(', ')} — 코드가 맞아도 "그런 방이 없어요"가 뜬다`); }
    else console.log(`✅ 허브 방코드 라우팅 ${want.length}종 (server.js ONLINE_GAMES와 일치)`);

    const missPill = want.filter(g => {
      const i = hub.indexOf(`href="${g}.html"`); if (i < 0) return false;
      return hub.slice(i, hub.indexOf('</a>', i)).indexOf('"pill">온라인') < 0;
    });
    if (missPill.length) { fail++; console.log(`❌ '온라인' pill이 빠진 카드: ${missPill.join(', ')}`); }
    else console.log(`✅ 온라인 ${want.length}종 카드에 '온라인' pill`);

    const resume = (hub.match(/var GAMES=\[([\s\S]*?)\];/) || [])[1] || '';
    const missResume = want.filter(g => resume.indexOf(`${g}.html`) < 0);
    if (missResume.length) { fail++; console.log(`❌ '이어하기' 대상에서 빠진 게임: ${missResume.join(', ')}`); }
    else console.log(`✅ '이어하기' 배너가 온라인 ${want.length}종을 본다`);
  }

  console.log(`\n${fail ? '❌ ' + fail + '종에 문제' : '✅ 온라인 진입 10종 전부 통과'}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
