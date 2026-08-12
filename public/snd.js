/* snd.js — 게임 공통 '오디오 방'. window.SNDBUS
 *
 * 왜 있나 (2026-08-12, 사운드 일관화)
 *   주사위·보드 게임(yut·yacht·kb·ld·lcr)은 마스터 버스(리버브+리미터)로 소리가 리치한데,
 *   카드게임 8종(onecard·oldmaid·seotda·indianpoker·blackjack·baccarat·highlow·alkkagi)은
 *   오실레이터를 ctx.destination에 생으로 꽂아 '싸구려 삐-'였다. 멜로디는 이미 공통인데
 *   '방'이 달라 게임마다 음질이 갈렸다. 그 방을 한 곳에서 정의해 전부 같은 공간감을 씌운다.
 *
 * 원칙
 *   - 멜로디·음색은 안 바꾼다. **출력 경로(방)만** 통일한다.
 *   - 게임의 AudioContext는 게임이 소유한다. 여기선 그 ctx에 버스를 1개 붙여 캐시만 한다.
 *   - 리버브 센드 12% + 리미터 → 겹침 클리핑 방지 + 합성음 티 완화(yut와 동일 세팅).
 *   - 실패해도 삼키고 ctx.destination으로 폴백 — 소리는 나되 방만 없다.
 */
(function () {
  'use strict';
  var SNDBUS = {
    /* 게임의 AudioContext를 받아 마스터 버스(리버브+리미터)를 돌려준다. ctx당 1개 캐시. */
    out: function (ctx) {
      if (!ctx) return null;
      if (ctx.__sndbus) return ctx.__sndbus;
      try {
        var lim = ctx.createDynamicsCompressor();
        lim.threshold.value = -3; lim.knee.value = 2; lim.ratio.value = 12;
        lim.attack.value = 0.003; lim.release.value = 0.12;
        // 메이크업 게인 — WebAudio DynamicsCompressor는 임계값 아래 신호도 ~11dB 깎는다
        // (실측: 0.14→0.04). 리미터 뒤에서 ~3.3x 되살려, 단발음은 원래 크기·겹침만 리미터가 잡게.
        var makeup = ctx.createGain(); makeup.gain.value = 3.3;
        lim.connect(makeup); makeup.connect(ctx.destination);
        var bus = ctx.createGain(); bus.gain.value = 1; bus.connect(lim);
        // 컨볼루션 리버브(감쇠 노이즈 임펄스, 외부 파일 0개) 센드 12%
        var len = Math.floor(ctx.sampleRate * 1.1);
        var ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (var ch = 0; ch < 2; ch++) {
          var d = ir.getChannelData(ch);
          for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
        }
        var cv = ctx.createConvolver(); cv.buffer = ir;
        var wet = ctx.createGain(); wet.gain.value = 0.12;
        bus.connect(cv); cv.connect(wet); wet.connect(lim);
        ctx.__sndbus = bus;
        return bus;
      } catch (e) {
        return ctx.destination;
      }
    }
  };
  window.SNDBUS = SNDBUS;
})();
