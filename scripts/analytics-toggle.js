#!/usr/bin/env node
/**
 * 계측 스위치 — 14개 HTML의 Plausible + analytics.js 로딩을 한 번에 켜고 끈다.
 *
 *   npm run analytics:status   지금 몇 개 페이지가 켜져 있나
 *   npm run analytics:on       전부 켠다
 *   npm run analytics:off      전부 끈다 (주석으로 감쌈 — 파일·호출부는 그대로)
 *
 * 왜 스크립트인가 — 2026-07-22에 손으로 껐다가 2026-08-04에 손으로 켰다. 그 사이에
 * **8개 페이지엔 Plausible 스크립트 태그가 아예 없다**는 걸 아무도 몰랐다(analytics.js만 있었다).
 * 그러면 이벤트는 큐 스텁에만 쌓이고 어디로도 안 간다 — 에러 없이 조용히 사라진다.
 * 이 스크립트는 켤 때 두 줄이 **항상 짝으로** 들어가는 걸 보장한다.
 *
 * ⚠️ 켜진 두 줄 사이에 다른 <script>를 끼워 넣지 말 것. 끌 때 주석에 갇혀 조용히 안 뜬다
 *    (CLAUDE.dice-alley.md 튜토리얼 절의 pace.js 사고가 정확히 이것이었다).
 */
const fs = require('fs');
const path = require('path');

const DOMAIN = 'yacht-dice-jxva.onrender.com';
const PUB = path.join(__dirname, '..', 'public');

const PLAUSIBLE = `<script defer data-domain="${DOMAIN}" src="https://plausible.io/js/script.js"></script>`;
const HEAD_ON = '<!-- 계측 — Plausible(쿠키리스·개인식별 없음) · privacy.html 고지 · 끄기: npm run analytics:off -->';
const HEAD_OFF = '<!-- 계측 꺼짐 — 켜기: npm run analytics:on';

const analyticsTag = (defer) => `<script src="analytics.js"${defer ? ' defer' : ''}></script>`;

// 켜진 모양: (머리 주석) + (plausible 줄) + (analytics 줄). 머리 주석은 없어도 인식한다.
const ON_RE = new RegExp(
  `(?:${esc(HEAD_ON)}\\n)?` +
  `(?:<script defer data-domain="[^"]*" src="https://plausible\\.io/js/script\\.js"></script>\\n)?` +
  `<script src="analytics\\.js"( defer)?></script>\\n`
);
/* 꺼진 모양: analytics.js **태그**를 품은 주석 블록 (2026-07-22에 손으로 만든 4가지 변종 전부).
   ⚠️ 'analytics.js'라는 글자만 찾으면 안 된다 — 튜토리얼 배치 경고 주석
      ("뒤쪽 analytics.js는 주석 블록 안이라…")이 먼저 걸려 엉뚱한 줄을 지운다. */
const OFF_RE = /<!--(?:(?!-->)[\s\S])*?<script src="analytics\.js"[^>]*><\/script>(?:(?!-->)[\s\S])*?-->\n/;

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function pages() {
  return fs.readdirSync(PUB)
    .filter(f => f.endsWith('.html'))
    .map(f => path.join(PUB, f))
    .filter(p => /<script src="analytics\.js"[^>]*><\/script>/.test(fs.readFileSync(p, 'utf8')));
}

function stateOf(src) {
  // 주석 블록을 걷어낸 뒤에도 태그가 살아 있으면 켜진 것이다
  if (/<script src="analytics\.js"[^>]*><\/script>/.test(src.replace(OFF_RE, ''))) return 'on';
  return OFF_RE.test(src) ? 'off' : 'none';
}

function turnOn(src) {
  const m = src.match(OFF_RE);
  if (!m) return null;
  const defer = / defer/.test(m[0].match(/<script src="analytics\.js"[^>]*>/)[0]);
  return src.replace(OFF_RE, `${HEAD_ON}\n${PLAUSIBLE}\n${analyticsTag(defer)}\n`);
}

function turnOff(src) {
  const m = src.match(ON_RE);
  if (!m) return null;
  return src.replace(ON_RE, `${HEAD_OFF}\n${PLAUSIBLE}\n${analyticsTag(!!m[1])}\n-->\n`);
}

const cmd = process.argv[2] || 'status';
const list = pages();
let changed = 0, on = 0, off = 0;

for (const p of list) {
  const src = fs.readFileSync(p, 'utf8');
  const st = stateOf(src);
  if (cmd === 'status') {
    console.log(`${st === 'on' ? '🟢 켜짐' : '⚪️ 꺼짐'}  ${path.basename(p)}`);
    st === 'on' ? on++ : off++;
    continue;
  }
  if (cmd === 'on' || cmd === 'off') {
    const want = cmd;
    if (st === want) { console.log(`·  ${path.basename(p)} — 이미 ${want}`); continue; }
    const next = want === 'on' ? turnOn(src) : turnOff(src);
    if (!next) { console.error(`❌ ${path.basename(p)} — 모양을 못 찾았다. 손으로 볼 것`); process.exitCode = 1; continue; }
    fs.writeFileSync(p, next);
    console.log(`${want === 'on' ? '🟢' : '⚪️'} ${path.basename(p)}`);
    changed++;
    continue;
  }
  console.error(`쓰는 법: node scripts/analytics-toggle.js [status|on|off]`);
  process.exit(1);
}

if (cmd === 'status') console.log(`\n켜짐 ${on} · 꺼짐 ${off} · 총 ${list.length}개 페이지`);
else console.log(`\n${changed}개 페이지 변경 · 총 ${list.length}개`);
