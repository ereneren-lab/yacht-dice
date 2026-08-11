/**
 * 허브 첫 화면 감사 — **헤드리스**. 폰 없이 돈다.
 *
 * 왜 필요한가 (2026-08-05):
 *   `audit-ux.js`·`audit-landscape.js`는 **게임 13종만** 본다. 허브(index.html)는 아무도 안 봤다.
 *   그런데 오늘 첫 화면을 통째로 갈아엎었다(대표 4장 → 13종 타일). 지키는 게 `audit:online` 4항목뿐이면
 *   다음 사람이 무심코 되돌려도 아무도 안 운다. 오늘 하루 내내 나온 그 패턴을 여기서 끊는다.
 *   (실기기용 `scripts/phone/audit-hub.js`는 폰이 있어야 돌아서 CI/일상 검증에 못 쓴다.)
 *
 * 재는 것
 *   ① 첫 화면에 13종이 다 들어오나 (384×748 = 갤A16 앱 웹뷰 실측 크기)
 *   ② 문서가 얼마나 기나 (개편 목표: 1.5화면 이하 — 개편 전은 2.5화면이었다)
 *   ③ 진입 두 버튼: 기본 접힘 · 누르면 열림 · 서로 배타
 *   ④ ?room= 으로 들어오면 코드 입력칸이 열려 있나 (실패 안내만 뜨고 고쳐 넣을 칸이 없으면 막다른 길)
 *   ⑤ 타일 13개가 실제로 존재하는 페이지를 가리키나 (오타 한 글자면 404)
 *   ⑥ 여러 폭에서 가로 넘침이 없나
 *   ⑦ 요약 한 줄이 13종 합과 맞나 (5종만 세던 버그의 회귀 감시)
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/audit-hub.js
 */
const { launchWithRetry, requireServer } = require('./cdp');

/* 🔴 2026-08-10 — 같은 화면을 **두 벌**로 재고 있었다(여기 + scripts/phone/audit-hub.js).
   눈이 둘이면 한쪽만 고치는 날이 오고, 그때부터 두 결과가 어긋난 채로 남는다.
   → **재는 눈은 여기 하나**, 붙는 방법만 고른다:
        node scripts/browser-test/audit-hub.js            헤드리스(폰 불필요)
        node scripts/browser-test/audit-hub.js --phone    실기기(adb 연결 필요)
        ... --detail                                      카드별 스크롤 깊이까지(옛 실기기판이 내던 것) */
const PHONE = process.argv.includes('--phone');
const DETAIL = process.argv.includes('--detail');

const VIEWS = [
  { n: '384x748 갤A16앱', w: 384, h: 748, wantAllTiles: true },
  { n: '360x640 소형폰',  w: 360, h: 640, wantAllTiles: true },
  { n: '390x844 아이폰',  w: 390, h: 844, wantAllTiles: true },
  { n: '1440x900 데스크톱', w: 1440, h: 900, wantAllTiles: true },
  /* 가로도 13종 전부를 기대한다 — 2026-08-05에 5열·행높이 고정으로 6/13 → 13/13이 됐다.
     여기를 false로 되돌리는 것은 '가로는 대충 봐도 된다'는 뜻이 된다. 그러지 말 것. */
  { n: '844x390 가로',    w: 844, h: 390, wantAllTiles: true },
];

/* 13종에 기록을 심는다. 예전 키(5종)와 공용 키(alley_stats) 양쪽을 쓰는 게 핵심 —
   허브가 둘을 합쳐 13종을 보는지가 이 감사의 ⑦번이다. */
const SEED = `
  localStorage.clear();
  var legacy={kb_stats:2, ld_stats:2, lcr_stats:2, yut_stats:2, yd_stats:2, alk_stats:2};
  Object.keys(legacy).forEach(function(k){ localStorage.setItem(k, JSON.stringify({games:2,wins:1,bestStreak:3,best:0})); });
  var sh={}; ['seotda','blackjack','baccarat','highlow','indianpoker','oldmaid','onecard'].forEach(function(g){
    sh[g]={games:2,wins:1,best:0,streak:0,bestStreak:3}; });
  localStorage.setItem('alley_stats', JSON.stringify(sh));
  return true;`;

const MEASURE = `
var d=document.documentElement, vh=innerHeight;
var tiles=[].slice.call(document.querySelectorAll('.gtile'));
/* 카드별 위치 — 옛 실기기판이 따로 재던 것. 합치면서 이쪽으로 가져왔다. */
var cards=tiles.map(function(t){ var b=t.getBoundingClientRect();
  var a=t.matches('a')?t:t.querySelector('a');
  return { name:(t.textContent||'').replace(/\s+/g,' ').trim().slice(0,14),
           top:Math.round(b.top+scrollY), href:(a&&a.getAttribute('href'))||'' }; });
var inView=tiles.filter(function(t){ return t.getBoundingClientRect().bottom<=vh; }).length;
var vis=function(s){ var e=document.querySelector(s); if(!e) return null;
  var r=e.getBoundingClientRect(); return r.height>2 && r.width>2; };
return {
  cards: cards,
  docH:d.scrollHeight, vh:vh, screens:+(d.scrollHeight/vh).toFixed(2),
  tiles:tiles.length, inView:inView,
  overflowX: d.scrollWidth > innerWidth+1,
  hrefs: tiles.map(function(t){ return t.getAttribute('href'); }),
  joinOpen: vis('#joinBar'), pickOpen: vis('#invitePick'),
  meTx:(document.getElementById('meTx')||{}).textContent||'',
  strip:[].map.call(document.querySelectorAll('#statStrip .si b'),function(b){return b.textContent;})
};`;

(async () => {
  /* ⚠️ P는 붙는 단계에서 이미 쓴다(아래 '실기기에 붙었다') — 반드시 여기, if(PHONE)보다 위에 둘 것.
     아래쪽에 있었을 때 --phone은 붙자마자 TDZ로 죽었다(`Cannot access 'P' before initialization`).
     헤드리스 경로는 P를 나중에 처음 써서 멀쩡했고, 그래서 두 벌을 합친 뒤에도 아무도 모르고 있었다(8/11 발견). */
  const P = (s) => console.log(s);

  /* 붙는 방법만 갈린다 — 재는 눈(MEASURE·검사 항목)은 아래에서 공유한다.
     실기기는 화면 크기를 우리가 못 정하므로 여러 뷰포트 훑기(①②)는 헤드리스에서만 한다. */
  let cdp = null, BASE = 'http://localhost:3000/', phone = null;
  if (PHONE) {
    const { attach } = require('../phone/phone-cdp');
    /* 붙기 전에 준비물을 확인한다 — 예전엔 연결이 없으면 ECONNREFUSED 스택만 뱉어서
       "왜 안 되는지"를 다음 사람이 못 찾았다. */
    phone = await attach().catch(e => {
      console.error('❌ 실기기에 못 붙었다 — ' + e.message);
      console.error('   준비: ① USB 연결·USB 디버깅 허용(삼성은 자동 차단 끄기) ② 앱 실행');
      console.error('   그다음: adb forward tcp:9223 localabstract:$(adb shell cat /proc/net/unix | grep -o "webview_devtools_remote_[0-9]*" | head -1)');
      console.error('   폰 없이 볼 거면 --phone 없이 그냥 돌릴 것.');
      process.exit(1);
    });
    BASE = 'https://localhost/';               // 앱 웹뷰의 출처
    P('📱 실기기에 붙었다 — 뷰포트 훑기(①②)는 건너뛴다(기기 크기가 하나다)');
  } else {
    await requireServer();
    cdp = await launchWithRetry();
  }
  /* 실기기엔 '탭'이 하나뿐이라 새 페이지를 못 연다 → 같은 페이지를 돌려 쓰고 close는 무시한다. */
  const openPage = async (w, h) => phone ? Object.create(phone, { close: { value: async () => {} } })
                                         : await cdp.newPage(w, h);
  let fail = 0, warn = 0;

  // ── ①②⑥ 폭별 측정
  P('════════ ①② 첫 화면: 13종이 다 들어오고 문서가 짧은가 ════════');
  let base = null;
  for (const V of (PHONE ? VIEWS.slice(0, 1) : VIEWS)) {    // 실기기는 기기 크기 하나로만 잰다
    const page = await openPage(V.w, V.h);
    try {
      await page.goto(BASE);
      await page.wait(500);
      await page.eval(SEED);
      await page.goto(BASE);
      await page.wait(1200);
      const m = await page.eval(MEASURE);
      if (V.w === 384) base = m;

      const bad = [];
      if (m.tiles !== 13) bad.push(`타일 ${m.tiles}개(13이어야 한다)`);
      if (V.wantAllTiles && m.inView < 13) bad.push(`첫 화면에 ${m.inView}/13만 들어옴`);
      var lim = (V.h < 560) ? 1.7 : 1.5;   // 가로는 높이가 390뿐이라 같은 내용도 화면수가 커진다
      if (m.screens > lim) bad.push(`문서 ${m.screens}화면(${lim} 이하여야 한다)`);
      if (m.overflowX) bad.push('가로 넘침');
      if (bad.length) { fail++; P(`❌ ${V.n.padEnd(16)} ${bad.join(' · ')}`); }
      else P(`✅ ${V.n.padEnd(16)} 타일 ${m.inView}/13 · 문서 ${m.docH}px(${m.screens}화면)`);
    } finally { await page.close(); }
  }

  // ── 카드별 스크롤 깊이 (--detail) — 합치기 전 실기기판이 내던 표
  if (DETAIL && base && base.cards) {
    P('\n════════ (상세) 게임별 스크롤 깊이 — 몇 번째 화면에서 보이나 ════════');
    base.cards.forEach((c, i) => {
      const scr = (c.top / (base.vh || 748)).toFixed(1);
      P(`  ${String(i + 1).padStart(2)}. ${c.name.padEnd(14)} y=${String(c.top).padStart(5)} → ${scr}번째 화면  ${c.href}`);
    });
  }

  // ── ③ 진입 두 버튼
  P('\n════════ ③ 진입 버튼: 기본 접힘 · 누르면 열림 · 서로 배타 ════════');
  {
    const page = await openPage(384, 748);
    try {
      await page.goto(BASE); await page.wait(1000);
      const st = () => page.eval(`var j=document.getElementById('joinBar'), p=document.getElementById('invitePick');
        var v=function(e){ return !!e && e.getBoundingClientRect().height>2; };
        return {join:v(j), pick:v(p), picks:document.querySelectorAll('#ipGrid a').length};`);
      const a = await st();
      await page.eval(`document.getElementById('joinBtn').click(); return true;`); await page.wait(250);
      const b = await st();
      await page.eval(`document.getElementById('inviteBtn').click(); return true;`); await page.wait(250);
      const c = await st();

      const bad = [];
      if (a.join || a.pick) bad.push('처음부터 열려 있다');
      if (!b.join || b.pick) bad.push("'방 코드'를 눌러도 입력칸이 안 열린다");
      if (!c.pick || c.join) bad.push("'친구와 하기'가 시트를 안 열거나 입력칸과 같이 떠 있다");
      if (c.picks < 1) bad.push('시트에 게임이 하나도 없다');
      if (bad.length) { fail++; P(`❌ ${bad.join(' · ')}`); }
      else P(`✅ 기본 접힘 → 방 코드 열림 → 친구와 하기로 전환(시트 ${c.picks}종)`);
    } finally { await page.close(); }
  }

  // ── ④ ?room= 진입
  P('\n════════ ④ 초대 링크(?room=)로 들어왔을 때 ════════');
  {
    const page = await openPage(384, 748);
    try {
      await page.goto(BASE + '?room=ZZZZ'); await page.wait(1500);
      const m = await page.eval(`var j=document.getElementById('joinBar'), i=document.getElementById('joinCode');
        return { open: !!j && j.getBoundingClientRect().height>2, val: i?i.value:'' };`);
      if (!m.open) { fail++; P('❌ 코드 입력칸이 닫혀 있다 — 방을 못 찾으면 고쳐 넣을 자리가 없다(막다른 길)'); }
      else P(`✅ 입력칸이 열려 있다 (코드 미리 채움: "${m.val}")`);
    } finally { await page.close(); }
  }

  // ── ⑤ 타일 링크가 실제 페이지인가
  P('\n════════ ⑤ 타일 13개가 실제 페이지를 가리키나 ════════');
  {
    const http = require('http');
    const head = (p) => new Promise(r => {
      const req = http.get({ host: 'localhost', port: 3000, path: '/' + p }, res => { res.resume(); r(res.statusCode); });
      req.on('error', () => r(0)); req.setTimeout(3000, () => { req.destroy(); r(0); });
    });
    const bad = [];
    for (const h of (base ? base.hrefs : [])) { const c = await head(h); if (c !== 200) bad.push(`${h}→${c}`); }
    if (bad.length) { fail++; P(`❌ 깨진 링크: ${bad.join(', ')}`); }
    else P(`✅ ${base ? base.hrefs.length : 0}개 전부 200`);
  }

  // ── ⑦ 요약 한 줄이 13종 합인가
  P('\n════════ ⑦ 요약이 13종을 세나 (5종만 세던 버그의 회귀 감시) ════════');
  {
    // 심은 값: 13종 × 2판 1승 = 26판 13승
    const want = { games: 26, wins: 13 };
    const got = base ? base.strip : [];
    const okStrip = got.length >= 2 && +got[0] === want.games && +got[1] === want.wins;
    const okMe = base && /26판\s*13승/.test(base.meTx.replace(/\s+/g, ' '));
    if (!okStrip || !okMe) {
      fail++;
      P(`❌ 요약 스트립 ${JSON.stringify(got)} · '내 기록' "${base ? base.meTx : ''}" — 26판 13승이어야 한다`);
      P('   (5종만 세면 10판 5승이 나온다 — 그게 2026-08-05에 고친 버그다)');
    } else P(`✅ 스트립 ${got.slice(0, 2).join('판/')}승 · '내 기록' "${base.meTx.trim()}"`);
  }

  P(`\n${fail ? '❌ ' + fail + '건 실패' : '✅ 허브 첫 화면 전부 통과'}${warn ? ' · 경고 ' + warn : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
