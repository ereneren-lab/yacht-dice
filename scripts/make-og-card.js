#!/usr/bin/env node
/**
 * 링크 미리보기 카드를 만든다 — 허브 1장(`public/og-card.jpg`) + **게임별 13장**(`public/og/<게임>.jpg`).
 *
 * 왜 필요한가 (2026-08-07)
 *   이 서비스가 퍼지는 길은 '친구와 하기'로 만든 **방 링크를 카카오톡에 붙여넣는 것**이다.
 *   그 링크는 `ld.html?room=ABCD` 같은 **게임 페이지** 주소라, 받는 사람이 보는 카드도 그 게임 것이다.
 *   처음엔 태그가 허브에만 있어 맨 URL로 떴고, 태그를 넣은 뒤에도 카드가 공용 한 장이라
 *   **무슨 게임에 초대받았는지**가 안 보였다.
 *
 * 재료는 **여기서 직접 찍는다.** 처음엔 실기기 캡처를 썼는데 그 폰에 저장돼 있던 깨진 별명
 *   ("나ㅎ쳐퍞")이 홍보물에 그대로 박혔다 — 남의 기기 상태가 섞이면 안 된다.
 *   빈 프로필로 로컬 서버를 열어 기본 이름으로 찍는다.
 *
 * 사용: node server.js 띄운 뒤  npm run og:card        (전체)
 *       npm run og:card -- ld seotda                  (일부만)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { launchWithRetry } = require('./browser-test/cdp');
const META = require('./game-meta');

const ROOT = path.join(__dirname, '..');
const OUTDIR = path.join(ROOT, 'public', 'og');
/* 허브 카드에 세울 3종 — 성격이 서로 다른 것으로 고른다(판·화투·주사위). */
const HUB_PICKS = ['alkkagi', 'seotda', 'kb'];

async function shoot(cdp, key) {
  const m = META[key];
  const p = await cdp.newPage(390, 844);
  await p.goto('http://localhost:3000/' + key + '.html');
  await p.wait(900);
  await p.eval(`try{ if(window.TUT) TUT.close(); }catch(e){} return true;`);
  await p.eval(`var b=document.querySelector('${m.start}'); if(b) b.click(); return true;`).catch(() => {});
  await p.wait(m.wait);
  const f = path.join(ROOT, 'out', `og-src-${key}.png`);
  await p.shot(f);
  await p.close();
  return f;
}

const uri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

const CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;overflow:hidden;
    font-family:'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif;
    background:radial-gradient(120% 120% at 12% 0%, #241d16 0%, #15110d 62%);
    color:#f3ece0;display:flex;align-items:center}
  .left{padding:0 0 0 76px}
  .kicker{display:inline-flex;align-items:center;gap:9px;font-size:20px;font-weight:800;
    letter-spacing:.02em;color:#e0a23c;border:1.5px solid rgba(224,162,60,.42);
    border-radius:999px;padding:8px 18px}
  .kicker i{width:9px;height:9px;border-radius:50%;background:#e0a23c;display:block}
  .tag{font-size:41px;font-weight:800;color:#e0a23c;letter-spacing:-.02em}
  .meta{margin-top:30px;display:flex;gap:12px}
  .chip{font-size:20px;font-weight:700;color:#cdbfa8;background:rgba(255,255,255,.055);
    border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:11px 17px;white-space:nowrap}
  .ph{position:absolute;border-radius:32px;overflow:hidden;border:1.5px solid rgba(255,255,255,.14);
    box-shadow:0 34px 70px rgba(0,0,0,.62), 0 0 0 1px rgba(0,0,0,.5)}
  .ph img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
  .fade{position:absolute;inset:0 0 0 auto;width:104px;
    background:linear-gradient(90deg, rgba(21,17,13,0) 0%, rgba(21,17,13,.92) 72%, #15110d 100%)}`;

/* 허브 카드 — 서비스 전체를 판다. 폰 세 대를 겹쳐 '여러 개가 있다'를 그림으로 말한다. */
const hubHtml = (imgs) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
  .left{width:640px}
  h1{font-size:126px;line-height:.98;font-weight:900;letter-spacing:-.035em;margin:26px 0 0}
  .tag{margin-top:16px}
  .right{position:relative;width:560px;height:630px}
  .ph{width:236px;height:492px}
  .a{left:2px;top:80px;transform:rotate(-6.5deg)}
  .b{left:150px;top:46px;transform:rotate(-1deg);z-index:2}
  .c{left:298px;top:84px;transform:rotate(5.5deg)}
</style></head><body>
  <div class="left">
    <div class="kicker"><i></i>설치 없이 · 브라우저에서 바로</div>
    <h1>딱세판만</h1>
    <div class="tag">커피 걸고 딱 세 판</div>
    <div class="meta"><div class="chip">보드·주사위·카드 13가지</div><div class="chip">링크 하나로 친구와</div></div>
  </div>
  <div class="right">
    <div class="ph a"><img src="${imgs[0]}"></div>
    <div class="ph b"><img src="${imgs[1]}"></div>
    <div class="ph c"><img src="${imgs[2]}"></div>
    <div class="fade"></div>
  </div>
</body></html>`;

/* 게임 카드 — **초대장**이다. 받는 사람이 알아야 할 건 셋: 무슨 게임인지, 얼마 걸리는지, 누가 부르는지.
   그래서 게임 이름을 제일 크게, 화면은 한 대만 크게 세운다. */
const gameHtml = (key, img) => {
  const m = META[key];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
  .left{width:660px}
  .brand{font-size:23px;font-weight:800;color:#a89a86;letter-spacing:.06em;margin-top:24px}
  h1{font-size:104px;line-height:1.0;font-weight:900;letter-spacing:-.035em;margin:6px 0 0}
  .tag{font-size:34px;margin-top:14px;color:#cdbfa8;font-weight:700}
  .right{position:relative;width:540px;height:630px}
  .ph{width:286px;height:562px;left:96px;top:34px;transform:rotate(-3deg)}
</style></head><body>
  <div class="left">
    <div class="kicker"><i></i>친구가 부르는 중 · 설치 없이 바로</div>
    <div class="brand">딱세판만</div>
    <h1>${m.name}</h1>
    <div class="tag">${m.desc}</div>
    <div class="meta"><div class="chip">한 판 ${m.time}</div><div class="chip">링크 누르면 바로 입장</div></div>
  </div>
  <div class="right"><div class="ph"><img src="${img}"></div><div class="fade"></div></div>
</body></html>`;
};

async function render(cdp, html, outFile) {
  const p = await cdp.newPage(1200, 630);
  // 카드는 정확히 1200×630이어야 한다(레티나 2배로 찍으면 2400이 된다)
  await p.s('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  const tmp = path.join(ROOT, 'out', 'og-tmp.html');
  fs.writeFileSync(tmp, html);
  await p.goto('file://' + tmp);
  await p.wait(700);
  /* PNG로 뽑으니 346KB였다. 미리보기 이미지는 작아야 확실히 뜬다 → JPEG. */
  const { data } = await p.s('Page.captureScreenshot', { format: 'jpeg', quality: 86 });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(data, 'base64'));
  await p.close();
  return Math.round(fs.statSync(outFile).size / 1024);
}

(async () => {
  const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const keys = only.length ? only.filter(k => META[k]) : Object.keys(META);
  if (!keys.length) { console.error('❌ 아는 게임이 없다:', only.join(' ')); process.exit(1); }

  const cdp = await launchWithRetry();
  const shots = {};
  for (const k of keys) shots[k] = await shoot(cdp, k);

  let big = 0;
  for (const k of keys) {
    const kb = await render(cdp, gameHtml(k, uri(shots[k])), path.join(OUTDIR, k + '.jpg'));
    if (kb > 300) big++;
    console.log(`  og/${(k + '.jpg').padEnd(18)} ${String(kb).padStart(4)}KB  ${META[k].name}`);
  }

  // 허브 카드는 3종이 다 찍혔을 때만 다시 만든다(일부만 돌렸으면 건드리지 않는다)
  if (HUB_PICKS.every(k => shots[k])) {
    const kb = await render(cdp, hubHtml(HUB_PICKS.map(k => uri(shots[k]))), path.join(ROOT, 'public', 'og-card.jpg'));
    console.log(`  og-card.jpg (허브)     ${String(kb).padStart(4)}KB`);
  }
  await cdp.close();
  console.log(`✅ 카드 ${keys.length}장${big ? ` · ⚠️ 300KB 넘는 것 ${big}장(카카오톡이 건너뛸 수 있다)` : ''}`);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
