/**
 * 공통 전적(AS) — 섯다·카드 6종은 판을 이겨도 아무것도 안 쌓였다.
 *
 * 기존 5종(윷·너클본즈·라이어·좌중우·요트)은 게임마다 `{게임}_stats` 키를 따로 쓴다.
 * 여기서는 처음부터 한 키(`alley_stats`)에 게임별로 나눠 담는다 —
 * 나중에 허브에서 "내 전적 한눈에"·상점 재화로 이어붙이려면 흩어져 있으면 안 된다.
 *
 * 저장 형태: { blackjack:{games,wins,best,streak,bestStreak}, ... }
 * 원칙: 이게 죽어도 게임은 돌아야 한다 → 전부 try/catch, 실패 시 조용히 무시.
 */
(function (global) {
  var KEY = 'alley_stats';
  var LABEL = {
    seotda: '섯다', blackjack: '블랙잭', baccarat: '바카라', highlow: '하이로우',
    indianpoker: '인디언포커', oldmaid: '도둑잡기', onecard: '원카드'
  };

  function all() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function blank() { return { games: 0, wins: 0, best: 0, streak: 0, bestStreak: 0 }; }

  var AS = {
    LABEL: LABEL,
    all: all,
    get: function (game) {
      var d = all()[game];
      return d ? Object.assign(blank(), d) : blank();
    },
    /** 한 판 끝. won=이겼나, score=이번 판 점수/최종 자금(없으면 생략) */
    record: function (game, won, score) {
      try {
        var db = all(), d = Object.assign(blank(), db[game] || {});
        d.games++;
        if (won) {
          d.wins++;
          d.streak = (d.streak || 0) + 1;
          if (d.streak > d.bestStreak) d.bestStreak = d.streak;
        } else d.streak = 0;
        if (typeof score === 'number' && score > d.best) d.best = Math.round(score);
        db[game] = d;
        localStorage.setItem(KEY, JSON.stringify(db));
        try { global.AL && AL.done(won); } catch (e) {}   // 계측(켜져 있을 때만)
        return d;
      } catch (e) { return blank(); }
    },
    /** 결과창에 붙일 전적 한 줄 */
    line: function (game) {
      var d = AS.get(game);
      if (!d.games) return '';
      var wr = Math.round((d.wins / d.games) * 100);
      var st = d.bestStreak > 1 ? ' · 최다연승 <b>' + d.bestStreak + '</b>' : '';
      return '전적 <b>' + d.games + '</b>판 · <b>' + d.wins + '</b>승 · 승률 <b>' + wr + '%</b>' + st;
    },
    /** 기록 + 결과창(#resBody)에 전적 줄 덧붙이기 — 7종이 같은 구조라 한 번에 처리된다 */
    finish: function (game, won, score) {
      var d = AS.record(game, won, score);
      try {
        var el = document.getElementById('resBody');
        if (el && !el.querySelector('.as-line')) {
          var div = document.createElement('div');
          div.className = 'as-line';
          div.style.cssText = 'margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.12);font-size:12.5px;opacity:.92';
          div.innerHTML = AS.line(game);
          el.appendChild(div);
        }
      } catch (e) {}
      return d;
    }
  };

  global.AS = AS;
})(typeof window !== 'undefined' ? window : this);
