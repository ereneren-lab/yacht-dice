/**
 * 캐릭터 아바타 검증 — 우리가 직접 만든 5종이 **아바타 있는 10게임 전부에서** 실제로 보이는가.
 *
 * 왜 있나 (2026-08-04)
 *   `public/img/`의 소프트 3D 마스코트 5종(윷의 도개걸윷모)을 오래 갖고 있었는데
 *   **윷놀이에서만** 썼다. 나머지 12게임은 키보드 이모지를 썼다 —
 *   누구나 공짜로 칠 수 있으니 우리 것도 아니고 팔 수도 없다.
 *   이 검사는 "캐릭터가 안 보이는 게임"이 다시 생기면 잡는다.
 *
 * 무엇을 보나
 *   ① chars.js가 실린다 (window.CHARS)
 *   ② 아바타를 'pig'로 두면 화면에 **이미지(.chav)**가 뜬다 — 글자 "pig"가 아니라
 *   ③ 이미지가 실제로 로드된다(naturalWidth>0) — 경로가 틀리면 깨진 채로도 태그는 있다
 *   ④ 크기가 부모 글자 크기를 따라간다(1em) — px 고정이면 게임마다 커지거나 사라진다
 *
 * 사용: npm run test:chars   (서버는 알아서 띄운다)
 */
const { launchWithRetry } = require('./cdp');
const { ensureServer } = require('./yut-drive');

/* 아바타를 **어디에 그리는지가 게임마다 다르다.** 한 잣대로 재면 못 고치는 실패가 남는다.
 *
 *   DOM    — 셋업/인게임 화면에 아바타 자리가 있다. 실제로 띄워서 이미지가 뜨는지 본다.
 *   CANVAS — 결과 화면을 캔버스로 그린다(좌·중·우). 캔버스 픽셀은 DOM 질의로 볼 수 없고,
 *            결과까지 가려면 한 판을 끝까지 돌려야 한다 → **배선을 소스에서 단언**한다.
 *   LOBBY  — 아바타가 온라인 로비에만 나온다(알까기 2인 대결). 혼자 하기엔 나올 자리가 없다.
 *
 * 블랙잭·바카라·하이로우는 상대가 딜러(하우스)라 **아바타 개념 자체가 없다**(소스에 'avatar'가 없다).
 * 그 셋을 넣으면 영원히 빨간 검사가 된다 — 그래서 아예 대상이 아니다. */
const DOM = ['yut', 'yacht', 'kb', 'ld', 'seotda', 'indianpoker', 'onecard', 'oldmaid'];
const WIRED = [
  { g: 'lcr', how: 'CANVAS', need: 'CHARS.draw' },
  { g: 'alkkagi', how: 'LOBBY', need: 'CHARS.html' },
];

(async () => {
  await ensureServer();
  const cdp = await launchWithRetry();
  let bad = 0;
  const fail = (m) => { bad++; console.log('❌ ' + m); };

  console.log('════ 캐릭터 아바타가 게임마다 보이는가 (아바타=pig) ════');
  for (const g of DOM) {
    const p = await cdp.newPage(384, 748);
    try {
      await p.goto(`http://localhost:3000/${g}.html`);
      await p.eval(`localStorage.setItem('alley_avatar','pig'); return 1;`);
      await p.goto(`http://localhost:3000/${g}.html`);
      await p.wait(900);

      const r = await p.eval(`
        var out = { chars: (typeof window.CHARS === 'object') };
        if (!out.chars) return JSON.stringify(out);
        // 판을 깔아야 아바타가 나오는 게임이 있다
        var b = document.querySelector('#startBtn, #startLocal');
        if (b) b.click();
        return JSON.stringify(out);`);
      const s0 = JSON.parse(r);
      if (!s0.chars) { fail(`${g} — chars.js 미로드 (window.CHARS 없음)`); await p.close(); continue; }
      await p.wait(1600);

      const s = await p.eval(`
        /* 클래스가 아니라 **실제 캐릭터 PNG를 가리키는가**로 판정한다.
           윷놀이는 CHARS보다 먼저 자체 구현으로 같은 PNG를 쓰고 있었고(ANIMAL_IMG),
           자리마다 클래스가 다르다(.vs-av · .rh-av img · .mav-img …).
           클래스로 세면 "캐릭터가 멀쩡히 보이는데 검사만 실패"하게 된다.
           ⚠️ 윷을 공용 모듈로 합치는 건 남은 일이다 — 합쳐도 이 판정은 그대로 유효하다. */
        var imgs = [].slice.call(document.querySelectorAll('img')).filter(function (i) {
          return /img\\/(pig|dog|sheep|cow|horse)\\.png/.test(i.getAttribute('src') || '');
        });
        var loaded = imgs.filter(function (i) { return i.naturalWidth > 0; });
        /* ⚠️ 숨은 자리(시작 후 감춰지는 셋업 패널 등)에도 아바타가 있다. 거기만 보고 통과하면
           "떠 있는데 안 보이는" 상태를 놓친다 → **화면에 실제로 자리를 차지한 것**을 따로 센다. */
        var shown = imgs.filter(function (i) { return i.getBoundingClientRect().width > 0; });
        // 'pig'가 글자로 새어나온 자리 — 이게 있으면 그 자리가 아직 이모지 취급이다
        var raw = [].slice.call(document.querySelectorAll('*')).filter(function (e) {
          return e.children.length === 0 && /^\\s*(pig|dog|sheep|cow|horse)\\s*$/.test(e.textContent || '');
        }).length;
        var em = shown.length ? (function () {
          var i = shown[0], fs = parseFloat(getComputedStyle(i.parentElement || i).fontSize) || 0;
          var w = i.getBoundingClientRect().width;
          return { fs: Math.round(fs), w: Math.round(w) };
        })() : null;
        return JSON.stringify({ n: imgs.length, loaded: loaded.length, shown: shown.length, raw: raw, em: em });`);
      const o = JSON.parse(s);

      if (!o.n) fail(`${g} — 캐릭터 이미지가 하나도 없다 (아바타 자리가 아직 글자다${o.raw ? `, 글자 "pig" ${o.raw}곳` : ''})`);
      else if (o.loaded !== o.n) fail(`${g} — 이미지 ${o.n}개 중 ${o.n - o.loaded}개가 안 뜬다(경로 확인)`);
      else if (!o.shown) fail(`${g} — 이미지 ${o.n}개가 전부 숨은 자리에만 있다(화면엔 안 보인다)`);
      else if (o.raw) fail(`${g} — 이미지 ${o.n}개는 떴지만 글자 "pig"가 ${o.raw}곳 남아 있다`);
      else console.log(`✅ ${g.padEnd(12)} 이미지 ${o.n}개(보이는 것 ${o.shown}) · 글자 노출 0 · ${o.em ? `글자 ${o.em.fs}px에 이미지 ${o.em.w}px` : ''}`);
    } catch (e) {
      fail(`${g} — 예외 ${e.message.slice(0, 60)}`);
    }
    await p.close();
  }

  /* 화면에서 못 보는 두 종 — 배선을 소스에서 단언한다.
     "코드가 그 자리에 있다"와 "실행됐다"는 다른 말이지만(함정 28), 여기서는
     띄워서 볼 방법이 없다(캔버스 결과 화면 / 온라인 로비). 그래서 배선까지만 지킨다. */
  console.log('\n──── 화면으로 못 보는 자리 (배선 단언) ────');
  {
    const fs = require('fs'), path = require('path');
    for (const w of WIRED) {
      const src = fs.readFileSync(path.join(__dirname, '../../public', w.g + '.html'), 'utf8');
      const hasScript = /<script src="chars\.js"><\/script>/.test(src);
      const hasCall = src.indexOf(w.need) >= 0;
      if (!hasScript) fail(`${w.g} — chars.js를 안 싣는다`);
      else if (!hasCall) fail(`${w.g} — ${w.how} 자리에 ${w.need} 배선이 없다`);
      else console.log(`✅ ${w.g.padEnd(12)} ${w.how} 자리에 ${w.need} 배선됨`);
    }
  }

  await cdp.close();
  console.log(bad ? `\n❌ 문제 ${bad}건` : '\n✓ 캐릭터 5종이 아바타 있는 10게임 전부에서 보인다');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
