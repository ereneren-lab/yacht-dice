#!/usr/bin/env node
/**
 * 윷놀이 성능 계측 — **실기기(Galaxy A16 앱 웹뷰)**. 데스크톱 헤드리스는 너무 빨라서
 * "렉 없음"이라는 거짓 결론을 준다(실측: 4배 감속에도 60fps 유지). 진짜 답은 여기서 나온다.
 *
 * 준비:
 *   export PATH=$PATH:~/Library/Android/sdk/platform-tools
 *   SOCK=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
 *   adb forward tcp:9223 localabstract:$SOCK
 *   ⚠️ 포트 9223은 공유 자원이다 — `adb forward --list`로 먼저 확인할 것.
 *
 * 사용:
 *   node scripts/phone/perf-yut-phone.js
 *   node scripts/phone/perf-yut-phone.js --variant=nograin,noshadow   # 원인 분리
 *   node scripts/phone/perf-yut-phone.js --json=out/perf-phone.json
 *
 * 끝나면 허브(https://localhost/)로 되돌려 놓는다 — 다른 작업이 폰을 쓰고 있을 수 있다.
 */
const { attach } = require('./phone-cdp');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const argv = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const VARIANTS = (argv('variant') || '').split(',').map(s => s.trim()).filter(Boolean);
const JSON_OUT = argv('json');
const BASE = argv('base') || 'https://localhost';
const WARM = +(argv('warm') || 10);
const N = +(argv('n') || 4);              // 인원(나 포함)
const LONG = +(argv('long') || 0);        // >0이면 그 시간(ms)만큼 계속 플레이하며 '긴 프레임'을 맥락과 함께 기록
const BENCH_MODE = args.includes('--bench');
const BENCH_MS = +(argv('benchms') || 4000);
const SUB = (argv('sub') || 'board,cls,fx').split(',').map(x=>x.trim());   // 어떤 하위 벤치를 돌릴지

const SAMPLE_START = `
  window.__pf = []; window.__pl = performance.now();
  (function loop(){ var n=performance.now(); window.__pf.push(n-window.__pl); window.__pl=n;
    window.__praf = requestAnimationFrame(loop); })();
  return true;`;
const SAMPLE_END = `
  cancelAnimationFrame(window.__praf);
  var f = (window.__pf||[]).slice(2);
  if (!f.length) return null;
  var s = f.slice().sort(function(a,b){return a-b});
  var q = function(p){ return s[Math.min(s.length-1, Math.floor(s.length*p))]; };
  var sum = f.reduce(function(a,b){return a+b},0);
  return { n:f.length, ms:Math.round(sum), fps:+(f.length/(sum/1000)).toFixed(1),
    p50:+q(.50).toFixed(1), p95:+q(.95).toFixed(1), worst:+s[s.length-1].toFixed(1),
    jank:f.filter(function(x){return x>50}).length, slow:f.filter(function(x){return x>33}).length };`;

/* ── 긴 세션 기록 ─────────────────────────────────────────────
   프레임이 늦은 '그 순간' 화면에 무엇이 있었는지를 같이 남긴다.
   숫자만 있으면 "느리다"까지밖에 못 가고, 무엇을 고쳐야 하는지는 안 나온다. */
/* ⚠️ 클래스 유무로 맥락을 판정하면 틀린다 — `.stick.tossing`은 애니가 끝나도(fill:both)
      다음 렌더까지 클래스가 남아 있어서, 잰 시간의 대부분이 '윷던지기'로 잘못 몰린다(실제로 그랬다).
      → **지금 실제로 돌고 있는 애니메이션**(getAnimations)으로 판정한다.
      그리고 longtask(스크립트가 메인 스레드를 잡은 시간)를 따로 모아
      '스크립트가 느린 것'과 '그리는 게 느린 것'을 가른다. */
const LONGREC_START = `
  window.__lr = { all: [], long: [], lt: [], t0: performance.now() };
  window.__lp = performance.now();
  try {
    window.__lro = new PerformanceObserver(function(list){
      list.getEntries().forEach(function(e){
        if (window.__lr.lt.length < 800) window.__lr.lt.push({ t: Math.round(e.startTime - window.__lr.t0), d: Math.round(e.duration) });
      });
    });
    window.__lro.observe({ entryTypes: ['longtask'] });
  } catch(e) { window.__lr.noLongtask = true; }
  var running = function(){
    var out = [];
    try {
      document.getAnimations().forEach(function(a){
        if (a.playState !== 'running') return;
        var t = a.effect && a.effect.target; if (!t) return;
        var cls = t.id ? '#'+t.id : (typeof t.className === 'string' ? '.'+t.className.split(' ')[0] : (t.tagName||'?'));
        out.push((a.animationName || ('transition:'+(a.transitionProperty||'?'))) + '@' + cls);
      });
    } catch(e) {}
    return out;
  };
  (function loop(){
    var n = performance.now(), d = n - window.__lp; window.__lp = n;
    window.__lr.all.push(d);
    if (d > 40 && window.__lr.long.length < 500)
      window.__lr.long.push({ t: Math.round(n - window.__lr.t0), d: Math.round(d), a: running() });
    window.__lraf = requestAnimationFrame(loop);
  })();
  return true;`;
const LONGREC_END = `
  cancelAnimationFrame(window.__lraf);
  try { window.__lro.disconnect(); } catch(e) {}
  var f = window.__lr.all.slice(2);
  var s = f.slice().sort(function(a,b){return a-b});
  var q = function(pp){ return s[Math.min(s.length-1, Math.floor(s.length*pp))]; };
  var sum = f.reduce(function(a,b){return a+b},0);
  // 긴 프레임에 '그 순간 돌고 있던 애니메이션'을 붙여 원인 후보별로 합산한다
  var buckets = {};
  window.__lr.long.forEach(function(x){
    var keys = x.a.length ? x.a : ['(애니 없음)'];
    var uniq = {}; keys.forEach(function(k){ uniq[k]=1; });
    Object.keys(uniq).forEach(function(k){
      var b = buckets[k] = buckets[k] || { n:0, worst:0, sum:0 };
      b.n++; b.sum += x.d; if (x.d > b.worst) b.worst = x.d;
    });
  });
  // 긴 프레임 중 몇 개가 longtask(스크립트)와 겹치나 — 겹치지 않으면 원인은 '그리기'다
  var lt = window.__lr.lt;
  var withScript = window.__lr.long.filter(function(x){
    return lt.some(function(e){ return e.t <= x.t && e.t + e.d >= x.t - x.d; });
  }).length;
  return { n:f.length, sec:Math.round(sum/1000), fps:+(f.length/(sum/1000)).toFixed(1),
    p50:+q(.5).toFixed(1), p95:+q(.95).toFixed(1), p99:+q(.99).toFixed(1), worst:+s[s.length-1].toFixed(1),
    slow:f.filter(function(x){return x>33}).length, jank:f.filter(function(x){return x>50}).length,
    longFrames: window.__lr.long.length, withScript: withScript,
    longtasks: lt.length, longtaskMs: lt.reduce(function(a,b){return a+b.d},0), noLongtask: !!window.__lr.noLongtask,
    buckets: buckets, top: window.__lr.long.slice().sort(function(a,b){return b.d-a.d}).slice(0,10) };`;

/* ── 결정적 A/B 벤치 ─────────────────────────────────────────
   실제 판을 굴리면 판마다 조건이 달라 전/후 비교가 안 된다.
   그래서 '말 이동'과 똑같은 무효화(0.3초마다 transform 갱신 + .28s 트랜지션)를
   같은 페이지·같은 판 위에서 반복하고, 그 사이에 후보를 하나씩 꺼보며 잰다. */
const BENCH = `
  window.__bench = function(ms){
    return new Promise(function(res){
      var g = document.querySelector('#pieceLayer .pcpiece');
      if (!g) return res(null);
      var m = /translate\\(\\s*(-?[\\d.]+)[ ,]+(-?[\\d.]+)/.exec(g.getAttribute('transform')||'');
      var ox = m?+m[1]:200, oy = m?+m[2]:200;
      // 판 바깥 링을 도는 좌표 — 실제 이동과 같은 범위를 훑어 리페인트 면적을 맞춘다
      var P=[[34,34],[117,34],[200,34],[283,34],[366,34],[366,117],[366,200],[366,283],
             [366,366],[283,366],[200,366],[117,366],[34,366],[34,283],[34,200],[34,117]];
      var f=[], last=performance.now(), t0=last, i=0, hop=last;
      (function loop(){
        var n=performance.now(); f.push(n-last); last=n;
        if (n-hop >= 300){ hop=n; var p=P[i++%P.length]; g.setAttribute('transform','translate('+p[0]+','+p[1]+')'); }
        if (n-t0 < ms) requestAnimationFrame(loop);
        else {
          g.setAttribute('transform','translate('+ox+','+oy+')');
          var s=f.slice(2).sort(function(a,b){return a-b});
          var q=function(x){ return s[Math.min(s.length-1,Math.floor(s.length*x))]; };
          var sum=s.reduce(function(a,b){return a+b},0);
          res({ n:s.length, fps:+(s.length/(sum/1000)).toFixed(1), p50:+q(.5).toFixed(1),
                p95:+q(.95).toFixed(1), p99:+q(.99).toFixed(1), worst:+s[s.length-1].toFixed(1),
                slow:s.filter(function(x){return x>33}).length, jank:s.filter(function(x){return x>50}).length });
        }
      })();
    });
  };
  return true;`;

/* 결과 오버레이(#yutFx) 전용 벤치 — 던질 때마다 뜨는 풀스크린 연출.
   긴 프레임의 78%에서 이게 돌고 있었다(측정). 실제 markup을 그대로 재현해 반복 발화시킨다. */
const BENCHFX = `
  window.__benchfx = function(rounds, big){
    return new Promise(function(res){
      var fx = document.getElementById('yutFx');
      if (!fx) { fx = document.createElement('div'); fx.id='yutFx'; document.body.appendChild(fx); }
      var f=[], last=performance.now(), raf, n=0;
      (function loop(){ var t=performance.now(); f.push(t-last); last=t; raf=requestAnimationFrame(loop); })();
      var done=function(){
        cancelAnimationFrame(raf); fx.classList.remove('on'); fx.innerHTML='';
        var s=f.slice(2).sort(function(a,b){return a-b});
        var q=function(x){ return s[Math.min(s.length-1,Math.floor(s.length*x))]; };
        var sum=s.reduce(function(a,b){return a+b},0);
        res({ n:s.length, fps:+(s.length/(sum/1000)).toFixed(1), p50:+q(.5).toFixed(1),
              p95:+q(.95).toFixed(1), p99:+q(.99).toFixed(1), worst:+s[s.length-1].toFixed(1),
              slow:s.filter(function(x){return x>33}).length, jank:s.filter(function(x){return x>50}).length });
      };
      var fire=function(){
        var dur = big?1500:800;
        fx.style.setProperty('--yf-dur',(dur/1000)+'s');
        fx.className='yutfx '+(big?'yut big':'gae small');
        fx.innerHTML='<div class="yf-dim"></div>'+(big?'<div class="yf-rays"></div>':'')
          +'<div class="yf-word">'+(big?'윷이야!':'개')+'</div>'+(big?'<div class="yf-sub">한 번 더!</div>':'');
        /* ⚠️ 2026-08-04: 여기에 **반짝이(yf-spark)가 빠져 있었다.** 그래서 1차 작업에서
           "결과 오버레이는 단독으로 거의 공짜"라는 결론이 나왔는데, 실제 resultBurst는
           폰에서 6개를 만들고 각각 will-change로 합성 레이어를 잡는다. 빠뜨린 것은 공짜로 보인다. */
        if (big) for (var i=0;i<6;i++){ var sp=document.createElement('div'); sp.className='yf-spark';
          sp.textContent=Math.random()<.5?'✦':'✧';
          var ang=Math.random()*Math.PI*2, dd=120+Math.random()*220;
          sp.style.setProperty('--dx',(Math.cos(ang)*dd).toFixed(0)+'px'); sp.style.setProperty('--dy',(Math.sin(ang)*dd).toFixed(0)+'px');
          sp.style.animationDelay=(Math.random()*.18).toFixed(2)+'s'; sp.style.color=Math.random()<.5?'#fff3cf':'#f2ce68';
          fx.appendChild(sp); }
        fx.classList.add('on');
        setTimeout(function(){ fx.classList.remove('on'); fx.innerHTML=''; }, dur);
        n++;
        if (n<rounds) setTimeout(fire, dur+350);
        else setTimeout(done, dur+400);
      };
      setTimeout(fire, 250);
    });
  };
  return true;`;

/* ── '던지기 한 번'의 실제 연출 더미(pile) 벤치 ─────────────────────────
   ⚠️ 위 BENCHFX는 **반짝이(yf-spark)도 윷가락도 없이** 오버레이만 재현한다.
      그래서 1차 작업에서 "결과 오버레이는 단독으로 거의 공짜(87.8fps)"라는 결론이 나왔는데,
      긴 세션의 최악 프레임을 뜯어보니 그 순간 실제로 돌던 것은
        yfDim + yfRays + yfRaysFade + yfWordIn + yfSubIn + yfSpark×6  (한 연출에서 11개)
        + yuttoss×4 + throwmo + respop + sbpop  (같은 순간의 다른 연출들)
      이었다. **빠뜨린 것을 안 재면 공짜로 보인다.**
   여기서는 renderSticks()가 실제로 하는 그대로를 재현한다:
     t=0     윷가락 4개 토스(0.08s 간격) + 던지는 사람 모션
     t=720   결과 글자 pop + 풀스크린 결과 오버레이(반짝이 포함)
   `resultAt`을 바꾸면 '결과를 윷가락 착지 뒤로 미루는' 설계안을 그대로 잴 수 있다. */
const BENCHPILE = `
  window.__benchpile = function(rounds, big, resultAt, opt){
    opt = opt || {};
    return new Promise(function(res){
      var fx = document.getElementById('yutFx');
      if (!fx) { fx = document.createElement('div'); fx.id='yutFx'; document.body.appendChild(fx); }
      var sticks = document.getElementById('yutsticks');
      var thrower = document.querySelector('.thrower');
      var rr = document.getElementById('throwResult');
      var f=[], last=performance.now(), raf, n=0, timers=[];
      (function loop(){ var t=performance.now(); f.push(t-last); last=t; raf=requestAnimationFrame(loop); })();
      var done=function(){
        cancelAnimationFrame(raf); timers.forEach(clearTimeout);
        fx.classList.remove('on'); fx.innerHTML='';
        var s=f.slice(2).sort(function(a,b){return a-b});
        var q=function(x){ return s[Math.min(s.length-1,Math.floor(s.length*x))]; };
        var sum=s.reduce(function(a,b){return a+b},0);
        res({ n:s.length, fps:+(s.length/(sum/1000)).toFixed(1), p50:+q(.5).toFixed(1),
              p95:+q(.95).toFixed(1), p99:+q(.99).toFixed(1), worst:+s[s.length-1].toFixed(1),
              slow:s.filter(function(x){return x>33}).length, jank:s.filter(function(x){return x>50}).length });
      };
      var burst=function(){
        var dur = big?1500:800;
        if (rr){ rr.textContent = big?'윷':'개'; rr.classList.remove('pop'); void rr.offsetWidth; rr.classList.add('pop'); }
        fx.style.setProperty('--yf-dur',(dur/1000)+'s');
        fx.className='yutfx '+(big?'yut big':'gae small');
        var html='<div class="yf-dim"></div>';
        if (big && !opt.norays) html+='<div class="yf-rays"></div>';
        html+='<div class="yf-word">'+(big?'윷이야!':'개')+'</div>';
        if (big) html+='<div class="yf-sub">한 번 더!</div>';
        fx.innerHTML=html;
        if (big && !opt.nosparks){
          var SP = opt.sparks==null ? 6 : opt.sparks;
          for(var i=0;i<SP;i++){ var s=document.createElement('div'); s.className='yf-spark'; s.textContent=Math.random()<.5?'✦':'✧';
            var ang=Math.random()*Math.PI*2, d=120+Math.random()*220;
            s.style.setProperty('--dx',(Math.cos(ang)*d).toFixed(0)+'px'); s.style.setProperty('--dy',(Math.sin(ang)*d).toFixed(0)+'px');
            s.style.animationDelay=(Math.random()*.18).toFixed(2)+'s'; s.style.color=Math.random()<.5?'#fff3cf':'#f2ce68';
            if (opt.nosparkwc) s.style.willChange='auto';
            fx.appendChild(s); }
        }
        fx.classList.add('on');
        timers.push(setTimeout(function(){ fx.classList.remove('on'); fx.innerHTML=''; }, dur));
      };
      var fire=function(){
        // ① 윷가락 토스 + 던지는 사람 (renderSticks의 isNew 경로)
        if (sticks){
          var up = big?[1,1,1,1]:[1,1,0,0], h='';
          for (var i=0;i<4;i++){
            var land = up[i]?0:180, half = up[i]?40:90, tilt=(Math.random()*12-6).toFixed(0);
            h += '<div class="stick'+(i===0?' mark':'')+' tossing" style="--landdeg:'+land+'deg;--half:'+half
               + 'deg;--tilt:'+tilt+'deg;animation-delay:'+(i*(opt.stagger==null?0.08:opt.stagger)).toFixed(2)
               + 's"><div class="face front"></div><div class="face back"></div></div>';
          }
          sticks.innerHTML=h;
        }
        if (thrower){ thrower.classList.remove('throwing'); void thrower.offsetWidth; thrower.classList.add('throwing'); }
        // ② 결과 (기본 720ms — 윷가락은 0.72s+0.24s stagger = 960ms에 착지한다)
        timers.push(setTimeout(burst, resultAt));
        n++;
        var cycle = resultAt + (big?1500:800) + 500;
        if (n<rounds) timers.push(setTimeout(fire, cycle));
        else timers.push(setTimeout(done, cycle));
      };
      timers.push(setTimeout(fire, 250));
    });
  };
  return true;`;

/* 화면 전체를 건드리는 연출(카메라 펀치·화면 흔들림·판 플래시) 벤치.
   transform/filter를 게임 전체에 걸면 그 안의 모든 것이 매 프레임 다시 그려진다.
   클래스만 붙였다 떼면 되므로 게임 로직 없이 결정적으로 잴 수 있다. */
const BENCHCLS = `
  window.__benchcls = function(sel, cls, ms, rounds, arm){
    return new Promise(function(res){
      var els = sel ? Array.prototype.slice.call(document.querySelectorAll(sel)) : [];
      var el = els[0] || null;
      var f=[], last=performance.now(), raf, n=0;
      (function loop(){ var t=performance.now(); f.push(t-last); last=t; raf=requestAnimationFrame(loop); })();
      var done=function(){
        cancelAnimationFrame(raf); els.forEach(function(e){ e.classList.remove(cls); e.style.willChange=''; });
        var s=f.slice(2).sort(function(a,b){return a-b});
        var q=function(x){ return s[Math.min(s.length-1,Math.floor(s.length*x))]; };
        var sum=s.reduce(function(a,b){return a+b},0);
        res({ n:s.length, fps:+(s.length/(sum/1000)).toFixed(1), p50:+q(.5).toFixed(1),
              p95:+q(.95).toFixed(1), p99:+q(.99).toFixed(1), worst:+s[s.length-1].toFixed(1),
              slow:s.filter(function(x){return x>33}).length, jank:s.filter(function(x){return x>50}).length });
      };
      var go=function(){ els.forEach(function(e){ e.classList.add(cls); }); };
      var fire=function(){
        els.forEach(function(e){ e.classList.remove(cls); if(arm) e.style.willChange='transform'; });
        if (el) void el.offsetWidth;
        if (arm) requestAnimationFrame(go); else go();
        n++;
        if (n<rounds) setTimeout(fire, ms+250);
        else setTimeout(done, ms+300);
      };
      setTimeout(fire, 200);
    });
  };
  return true;`;

/* 화면 전체 연출 **두 개를 동시에** 거는 벤치.
   1차 작업은 camerapunch와 scrshake를 각각 따로만 쟀다. 그런데 실제 코드에서 잡기(runCaptureFx)는
   screenFlash + screenShake + cameraPunch를 **한 줄에서 연달아** 부른다 —
   `.app`(부모)과 `#game`(자식)에 동시에 transform이 걸리는 것이라, 서로를 재래스터화한다.
   따로 잰 값의 합보다 나쁠 수 있고, 그게 사실이면 "동시에 하나만" 이라는 설계 결정의 근거가 된다. */
const BENCHPAIR = `
  window.__benchpair = function(ms, rounds, arm, both){
    return new Promise(function(res){
      var g=document.getElementById('game'), a=document.querySelector('.app');
      if(!g||!a) return res(null);
      var f=[], last=performance.now(), raf, n=0;
      (function loop(){ var t=performance.now(); f.push(t-last); last=t; raf=requestAnimationFrame(loop); })();
      var done=function(){
        cancelAnimationFrame(raf);
        g.classList.remove('camerapunch'); a.classList.remove('scrshake'); g.style.willChange=''; a.style.willChange='';
        var s=f.slice(2).sort(function(x,y){return x-y});
        var q=function(x){ return s[Math.min(s.length-1,Math.floor(s.length*x))]; };
        var sum=s.reduce(function(x,y){return x+y},0);
        res({ n:s.length, fps:+(s.length/(sum/1000)).toFixed(1), p50:+q(.5).toFixed(1),
              p95:+q(.95).toFixed(1), p99:+q(.99).toFixed(1), worst:+s[s.length-1].toFixed(1),
              slow:s.filter(function(x){return x>33}).length, jank:s.filter(function(x){return x>50}).length });
      };
      var fire=function(){
        g.classList.remove('camerapunch'); a.classList.remove('scrshake');
        if(arm){ g.style.willChange='transform'; a.style.willChange='transform'; }
        void g.offsetWidth;
        var go=function(){ a.classList.add('scrshake'); if(both) g.classList.add('camerapunch'); };
        if(arm) requestAnimationFrame(go); else go();
        n++;
        if(n<rounds) setTimeout(fire, ms+250); else setTimeout(done, ms+300);
      };
      setTimeout(fire, 200);
    });
  };
  return true;`;

const VARIANT_JS = {
  nograin: `document.querySelectorAll('#boardLayer rect[filter*="woodgrain"]').forEach(function(e){e.remove()}); return true;`,
  nonodeshadow: `document.querySelectorAll('#boardLayer circle[filter*="nodesh"]').forEach(function(e){e.removeAttribute('filter')}); return true;`,
  noshadow: `var st=document.createElement('style'); st.textContent='#pieceLayer .ring{filter:none !important}'; document.head.appendChild(st); return true;`,
  noidleanim: `var st=document.createElement('style'); st.textContent=
      '#pieceLayer .pcpiece .pcbody,#pieceLayer .pcpiece.mv .pcbody,#pieceLayer .pcpiece.lead .pclead,#pieceLayer .pcpiece.mv .ring,#twinkleG circle{animation:none !important}';
    document.head.appendChild(st); return true;`,
  noboardsh: `var e=document.querySelector('#boardLayer rect[filter*="boardsh"]'); if(e)e.removeAttribute('filter'); return true;`,
};

/* ── 조작 (yut-drive.js와 같은 규칙 · 함정 16: stepghost를 반드시 처리) ── */
async function throwYut(p, holdMs = 260) {
  const ok = await p.eval(`var b=document.getElementById('throwBtn');
    if(!b||b.disabled) return false;
    b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return true;`);
  if (!ok) return false;
  await p.wait(holdMs);
  await p.eval(`window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); return true;`);
  return true;
}
/** trayFirst=true면 대기 말부터 꺼낸다 — 안 그러면 같은 말만 밀어 판 위에 말이 1~2개뿐이라
 *  실제 플레이(6~16개)와 전혀 다른 조건에서 재게 된다. */
const pickPiece = (p, trayFirst) => p.eval(trayFirst ? `
  var t=document.querySelector('#pieceTray .tp.movable'); if(t){t.onclick(); return 'tray';}
  var g=document.querySelector('#pieceLayer .pcpiece.mv'); if(g){g.onclick(); return 'board';}
  return null;` : `
  var g=document.querySelector('#pieceLayer .pcpiece.mv'); if(g){g.onclick(); return 'board';}
  var t=document.querySelector('#pieceTray .tp.movable'); if(t){t.onclick(); return 'tray';}
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
    btn:b?b.textContent.slice(0,24):'',
    info:ti?ti.textContent.trim().slice(0,60):'',
    pieces:document.querySelectorAll('#pieceLayer .pcpiece').length };`);

/** 한 턴 — 진행됐으면 true. 굳으면(함정 16) 조용히 시간만 흐르므로 사유를 남긴다. */
async function turn(p, stalls, trayFirst) {
  const st = await state(p);
  if (st.over) { await p.eval(`var b=document.getElementById('againBtn'); if(b)b.click(); return true;`); await p.wait(2500); return false; }
  if (!st.throwable) {
    // 말은 고를 수 있는데 던지기가 막혀 있다 = 이동 선택이 남은 것(고스트/방향)
    if (st.mv || st.tray || st.ghost) {
      if (st.ghost) { await resolveDir(p); await p.wait(600); return false; }
      if (await pickPiece(p, trayFirst)) { await p.wait(300); await resolveDir(p); await p.wait(1500); return true; }
    }
    stalls[st.info || '(빈 안내)'] = (stalls[st.info || '(빈 안내)'] || 0) + 1;
    await p.wait(300); return false;
  }
  await throwYut(p);
  await p.wait(1500);
  if (await pickPiece(p, trayFirst)) { await p.wait(300); await resolveDir(p); await p.wait(1700); return true; }
  await p.wait(600); return false;
}

async function measure(p, label, ms, during) {
  await p.eval(SAMPLE_START);
  const t0 = Date.now();
  if (during) await during();
  const left = ms - (Date.now() - t0);
  if (left > 0) await p.wait(left);
  const r = await p.eval(SAMPLE_END);
  return r ? { label, ...r } : { label, empty: true };
}

async function run() {
  const p = await attach();
  const out = { device: 'Galaxy A16 (app webview)', at: new Date().toISOString(), variants: VARIANTS, phases: [] };
  try {
    await p.goto(BASE + '/yut.html');
    await p.wait(1500);
    out.viewport = await p.eval(`return innerWidth+'x'+innerHeight;`);
    out.reducedMotion = await p.eval(`return matchMedia('(prefers-reduced-motion: reduce)').matches;`);
    out.dpr = await p.eval(`return devicePixelRatio;`);
    // 첫 방문 오버레이(함정 15)
    await p.eval(`try{TUT&&TUT.close&&TUT.close()}catch(e){}
      ['helpClose','rulesClose'].forEach(function(id){var b=document.getElementById(id); if(b)b.click();}); return true;`);
    // 인원 — 문서상 "보통 한 판 7~10분(4인 기준)"이 실사용 조건이다
    await p.eval(`var b=document.querySelector('#optCount .opt[data-n="${N}"]'); if(b)b.click(); return !!b;`);
    await p.eval(`var b=document.getElementById('startBtn'); if(b)b.click(); return true;`);
    await p.wait(8000);   // VS 인트로

    // 판을 실제 플레이 상태로 채운다 — 빈 판에서 잰 숫자는 실제 플레이가 아니다
    const stalls = {};
    let played = 0;
    const deadline = Date.now() + 180000;
    while (played < WARM && Date.now() < deadline) {
      if (await turn(p, stalls, played < WARM * 0.7)) played++;
    }
    out.warmupTurns = played;
    out.stalls = stalls;

    for (const v of VARIANTS) { if (!VARIANT_JS[v]) throw new Error('모르는 변종: ' + v); await p.eval(VARIANT_JS[v]); }
    const st = await state(p);
    out.pieces = st.pieces;
    out.svgNodes = await p.eval(`return document.getElementById('board').getElementsByTagName('*').length;`);

    if (BENCH_MODE) {
      // ⚠️ AI 턴이 돌고 있으면 A/B가 통째로 흔들린다(실측: 같은 baseline이 42.6↔79.5로 널뛰었다).
      //    '내 차례'에 세워 두면 엔진이 조용해진다 — 내가 던지기 전엔 아무도 움직이지 않는다.
      out.quiesced = false;
      for (let i = 0; i < 120; i++) {
        const st = await state(p);
        if (st.throwable) { out.quiesced = true; break; }
        if (st.over) { await p.eval(`var b=document.getElementById('againBtn'); if(b)b.click(); return true;`); await p.wait(2500); continue; }
        if (st.ghost) { await resolveDir(p); }
        else if (st.mv || st.tray) { if (await pickPiece(p)) { await p.wait(300); await resolveDir(p); } }
        await p.wait(700);
      }
      await p.wait(3000);            // 마지막 연출이 다 사라질 때까지
      await p.eval(BENCH);
      out.bench = [];
      /* 누적으로 꺼가며 재면 순서 효과와 AI 턴 소음이 섞여 개별 기여도를 못 낸다.
         → **되돌릴 수 있는 CSS 한 장**으로 후보를 하나씩만 끄고, 사이사이 baseline을 다시 잰다.
         (SVG `filter` 는 표현 속성이라 CSS `filter` 가 이긴다 — 요소를 지우지 않아도 된다) */
      const OFF = {
        '판 SVG 필터 전부 (칸·판 그림자 feDropShadow)': '#boardLayer *{filter:none !important}',
        '칸 그림자만 (circle ×30)': '#boardLayer circle{filter:none !important}',
        '나무결 feTurbulence만': '#boardLayer rect[filter*="woodgrain"]{display:none !important}',
        '말 그림자 (pcsh)': '#pieceLayer .ring{filter:none !important}',
        '상시 애니 (숨쉬기·반짝임·선두광)':
          '#pieceLayer .pcpiece .pcbody,#pieceLayer .pcpiece.mv .pcbody,#pieceLayer .pcpiece.lead .pclead,#pieceLayer .pcpiece.mv .ring,#twinkleG circle{animation:none !important}',
        '판 필터 + 상시 애니 둘 다':
          '#boardLayer *{filter:none !important} #pieceLayer .pcpiece .pcbody,#pieceLayer .pcpiece.mv .pcbody,#pieceLayer .pcpiece.lead .pclead,#pieceLayer .pcpiece.mv .ring,#twinkleG circle{animation:none !important}',
      };
      await p.eval(`var s=document.createElement('style'); s.id='__perfoff'; document.head.appendChild(s); return true;`);
      const set = css => p.eval(`document.getElementById('__perfoff').textContent=${JSON.stringify(css)}; return true;`);
      const run = async label => { await p.wait(500); const r = await p.eval(`return window.__bench(${BENCH_MS});`); out.bench.push({ label, ...(r || {}) }); };
      if (SUB.includes('board')) {
      await set(''); await run('baseline');
      for (const [label, css] of Object.entries(OFF)) {
        await set(css); await run('끔: ' + label);
        await set(''); await run('baseline');
      }
      }

      // ②-a 화면 전체 연출 — 게임 전체에 transform/filter를 거는 것들
      if (SUB.includes('cls')) {
      await p.eval(BENCHCLS);
      out.benchcls = [];
      const CLS = [
        ['(아무것도 안 함)', null, '', 500],
        ['#game.camerapunch (전체 확대)', '#game', 'camerapunch', 500],
        ['.app.scrshake (화면 흔들림)', '.app', 'scrshake', 500],
        ['.board.finflash (판 밝기+글로우 필터)', '.board', 'finflash', 800],
        ['.board.shake (판 흔들림)', '.board', 'shake', 500],
        ['윷가락 4개 3D 토스', '.yutsticks .stick', 'tossing', 800],
        ['말 던지는 캐릭터', '.thrower', 'throwing', 700],
      ];
      for (const [label, sel, cls, ms] of CLS) {
        await set(''); await p.wait(400);
        const r = await p.eval(`return window.__benchcls(${JSON.stringify(sel)}, ${JSON.stringify(cls)}, ${ms}, 3, false);`);
        out.benchcls.push({ label, ...(r || {}) });
      }
      // will-change를 한 프레임 먼저 걸면(=제품 코드의 _armLayer) 얼마나 나아지나
      for (const [label, sel, cls, ms] of CLS) {
        if (!sel) continue;
        await p.wait(400);
        const r = await p.eval(`return window.__benchcls(${JSON.stringify(sel)}, ${JSON.stringify(cls)}, ${ms}, 3, true);`);
        out.benchcls.push({ label: '↑ 레이어 선점 · ' + label, ...(r || {}) });
      }
      }

      // ②-a2 화면 전체 연출 **동시 발화** — "동시에 하나만"이라는 설계 결정의 근거
      if (SUB.includes('pair')) {
        await p.eval(BENCHPAIR);
        out.benchpair = [];
        const RUN = async (label, arm, both) => {
          await set(''); await p.wait(400);
          const r = await p.eval(`return window.__benchpair(500, 4, ${arm}, ${both});`);
          out.benchpair.push({ label, ...(r || {}) });
        };
        // 같은 조건을 번갈아 두 번씩 — AI 턴 소음이 한쪽에만 얹히는 것을 막는다
        for (let k = 0; k < 2; k++) {
          await RUN('흔들림만 (.app.scrshake)', true, false);
          await RUN('흔들림 + 카메라펀치 동시', true, true);
        }
      }

      // ②-b 던지기 한 번의 실제 연출 더미 — 여러 연출이 '동시에' 도는 그 순간을 잰다
      if (SUB.includes('pile')) {
        await p.eval(BENCHPILE);
        out.benchpile = [];
        const PILE = [
          ['baseline (결과 720ms · 반짝이 6)',        720, {}],
          ['· 결과를 착지 뒤로 (960ms)',              960, {}],
          ['· 반짝이 제거',                           720, { nosparks: true }],
          ['· 반짝이 3개',                            720, { sparks: 3 }],
          ['· 반짝이 will-change 제거',               720, { nosparkwc: true }],
          ['· yf-rays 제거',                          720, { norays: true }],
          ['· 착지 뒤 + 반짝이 3 + rays 제거',        960, { sparks: 3, norays: true }],
        ];
        for (const big of [true, false]) {
          for (const [label, at, opt] of PILE) {
            if (!big && /반짝이|rays/.test(label)) continue;   // small엔 애초에 없다
            await set(''); await p.wait(400);
            const r = await p.eval(`return window.__benchpile(3, ${big}, ${at}, ${JSON.stringify(opt)});`);
            out.benchpile.push({ label: (big ? '윷·모(big) ' : '도·개·걸(small) ') + label, ...(r || {}) });
          }
        }
      }

      // ② 결과 오버레이(#yutFx) — 던질 때마다 뜬다. 도·개·걸(small)이 압도적으로 잦다.
      if (SUB.includes('fx')) {
      await p.eval(BENCHFX);
      out.benchfx = [];
      const FXOFF = {
        '반짝이(yf-spark) 제거': '#yutFx .yf-spark{display:none !important}',
        '반짝이 will-change 제거': '#yutFx .yf-spark{will-change:auto !important}',
        'yf-rays 제거(윷·모 전용)': '#yutFx .yf-rays{display:none !important}',
        'yf-rays 회전만 정지': '#yutFx .yf-rays{animation:yfRaysFade var(--yf-dur,1.35s) ease-out forwards !important}',
        'yf-rays 70vmax + 회전 정지': '#yutFx .yf-rays{width:70vmax;height:70vmax;margin-left:-35vmax;margin-top:-35vmax;animation:yfRaysFade var(--yf-dur,1.35s) ease-out forwards !important}',
        '글자에 will-change (합성 레이어로)': '#yutFx .yf-word{will-change:transform,opacity} #yutFx .yf-dim{will-change:opacity}',
        '글자 외곽선(-webkit-text-stroke) 제거': '#yutFx .yf-word{-webkit-text-stroke-width:0 !important}',
        '어둡힘(yf-dim) 제거': '#yutFx .yf-dim{display:none !important}',
      };
      for (const big of (SUB.includes('fxbig') ? [true] : [false, true])) {
        const kind = big ? '윷·모(big)' : '도·개·걸(small)';
        const runfx = async label => { await p.wait(400); const r = await p.eval(`return window.__benchfx(3, ${big});`); out.benchfx.push({ label: kind + ' ' + label, ...(r || {}) }); };
        await set(''); await runfx('baseline');
        for (const [label, css] of Object.entries(FXOFF)) {
          await set(css); await runfx('· ' + label);
          await set(''); await runfx('baseline');
        }
      }
      }
    }
    if (LONG > 0) {
      // 긴 프레임이 '언제' 나는지 맥락과 함께 기록한다 — 구간을 미리 정해두면
      // 내가 상상한 구간에서만 재게 되어, 진짜 원인이 그 밖에 있으면 영영 못 본다.
      await p.eval(LONGREC_START);
      const end = Date.now() + LONG;
      let turns = 0;
      while (Date.now() < end) if (await turn(p, stalls, false)) turns++;
      out.long = await p.eval(LONGREC_END);
      out.long.turns = turns;
      out.stalls = stalls;
    }
    out.phases.push(await measure(p, 'idle', 3000));
    out.phases.push(await measure(p, 'throw', 2600, async () => {
      const s = await state(p); if (s.throwable) await throwYut(p); else await p.wait(600);
    }));
    out.phases.push(await measure(p, 'move', 3000, async () => {
      const k = await pickPiece(p); if (k) { await p.wait(300); await resolveDir(p); }
    }));
    out.phases.push(await measure(p, 'ai', 3000));
  } finally {
    try { await p.goto(BASE + '/'); } catch (e) {}   // 폰을 허브로 되돌린다(공유 자원)
    p.close();
  }

  const tag = VARIANTS.length ? VARIANTS.join('+') : 'baseline';
  console.log(`\n윷놀이 성능 — 실기기 ${out.viewport} · dpr ${out.dpr} · reduced-motion=${out.reducedMotion} · 변종 [${tag}]`);
  console.log(`  판 위 말 ${out.pieces}개 · SVG 요소 ${out.svgNodes}개 · 워밍업 ${out.warmupTurns}턴`);
  if (out.long) {
    const L = out.long;
    console.log(`  ── 긴 세션 ${L.sec}초 · ${L.turns}턴 · 평균 ${L.fps}fps · p50 ${L.p50} p95 ${L.p95} p99 ${L.p99} 최악 ${L.worst}ms`);
    console.log(`     느린 프레임(>33ms) ${L.slow}/${L.n} · 끊김(>50ms) ${L.jank}`);
    console.log(`     긴 프레임 ${L.longFrames}개 중 스크립트(longtask)와 겹친 것 ${L.withScript}개 · longtask ${L.longtasks}건 ${L.longtaskMs}ms${L.noLongtask ? ' (longtask 미지원)' : ''}`);
    console.log('     그 순간 돌던 애니메이션 (합계 내림차순):');
    Object.entries(L.buckets).sort((a, b) => b[1].sum - a[1].sum).slice(0, 14).forEach(([k, v]) =>
      console.log(`       ${k.padEnd(38)} ${String(v.n).padStart(4)}회 · 최악 ${String(v.worst).padStart(5)}ms · 합계 ${Math.round(v.sum)}ms`));
    console.log('     최악 프레임 10개: ' + L.top.map(x => x.d + 'ms').join(', '));
  }
  if (out.bench) {
    console.log('  ── 결정적 벤치(말 이동과 같은 무효화 · 후보를 누적으로 제거)');
    console.log('     조건                                  fps   p50    p95    p99   최악   >33ms >50ms');
    out.bench.forEach(b => console.log(`     ${b.label.padEnd(34)} ${String(b.fps).padStart(5)} ${String(b.p50).padStart(6)} ${String(b.p95).padStart(6)} ${String(b.p99).padStart(6)} ${String(b.worst).padStart(6)} ${String(b.slow).padStart(6)} ${String(b.jank).padStart(5)}`));
  }
  if (out.benchcls) {
    console.log('  ── 화면 전체 연출 벤치 (클래스 3회 발화)');
    console.log('     조건                                            fps   p50    p95    p99   최악   >33ms >50ms');
    out.benchcls.forEach(b => console.log(`     ${b.label.padEnd(44)} ${String(b.fps).padStart(5)} ${String(b.p50).padStart(6)} ${String(b.p95).padStart(6)} ${String(b.p99).padStart(6)} ${String(b.worst).padStart(6)} ${String(b.slow).padStart(6)} ${String(b.jank).padStart(5)}`));
  }
  if (out.benchpair) {
    console.log('  ── 화면 전체 연출 동시 발화 (4회 × 2세트 교차)');
    console.log('     조건                                            fps   p50    p95    p99   최악   >33ms >50ms');
    out.benchpair.forEach(b => console.log(`     ${b.label.padEnd(44)} ${String(b.fps).padStart(5)} ${String(b.p50).padStart(6)} ${String(b.p95).padStart(6)} ${String(b.p99).padStart(6)} ${String(b.worst).padStart(6)} ${String(b.slow).padStart(6)} ${String(b.jank).padStart(5)}`));
  }
  if (out.benchpile) {
    console.log('  ── 던지기 한 번의 연출 더미(pile) — 3회 발화 × 조건');
    console.log('     조건                                            fps   p50    p95    p99   최악   >33ms >50ms');
    out.benchpile.forEach(b => console.log(`     ${b.label.padEnd(44)} ${String(b.fps).padStart(5)} ${String(b.p50).padStart(6)} ${String(b.p95).padStart(6)} ${String(b.p99).padStart(6)} ${String(b.worst).padStart(6)} ${String(b.slow).padStart(6)} ${String(b.jank).padStart(5)}`));
  }
  if (out.benchfx) {
    console.log('  ── 결과 오버레이(#yutFx) 벤치 — 3회 발화 × 조건');
    console.log('     조건                                            fps   p50    p95    p99   최악   >33ms >50ms');
    out.benchfx.forEach(b => console.log(`     ${b.label.padEnd(44)} ${String(b.fps).padStart(5)} ${String(b.p50).padStart(6)} ${String(b.p95).padStart(6)} ${String(b.p99).padStart(6)} ${String(b.worst).padStart(6)} ${String(b.slow).padStart(6)} ${String(b.jank).padStart(5)}`));
  }
  if (out.stalls && Object.keys(out.stalls).length) {
    console.log('  ── 드라이버가 기다린 상태(함정 16 — 굳으면 침묵으로 나타난다):');
    Object.entries(out.stalls).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([k, v]) => console.log(`     ${String(v).padStart(4)}회  ${k}`));
  }
  console.log('  구간      fps   p50    p95   최악   >33ms  >50ms');
  for (const ph of out.phases) {
    if (ph.empty) { console.log(`  ${ph.label.padEnd(8)} (표본 없음)`); continue; }
    console.log(`  ${ph.label.padEnd(8)} ${String(ph.fps).padStart(5)} ${String(ph.p50).padStart(6)} ${String(ph.p95).padStart(6)} ${String(ph.worst).padStart(6)} ${String(ph.slow).padStart(6)} ${String(ph.jank).padStart(6)}`);
  }
  if (JSON_OUT) { fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true }); fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2)); console.log('  → ' + JSON_OUT); }
}

run().catch(e => { console.error('실패:', e.message); process.exit(1); });
