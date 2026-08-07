#!/usr/bin/env node
/**
 * 링크 미리보기 카드(1200×630)를 만든다 — `public/og-card.png`.
 *
 * 왜 필요한가 (2026-08-07)
 *   이 서비스가 퍼지는 길은 **카카오톡에 링크를 붙여넣는 것 하나**다(친구와 하기 = 링크 공유).
 *   그런데 og:image가 512 정사각 아이콘이고 twitter:card가 `summary`라, 공유하면
 *   작은 아이콘 하나만 뜬다 — 무슨 서비스인지, 재미있어 보이는지가 전혀 안 보인다.
 *
 * 무엇을 담나: 이름 · 태그라인 · **실제 플레이 화면 3장**(그림이 아니라 진짜 게임 화면이다).
 *   섬네일로 줄어들어도 읽히도록 제목을 크게 쓰고, 여백을 넉넉히 둔다.
 *
 * 재료는 **여기서 직접 찍는다.** 처음엔 실기기 캡처(out/phone-ai-*.png)를 썼는데,
 * 그 폰에 저장돼 있던 깨진 별명("나ㅎ쳐퍞")이 홍보물에 그대로 박혔다 —
 * 남의 기기 상태가 섞이면 안 된다. 빈 프로필로 새로 열어 기본 이름("나")으로 찍는다.
 *
 * 사용: node server.js 띄운 뒤  node scripts/make-og-card.js
 */
const fs = require('fs');
const path = require('path');
const { launchWithRetry } = require('./browser-test/cdp');

const ROOT = path.join(__dirname, '..');
/* 어떤 판을 보여줄까 — 한눈에 '무슨 게임인지' 읽히는 것으로 고른다.
   알까기(초록 판·돌), 섯다(화투·판돈), 너클본즈(주사위 격자). 셋 다 성격이 다르다. */
const PICKS = [
  { g: 'alkkagi', start: '#startBtn', wait: 2600 },
  { g: 'seotda',  start: '#startBtn', wait: 3400 },
  { g: 'kb',      start: '#startBtn', wait: 2600 },
];

async function shootGame(cdp, pick) {
  const p = await cdp.newPage(390, 844);
  await p.goto('http://localhost:3000/' + pick.g + '.html');
  await p.wait(900);
  await p.eval(`try{ if(window.TUT) TUT.close(); }catch(e){} return true;`);
  await p.eval(`var b=document.querySelector('${pick.start}'); if(b) b.click(); return true;`).catch(() => {});
  await p.wait(pick.wait);
  const f = path.join(ROOT, 'out', `og-src-${pick.g}.png`);
  await p.shot(f);
  await p.close();
  return f;
}

function dataUri(p) {
  return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
}

const html = (imgs) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  @font-face{font-family:'Pre';src:local('Pretendard'),local('Apple SD Gothic Neo');}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;overflow:hidden;
    font-family:'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif;
    background:radial-gradient(120% 120% at 12% 0%, #241d16 0%, #15110d 62%);
    color:#f3ece0;display:flex;align-items:center}
  /* 왼쪽 — 말 몇 마디로 끝낸다. 섬네일에서 읽히는 건 결국 제목뿐이다. */
  .left{width:640px;padding:0 0 0 76px}
  .kicker{display:inline-flex;align-items:center;gap:9px;font-size:20px;font-weight:800;
    letter-spacing:.02em;color:#e0a23c;border:1.5px solid rgba(224,162,60,.42);
    border-radius:999px;padding:8px 18px}
  .kicker i{width:9px;height:9px;border-radius:50%;background:#e0a23c;display:block}
  h1{font-size:126px;line-height:.98;font-weight:900;letter-spacing:-.035em;margin:26px 0 0}
  .tag{font-size:41px;font-weight:800;color:#e0a23c;margin-top:16px;letter-spacing:-.02em}
  .meta{margin-top:30px;display:flex;gap:12px}
  .chip{font-size:20px;font-weight:700;color:#cdbfa8;background:rgba(255,255,255,.055);
    border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:11px 17px;white-space:nowrap}
  /* 오른쪽 — 진짜 플레이 화면. 그림이 아니라 제품 자체를 보여준다. */
  .right{position:relative;width:560px;height:630px}
  .ph{position:absolute;width:236px;height:492px;border-radius:32px;overflow:hidden;
    border:1.5px solid rgba(255,255,255,.14);
    box-shadow:0 34px 70px rgba(0,0,0,.62), 0 0 0 1px rgba(0,0,0,.5)}
  .ph img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
  .ph.a{left:2px;top:80px;transform:rotate(-6.5deg)}
  .ph.b{left:150px;top:46px;transform:rotate(-1deg);z-index:2}
  .ph.c{left:298px;top:84px;transform:rotate(5.5deg)}
  /* 오른쪽 끝이 잘려 보이지 않게, 배경으로 자연스럽게 사라지게 한다 */
  /* 오른쪽 끝을 배경으로 흘려보낸다 — 잘린 게 아니라 '이어지는' 것으로 보이게 */
  .fade{position:absolute;inset:0 0 0 auto;width:104px;
    background:linear-gradient(90deg, rgba(21,17,13,0) 0%, rgba(21,17,13,.92) 72%, #15110d 100%)}
</style></head><body>
  <div class="left">
    <div class="kicker"><i></i>설치 없이 · 브라우저에서 바로</div>
    <h1>딱세판만</h1>
    <div class="tag">커피 걸고 딱 세 판</div>
    <div class="meta">
      <div class="chip">보드·주사위·카드 13가지</div>
      <div class="chip">링크 하나로 친구와</div>
    </div>
  </div>
  <div class="right">
    <div class="ph a"><img src="${imgs[0]}"></div>
    <div class="ph b"><img src="${imgs[1]}"></div>
    <div class="ph c"><img src="${imgs[2]}"></div>
    <div class="fade"></div>
  </div>
</body></html>`;

(async () => {
  const cdp = await launchWithRetry();
  const SHOTS = [];
  for (const pick of PICKS) SHOTS.push(await shootGame(cdp, pick));
  const p = await cdp.newPage(1200, 630);
  // 카드는 정확히 1200×630이어야 한다(레티나 2배로 찍으면 2400이 된다)
  await p.s('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  const file = path.join(ROOT, 'out', 'og-card.html');
  fs.writeFileSync(file, html(SHOTS.map(dataUri)));
  await p.goto('file://' + file);
  await p.wait(900);
  /* PNG로 뽑으니 346KB였다. 미리보기 이미지는 작아야 확실히 뜬다 → JPEG로 뽑는다. */
  const out = path.join(ROOT, 'public', 'og-card.jpg');
  const { data } = await p.s('Page.captureScreenshot', { format: 'jpeg', quality: 86 });
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  await p.close(); await cdp.close();
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`✅ public/og-card.jpg — 1200×630 · ${kb}KB`);
  if (kb > 300) console.log('⚠️ 300KB가 넘는다. 카카오톡 미리보기는 큰 파일을 건너뛰기도 한다 — 줄일 것.');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
