#!/usr/bin/env node
/**
 * 윷놀이 'ai 구간' CPU 프로파일 — **함수 단위로** 시간을 가른다.
 *
 * 왜 필요한가 (2026-08-05):
 *   `perf-yut-phone.js`는 fps를 구간별로 잰다. 그 결과가 매 측정 일관되게 말한 것은 하나다 —
 *   **`ai` 구간이 늘 제일 나쁘다**(42~58fps · p95 32~90ms · 최악 108~176ms). `idle`은 85~90fps.
 *   그런데 fps는 '누가 먹었나'를 말해주지 않는다. 연출을 줄이는 실험은 전부 실패했고
 *   (전/후 교차 3쌍에서 차이 없음 — outputs/production/2026-08-04_dice-alley_yut-phase2.md 4-2),
 *   `longtask`(50ms↑)는 거의 0으로 잡히는데 30~40ms짜리는 거기 안 걸린다.
 *   → 샘플링 프로파일러로 **자기시간(self time)** 을 함수별로 모은다. 코드는 한 줄도 안 고친다.
 *
 * 준비:
 *   export PATH=$PATH:~/Library/Android/sdk/platform-tools
 *   SOCK=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
 *   adb forward tcp:9223 localabstract:$SOCK
 *
 * 사용:
 *   node scripts/phone/profile-yut-ai.js                 # 4인(AI 3) 판을 깔고 12초 프로파일
 *   node scripts/phone/profile-yut-ai.js --ms=20000      # 더 길게
 *   node scripts/phone/profile-yut-ai.js --json=out/prof.json
 *
 * ⚠️ 샘플링은 100µs 간격이라 '있었다/없었다'는 정확하지만 절대 ms는 근사다. **순위**를 보는 도구다.
 */
const { attach } = require('./phone-cdp');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const argv = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const MS = +(argv('ms') || 12000);
const JSON_OUT = argv('json');
const BASE = argv('base') || 'https://localhost';
const N = +(argv('n') || 4);

/* 선 뽑기를 통과시킨다 — 윷 던지기는 꾹 눌렀다 떼는 조작이라 click()으론 안 된다. */
const SETTLE = `var sk=document.getElementById('coSkip');
  if(sk && sk.getBoundingClientRect().width>0){ sk.click(); return true; }
  var b=document.getElementById('throwBtn'); if(!b) return false;
  b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  setTimeout(function(){ window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); }, 260);
  return true;`;

const READY = `var b=document.getElementById('board'); if(!b) return false;
  var r=b.getBoundingClientRect(); if(r.width<=4||r.height<=4) return false;
  var sk=document.getElementById('coSkip'); return !(sk && sk.getBoundingClientRect().width>0);`;

/* ── 조작 — `perf-yut-phone.js`의 검증된 절차를 그대로 쓴다.
   ⚠️ 처음엔 `.tp:not(.done)`·`#ghostOk` 같은 짐작 셀렉터로 짰다가 **판이 "내 차례"에서 멈춘 채로
      14초를 재버렸다**(그 프로파일은 AI 턴이 아니라 가만히 있는 판이었다). 실제 클래스는
      `.tp.movable` · `.pcpiece.mv` · `.stepghost`이고, 클릭은 `.onclick()` 직접 호출이어야 한다.
      던지기는 꾹 눌렀다 떼는 조작이라 click()으로는 안 된다(함정 16). */
const throwYut = async (p, holdMs = 260) => {
  const ok = await p.eval(`var b=document.getElementById('throwBtn');
    if(!b||b.disabled) return false;
    b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return true;`);
  if (!ok) return false;
  await p.wait(holdMs);
  await p.eval(`window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); return true;`);
  return true;
};
/** 대기 말부터 꺼낸다 — 안 그러면 같은 말만 밀어 판 위 말이 1~2개뿐인 가짜 조건이 된다 */
const pickPiece = p => p.eval(`
  var t=document.querySelector('#pieceTray .tp.movable'); if(t){t.onclick(); return 'tray';}
  var g=document.querySelector('#pieceLayer .pcpiece.mv'); if(g){g.onclick(); return 'board';}
  return null;`);
const resolveDir = p => p.eval(`
  var gh=document.querySelector('#pieceLayer .stepghost'); if(gh&&gh.onclick){gh.onclick(); return 'stepghost';}
  var st=document.getElementById('dirSt'); if(st&&st.offsetParent!==null){st.onclick(); return 'dirSt';}
  return false;`);
const state = p => p.eval(`
  var b=document.getElementById('throwBtn'), ov=document.getElementById('resultOv'), ti=document.getElementById('turnInfo');
  return { over:!!(ov&&ov.classList.contains('on')),
    throwable:!!b&&!b.disabled&&b.offsetParent!==null,
    mv:document.querySelectorAll('#pieceLayer .pcpiece.mv').length,
    tray:document.querySelectorAll('#pieceTray .tp.movable').length,
    ghost:document.querySelectorAll('#pieceLayer .stepghost').length,
    info:ti?ti.textContent.trim().slice(0,40):'',
    pieces:document.querySelectorAll('#pieceLayer .pcpiece').length };`);

/** 한 턴. 진행됐으면 true. 굳으면 사유를 stalls에 남긴다(조용히 시간만 흐르는 걸 막는다). */
async function turn(p, stalls) {
  const st = await state(p);
  if (st.over) { await p.eval(`var b=document.getElementById('againBtn'); if(b)b.click(); return true;`); await p.wait(2500); return false; }
  if (!st.throwable) {
    if (st.mv || st.tray || st.ghost) {
      if (st.ghost) { await resolveDir(p); await p.wait(600); return false; }
      if (await pickPiece(p)) { await p.wait(300); await resolveDir(p); await p.wait(1500); return true; }
    }
    stalls[st.info || '(빈 안내)'] = (stalls[st.info || '(빈 안내)'] || 0) + 1;
    await p.wait(300); return false;
  }
  await throwYut(p);
  await p.wait(1500);
  if (await pickPiece(p)) { await p.wait(300); await resolveDir(p); await p.wait(1700); return true; }
  await p.wait(600); return false;
}

/** 프로파일 노드 트리 → 함수별 자기시간(ms) 집계 */
function aggregate(profile) {
  const byId = new Map();
  for (const n of profile.nodes) byId.set(n.id, n);
  const selfTicks = new Map();          // nodeId → 샘플 수
  for (const s of profile.samples || []) selfTicks.set(s, (selfTicks.get(s) || 0) + 1);

  // timeDeltas는 샘플 간 간격(µs). 총 시간으로 샘플 하나의 평균 무게를 낸다.
  const totalUs = (profile.timeDeltas || []).reduce((a, b) => a + b, 0);
  const nSamples = (profile.samples || []).length || 1;
  const usPerSample = totalUs / nSamples;

  const rows = [];
  for (const [id, ticks] of selfTicks) {
    const n = byId.get(id); if (!n) continue;
    const f = n.callFrame || {};
    const name = f.functionName || '(anonymous)';
    const where = (f.url || '').split('/').pop() + ':' + ((f.lineNumber | 0) + 1);
    rows.push({ name, where, ms: +(ticks * usPerSample / 1000).toFixed(1), ticks });
  }
  rows.sort((a, b) => b.ms - a.ms);
  return { rows, totalMs: +(totalUs / 1000).toFixed(1), nSamples };
}

(async () => {
  const p = await attach();
  console.log('붙음:', await p.eval('location.href'));

  await p.goto(BASE + '/yut.html');
  await p.wait(1200);
  await p.eval(`try{ if(window.TUT) TUT.close(); }catch(e){} return true;`);

  // 인원 선택 — AI 턴을 최대한 많이 만들려면 사람 1 + AI 여럿
  await p.eval(`var b=document.querySelector('#optCount .opt[data-n="${N}"]'); if(b) b.click(); return true;`);
  await p.wait(300);
  await p.eval(`var s=document.getElementById('startBtn'); if(s) s.click(); return true;`);
  await p.wait(2500);

  for (let i = 0; i < 30; i++) {
    if (await p.eval(READY).catch(() => false)) break;
    await p.eval(SETTLE).catch(() => {});
    await p.wait(600);
  }
  await p.wait(1500);
  console.log('판 준비됨 — 프로파일 ' + (MS / 1000) + '초 시작');

  await p.send('Profiler.enable');
  await p.send('Profiler.setSamplingInterval', { interval: 100 });   // 100µs
  await p.send('Profiler.start');

  const t0 = Date.now();
  const stalls = {};
  let turns = 0;
  while (Date.now() - t0 < MS) {
    if (await turn(p, stalls).catch(() => false)) turns++;
  }

  const { profile } = await p.send('Profiler.stop');
  const { rows, totalMs, nSamples } = aggregate(profile);

  /* ⚠️ 이 줄이 결과의 유효성을 가른다 — 진행한 턴이 0이면 '가만히 있는 판'을 잰 것이다.
     최상위 let은 window에 없다(함정 18) → 상태는 DOM으로 읽는다. */
  const st = await state(p).catch(() => null);
  console.log('\n진행한 턴:', turns, '· 굳은 지점:', JSON.stringify(stalls), '· 끝 상태:', JSON.stringify(st));
  if (!turns) console.log('❌ 턴이 하나도 안 굴렀다 — 이 프로파일은 AI 구간의 근거가 못 된다.');
  console.log(`샘플 ${nSamples}개 · 총 ${totalMs}ms\n`);
  console.log('자기시간 상위 25 (ms · 함수 · 위치)');
  console.log('─'.repeat(64));
  for (const r of rows.slice(0, 25)) {
    console.log(String(r.ms).padStart(8) + '  ' + r.name.padEnd(26).slice(0, 26) + '  ' + r.where);
  }

  if (JSON_OUT) {
    const f = path.resolve(JSON_OUT);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ at: new Date().toISOString(), ms: MS, n: N, turns, stalls, totalMs, nSamples, rows }, null, 1));
    console.log('\n저장: ' + f);
  }

  await p.goto(BASE + '/');   // 폰을 허브로 되돌려 놓는다
  p.close();
  process.exit(0);
})().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
