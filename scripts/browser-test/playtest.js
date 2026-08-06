/**
 * 실사용자 플레이 점검 — 13종을 **실제로 눌러 보며** 막히는 곳·조용한 오류를 찾는다.
 *
 * 기존 감사와 다른 점:
 *   audit-ux/landscape/hub는 **화면 치수**를 잰다. 이 파일은 **플레이**를 한다.
 *   셋업에서 시작을 누르고, 판이 도는지 보고, 결과창까지 가고, 다시 하기를 눌러 본다.
 *   그 과정에서 나오는 것:
 *     · 콘솔 오류 / 처리 안 된 예외 (사용자에겐 "가만히 있는 화면"으로만 보인다)
 *     · 404 요청 (아이콘·소리·이미지가 조용히 빠져 있는 경우)
 *     · **진행이 막히는 지점** — 눌러도 아무 일이 안 나는 상태가 몇 초 이상 지속
 *     · 결과창까지 못 가는 게임
 *
 * 사용: node server.js 띄운 뒤  node scripts/browser-test/playtest.js
 *       node scripts/browser-test/playtest.js yut seotda      (일부만)
 *       node scripts/browser-test/playtest.js --shots         (단계별 캡처 저장)
 */
const { launchWithRetry, requireServer } = require('./cdp');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const SHOTS = args.includes('--shots');
const ONLY = args.filter(a => !a.startsWith('--'));
const OUT = path.join(__dirname, 'out', 'playtest');
if (SHOTS) fs.mkdirSync(OUT, { recursive: true });

/* 게임마다 '시작' 버튼과 '한 수 두기'가 다르다. 여기 없는 게임은 공용 규칙으로 시도한다.
   act: 판을 굴리는 클릭 후보들(위에서부터 보이는 것 하나를 누른다) */
const GAMES = [
  /* ⚠️ 이 셀렉터들은 **짐작이 아니라 실제 DOM에서 뽑은 것**이다(2026-08-06).
     처음엔 그럴듯한 이름(#hitBtn·#acts button…)으로 짰다가 13종 중 6종이 '조작 0회'로 나왔고,
     캡처를 열어보니 게임은 멀쩡했다 — 내 셀렉터가 틀린 것이었다. 그대로 보고했으면 전부 오진이었다.
     act는 **위에서부터 먼저 보이는 것 하나**를 누른다 → 칩을 먼저 걸고 딜하도록 순서를 잡았다. */
  { g: 'kb',          start: '#startBtn',   act: ['#rollBtn', '#board .cell', '.slot'] },
  { g: 'yacht',       start: '#startLocal', act: ['#rollBtn', '#sheet td.val'] },
  { g: 'ld',          start: '#startBtn',   act: ['#bidBtn', '#callBtn', '#qplus'] },
  { g: 'lcr',         start: '#startBtn',   act: ['#rollBtn'] },
  { g: 'yut',         start: '#startBtn',   act: ['#coSkip'], hold: '#throwBtn',
    extra: ['#pieceTray .tp.movable', '#pieceLayer .pcpiece.mv', '#pieceLayer .stepghost'] },
  /* 알까기는 돌을 **당겨서 튕기는** 조작이라 버튼이 없다 — 자동 조작 대상에서 뺀다(오진 방지). */
  { g: 'alkkagi',     start: '#startBtn',   act: [], skip: '드래그 조작이라 자동 플레이 불가' },
  { g: 'seotda',      start: '#startBtn',   act: ['#betbar .bbtn', '#nextBtn', '#againBtn'] },
  { g: 'indianpoker', start: '#startBtn',   act: ['.bbtn.check', '.bbtn.call', '.bbtn.die', '#nextBtn'] },
  { g: 'onecard',     start: '#startBtn',   act: ['#myHand .card', '.hand .card', '#drawBtn'] },
  { g: 'oldmaid',     start: '#startBtn',   act: ['#myHand .card', '.hand .card', '.card', '#nextBtn'] },
  { g: 'blackjack',   start: '#startBtn',   act: ['.cchip.c25', '#dealBtn', '#hitBtn', '#standBtn'] },
  { g: 'baccarat',    start: '#startBtn',   act: ['.cchip.c50', '#dealBtn'] },
  { g: 'highlow',     start: '#startBtn',   act: ['.cchip.c50', '#dealBtn', '#hiBtn', '#loBtn'] },
];

const CLICK_FIRST = sels => `
  var sels=${JSON.stringify(sels)};
  for(var i=0;i<sels.length;i++){
    var e=document.querySelector(sels[i]);
    if(!e || e.disabled) continue;
    var r=e.getBoundingClientRect(); if(r.width<2||r.height<2) continue;
    var st=getComputedStyle(e); if(st.visibility==='hidden'||st.display==='none') continue;
    e.click(); return sels[i];
  }
  return null;`;

/* 화면이 '살아 있나' — 눈에 보이는 텍스트의 지문. 몇 초째 그대로면 막힌 것이다. */
const FINGERPRINT = `
  var b=document.body;
  var t=(b.innerText||'').replace(/\\s+/g,' ').slice(0,400);
  var ov=document.querySelector('#resultOv,#resOv,.resultov,#overOv');
  return { t:t, over: !!(ov && (ov.classList.contains('on')||getComputedStyle(ov).display!=='none')) };`;

(async () => {
  await requireServer();
  const cdp = await launchWithRetry();
  const list = ONLY.length ? GAMES.filter(x => ONLY.includes(x.g)) : GAMES;
  const report = [];

  for (const G of list) {
    const page = await cdp.newPage(390, 844);
    const rec = { g: G.g, errors: [], missing: [], stuck: 0, reachedResult: false, acts: 0, note: '' };
    if (G.skip) { rec.note = G.skip; report.push(rec); await page.close();
      console.log(`⏭️  ${G.g.padEnd(12)} 건너뜀 — ${G.skip}`); continue; }
    try {
      if (page.setMotion) await page.setMotion(true);
      // 404 등 실패한 요청을 잡는다 — 아이콘·소리가 조용히 빠져 있는 경우가 여기서 드러난다
      page.cdp.on('Network.responseReceived', (p, sid) => {
        if (sid !== page.sessionId) return;
        if (p.response && p.response.status >= 400) rec.missing.push(p.response.status + ' ' + p.response.url.split('/').pop());
      });
      await page.s('Network.enable').catch(() => {});

      await page.goto('http://localhost:3000/' + G.g + '.html');
      await page.wait(1200);
      await page.eval(`try{ if(window.TUT) TUT.close(); }catch(e){} return true;`);
      if (SHOTS) await page.shot(path.join(OUT, G.g + '-1-setup.png'));

      // 시작
      try { await page.click(G.start); } catch (e) { rec.note += '시작 버튼 못 누름; '; }
      await page.wait(2000);

      // 판을 굴린다 — 같은 화면이 계속되면 '막힘'으로 센다
      let last = '', same = 0;
      for (let i = 0; i < 26; i++) {
        if (G.hold) {
          // 꾹 눌렀다 떼는 조작(윷) — click()으로는 안 된다(함정 16)
          await page.eval(`var b=document.querySelector('${G.hold}');
            if(b&&!b.disabled){ b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return true; } return false;`).catch(() => {});
          await page.wait(260);
          await page.eval(`window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); return true;`).catch(() => {});
        }
        const hit = await page.eval(CLICK_FIRST(G.act)).catch(() => null);
        if (hit) rec.acts++;
        if (G.extra) { const x = await page.eval(CLICK_FIRST(G.extra)).catch(() => null); if (x) rec.acts++; }
        await page.wait(700);
        const fp = await page.eval(FINGERPRINT).catch(() => ({ t: '', over: false }));
        if (fp.over) { rec.reachedResult = true; break; }
        if (fp.t === last) { same++; if (same >= 6) { rec.stuck = i; break; } } else { same = 0; last = fp.t; }
      }
      if (SHOTS) await page.shot(path.join(OUT, G.g + '-2-play.png'));

      rec.errors = (page.errors || []).slice(0, 6);
    } catch (e) {
      rec.note += 'ERR ' + e.message.split('\n')[0];
    } finally { await page.close(); }
    report.push(rec);

    const bad = rec.errors.length || rec.missing.length || (!rec.reachedResult && rec.stuck);
    const mark = bad ? '⚠️ ' : '✅ ';
    console.log(`${mark}${G.g.padEnd(12)} 조작 ${String(rec.acts).padStart(2)}회 · ` +
      `결과창 ${rec.reachedResult ? '도달' : '미도달'}${rec.stuck ? `(${rec.stuck}수째 정지)` : ''} · ` +
      `오류 ${rec.errors.length} · 실패요청 ${rec.missing.length}${rec.note ? ' · ' + rec.note : ''}`);
    rec.errors.forEach(e => console.log('      ↳ ' + e.slice(0, 140)));
    [...new Set(rec.missing)].forEach(m => console.log('      ↳ 요청실패 ' + m));
  }

  const withErr = report.filter(r => r.errors.length).length;
  const noResult = report.filter(r => !r.reachedResult).length;
  console.log(`\n오류가 난 게임 ${withErr}종 · 결과창까지 못 간 게임 ${noResult}종`);
  if (SHOTS) console.log('캡처: ' + OUT);
  process.exit(0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
