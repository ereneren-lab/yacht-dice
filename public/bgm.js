/* bgm.js — 게임 공통 배경음악(BGM) 레이어. window.BGM
 *
 * 왜 있나 (2026-08-12, 사운드 일관화 Part 2)
 *   BGM이 윷놀이에만 있었다(국악풍). 12종은 무음악. 게임회사급 분위기를 위해 BGM을
 *   3무드(국악/캐주얼/라운지)로 공용화해, 각 게임이 자기 무드 하나만 선언하면 되게 한다.
 *   윷놀이는 자체 인라인 BGM을 그대로 두므로 여기선 다루지 않는다(이중 재생 방지).
 *
 * 설계
 *   - 외부 파일 0개. WebAudio 절차 생성 + lookahead 스케줄러로 끊김 없이 루프.
 *   - 각 게임: <script src="bgm.js"> 뒤에 BGM.set('folk'|'casual'|'lounge') 한 줄.
 *   - 첫 사용자 제스처(pointerdown)에서 시작(브라우저 자동재생 정책). 탭 숨김/이탈 시 정지.
 *   - 기본 켜짐. 공용 뮤트 키 alley_bgm — 한 게임에서 끄면 모든 게임에서 꺼진 채 시작.
 *   - 우하단에 작은 🎵 토글을 스스로 주입(각 게임 UI 안 건드림).
 *   - SFX(alley_sound)와 독립. 실패해도 조용히 삼킨다.
 *
 * 무드 상태 (2026-08-12)
 *   folk   ✅ (윷 엔진 이식 — 가야금+장구)   섯다·알까기
 *   casual ⏳ (2b 예정)                       요트·너클본즈·라이어·좌중우
 *   lounge ⏳ (2c 예정)                       카드 6종
 */
(function () {
  'use strict';

  var mood = null;
  var ctx = null, master = null, seqTimer = null, playing = false, nbuf = null;
  var nextTime = 0, step = 0;
  var started = false;   // 제스처로 한 번 시작됐는지

  var on = true;
  try { on = localStorage.getItem('alley_bgm') !== '0'; } catch (e) {}

  /* ── 오디오 컨텍스트 + 마스터(리버브+리미터+메이크업) ── */
  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = 0.0001;
      try {
        var lim = ctx.createDynamicsCompressor();
        lim.threshold.value = -4; lim.knee.value = 3; lim.ratio.value = 10;
        lim.attack.value = 0.004; lim.release.value = 0.16;
        var makeup = ctx.createGain(); makeup.gain.value = 3.0;   // 리미터 감쇠 보정(snd.js와 동일 취지)
        lim.connect(makeup); makeup.connect(ctx.destination);
        master.connect(lim);
        var irLen = Math.floor(ctx.sampleRate * 1.4);
        var ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
        for (var chn = 0; chn < 2; chn++) {
          var dd = ir.getChannelData(chn);
          for (var i = 0; i < irLen; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.8);
        }
        var cv = ctx.createConvolver(); cv.buffer = ir;
        var wet = ctx.createGain(); wet.gain.value = 0.12;
        master.connect(cv); cv.connect(wet); wet.connect(lim);
      } catch (e) { try { master.connect(ctx.destination); } catch (e2) {} }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function noise() {
    if (nbuf) return nbuf;
    var n = Math.floor(ctx.sampleRate * 0.4), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return nbuf = b;
  }

  /* ══════════════ 무드: folk (국악 — 윷 엔진 이식) ══════════════ */
  var folk = (function () {
    var TEMPO = 78, STEPS = 16;
    var SCALE = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99]; // 5음계
    var mi = 4;
    function sd() { return 60 / TEMPO / 2; }
    // 가야금 뜯는 음
    function pluck(freq, t, dur, gain) {
      var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(freq, t);
      var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.type = 'sine'; lfo.frequency.setValueAtTime(5.4, t);
      lg.gain.setValueAtTime(freq * 0.006, t); lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur);
      var h = ctx.createOscillator(); h.type = 'sine'; h.frequency.setValueAtTime(freq * 2, t);
      var g = ctx.createGain(), hg = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      hg.gain.setValueAtTime(0.0001, t); hg.gain.linearRampToValueAtTime(gain * 0.16, t + 0.006); hg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.55);
      o.connect(g); h.connect(hg); g.connect(master); hg.connect(master);
      o.start(t); o.stop(t + dur); h.start(t); h.stop(t + dur * 0.6);
    }
    function kung(t, gain) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.13); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.22); }
    function duk(t, gain) { var s = ctx.createBufferSource(); s.buffer = noise(); var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(1500, t); bp.Q.value = 1.3; var g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.1); }
    return {
      steps: STEPS, stepDur: sd,
      schedStep: function (s, t) {
        if (s % 4 === 0) kung(t, s % 8 === 0 ? 0.5 : 0.34);
        if (s % 4 === 2) duk(t, 0.18);
        if (s % 8 === 6) duk(t, 0.12);
        var rest = (s % 2 === 1) ? Math.random() < 0.55 : Math.random() < 0.15;
        if (!rest) {
          var r = Math.random(), dstep = r < 0.42 ? 1 : r < 0.84 ? -1 : (r < 0.92 ? 2 : -2);
          mi = Math.max(0, Math.min(SCALE.length - 1, mi + dstep));
          var down = (s % 4 === 0), dur = down ? sd() * 2.1 : sd() * 1.3, gain = (down ? 0.14 : 0.10) * (0.85 + Math.random() * 0.3);
          pluck(SCALE[mi], t, dur, gain);
          if (down && Math.random() < 0.4 && mi >= 3) pluck(SCALE[mi - 3], t, dur * 0.9, gain * 0.5);
        }
      }
    };
  })();

  var MOODS = { folk: folk };   // casual·lounge 는 2b·2c 에서 추가

  /* ── 스케줄러 · 시작/정지 ── */
  function gen() { return MOODS[mood] || null; }
  function scheduler() {
    var g = gen(); if (!ctx || !g) return;
    var ahead = 0.12;
    while (nextTime < ctx.currentTime + ahead) {
      try { g.schedStep(step, nextTime); } catch (e) {}
      nextTime += g.stepDur(); step = (step + 1) % g.steps;
    }
  }
  function begin() {
    if (playing || !on || !gen()) return;
    if (!ac()) return;
    nextTime = ctx.currentTime + 0.08; step = 0; playing = true;
    try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0.15, ctx.currentTime, 0.8); }
    catch (e) { if (master) master.gain.value = 0.15; }
    seqTimer = setInterval(scheduler, 25); scheduler();
  }
  function halt() {
    if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
    playing = false;
    if (master && ctx) { try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); } catch (e) {} }
  }

  /* ── 토글 버튼 자가 주입(우하단, 작게) ── */
  function mountBtn() {
    if (document.getElementById('bgmToggle')) return;
    var b = document.createElement('button');
    b.id = 'bgmToggle'; b.type = 'button';
    b.setAttribute('aria-label', '배경음악');
    b.style.cssText = 'position:fixed;left:calc(10px + env(safe-area-inset-left));bottom:calc(10px + env(safe-area-inset-bottom));z-index:9999;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(20,17,13,.6);color:#f3ece0;font-size:15px;line-height:1;cursor:pointer;backdrop-filter:blur(4px);opacity:.75;padding:0';
    b.textContent = '🎵';
    b.onclick = function () { BGM.toggle(); };
    (document.body || document.documentElement).appendChild(b);
    sync();
  }
  function sync() {
    var b = document.getElementById('bgmToggle'); if (!b) return;
    b.style.opacity = on ? '.85' : '.4';
    b.textContent = on ? '🎵' : '🔈';
    b.title = on ? '배경음악 끄기' : '배경음악 켜기';
  }

  var BGM = {
    set: function (m) { mood = m; },
    start: function () { if (started) { begin(); return; } started = true; begin(); },
    stop: halt,
    toggle: function () {
      on = !on;
      try { localStorage.setItem('alley_bgm', on ? '1' : '0'); } catch (e) {}
      if (on) begin(); else halt();
      sync();
      return on;
    },
    isOn: function () { return on; },
    playing: function () { return playing; }
  };
  window.BGM = BGM;

  /* ── 부트: 토글 주입 + 첫 제스처에서 시작 + 생명주기 ── */
  function boot() {
    mountBtn();
    var kick = function () { BGM.start(); };
    window.addEventListener('pointerdown', kick, { once: true, passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) halt(); else if (on && started) begin();
    });
    window.addEventListener('pagehide', halt);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
