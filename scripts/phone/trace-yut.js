#!/usr/bin/env node
/**
 * 윷놀이 실기기 트레이스 — **JS 밖에서 무엇이 시간을 먹나**를 가른다.
 *
 * 앞선 결론(2026-08-05, `profile-yut-ai.js`):
 *   실기기 30초 CPU 프로파일에서 **JS 실행은 전체의 1% 남짓**이었다(idle 22.0s · program 7.5s · JS 0.35s).
 *   연출을 줄이는 실험이 전부 실패한 이유가 여기 있다 — 병목이 자바스크립트가 아니다.
 *   그런데 샘플링 프로파일러는 그 `(program)` 7.5초의 정체를 말해주지 않는다(V8 밖은 이름이 없다).
 *   → Tracing 도메인으로 **스타일 계산 · 레이아웃 · 페인트 · 래스터 · 합성**을 이름별로 가른다.
 *
 * 준비:
 *   export PATH=$PATH:~/Library/Android/sdk/platform-tools
 *   SOCK=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
 *   adb forward tcp:9223 localabstract:$SOCK
 *
 * 사용:
 *   node scripts/phone/trace-yut.js                  # 20초 트레이스
 *   node scripts/phone/trace-yut.js --ms=30000 --json=out/trace.json
 *
 * ⚠️ 트레이스는 그 자체로 무겁다(수집 오버헤드). **절대값이 아니라 비율**을 보는 도구다.
 */
const { attach } = require('./phone-cdp');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const argv = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const MS = +(argv('ms') || 20000);
const JSON_OUT = argv('json');
const BASE = argv('base') || 'https://localhost';
const N = +(argv('n') || 4);

const SETTLE = `var sk=document.getElementById('coSkip');
  if(sk && sk.getBoundingClientRect().width>0){ sk.click(); return true; }
  var b=document.getElementById('throwBtn'); if(!b) return false;
  b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  setTimeout(function(){ window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); }, 260);
  return true;`;
const READY = `var b=document.getElementById('board'); if(!b) return false;
  var r=b.getBoundingClientRect(); if(r.width<=4||r.height<=4) return false;
  var sk=document.getElementById('coSkip'); return !(sk && sk.getBoundingClientRect().width>0);`;

/* 조작 — profile-yut-ai.js와 같은 검증된 절차(함정 16: 던지기는 꾹 눌렀다 떼기) */
const throwYut = async (p, hold = 260) => {
  const ok = await p.eval(`var b=document.getElementById('throwBtn');
    if(!b||b.disabled) return false;
    b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return true;`);
  if (!ok) return false;
  await p.wait(hold);
  await p.eval(`window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); return true;`);
  return true;
};
const pickPiece = p => p.eval(`
  var t=document.querySelector('#pieceTray .tp.movable'); if(t){t.onclick(); return 'tray';}
  var g=document.querySelector('#pieceLayer .pcpiece.mv'); if(g){g.onclick(); return 'board';}
  return null;`);
const resolveDir = p => p.eval(`
  var gh=document.querySelector('#pieceLayer .stepghost'); if(gh&&gh.onclick){gh.onclick(); return 'stepghost';}
  var st=document.getElementById('dirSt'); if(st&&st.offsetParent!==null){st.onclick(); return 'dirSt';}
  return false;`);
const state = p => p.eval(`
  var b=document.getElementById('throwBtn'), ov=document.getElementById('resultOv');
  return { over:!!(ov&&ov.classList.contains('on')),
    throwable:!!b&&!b.disabled&&b.offsetParent!==null,
    mv:document.querySelectorAll('#pieceLayer .pcpiece.mv').length,
    tray:document.querySelectorAll('#pieceTray .tp.movable').length,
    ghost:document.querySelectorAll('#pieceLayer .stepghost').length };`);
async function turn(p) {
  const st = await state(p);
  if (st.over) { await p.eval(`var b=document.getElementById('againBtn'); if(b)b.click(); return true;`); await p.wait(2500); return false; }
  if (!st.throwable) {
    if (st.ghost) { await resolveDir(p); await p.wait(600); return false; }
    if (st.mv || st.tray) { if (await pickPiece(p)) { await p.wait(300); await resolveDir(p); await p.wait(1500); return true; } }
    await p.wait(300); return false;
  }
  await throwYut(p);
  await p.wait(1500);
  if (await pickPiece(p)) { await p.wait(300); await resolveDir(p); await p.wait(1700); return true; }
  await p.wait(600); return false;
}

/* 이름을 사람 말로. 트레이스 이벤트 이름은 크로미움 내부 용어다. */
const LABEL = {
  RasterTask: '래스터(타일 그리기)',
  Paint: '페인트(그릴 목록 만들기)',
  PaintImage: '이미지 페인트',
  Layout: '레이아웃(위치·크기 계산)',
  UpdateLayoutTree: '스타일 계산',
  UpdateLayerTree: '레이어 정리',
  CompositeLayers: '합성',
  Commit: '커밋(합성 스레드로 넘기기)',
  FunctionCall: 'JS 함수 호출',
  EvaluateScript: 'JS 평가',
  TimerFire: '타이머 콜백',
  FireAnimationFrame: 'rAF 콜백',
  ParseHTML: 'HTML 파싱',
  DecodeImage: '이미지 디코드',
  GPUTask: 'GPU 작업',
  'ThreadControllerImpl::RunTask': '스레드 작업(기타)',
};

(async () => {
  const p = await attach();
  console.log('붙음:', await p.eval('location.href'));
  await p.goto(BASE + '/yut.html');
  await p.wait(1200);
  await p.eval(`try{ if(window.TUT) TUT.close(); }catch(e){} return true;`);
  await p.eval(`var b=document.querySelector('#optCount .opt[data-n="${N}"]'); if(b) b.click(); return true;`);
  await p.wait(300);
  await p.eval(`var s=document.getElementById('startBtn'); if(s) s.click(); return true;`);
  await p.wait(2500);
  for (let i = 0; i < 30; i++) {
    if (await p.eval(READY).catch(() => false)) break;
    await p.eval(SETTLE).catch(() => {});
    await p.wait(600);
  }
  await p.wait(1200);

  // ── 트레이스 수집: dataCollected 이벤트를 직접 받는다(phone-cdp는 콘솔만 훅한다)
  const events = [];
  p.ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.method === 'Tracing.dataCollected' && m.params && m.params.value) events.push(...m.params.value);
  });
  const done = new Promise(res => {
    p.ws.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch (e) { return; }
      if (m.method === 'Tracing.tracingComplete') res();
    });
  });

  await p.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: { includedCategories: ['disabled-by-default-devtools.timeline', 'devtools.timeline', 'toplevel'] }
  });
  console.log(`판 준비됨 — ${MS / 1000}초 트레이스 시작`);

  const t0 = Date.now(); let turns = 0;
  while (Date.now() - t0 < MS) { if (await turn(p).catch(() => false)) turns++; }

  await p.send('Tracing.end');
  await Promise.race([done, new Promise(r => setTimeout(r, 15000))]);
  await p.wait(500);

  // ── 집계: 완료(X) 이벤트의 dur을 이름별·스레드별로 합친다
  const byName = new Map(), byThread = new Map();
  let total = 0;
  for (const e of events) {
    if (e.ph !== 'X' || typeof e.dur !== 'number') continue;
    const n = e.name;
    byName.set(n, (byName.get(n) || 0) + e.dur);
    const th = e.tid;
    byThread.set(th, (byThread.get(th) || 0) + e.dur);
    total += e.dur;
  }
  /* ⚠️ 그냥 이름별로 합치면 **컨테이너가 1·2등을 차지한다**(RunTask·ThreadControllerImpl::RunTask는
     '무슨 일'이 아니라 '작업 하나'를 감싸는 껍데기고, 그 안에 페인트·JS가 다시 들어 있다).
     게다가 스레드가 여러 개라 합계가 실제 시간(벽시계)을 훌쩍 넘는다.
     → **무슨 일인지 이름이 분명한 것만** 골라 묶고, 벽시계 대비 비율로 본다. */
  const BUCKET = {
    '스타일 계산': ['UpdateLayoutTree', 'ScheduleStyleRecalculation', 'InvalidateLayout'],
    '레이아웃': ['Layout', 'PrePaint', 'UpdateLayerTree'],
    '페인트(그릴 목록)': ['Paint', 'PaintImage'],
    '래스터(타일 그리기)': ['RasterTask', 'TaskGraphRunner::RunTask'],
    '합성·커밋': ['CompositeLayers', 'Commit', 'ProxyImpl::BeginMainFrame'],
    'GPU·GL 그리기': ['DrawFn_DrawGL', 'GPUTask'],
    'JS': ['FunctionCall', 'EvaluateScript', 'TimerFire', 'FireAnimationFrame', 'v8.callFunction', 'MajorGC', 'MinorGC'],
    '이미지 디코드': ['DecodeImage', 'Decode Image'],
  };
  const wallMs = MS;
  const buckets = Object.keys(BUCKET).map(k => ({
    name: k,
    ms: +(BUCKET[k].reduce((a, n) => a + (byName.get(n) || 0), 0) / 1000).toFixed(1)
  })).sort((a, b) => b.ms - a.ms);
  const rows = [...byName.entries()].map(([n, us]) => ({ name: n, ms: +(us / 1000).toFixed(1) }))
    .sort((a, b) => b.ms - a.ms);

  console.log(`\n진행한 턴 ${turns} · 이벤트 ${events.length}개 · 벽시계 ${(wallMs / 1000).toFixed(0)}초`);
  if (!turns) console.log('❌ 턴이 하나도 안 굴렀다 — 이 트레이스는 AI 구간의 근거가 못 된다.');
  console.log('\n무슨 일에 시간이 갔나 (ms · 벽시계 대비)');
  console.log('─'.repeat(52));
  for (const b of buckets) {
    if (!b.ms) continue;
    console.log(String(b.ms).padStart(9) + '  ' + String((b.ms / wallMs * 100).toFixed(0) + '%').padStart(5) + '  ' + b.name);
  }
  console.log('\n(참고) 원본 이름 상위 8 — 껍데기 포함');
  for (const r of rows.slice(0, 8)) console.log(String(r.ms).padStart(9) + '  ' + (LABEL[r.name] || r.name));

  if (JSON_OUT) {
    const f = path.resolve(JSON_OUT);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ at: new Date().toISOString(), ms: MS, turns, totalMs: +(total / 1000).toFixed(1), buckets, rows }, null, 1));
    console.log('\n저장: ' + f);
  }

  await p.goto(BASE + '/');
  p.close();
  process.exit(0);
})().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
