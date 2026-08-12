/* 허브 첫인상 실측 — 폰 사이즈로 캡처 + 첫 게임카드 위치·총 스크롤 측정 */
const { launchWithRetry, requireServer } = require('./cdp');
const path = require('path');
const OUT = process.env.SHOT_OUT || path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });

async function run(){
  if(!(await requireServer('http://localhost:3000/'))){ console.log('서버 없음'); process.exit(1); }
  const cdp = await launchWithRetry();
  try {
    const W=+(process.env.SW||384), H=+(process.env.SH||748);
    const page = await cdp.newPage(W, H);
    await page.goto('http://localhost:3000/');
    await new Promise(r=>setTimeout(r,600));
    await page.shot(path.join(OUT,process.env.SHOT_NAME||"hub-first.png"));   // 첫 화면
    const m = await page.eval(`
      var doc = document.documentElement;
      var firstCard = document.querySelector('.cards .card, .card');
      var r = firstCard ? firstCard.getBoundingClientRect() : null;
      var det = document.getElementById('allGames');
      return JSON.stringify({
        viewportH: ${H},
        docH: doc.scrollHeight,
        screens: +(doc.scrollHeight/${H}).toFixed(2),
        firstCardTop: r ? Math.round(r.top) : -1,
        firstCardPct: r ? Math.round(r.top/${H}*100) : -1,
        allGamesOpen: det ? det.hasAttribute('open') : null,
        brandText: (document.querySelector('h1')||{}).textContent||'',
        cardsVisibleAboveFold: Array.from(document.querySelectorAll('.card')).filter(function(c){var b=c.getBoundingClientRect();return b.top>=0 && b.bottom<=${H};}).length
      });
    `);
    console.log(m);
    await page.close();
  } finally { await cdp.close(); }
}
run().catch(e=>{ console.error(e); process.exit(1); });
