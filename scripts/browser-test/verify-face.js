/**
 * 표정(감정) 회귀 검사 — 캐릭터 표정 스왑이 안 깨지게 지킨다.
 *
 * 왜 (2026-08-18)
 *   표정은 캐릭터마다 점진적으로 채워진다(지금은 pig만 6/6). 그래서 "전부 있어야 통과"로 묶으면
 *   롤아웃 내내 빨간불이라 쓸모가 없다. 대신:
 *     · **바뀌면 안 되는 것**(이벤트→emotion 배선, reactImg 폴백 규칙, 기존 아트 규격)은 **하드 단언**
 *     · **채워지는 중인 것**(캐릭터별 6표정 완성도)은 **커버리지 리포트**(실패 아님)
 *   배선은 아트와 무관하게 안정적이라, 리팩터가 reactCard 인자나 faceSrc 규칙을 조용히 깨면 여기서 걸린다.
 *
 * 순수 node — 브라우저 불필요(정적 소스 + PNG 헤더 파싱 + reactImg 셰임).
 * 사용: node scripts/browser-test/verify-face.js
 */
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '../../public');
const IMG = path.join(PUB, 'img');
const R = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${!ok && detail ? ' — ' + detail : ''}`);
};

// 표정 6종과 그 발화 이벤트(윷) — ART_BRIEF.md의 매핑이 정본이다.
const EMO = ['star', 'surprise', 'happy', 'sad', 'angry', 'cheer'];
const EVENT = { star: '윷·모', surprise: '빽도', happy: '잡음', sad: '잡힘', angry: '늪', cheer: '우승' };

// ── 1) yut.html 배선: 5 emotion(reactCard) + cheer(resHero) ─────────────────
{
  const yut = R('yut.html');
  for (const e of ['star', 'surprise', 'happy', 'sad', 'angry']) {
    check(`배선(yut) — ${e} (${EVENT[e]})`,
      new RegExp(`reactCard\\([^)]*'${e}'`).test(yut),
      `reactCard(...,'${e}') 없음`);
  }
  check('배선(yut) — cheer (우승 히어로 resHero)',
    /faceSrc\(\s*\w+\s*,\s*'cheer'\s*\)/.test(yut),
    "resHero의 faceSrc(av,'cheer') 스왑 없음");

  /* 📱 폰에서도 살아 있는가 — 2026-08-20에 여기서 크게 데였다.
     reactCard가 `#charCards`(캐릭터 카드)만 찾고 있었는데 그 요소는 **781px 미만에서 display:none**이다.
     즉 표정 다섯이 폰에서 통째로 죽어 있었다(아트 63장 중 폰에 뜨는 건 cheer 18장뿐이었다).
     고친 방식: `avatarImgs(pid)`가 **보이는** 아바타를 전부 모은다 — 카드 / 던지는 캐릭터 / 상단 칩.
     이 셋 중 하나라도 빠지면 그 폭에서 표정이 사라진다. 그래서 셋을 각각 단언한다. */
  check('배선(yut) — avatarSel: 아바타가 사는 자리들을 모으는 함수가 있다',
    /function\s+avatarSel\s*\(/.test(yut),
    'avatarSel이 없다 — reactCard가 카드만 보면 폰에서 표정이 안 뜬다');
  check('배선(yut) — reactCard가 CHARS.reactSel(avatarSel(...))를 쓴다',
    /function\s+reactCard[\s\S]{0,900}CHARS\.reactSel\(\s*avatarSel\(/.test(yut),
    'reactCard가 카드만 직접 찾고 있다(폰에서 죽는다)');
  for (const [sel, why] of [
    ['#charCards',      '데스크톱 캐릭터 카드(≥781px)'],
    ['.thrower',        '폰 — 던지는 캐릭터(차례인 사람)'],
    ['.players-strip',  '폰 — 상단 칩(차례가 아닌 사람. sad가 여기로 온다)'],
  ]) {
    check(`배선(yut) — avatarSel이 ${sel} 를 본다 (${why})`,
      new RegExp(`function\\s+avatarSel[\\s\\S]{0,700}${sel.replace(/[.#]/g, '\\$&')}`).test(yut),
      `${sel} 를 안 본다 — 그 폭에서 표정이 사라진다`);
  }
}

/* ── 1-b) 카드게임 배선 (2026-08-25) ────────────────────────────────────────
   표정이 윷놀이에서만 뜨던 것을 카드게임으로 넓혔다. 아트 108장의 값이 12게임으로 퍼진다.
   이 게임들은 자리를 `el.innerHTML=...`로 통째로 다시 그린다 —
   **그래서 `CHARS.hold`(표정 기억)와 render 끝의 `CHARS.reapply`(다시 붙이기)가 한 쌍이다.**
   실측: 짝이 없으면 스왑이 1회 일어나고도 **화면엔 0회로 남는다**(다음 렌더가 지운다).
   둘 중 하나만 있으면 조용히 죽으므로 **둘 다** 단언한다. */
{
  const WIRED = [
    ['seotda.html', '섯다 — 쇼다운(aiReactions)·큰 베팅'],
    ['indianpoker.html', '인디언 포커 — 쇼다운(resultFx)'],
    ['onecard.html', '원카드 — 공격 카드·판 종료'],
    ['oldmaid.html', '도둑잡기 — 조커 넘김(jokerFX)·판 종료'],
    ['yacht.html', '요트 — 대박 콤보(star)·0점(sad)'],
    ['kb.html', '너클본즈 — 부숨(happy/star)·부서짐(sad/angry)·판 종료'],
  ];
  for (const [file, why] of WIRED) {
    const src = R(file);
    const fn = /yacht/.test(file) ? 'facePid' : 'faceSeat';     // 요트만 pid로 찾는다(나머지는 자리 번호)
    const key = /yacht/.test(file) ? 'data-pid' : 'data-seat';
    check(`배선(${file}) — ${fn}가 CHARS.hold를 쓴다 (${why})`,
      new RegExp(`function\\s+${fn}[\\s\\S]{0,400}CHARS\\.hold\\(`).test(src),
      'hold가 아니면 다음 렌더가 표정을 지운다');
    check(`배선(${file}) — render 끝에서 CHARS.reapply를 부른다`,
      /CHARS\.reapply\(\)/.test(src),
      'reapply가 없으면 표정이 화면에 남지 않는다');
    check(`배선(${file}) — 선택자에 [${key}]를 쓴다`,
      new RegExp(`function\\s+${fn}[\\s\\S]{0,400}${key}`).test(src),
      '플레이어별로 구분되지 않으면 엉뚱한 얼굴이 바뀐다');
  }
}

// ── 2) chars.js API + faceSrc 경로 규칙 ─────────────────────────────────────
{
  const chars = R('chars.js');
  check('chars.js — reactImg 존재', /reactImg\s*:/.test(chars));
  check('chars.js — reactSel 존재 (보이는 아바타만 고른다)', /reactSel\s*:/.test(chars));
  check('chars.js — reactSel이 getBoundingClientRect로 가시성을 판정한다',
    /reactSel[\s\S]{0,600}getBoundingClientRect/.test(chars),
    '숨은 요소에서 스왑하면 아무도 못 본다(2026-08-20 폰 버그)');
  check('chars.js — hold/reapply 쌍 존재 (렌더가 지우는 것을 막는다)',
    /hold\s*:\s*function/.test(chars) && /reapply\s*:\s*function/.test(chars));
  check('chars.js — faceSrc 존재', /faceSrc\s*:/.test(chars));
  check("chars.js — faceSrc 규칙: img/{id}_{emotion}.png",
    /faceSrc[\s\S]{0,140}['"]img\/['"]\s*\+\s*id\s*\+\s*['"]_['"]\s*\+\s*emotion\s*\+\s*['"]\.png['"]/.test(chars),
    '경로 조립 규칙이 바뀌었다 — 아트 파일명과 어긋난다');
}

// ── 3) reactImg 폴백 로직 (셰임) ────────────────────────────────────────────
{
  let probes = [];
  global.Image = class { constructor() { this.naturalWidth = 0; probes.push(this); } set src(v) { this._src = v; } get src() { return this._src; } };
  const timers = [];
  global.setTimeout = (fn) => { timers.push(fn); return timers.length; };
  global.clearTimeout = () => {};
  global.document = { readyState: 'complete', getElementById: () => null, createElement: () => ({}), head: { appendChild() {} }, documentElement: { appendChild() {} }, addEventListener() {} };
  global.window = global; global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  delete require.cache[require.resolve(path.join(PUB, 'chars.js'))];
  require(path.join(PUB, 'chars.js'));
  const C = global.CHARS;
  const mkEl = (src) => ({ src, attrs: {}, getAttribute(k) { return this.attrs[k] || null; }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } });

  const el1 = mkEl('img/pig.png');
  probes = []; C.reactImg(el1, 'pig', 'happy', 1000); probes[0].onerror();
  check('reactImg — 없는 표정이면 기본 이미지 유지(폴백)', el1.src === 'img/pig.png');

  const el2 = mkEl('img/dog.png');
  probes = []; timers.length = 0; C.reactImg(el2, 'dog', 'star', 1000);
  probes[0].naturalWidth = 512; probes[0].onload();
  const swapped = el2.src === 'img/dog_star.png';
  timers[0] && timers[0]();
  check('reactImg — 있는 표정이면 스왑 후 복귀', swapped && el2.src === 'img/dog.png');

  const el3 = mkEl('x');
  probes = []; C.reactImg(el3, '🎲', 'happy', 1000);
  check('reactImg — 이모지 아바타는 무시', probes.length === 0 && el3.src === 'x');
}

// ── 4) 캐릭터 아트: 기존 파일 규격 하드 단언 + 완성도 커버리지 리포트 ──────────
function pngDim(p) {
  try {
    const b = fs.readFileSync(p);
    if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return null;   // PNG 시그니처
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  } catch (e) { return null; }
}
const IDS = [...R('chars.js').matchAll(/\bid:\s*'([a-z]+)'/g)].map(m => m[1]);
check('chars.js — 캐릭터 id 파싱', IDS.length >= 5, `${IDS.length}종: ${IDS.slice(0, 6).join(',')}…`);

let badArt = [];
const coverage = [];
for (const id of IDS) {
  // 베이스는 반드시 있어야 하고 정사각이어야 한다
  const base = pngDim(path.join(IMG, id + '.png'));
  if (!base) badArt.push(id + '.png[없음/깨짐]');
  else if (base.w !== base.h) badArt.push(`${id}.png[${base.w}x${base.h} 비정사각]`);
  // 표정: 있는 것만 검증(없는 건 커버리지로만)
  let have = 0;
  for (const e of EMO) {
    const d = pngDim(path.join(IMG, `${id}_${e}.png`));
    if (d == null) continue;   // 아직 안 만든 표정 — OK(롤아웃 중)
    have++;
    if (d.w !== d.h) badArt.push(`${id}_${e}.png[${d.w}x${d.h} 비정사각]`);
    else if (base && d.w !== base.w) badArt.push(`${id}_${e}.png[${d.w}≠베이스${base.w}]`);
  }
  coverage.push({ id, have });
}
check('아트 — 존재하는 표정/베이스 규격 정상(정사각·베이스와 동일 크기)', badArt.length === 0,
  badArt.length ? badArt.join(' · ') : '어긋남 없음');

// 커버리지 리포트(실패 아님)
const done = coverage.filter(c => c.have === 6).map(c => c.id);
const partial = coverage.filter(c => c.have > 0 && c.have < 6).map(c => `${c.id}(${c.have}/6)`);
const none = coverage.filter(c => c.have === 0).map(c => c.id);
console.log(`\n📊 표정 커버리지: 완성 ${done.length}/${IDS.length}종` +
  (done.length ? ` [${done.join(',')}]` : '') +
  (partial.length ? ` · 진행중 [${partial.join(',')}]` : '') +
  (none.length ? ` · 미착수 ${none.length}종` : ''));

const fail = results.filter(r => !r.ok);
console.log(`\n${fail.length ? '❌' : '✓'} ${results.length - fail.length}/${results.length} 통과 (배선·로직·기존아트)`);
process.exit(fail.length ? 1 : 0);
