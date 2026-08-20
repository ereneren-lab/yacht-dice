#!/usr/bin/env node
/**
 * 지표 보기 — GoatCounter에서 숫자를 직접 받아 퍼널로 보여준다. (npm run stats)
 *
 * 왜 있나 (2026-08-18)
 *   "대시보드를 눈으로 봐 주세요"가 몇 번을 요청해도 안 닫히는 문이었다. 그 사이 온라인 방이 나흘,
 *   윷 상점 캐릭터가 일주일 죽어 있었는데 아무도 신고하지 않았다 — **사람이 있는지조차 몰랐기 때문이다.**
 *   눈으로 보는 일을 한 번의 토큰 발급으로 바꾼다. 그 뒤로는 아무 때나 숫자를 뽑을 수 있다.
 *
 * 토큰 (저장소에 넣지 않는다)
 *   GoatCounter → 우상단 사용자명 → API → 토큰 만들기(읽기 권한이면 충분) → show 로 복사
 *   umask 077 && printf '%s' '토큰' > ~/.goatcounter-token
 *   또는 GOATCOUNTER_TOKEN 환경변수.
 *
 * 사용
 *   npm run stats            최근 7일
 *   npm run stats -- 1       오늘
 *   npm run stats -- 30      최근 30일
 *
 * ⚠️ 레이트리밋 4req/s — 아래에서 순차 호출하며 간격을 둔다.
 */
'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

const SITE = 'sepan.goatcounter.com';           // analytics.js·analytics-toggle.js와 같은 사이트
const DAYS = parseInt(process.argv[2], 10) || 7;

function token() {
  if (process.env.GOATCOUNTER_TOKEN) return process.env.GOATCOUNTER_TOKEN.trim();
  const f = path.join(process.env.HOME || '', '.goatcounter-token');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch (e) { return null; }
}

/** GoatCounter가 가끔 멀쩡한 요청에 404를 준다(2026-08-20 실측: 같은 주소가 curl로는 200).
 *  한 번 튕겼다고 "데이터 없음"으로 오독하지 않도록 짧게 두 번 더 시도한다. */
async function getRetry(p, tk, n) {
  let last;
  for (let i = 0; i < (n || 3); i++) {
    try { return await get(p, tk); }
    catch (e) { last = e; if (!/^404/.test(e.message)) throw e; await sleep(400); }
  }
  throw last;
}

function get(p, tk) {
  return new Promise((res, rej) => {
    const req = https.request({ host: SITE, path: p, method: 'GET',
      headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' } }, r => {
      let b = ''; r.on('data', d => b += d);
      r.on('end', () => {
        if (r.statusCode === 401) return rej(new Error('401 — 토큰이 틀렸다'));
        if (r.statusCode === 403) return rej(new Error('403 — 토큰에 읽기 권한이 없다'));
        if (r.statusCode >= 400) return rej(new Error(r.statusCode + ' — ' + b.slice(0, 120)));
        try { res(JSON.parse(b)); } catch (e) { rej(new Error('응답을 못 읽었다: ' + b.slice(0, 120))); }
      });
    });
    req.on('error', rej);
    req.setTimeout(20000, () => { req.destroy(); rej(new Error('시간 초과')); });
    req.end();
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ymd = (d) => d.toISOString().slice(0, 10);

/* 우리가 심은 이벤트 이름들. analytics.js는 게임 이름을 **이름 안에** 붙인다
   ('게임시작-윷놀이') — GoatCounter가 이벤트에 속성을 못 달기 때문이다. 그래서 접두사로 묶는다. */
const FUNNEL = [
  ['게임시작',   '게임 시작'],
  ['1판완료',    '한 판 완료'],
  ['방만들기',   '방 만들기'],
  ['초대보내기', '초대 보내기'],
  ['초대입장',   '초대로 입장'],
];

(async () => {
  const tk = token();
  if (!tk) {
    console.log('❌ 토큰이 없다.');
    console.log('   GoatCounter → 우상단 사용자명 → API → 토큰 만들기 → show 로 복사한 뒤:');
    console.log("     umask 077 && printf '%s' '토큰' > ~/.goatcounter-token");
    console.log('   (저장소 밖이라 git에 안 들어간다. GOATCOUNTER_TOKEN 환경변수도 된다.)');
    process.exit(1);
  }
  const end = new Date();
  const start = new Date(Date.now() - (DAYS - 1) * 86400000);
  /* ⚠️ end는 **배타적**이다 — `end=오늘`로 주면 오늘 데이터가 통째로 빠진다
     (2026-08-18에 실제로 겪었다: 오늘 52건이 0으로 나왔다). 시각까지 붙여 하루를 닫는다. */
  const range = `start=${ymd(start)}T00:00:00Z&end=${ymd(end)}T23:59:59Z`;
  console.log(`\n📊 ${SITE} · ${ymd(start)} ~ ${ymd(end)} (${DAYS}일)\n`);

  let total;
  try {
    total = await getRetry(`/api/v0/stats/total?${range}`, tk);
  } catch (e) {
    console.log('❌ ' + e.message);
    if (/401|403/.test(e.message)) console.log('   토큰을 다시 만들어 ~/.goatcounter-token 에 넣을 것.');
    process.exit(1);
  }
  console.log(`  방문        ${String(total.total_unique ?? total.total ?? 0).padStart(6)} 명`);
  console.log(`  페이지 조회 ${String(total.total ?? 0).padStart(6)} 회`);

  await sleep(300);
  let hits = [];
  try {
    const r = await getRetry(`/api/v0/stats/hits?${range}&limit=200`, tk);
    hits = r.hits || [];
  } catch (e) { console.log('  (경로별 지표를 못 받았다: ' + e.message + ')'); }

  const sum = (pred) => hits.filter(h => pred(h.path || '')).reduce((a, h) => a + (h.count || 0), 0);

  console.log('\n  ── 퍼널 (이벤트) ──');
  let anyEvent = false;
  for (const [key, label] of FUNNEL) {
    const n = sum(p => p === key || p.indexOf(key + '-') === 0);
    if (n > 0) anyEvent = true;
    console.log(`  ${label.padEnd(12)} ${String(n).padStart(6)}`);
  }

  /* 초대 루프가 실제로 도는가 — 이 앱의 핵심 질문이다.
     보낸 초대 대비 들어온 사람 비율. 낮으면 링크가 안 먹히는 것이고, 높으면 바이럴이 돈다. */
  const sent = sum(p => p.indexOf('초대보내기') === 0);
  const came = sum(p => p.indexOf('초대입장') === 0);
  if (sent > 0) console.log(`\n  초대 성공률  ${came}/${sent} = ${Math.round(came / sent * 100)}%`);

  console.log('\n  ── 게임별 시작 ──');
  const byGame = hits.filter(h => (h.path || '').indexOf('게임시작-') === 0)
    .map(h => [(h.path || '').slice('게임시작-'.length), h.count || 0])
    .sort((a, b) => b[1] - a[1]);
  if (!byGame.length) console.log('   (없음)');
  byGame.slice(0, 13).forEach(([g, n]) => console.log(`  ${g.padEnd(12)} ${String(n).padStart(6)}`));

  if (!anyEvent && (total.total || 0) === 0) {
    console.log('\n⚠️ 아무 것도 안 들어왔다. 코드 쪽 전송 경로는 이미 검증됐다(npm run test:analytics:send).');
    console.log('   남은 범인 셋: ① 광고 차단기(goatcounter.com·gc.zgo.at 허용) ② 사이트 코드 ③ 아직 아무도 안 왔다.');
  } else if (!anyEvent) {
    console.log('\n⚠️ 페이지 조회는 있는데 **이벤트가 하나도 없다.** 게임을 시작한 사람이 없거나 배선이 끊긴 것이다.');
  }
  console.log('');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
