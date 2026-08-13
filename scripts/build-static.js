#!/usr/bin/env node
/**
 * 정적 배포 번들을 만든다 — `dist-static/`.
 *
 * 왜 (2026-08-07)
 *   실측: Render 무료 티어가 잠들면 **첫바이트 21.6초**(깨어 있으면 0.26초).
 *   그런데 이 서비스의 서버는 하는 일이 둘뿐이다 — ① 정적 파일 주기 ② 웹소켓 방.
 *   13종 게임은 전부 브라우저에서 돈다. **정적 파일을 CDN에 올리면 첫 방문이 즉시 뜬다.**
 *   방(온라인 대전)만 그대로 게임 서버로 붙는다(`public/net.js`의 GAME_SERVER).
 *
 *   서비스워커(캐시 우선)는 **이미 와 본 사람**만 구한다. 이건 **처음 온 사람**을 구하는 쪽이다.
 *
 * 무엇이 달라지나
 *   · 정적: CDN(Cloudflare Pages·Netlify·GitHub Pages 등) — 잠들지 않는다
 *   · 방:   지금 서버 그대로(wss://…onrender.com) — 처음 붙을 때 한 번은 깨우느라 느릴 수 있다
 *
 * 사용:
 *   node scripts/build-static.js                     기본(주소는 지금 Render 주소 그대로)
 *   SITE_URL=https://내주소 node scripts/build-static.js   새 주소로 미리보기 태그까지 바꿔서
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist-static');
const OLD_URL = 'https://yacht-dice-jxva.onrender.com';
const SITE_URL = (process.env.SITE_URL || OLD_URL).replace(/\/+$/, '');
/* 하위 경로 배포(GitHub Pages의 `/저장소이름/`) 대응.
   ⚠️ `sw.js`가 `'/index.html'`처럼 **도메인 루트 기준 절대경로**로 캐시를 채운다 —
      하위 경로에 올리면 그 경로들이 전부 404가 되어 서비스워커가 통째로 무용지물이 된다
      (그게 첫 방문 21.6초를 막는 장치라 조용히 죽으면 제일 아프다).
   그래서 base가 있으면 sw.js·manifest의 절대경로에 접두사를 붙인다. */
const BASE = (() => { try { const u = new URL(SITE_URL); return u.pathname.replace(/\/+$/, ''); } catch (e) { return ''; } })();

/* 번들에 넣지 않을 것 — 개발용 사본이나 산출물이 섞이면 CDN에 올라간다 */
const SKIP = new Set(['.DS_Store']);

/** public/ 전체 내용의 해시 8자리 — 서비스워커 캐시 이름에 박는다(아래 sw.js 처리 참고).
 *  sw.js 자신은 뺀다(자기 해시를 자기 안에 넣을 수 없다). 내용이 한 글자라도 바뀌면 값이 바뀐다. */
function bundleStamp(dir) {
  const h = require('crypto').createHash('sha1');
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      if (SKIP.has(e.name)) continue;
      const p = path.join(d, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { walk(p, r); continue; }
      if (r === 'sw.js') continue;
      h.update(r).update(fs.readFileSync(p));
    }
  };
  walk(dir, '');
  return h.digest('hex').slice(0, 8);
}
const STAMP = bundleStamp(path.join(__dirname, '..', 'public'));

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  let n = 0, bytes = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { const r = copyDir(s, d); n += r.n; bytes += r.bytes; continue; }
    let buf = fs.readFileSync(s);
    /* 주소가 바뀌면 **미리보기 태그·계측 도메인**이 옛 주소를 가리킨 채 남는다 —
       공유 카드가 엉뚱한 곳을 가리키고 방문 집계가 갈라진다. 텍스트 파일만 치환한다. */
    if (SITE_URL !== OLD_URL && /\.(html|js|json|webmanifest|css)$/.test(e.name)) {
      buf = Buffer.from(buf.toString('utf8').split(OLD_URL).join(SITE_URL), 'utf8');
    }
    /* 🔴 2026-08-11 — **캐시 이름을 손으로 올리는 걸 아무도 안 했다.**
       sw.js는 캐시 우선이라(21초 콜드스타트를 피하려고 그렇게 만들었다) 캐시 이름이 그대로면
       배포해도 옛 파일이 계속 나간다. 실제로 새 캐릭터가 안 보인다는 신고가 그것이었다.
       → 번들 내용의 해시를 캐시 이름에 박는다. 내용이 바뀌면 이름이 저절로 바뀌고,
         activate에서 옛 캐시가 지워져 새 파일이 즉시 닿는다. 손으로 올릴 일이 없어진다. */
    /* 🔴 2026-08-13 — **앱(OTA)에 새 코드가 영영 안 닿고 있었다.**
       앱은 서비스워커를 안 쓰고(sw-reg.js가 네이티브에서 빠진다) 안드로이드 웹뷰의 HTTP 캐시가 잡는데,
       그 캐시가 `max-age=600`이 지나도 재검증을 건너뛴다(실측: 배포 후에도 옛 함수 그대로).
       GitHub Pages는 Cache-Control을 못 바꾸니(600 고정) **주소를 바꾸는 수밖에 없다.**
       → 로컬 js/css 주소에 번들 해시를 박는다: `juice.js` → `juice.js?v=<해시>`.
       ⚠️ 건드리면 안 되는 것 둘:
          · 외부 스크립트(`//gc.zgo.at/count.js`) — 슬래시가 있어 아래 정규식이 안 잡는다.
          · `sw.js` — 등록 주소가 바뀌면 브라우저가 **다른 서비스워커로 본다**(등록이 갈라진다). */
    if (/\.html$/.test(e.name)) {
      let t = buf.toString('utf8');
      t = t.replace(/(<script\s[^>]*src=")([A-Za-z0-9._-]+\.js)(")/g,
                    (m, a, src, b) => (src === 'sw.js' ? m : a + src + '?v=' + STAMP + b));
      t = t.replace(/(<link\s[^>]*href=")([A-Za-z0-9._-]+\.css)(")/g,
                    (m, a, href, b) => a + href + '?v=' + STAMP + b);
      buf = Buffer.from(t, 'utf8');
    }

    if (e.name === 'sw.js') {
      /* SHARED는 페이지가 실제로 요청하는 주소와 같아야 프리캐시가 쓸모 있다.
         페이지가 `juice.js?v=abc`를 부르는데 SW가 `/juice.js`를 담아두면 서로 못 만난다. */
      buf = Buffer.from(buf.toString('utf8').replace(
        /const SHARED = \[([\s\S]*?)\];/,
        (m, body) => 'const SHARED = [' + body.replace(/'(\/[A-Za-z0-9._-]+\.(?:js|css))'/g,
          (mm, path) => `'${path}?v=${STAMP}'`) + '];'), 'utf8');
      buf = Buffer.from(buf.toString('utf8').replace(
        /const CACHE = '([^']+)'/,
        (_, cur) => `const CACHE = '${cur.replace(/-[0-9a-f]{8}$/, '')}-${STAMP}'`), 'utf8');
    }
    if (BASE && (e.name === 'sw.js' || e.name === 'manifest.json')) {
      let t = buf.toString('utf8');
      t = t.replace(/(['"])\/(?!\/)/g, `$1${BASE}/`);   // '/index.html' → '/저장소/index.html'
      buf = Buffer.from(t, 'utf8');
    }
    fs.writeFileSync(d, buf); n++; bytes += buf.length;
  }
  return { n, bytes };
}

if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
const { n, bytes } = copyDir(SRC, OUT);

/* 캐시 규칙 — Netlify·Cloudflare Pages가 읽는 형식.
   HTML은 매번 재검증(배포 즉시 반영), 나머지는 길게. 서비스워커는 절대 캐시하지 않는다
   (여기가 캐시되면 옛 서비스워커가 살아남아 새 배포가 영영 안 보인다). */
fs.writeFileSync(path.join(OUT, '_headers'), `/*
  Cache-Control: public, max-age=3600
/*.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/manifest.json
  Cache-Control: no-cache
/*.png
  Cache-Control: public, max-age=604800
/*.jpg
  Cache-Control: public, max-age=604800
`);

const mb = (bytes / 1024 / 1024).toFixed(1);
console.log(`✅ dist-static/ — 파일 ${n}개 · ${mb}MB · 주소 ${SITE_URL}${BASE ? ` (하위 경로 ${BASE} 보정 적용)` : ''}`);
console.log('   확인:  npx serve dist-static  또는  node scripts/serve-static.js');
console.log('   ⚠️ 방(온라인)은 이 번들이 아니라 게임 서버로 붙는다 — net.js의 GAME_SERVER');
