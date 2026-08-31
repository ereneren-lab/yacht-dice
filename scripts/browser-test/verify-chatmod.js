/**
 * verify-chatmod.js — chatmod.js(채팅 뮤트·신고 레이어) 로직 단독 검증.
 *
 * 왜 이렇게 (about:blank + 소스 주입)
 *   실제 게임 페이지(yut.html 등)를 goto하면 analytics·폰트 등 외부 호스트를 기다리다
 *   헤드리스가 멎어(exit 143) 검증이 안 된다. 그래서 여기선 빈 페이지에 최소 채팅 DOM과
 *   chatmod.js **소스만** 주입해 레이어 로직만 순수하게 확인한다 — 외부 의존 0.
 *
 * 검증 항목
 *   1) chatmod 로드 → window.CHATMOD 노출
 *   2) 남의 메시지(.cmsg:not(.me))에 ⋯(.cmod-dot) 자동 부착 (MutationObserver)
 *   3) 내 메시지(.me)엔 ⋯ 안 붙음
 *   4) ⋯ 클릭 → 메뉴(뮤트/신고) 뜸
 *   5) 뮤트 → 그 이름 메시지 숨김 + localStorage alley_muted 반영 + 이후 메시지도 숨김
 *   6) 신고 → 숨김 + 자동 뮤트
 */
const fs = require('fs');
const path = require('path');
const { launchWithRetry, requireServer } = require('./cdp');

// 최소 채팅 픽스처(외부 의존 0)를 로컬 서버가 서빙한다. #chatLog·mock addChat·chatmod.js만.
// public/에 잠깐 썼다가 finally에서 지운다 — 테스트 파일이 배포본에 새어들지 않게.
const FIXTURE_PATH = path.join(__dirname, '../../public/_chatmod_fixture.html');
const URL = 'http://localhost:3000/_chatmod_fixture.html';
const FIXTURE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>chatmod fixture</title>
<style>:root{--muted:#9a8f80}.cmsg{padding:4px}</style></head><body>
<div class="chatbox"><div class="chatlog" id="chatLog"></div></div>
<script>
  window.__esc = function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  window.addChat = function(name, text, mine){
    var log = document.getElementById('chatLog');
    var d = document.createElement('div');
    d.className = 'cmsg' + (mine ? ' me' : '');
    d.innerHTML = '<b>' + window.__esc(name) + '</b>' + window.__esc(text);
    log.appendChild(d); return d;
  };
</script>
<script src="chatmod.js"></script>
</body></html>`;

async function main() {
  await requireServer('http://localhost:3000/');
  fs.writeFileSync(FIXTURE_PATH, FIXTURE_HTML);
  const cdp = await launchWithRetry();
  const page = await cdp.newPage();
  let pass = 0, fail = 0;
  const ok = (name, cond, extra) => { (cond ? pass++ : fail++); console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra && !cond ? ' — ' + extra : '')); };

  try {
    await page.goto(URL);
    await page.eval('localStorage.clear();');
    await page.wait(400);   // boot()의 setInterval(250ms)이 #chatLog를 잡을 시간

    ok('1) CHATMOD 로드', await page.eval('return typeof window.CHATMOD === "object" && typeof window.CHATMOD.mute === "function";'));

    // 남의 메시지 추가 → observer가 ⋯ 붙여야
    await page.eval('window.addChat("상대방", "안녕", false);');
    await page.wait(150);
    ok('2) 남 메시지에 ⋯ 부착',
      await page.eval('return document.querySelectorAll("#chatLog .cmsg:not(.me) .cmod-dot").length === 1;'),
      await page.eval('return "cmsg="+document.querySelectorAll("#chatLog .cmsg").length+" dot="+document.querySelectorAll(".cmod-dot").length;'));

    // 내 메시지엔 안 붙어야
    await page.eval('window.addChat("나", "내말", true);');
    await page.wait(150);
    ok('3) 내 메시지엔 ⋯ 없음',
      await page.eval('return document.querySelectorAll("#chatLog .cmsg.me .cmod-dot").length === 0;'));

    // ⋯ 클릭 → 메뉴
    await page.eval('document.querySelector("#chatLog .cmsg:not(.me) .cmod-dot").click();');
    await page.wait(80);
    ok('4) ⋯ 클릭 → 메뉴 표시',
      await page.eval('var m=document.getElementById("cmodMenu"); return !!m && m.querySelectorAll("button[data-a]").length === 2;'));

    // 뮤트 클릭
    await page.eval('var b=document.querySelector("#cmodMenu button[data-a=mute]"); b.click();');
    await page.wait(120);
    ok('5a) 뮤트 → 그 메시지 숨김',
      await page.eval('var m=document.querySelector("#chatLog .cmsg:not(.me)"); return m.style.display === "none";'));
    ok('5b) 뮤트 → localStorage alley_muted 반영',
      await page.eval('try{return JSON.parse(localStorage.getItem("alley_muted")||"[]").indexOf("상대방")>=0;}catch(e){return false;}'));

    // 뮤트 이후 같은 사람 새 메시지도 숨겨져야
    await page.eval('window.addChat("상대방", "또옴", false);');
    await page.wait(150);
    ok('5c) 뮤트 후 새 메시지도 숨김',
      await page.eval('var all=[].slice.call(document.querySelectorAll("#chatLog .cmsg:not(.me)")); return all.length>=2 && all.every(function(m){return m.style.display==="none";});'));

    // 신고 경로: 새 사람 메시지 → ⋯ → 신고 → 숨김 + 뮤트
    await page.eval('window.addChat("악당", "욕설", false);');
    await page.wait(150);
    await page.eval('var dots=document.querySelectorAll("#chatLog .cmsg:not(.me) .cmod-dot"); dots[dots.length-1].click();');
    await page.wait(80);
    await page.eval('document.querySelector("#cmodMenu button[data-a=report]").click();');
    await page.wait(120);
    ok('6) 신고 → 숨김 + 자동 뮤트',
      await page.eval('try{var muted=JSON.parse(localStorage.getItem("alley_muted")||"[]").indexOf("악당")>=0; var hidden=[].slice.call(document.querySelectorAll("#chatLog .cmsg")).some(function(m){return /악당/.test(m.textContent)&&m.style.display==="none";}); return muted&&hidden;}catch(e){return false;}'));

    if (page.errors.length) console.log('  ⚠️ 콘솔 오류:', page.errors.slice(0, 5).join(' | '));
    console.log(`\n  결과: ${pass} 통과 / ${fail} 실패`);
  } finally {
    await page.close();
    await cdp.close();
    try { fs.unlinkSync(FIXTURE_PATH); } catch (e) {}
  }
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('실패:', e.message); process.exit(1); });
