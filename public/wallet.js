/**
 * 통합 재화(AW) — 골목 전체가 쓰는 코인 지갑. 상점의 토대다.
 *
 * 왜: 지갑이 게임마다 쪼개져 있었다. 섯다만 영구 저장(seotda_wallet)이었고
 * 블랙잭·바카라·하이로우는 세션 한정이라 새로고침하면 자금이 초기화됐다.
 * 그래서 "모아서 뭘 산다"가 성립하지 않았다.
 *
 * 모델
 *  - 베팅 게임: 시작할 때 지갑에서 바이인(take) → 끝날 때 남은 칩 환급(add). 섯다가 쓰던 방식.
 *  - 비베팅 게임: 이기면 보상 코인(reward).
 *  - 저장 키는 'alley_coin' 하나. 기존 seotda_wallet 값은 한 번만 옮겨 온다.
 */
(function (global) {
  var KEY = 'alley_coin';
  var DEFAULT = 100000;          // 섯다가 쓰던 기본값을 그대로 이어받는다
  var REWARD_WIN = 300;          // 비베팅 게임 승리 보상
  var LOW = 1000;                // 이 밑이면 '충전' 버튼을 보여주는 기준

  (function migrate() {
    try {
      if (localStorage.getItem(KEY) != null) return;
      var old = localStorage.getItem('seotda_wallet');
      if (old != null) localStorage.setItem(KEY, old);
    } catch (e) {}
  })();

  function read() {
    try { var v = parseInt(localStorage.getItem(KEY), 10); return isNaN(v) ? DEFAULT : v; }
    catch (e) { return DEFAULT; }
  }
  function write(v) {
    v = Math.max(0, Math.round(v));
    try { localStorage.setItem(KEY, String(v)); } catch (e) {}
    try { global.dispatchEvent(new CustomEvent('coinchange', { detail: { coin: v } })); } catch (e) {}
    paint();
    return v;
  }

  var AW = {
    KEY: KEY, DEFAULT: DEFAULT, LOW: LOW,
    get: read,
    set: write,
    fmt: function (v) { return (v == null ? read() : v).toLocaleString(); },
    /** 지갑에 더한다(환급·보상). 음수도 허용하지만 0 밑으로는 안 내려간다. */
    add: function (n) { return write(read() + (n || 0)); },
    /** 바이인. 지갑에 있는 만큼만 빼고 '실제로 뺀 액수'를 돌려준다(모자라면 그만큼만). */
    take: function (n) {
      var have = read(), use = Math.max(0, Math.min(have, Math.round(n || 0)));
      write(have - use);
      return use;
    },
    /** 비베팅 게임 보상 — 이기면 코인이 붙는다(진 판은 0, 잃지는 않는다) */
    reward: function (won, amount) {
      if (!won) return 0;
      var n = amount == null ? REWARD_WIN : amount;
      AW.add(n);
      return n;
    },
    /** 파산 구제 — 상점/충전 붙이기 전까지의 임시 장치 */
    charge: function (n) { return AW.add(n == null ? 50000 : n); }
  };

  // 화면에 지갑을 표시하는 곳이 있으면 알아서 갱신한다(id/class 둘 다 지원)
  function paint() {
    try {
      var v = read();
      var els = document.querySelectorAll('[data-coin],#coinAmt');
      for (var i = 0; i < els.length; i++) els[i].textContent = v.toLocaleString();
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
  else paint();

  global.AW = AW;
})(typeof window !== 'undefined' ? window : this);
