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

  /* 기존 6종은 예전부터 자기 키에 쌓아왔고 지금도 거기 먼저 쓴다(그 화면들이 그걸 읽는다).
     alley_stats에는 v1.224부터만 쌓이므로, 이 6종은 '자기 키'가 전체 기록이다.
     그래서 허브 통합 화면은 둘을 더하지 않고 **자기 키가 있으면 그걸 쓴다**(이중 계산 방지). */
  var LEGACY = { kb:'kb_stats', lcr:'lcr_stats', ld:'ld_stats', yut:'yut_stats', alkkagi:'alk_stats', yacht:'yd_stats' };
  var ORDER = ['yut','yacht','kb','ld','lcr','alkkagi','seotda','blackjack','baccarat','highlow','indianpoker','oldmaid','onecard'];
  var ALL_LABEL = {
    yut:'윷놀이', yacht:'요트 다이스', kb:'너클본즈', ld:'라이어 다이스', lcr:'좌·중·우', alkkagi:'알까기',
    seotda:'섯다', blackjack:'블랙잭', baccarat:'바카라', highlow:'하이로우', indianpoker:'인디언포커',
    oldmaid:'도둑잡기', onecard:'원카드'
  };
  var HREF = {
    yut:'yut.html', yacht:'yacht.html', kb:'kb.html', ld:'ld.html', lcr:'lcr.html', alkkagi:'alkkagi.html',
    seotda:'seotda.html', blackjack:'blackjack.html', baccarat:'baccarat.html', highlow:'highlow.html',
    indianpoker:'indianpoker.html', oldmaid:'oldmaid.html', onecard:'onecard.html'
  };

  var AS = {
    LABEL: LABEL,
    ALL_LABEL: ALL_LABEL,
    ORDER: ORDER,
    HREF: HREF,
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
        /* 첫 판이 끝난 사람에게만 규칙을 한 번 권한다.
           첫 방문 자동 튜토리얼을 걷어낸 자리를 여기가 대신한다(2026-07-29).
           TUT가 스스로 '이미 봤나/이미 권했나'를 판단하므로 여기선 조건 없이 부르면 된다. */
        try { if (d.games === 1 && global.TUT && TUT.nudge) TUT.nudge(); } catch (e) {}
        return d;
      } catch (e) { return blank(); }
    },
    /** 13게임 전체 전적 — 기존 키(있으면 그게 전체)와 통합 키를 합쳐 하나로 본다 */
    merged: function () {
      var db = all(), out = {};
      for (var i = 0; i < ORDER.length; i++) {
        var g = ORDER[i], d = null;
        if (LEGACY[g]) {
          try {
            var raw = localStorage.getItem(LEGACY[g]);
            if (raw) { var L = JSON.parse(raw); if (L && typeof L.games === 'number') d = L; }
          } catch (e) {}
        }
        if (!d) d = db[g];
        if (!d || !d.games) continue;
        /* bestStreak도 함께 넘긴다 — 허브의 '최고 연승'이 이 값을 쓴다(2026-08-05).
           예전엔 허브가 게임별 `{접두사}_stats`를 직접 읽어 5종만 셌다. */
        out[g] = { games: d.games | 0, wins: d.wins | 0, best: d.best || 0, bestStreak: d.bestStreak | 0 };
      }
      return out;
    },

    /* ── 파생 배지 (2026-08-05) ───────────────────────────────────────────
       문제: 게임 자체 도전과제(`{게임}_ach`)를 쓰는 건 5종(kb·lcr·ld·yd·yut)뿐이다.
             그래서 허브의 '배지' 숫자와 도전과제 '수집가(배지 15개)'는 나머지 8종을
             아무리 플레이해도 오르지 않았다. 13종화에서 유일하게 못 맞춘 축이었다.
       해법: 8종은 **이미 쌓고 있는 전적에서 배지를 뽑아낸다.** 게임 파일을 고치지 않고,
             없는 데이터를 지어내지도 않는다 — 판수·승·연승은 실제로 저장돼 있는 값이다.
       ⚠️ 자기 도전과제가 있는 5종에는 파생 배지를 주지 않는다(같은 성취를 두 번 세지 않기 위해). */
    OWN_ACH: ['kb', 'lcr', 'ld', 'yacht', 'yut'],
    DERIVED: [
      { id: 'firstwin', e: '🎉', name: '첫 승',   desc: '1승',        ok: function (d) { return d.wins >= 1; } },
      { id: 'ten',      e: '🔟', name: '열 판',   desc: '10판',       ok: function (d) { return d.games >= 10; } },
      { id: 'streak3',  e: '🔥', name: '3연승',   desc: '최고 연승 3', ok: function (d) { return (d.bestStreak | 0) >= 3; } },
      { id: 'fifty',    e: '🏅', name: '쉰 판',   desc: '50판',       ok: function (d) { return d.games >= 50; } }
    ],
    /** 그 게임에서 얻은 파생 배지들(자기 도전과제가 있는 5종은 빈 배열) */
    derived: function (game, d) {
      if (AS.OWN_ACH.indexOf(game) >= 0) return [];
      if (!d) d = AS.merged()[game];
      if (!d || !d.games) return [];
      return AS.DERIVED.filter(function (b) { return b.ok(d); });
    },
    /** 13종 배지 총합 — 5종은 자기 키(`{접두사}_ach`), 나머지 8종은 파생 */
    badgeCount: function (legacyKeys) {
      var n = 0, m = AS.merged();
      (legacyKeys || []).forEach(function (k) {
        try { var a = JSON.parse(localStorage.getItem(k) || 'null'); if (Array.isArray(a)) n += a.length; } catch (e) {}
      });
      Object.keys(m).forEach(function (g) { n += AS.derived(g, m[g]).length; });
      return n;
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
