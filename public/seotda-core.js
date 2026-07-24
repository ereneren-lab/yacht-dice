/* 섯다 엔진 — UMD. 피망식 2장 섯다: 화투 20장, 히든 카드, 2라운드 베팅, 정통 잡이(토글).
   설계·규칙 출처: SEOTDA_DESIGN.md (피망 인게임 + 티스토리2 + tarkerx 교차검증).
   결정론: 셔플·AI 랜덤은 주입 rng 사용(Math.random 금지 — 5종 규약과 동일). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SeotdaCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // ── 결정론 PRNG (seed → 0..1) ──
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── 덱: 1~10월 각 2장(총 20장). 광은 1·3·8월에 1장씩(3장). ──
  function makeDeck() {
    const deck = []; let id = 0;
    for (let m = 1; m <= 10; m++) {
      const hasGwang = (m === 1 || m === 3 || m === 8);
      deck.push({ id: id++, month: m, gwang: hasGwang });  // 광 or 첫 장
      deck.push({ id: id++, month: m, gwang: false });     // 피/열끗
    }
    return deck;  // 20장
  }
  function shuffle(deck, rng) {
    const a = deck.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ── 특수 끗(월 조합, 순서=강함) : 알리>독사>구삥>장삥>장사>세륙 ──
  const SPECIAL = {
    '1,2': { sub: 6, name: '알리' },
    '1,4': { sub: 5, name: '독사' },
    '1,9': { sub: 4, name: '구삥' },
    '1,10': { sub: 3, name: '장삥' },
    '4,10': { sub: 2, name: '장사' },
    '4,6': { sub: 1, name: '세륙' },
  };

  // ── 패평가: 2장 → { rank(정수·클수록 강), tier, name, jabi } ──
  //    tier별 rank 구간: 광땡 4000+ / 땡 3000+ / 특수끗 2000+ / 끗 1000+  (겹치지 않음)
  //    잡이(암행어사·땡잡이·구사)는 '관계형 반전'이라 rank엔 안 넣고 플래그로만 → 쇼다운에서 적용.
  function evalHand(a, b) {
    const m1 = a.month, m2 = b.month;
    const key = m1 < m2 ? (m1 + ',' + m2) : (m2 + ',' + m1);
    const set = { [m1]: true, [m2]: true };
    const jabi = { amhaeng: false, ttaengjabi: false, gusa: false };
    if (set[4] && set[7]) jabi.amhaeng = true;                 // 암행어사 4+7
    if (set[4] && set[9]) jabi.gusa = true;                    // 구사 4+9
    if (set[3] && set[7]) {                                    // 땡잡이 = 3광 + 7
      const three = a.month === 3 ? a : (b.month === 3 ? b : null);
      if (three && three.gwang) jabi.ttaengjabi = true;
    }
    // 광땡 (광 2장 · 서로 다른 월) — 38 > 18 > 13
    if (a.gwang && b.gwang) {
      const gsub = key === '3,8' ? 3 : key === '1,8' ? 2 : 1;
      const gname = key === '3,8' ? '38광땡' : key === '1,8' ? '18광땡' : '13광땡';
      return { rank: 4000 + gsub, tier: '광땡', name: gname, jabi };
    }
    // 땡 (같은 월 페어) — 장땡(10) > … > 삥땡(1)
    if (m1 === m2) {
      const name = m1 === 10 ? '장땡' : m1 === 1 ? '삥땡' : (m1 + '땡');
      return { rank: 3000 + m1, tier: '땡', name, jabi };
    }
    // 특수 끗
    if (SPECIAL[key]) {
      const s = SPECIAL[key];
      return { rank: 2000 + s.sub, tier: '특수', name: s.name, jabi };
    }
    // 끗 (두 월 합의 끝자리) — 갑오(9) > … > 망통(0)
    const k = (m1 + m2) % 10;
    const name = k === 9 ? '갑오' : k === 0 ? '망통' : (k + '끗');
    return { rank: 1000 + k, tier: '끗', name, jabi };
  }

  // ── 쇼다운 비교(잡이 반영). A가 이기면 >0, 지면 <0, 무승부 0. ──
  //    잡이 on일 때 관계형 반전: 암행어사→13/18광땡, 땡잡이→1~9땡(장땡·광땡 제외).
  //    (38광땡·장땡은 못 잡음). 3자 순환(가위바위보)은 드물어 king-of-hill로 근사 — 설계서 명시.
  function cmpJabi(A, B, jabiOn) {
    if (jabiOn) {
      if (A.jabi.amhaeng && B.tier === '광땡' && (B.name === '13광땡' || B.name === '18광땡')) return 1;
      if (B.jabi.amhaeng && A.tier === '광땡' && (A.name === '13광땡' || A.name === '18광땡')) return -1;
      if (A.jabi.ttaengjabi && B.tier === '땡' && B.name !== '장땡') return 1;
      if (B.jabi.ttaengjabi && A.tier === '땡' && A.name !== '장땡') return -1;
    }
    return A.rank - B.rank;
  }
  // entries: [{seat, cards:[c1,c2]}] (살아있는 사람만). opts.jabi.
  //   반환: { result:'redeal' } (구사) 또는 { result:'win', winners:[seat...], evs }
  function resolveShowdown(entries, opts) {
    opts = opts || {};
    const evs = entries.map(e => ({ seat: e.seat, h: evalHand(e.cards[0], e.cards[1]) }));
    if (opts.jabi) {
      // 구사: 누군가 4+9 && 판 최고 base가 '알리(2006) 이하' → 재경기
      if (evs.some(e => e.h.jabi.gusa)) {
        const maxBase = Math.max.apply(null, evs.map(e => e.h.rank));
        if (maxBase <= 2006) return { result: 'redeal', reason: '구사' };
      }
    }
    let best = evs[0];
    for (let i = 1; i < evs.length; i++) if (cmpJabi(evs[i].h, best.h, !!opts.jabi) > 0) best = evs[i];
    const winners = evs.filter(e => cmpJabi(e.h, best.h, !!opts.jabi) === 0).map(e => e.seat);
    return { result: 'win', winners, evs, best: best.h };
  }

  // ── 베팅 액션 유효/금액 계산 헬퍼 ──
  // 라운드 문맥: bet=이번 라운드 최대 기여액, contrib[seat]=이번 라운드 내 기여.
  const RAISE = { call: 0, ping: 0 };

  class SeotdaEngine {
    constructor(opt) {
      opt = opt || {};
      this.players = (opt.players || []).map((p, i) => ({
        pid: p.pid, name: p.name || ('P' + (i + 1)), avatar: p.avatar || null,
        ai: !!p.ai, aiDiff: p.aiDiff || 'normal', seat: i, connected: p.connected !== false,
        chips: opt.startChips != null ? opt.startChips : 20000,
      }));
      this.N = this.players.length;
      this.ante = opt.ante != null ? opt.ante : 100;
      this.jabi = !!opt.jabi;                 // 잡이 규칙 on/off(기본 off)
      this.ttaengValue = !!opt.ttaengValue;   // 땡값(옵션)
      this.rng = opt.rng || mulberry32(12345);
      this.onState = opt.onState || function () {};
      this.aiMs = opt.aiMs != null ? opt.aiMs : 900;
      this.manualAI = !!opt.manualAI;
      this.dealerSeat = 0;
      this.handNo = 0;
      this.actionSeq = 0;    // 베팅 액션 순번(클라 칩 연출 트리거용)
      this.phase = 'idle';   // 'idle'|'bet'|'showdown'|'handover'|'gameover'
      this._dead = false;
      this._timer = null;
      this.winner = null;
    }

    start() { this._newHand(); }

    _alive() { return this.players.filter(p => p.chips > 0); }

    _newHand() {
      if (this._dead) return;
      // 파산 안 한 사람만 참가. 1명 이하면 게임 종료.
      const inPlay = this.players.filter(p => p.chips > 0);
      if (inPlay.length <= 1) { this.phase = 'gameover'; this.winner = inPlay[0] ? inPlay[0].pid : null; this._emit(); return; }
      this.handNo++;
      // 딜러 다음 살아있는 좌석부터 선
      this.dealerSeat = this._nextAliveSeat(this.dealerSeat);
      this.deck = shuffle(makeDeck(), this.rng);
      this.deckIdx = 0;
      this.hands = this.players.map(() => []);
      this.inHand = this.players.map(p => p.chips > 0);   // 이번 판 참가 여부
      this.folded = this.players.map(() => false);
      this.allin = this.players.map(() => false);
      this.pot = 0;
      this.roundContribTotal = this.players.map(() => 0);  // 판 전체 기여(팟 정합·환급용)
      this.contrib = this.players.map(() => 0);            // _startBetRound 전에 앤티 _put이 참조
      // 앤티
      for (let s = 0; s < this.N; s++) if (this.inHand[s]) this._put(s, Math.min(this.ante, this.players[s].chips));
      // 1장 딜(라운드1)
      this._dealOne();
      this.round = 1;
      this.lastResult = null;
      this._startBetRound();
    }

    _nextAliveSeat(from) {
      for (let k = 1; k <= this.N; k++) { const s = (from + k) % this.N; if (this.players[s].chips > 0) return s; }
      return from;
    }
    _dealOne() {
      for (let s = 0; s < this.N; s++) if (this.inHand[s] && !this.folded[s]) this.hands[s].push(this.deck[this.deckIdx++]);
    }
    _put(seat, amt) {
      amt = Math.max(0, Math.min(amt, this.players[seat].chips));
      this.players[seat].chips -= amt;
      this.contrib[seat] = (this.contrib[seat] || 0) + amt;
      this.roundContribTotal[seat] += amt;
      this.pot += amt;
      if (this.players[seat].chips === 0) this.allin[seat] = true;
      return amt;
    }

    _startBetRound() {
      this.contrib = this.players.map(() => 0);
      this.bet = 0;                     // 이번 라운드 콜 기준액
      this.lastAggressor = -1;
      // 이번 라운드 행동해야 할 사람(살아있고 안 죽고 올인 아님)
      this.toAct = new Set();
      for (let s = 0; s < this.N; s++) if (this.inHand[s] && !this.folded[s] && !this.allin[s]) this.toAct.add(s);
      // 선부터
      this.turn = this._firstToAct();
      this.phase = 'bet';
      this._emit();
      this._maybeAI();
    }
    _firstToAct() {
      // 딜러 다음(선)부터 살아있는 첫 사람
      let s = this.dealerSeat;
      for (let k = 0; k < this.N; k++) { s = (this.dealerSeat + k) % this.N; if (this.toAct.has(s)) return s; }
      return this.dealerSeat;
    }
    _liveCount() { let c = 0; for (let s = 0; s < this.N; s++) if (this.inHand[s] && !this.folded[s]) c++; return c; }

    // 유효 액션 목록(클라 UI용)
    validActions(seat) {
      if (this.phase !== 'bet' || this.turn !== seat) return [];
      const acts = ['die'];
      const toCall = this.bet - (this.contrib[seat] || 0);
      const chips = this.players[seat].chips;
      if (this.bet === 0) { acts.push('ping'); acts.push('check'); }
      else if (toCall <= chips) acts.push('call');
      // 레이즈류(칩 있으면)
      if (chips > toCall) { acts.push('quarter'); acts.push('half'); if (this.bet > 0) acts.push('ttadang'); }
      if (chips > 0) acts.push('allin');
      return acts;
    }
    // 레이즈 목표 베팅액
    _raiseTarget(mode) {
      const p = this.pot;
      if (mode === 'ping') return this.ante;
      if (mode === 'ttadang') return this.bet * 2;
      if (mode === 'quarter') return this.bet + Math.max(this.ante, Math.round(p * 0.25));
      if (mode === 'half') return this.bet + Math.max(this.ante, Math.round(p * 0.5));
      return this.bet;
    }

    action(pid, a) {
      if (this._dead || this.phase !== 'bet') return;
      const seat = this.players.findIndex(p => p.pid === pid);
      if (seat < 0 || seat !== this.turn) return;
      if (!a || typeof a !== 'object' || a.type !== 'bet') return;
      this._clearTimer();
      const mode = a.mode;
      const chips = this.players[seat].chips;
      const toCall = this.bet - (this.contrib[seat] || 0);
      if (mode === 'die') { this.folded[seat] = true; this.toAct.delete(seat); }
      else if (mode === 'check') { if (this.bet !== 0) return; this.toAct.delete(seat); }
      else if (mode === 'call') { if (this.bet === 0) return; this._put(seat, Math.min(toCall, chips)); this.toAct.delete(seat); }
      else if (mode === 'allin') {
        const before = this.bet; this._put(seat, chips);
        const my = this.contrib[seat];
        if (my > before) { this.bet = my; this._resetToActAfterRaise(seat); }
        this.toAct.delete(seat);
      }
      else if (mode === 'ping' || mode === 'ttadang' || mode === 'quarter' || mode === 'half') {
        if (mode === 'ping' && this.bet !== 0) return;                  // 삥은 오픈(bet==0)에서만
        if (mode === 'ttadang' && this.bet === 0) return;              // 따당은 기존 베팅 2배 → bet>0 필요
        // quarter/half: 오픈(bet==0)이든 레이즈든 가능
        const target = this._raiseTarget(mode);
        const need = target - (this.contrib[seat] || 0);
        if (need > chips) { // 부족하면 올인 처리
          this._put(seat, chips);
        } else {
          this._put(seat, need);
        }
        const my = this.contrib[seat];
        if (my > this.bet) { this.bet = my; this._resetToActAfterRaise(seat); }
        this.toAct.delete(seat);
      } else return;

      this.lastAction = { seat, mode, amount: chips - this.players[seat].chips, seq: ++this.actionSeq };
      this._afterAction();
    }
    _resetToActAfterRaise(raiser) {
      this.lastAggressor = raiser;
      this.toAct = new Set();
      for (let s = 0; s < this.N; s++) if (this.inHand[s] && !this.folded[s] && !this.allin[s] && s !== raiser) this.toAct.add(s);
    }
    _afterAction() {
      // 1명만 남으면 즉시 종료(패 안 깜)
      if (this._liveCount() <= 1) return this._endHandByFold();
      // 라운드 종료?
      if (this.toAct.size === 0) return this._endBetRound();
      // 다음 차례
      this.turn = this._nextToAct(this.turn);
      this._emit();
      this._maybeAI();
    }
    _nextToAct(from) {
      for (let k = 1; k <= this.N; k++) { const s = (from + k) % this.N; if (this.toAct.has(s)) return s; }
      return from;
    }
    _endBetRound() {
      if (this.round === 1) {
        this.round = 2;
        this._dealOne();          // 2장째
        this._startBetRound();
      } else {
        this._showdown();
      }
    }
    _endHandByFold() {
      const winner = this.players.findIndex((p, s) => this.inHand[s] && !this.folded[s]);
      this._award([winner], null);
    }
    _showdown() {
      const entries = [];
      for (let s = 0; s < this.N; s++) if (this.inHand[s] && !this.folded[s]) entries.push({ seat: s, cards: this.hands[s] });
      const res = resolveShowdown(entries, { jabi: this.jabi });
      if (res.result === 'redeal') {
        // 구사: 팟 유지한 채 재분배(간이: 앤티 다시 안 걷고 그대로 다시 딜)
        this.phase = 'showdown'; this.lastResult = { redeal: true, reason: res.reason };
        this._emit();
        this._redeal();
        return;
      }
      this.reveal = true;
      // 잡이 반전으로 이겼는지 판정(배너용)
      let jabiWin = null;
      if (this.jabi && res.winners.length) {
        const w = res.evs.find(e => e.seat === res.winners[0]);
        if (w) {
          if (w.h.jabi.amhaeng && res.evs.some(e => e.h.tier === '광땡' && (e.h.name === '13광땡' || e.h.name === '18광땡'))) jabiWin = '암행어사';
          else if (w.h.jabi.ttaengjabi && res.evs.some(e => e.h.tier === '땡' && e.h.name !== '장땡')) jabiWin = '땡잡이';
        }
      }
      this._award(res.winners, res.evs, jabiWin);
    }
    _redeal() {
      // 팟 유지, 카드만 다시(앤티 재징수 없음). 딜러 유지.
      this.deck = shuffle(makeDeck(), this.rng); this.deckIdx = 0;
      this.hands = this.players.map(() => []);
      this.folded = this.players.map((p, s) => !this.inHand[s]);
      this.allin = this.players.map(() => false);
      this._dealOne();
      this.round = 1;
      this._startBetRound();
    }
    _award(winners, evs, jabiWin) {
      const share = Math.floor(this.pot / winners.length);
      let rem = this.pot - share * winners.length;
      winners.forEach((w, i) => { this.players[w].chips += share + (i < rem ? 1 : 0); });
      this.phase = 'handover';
      this.lastResult = {
        winners: winners.map(w => this.players[w].pid),
        pot: this.pot,
        reveal: !!this.reveal,
        jabiWin: jabiWin || null,
        hands: evs ? evs.map(e => ({ seat: e.seat, name: e.h.name, tier: e.h.tier })) : null,
      };
      this._emit();
      this._maybeNextHand();
    }
    _maybeNextHand() {
      this._clearTimer();
      if (this._dead) return;
      // 다음 판 예약(UI가 없으면 즉시 진행 · manualAI면 대기)
      if (this.manualAI) return;
      this._timer = setTimeout(() => { this.reveal = false; this._newHand(); }, this.aiMs + 600);
    }
    nextHand() { this._clearTimer(); this.reveal = false; this._newHand(); }   // UI에서 '다음 판'

    // ── AI ──
    _maybeAI() {
      this._clearTimer();
      if (this._dead || this.phase !== 'bet') return;
      const p = this.players[this.turn];
      if (!p || !p.ai || !this.inHand[this.turn] || this.folded[this.turn]) return;
      if (this.manualAI) return;
      this._timer = setTimeout(() => { if (!this._dead && this.phase === 'bet') this._aiAct(this.turn); }, this.aiMs);
    }
    aiTurnIfNeeded() {   // manualAI: UI가 리플레이 끝난 뒤 호출
      if (this._dead || this.phase !== 'bet') return false;
      const p = this.players[this.turn];
      if (!p || !p.ai) return false;
      this._aiAct(this.turn); return true;
    }
    _handStrength(seat) {
      const h = this.hands[seat];
      if (this.round === 1 || h.length < 2) {   // 1장만: 월/광으로 대략
        const c = h[0]; return Math.min(1, (c.month / 12) + (c.gwang ? 0.25 : 0));
      }
      const ev = evalHand(h[0], h[1]);
      // rank를 대략 0..1로 (끗 1000~1009 → 0~.35, 특수~.5, 땡~.8, 광땡~1)
      if (ev.tier === '광땡') return 0.97 + (ev.rank - 4000) * 0.01;
      if (ev.tier === '땡') return 0.62 + (ev.rank - 3000) * 0.02;   // 삥땡~.64, 장땡~.82
      if (ev.tier === '특수') return 0.45 + (ev.rank - 2000) * 0.02;
      return 0.05 + ((ev.rank - 1000) / 9) * 0.32;                   // 망통~.05, 갑오~.37
    }
    _aiAct(seat) {
      const diff = this.players[seat].aiDiff;
      const st = this._handStrength(seat);
      const r = this.rng();
      const toCall = this.bet - (this.contrib[seat] || 0);
      const potOdds = toCall > 0 ? toCall / (this.pot + toCall) : 0;
      const bluffP = diff === 'hard' ? 0.22 : diff === 'easy' ? 0.06 : 0.13;
      const acts = this.validActions(seat);
      const can = m => acts.indexOf(m) >= 0;
      let mode;
      if (this.bet === 0) {            // 아무도 안 걸었음
        if (st > 0.55 && can('half')) mode = (r < 0.5 ? 'half' : 'quarter');
        else if (st > 0.35 && can('quarter')) mode = 'quarter';
        else if (r < bluffP && can('half')) mode = 'half';          // 블러프
        else mode = can('ping') ? (r < 0.4 ? 'ping' : 'check') : 'check';
      } else {                         // 콜/레이즈/다이
        const foldThresh = (diff === 'easy' ? 0.15 : diff === 'hard' ? 0.32 : 0.22) + potOdds * 0.5;
        if (st > 0.7 && can('half') && r < 0.55) mode = (r < 0.28 ? 'ttadang' : 'half');
        else if (st > foldThresh) mode = can('call') ? 'call' : 'check';
        else if (r < bluffP && can('half')) mode = 'quarter';       // 블러프 레이즈
        else mode = 'die';
      }
      if (!can(mode)) mode = can('call') ? 'call' : can('check') ? 'check' : 'die';
      this.action(this.players[seat].pid, { type: 'bet', mode });
    }

    _clearTimer() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }
    _emit() { try { this.onState(); } catch (e) { if (typeof console !== 'undefined' && console.error) console.error('seotda onState error:', e && e.message); } }

    // ── 직렬화(히든): viewer 본인 카드만 앞면. 쇼다운/reveal 때 안 죽은 전원 공개. ──
    serialize(viewer) {
      const vseat = this.players.findIndex(p => p.pid === viewer);
      const revealAll = this.phase === 'handover' && this.reveal;
      return {
        game: 'seotda', phase: this.phase, handNo: this.handNo,
        pot: this.pot, bet: this.bet, turn: this.turn, round: this.round,
        dealerSeat: this.dealerSeat, jabi: this.jabi, ante: this.ante,
        winner: this.winner,
        lastAction: this.lastAction || null,
        lastResult: this.lastResult || null,
        validActions: (vseat >= 0 ? this.validActions(vseat) : []),
        players: this.players.map((p, s) => ({
          pid: p.pid, name: p.name, avatar: p.avatar, ai: p.ai, connected: p.connected, seat: s,
          chips: p.chips,
          inHand: !!(this.inHand && this.inHand[s]),
          folded: !!(this.folded && this.folded[s]),
          allin: !!(this.allin && this.allin[s]),
          contrib: (this.contrib && this.contrib[s]) || 0,
          cardCount: (this.hands && this.hands[s]) ? this.hands[s].length : 0,
          // 카드 공개: 본인 or (쇼다운에서 안 죽은 사람)
          cards: ((s === vseat) || (revealAll && this.inHand && this.inHand[s] && !this.folded[s]))
            ? (this.hands && this.hands[s] ? this.hands[s].slice() : [])
            : null,
          hand: ((s === vseat && this.hands && this.hands[s] && this.hands[s].length === 2))
            ? (function (h) { const e = evalHand(h[0], h[1]); return { name: e.name, tier: e.tier }; })(this.hands[s])
            : null,
        })),
      };
    }

    setConnected(pid, v) { const p = this.players.find(x => x.pid === pid); if (p) p.connected = v; }
    destroy() { this._dead = true; this._clearTimer(); }
  }

  return { SeotdaEngine, makeDeck, shuffle, evalHand, resolveShowdown, cmpJabi, mulberry32, SPECIAL };
});
