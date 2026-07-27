/* === indianpoker-core.js — 인디언 포커 엔진 (브라우저/Node 공용) ===
 * 숨김 정보가 **거꾸로**인 게임이다: 남의 카드는 전부 보이고 **내 카드만** 안 보인다.
 *   → serialize(viewerPid)가 가리는 대상이 '남'이 아니라 '보는 사람 자신'이다.
 *     (라이어·섯다는 남을 가린다. 여기만 반대라서 헷갈리기 쉽다.)
 *
 * 규칙: 1~10 각 4장(40장). 각자 1장. 앤티 1칩. 한 바퀴 베팅(체크/콜/레이즈+1/다이).
 *       안 죽은 사람 중 숫자가 가장 높은 사람이 팟을 가져간다(동점은 나눔).
 *       칩이 0이면 탈락, 혼자 남으면 최종 승리.
 *
 * 인터페이스:
 *   new IPEngine({players, startChips, ante, itemsOn, itemCharges, aiMs, showdownMs, manualAI, rng, onState})
 *   .start() / .action(pid,a) / .nextHand() / .serialize(viewerPid) / .setConnected(pid,b) / .destroy()
 *   a = {type:'bet', mode:'die'|'check'|'call'|'raise'} | {type:'peek'}
 *   onState()은 인자 없이 호출된다 → 소비자가 serialize(viewerPid)를 직접 부른다(사람마다 화면이 다르다).
 *
 * 엔진은 '무슨 일이 있었나'만 남기고 그리지 않는다(연출은 클라가 seq 차이를 보고 만든다).
 *   dealSeq(새 판 딜) · lastAction{seat,mode,amount,seq}(칩 연출) · lastPeek{seq,...}(아이템 연출)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IPCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RANKS = 10;   // 카드 숫자 1~10
  const COPIES = 4;   // 각 4장 = 40장

  function makeDeck(rng) {
    rng = rng || Math.random;
    const d = [];
    for (let r = 1; r <= RANKS; r++) for (let k = 0; k < COPIES; k++) d.push(r);
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = d[i]; d[i] = d[j]; d[j] = t; }
    return d;
  }

  /* 이길 확률 추정 — 순수 함수(DOM·상태 없음).
     my==null(=내 카드를 모름): 보이는 최고 카드보다 높을 확률 ≈ (10-maxSeen)/10, 상대가 많을수록 보수적.
     my!=null(=아이템으로 내 카드를 봄): 상대 카드는 전부 보이므로 승패가 사실상 확정된다. */
  function estimateWin(seen, my, opp) {
    const maxSeen = seen.length ? Math.max.apply(null, seen) : 0;
    if (my != null) {
      if (my > maxSeen) return 0.97;
      if (my < maxSeen) return 0.03;
      return 0.5;
    }
    let p = (RANKS - maxSeen) / RANKS;
    p = Math.max(0.05, Math.min(0.95, p));
    return Math.pow(p, Math.max(1, (opp || 1) * 0.8));
  }

  /* AI 판단 — 엔진이 만든 view(=그 자리에서 본 serialize)만 보고 결정한다.
     '내 카드를 봤는가'가 view.myCard에 이미 반영돼 있어서 아이템 전용 분기가 필요 없다
     (라이어의 peeked와 같은 방식 — 사람도 화면에서 똑같은 정보를 본다). */
  function aiDecide(view, seat, diff, rng) {
    rng = rng || Math.random;
    const me = view.players[seat];
    const seen = []; let opp = 0;
    for (const p of view.players) {
      if (p.seat === seat) continue;
      if (p.inHand && !p.folded) { opp++; if (p.card != null) seen.push(p.card); }
    }
    const winP = estimateWin(seen, view.myCard, opp);
    const toCall = view.bet - (me ? me.contrib : 0);
    const acts = view.validActions || [];
    const can = m => acts.indexOf(m) >= 0;
    const r = rng();
    const bluffP = diff === 'hard' ? 0.28 : diff === 'easy' ? 0.08 : 0.16;
    let mode;
    if (toCall <= 0) {                     // 공짜로 볼 수 있는 상황
      if (winP > 0.6 && can('raise') && r < 0.6) mode = 'raise';
      else if (r < bluffP && can('raise')) mode = 'raise';     // 블러프
      else mode = 'check';
    } else {
      const potOdds = toCall / (view.pot + toCall);
      const foldThresh = (diff === 'easy' ? 0.12 : diff === 'hard' ? 0.26 : 0.19) + potOdds * 0.35;
      if (winP > 0.7 && can('raise') && r < 0.5) mode = 'raise';
      else if (winP > foldThresh && can('call')) mode = 'call';
      else if (r < bluffP && can('raise')) mode = 'raise';     // 블러프 레이즈
      else mode = 'die';
    }
    if (!can(mode)) mode = can('call') ? 'call' : can('check') ? 'check' : 'die';
    return { type: 'bet', mode };
  }

  class IPEngine {
    constructor(opts) {
      opts = opts || {};
      this.rng = opts.rng || Math.random;
      this.onState = opts.onState || function () {};
      this.startChips = opts.startChips != null ? opts.startChips | 0 : 50;
      this.ante = opts.ante != null ? Math.max(1, opts.ante | 0) : 1;
      this.aiMs = opts.aiMs != null ? opts.aiMs : 850;
      this.showdownMs = opts.showdownMs != null ? opts.showdownMs : 520;
      this.manualAI = !!opts.manualAI;
      this.players = (opts.players || []).map((p, i) => ({
        pid: p.pid, name: p.name || ('P' + (i + 1)), avatar: p.avatar || null, ai: !!p.ai,
        aiDiff: p.aiDiff || 'normal', connected: p.connected !== false, seat: i,
        chips: p.chips != null ? p.chips | 0 : this.startChips
      }));
      this.N = this.players.length;
      /* 아이템전 — 켜면 **모든 자리(AI 포함)가 같은 개수**의 '🔍 내 카드 보기'를 받는다.
         상점에서 산 개수와 무관하다(돈으로 유리해지지 않게). 기본은 꺼짐.
         효과: 이 게임의 유일한 숨김정보인 '내 카드'를 나에게만 공개한다(그 판 동안 유지).
         지급은 **게임당 1회**다 — 판마다 새로 주면 매 판이 정보 게임이 아니게 된다. */
      this.itemsOn = !!opts.itemsOn;
      this.itemCharges = Math.max(0, Math.min(5, opts.itemCharges != null ? opts.itemCharges | 0 : 2));
      this.items = this.players.map(() => this.itemsOn ? this.itemCharges : 0);
      this.peeked = this.players.map(() => false);
      this.peekSeq = 0; this.lastPeek = null;

      this.phase = 'idle';    // 'idle'|'bet'|'showdown'(공개 직전 뜸)|'result'|'gameover'
      this.handNo = 0; this.turn = 0;
      this.deck = []; this.cards = []; this.contrib = []; this.folded = []; this.inHand = []; this.lastAct = [];
      this.pot = 0; this.bet = 0; this.toActCount = 0; this.lastAggressor = -1;
      this.actionSeq = 0; this.lastAction = null; this.dealSeq = 0;
      this.lastResult = null; this.winner = null;
      this.gameStartTime = 0;
      this._dead = false; this._timer = null;
    }

    // ── 진행 ──────────────────────────────────────────────
    start() { this._dead = false; this.gameStartTime = Date.now(); this._newHand(); }
    nextHand() { if (this._dead || this.phase === 'gameover') return; this._newHand(); }

    _newHand() {
      this._clearTimer();
      if (this._dead) return;
      if (this._aliveCount() <= 1) {
        const w = this.players.find(p => p.chips > 0);
        this.phase = 'gameover'; this.winner = w ? w.pid : null;
        this._emit(); return;
      }
      this.handNo++;
      this.deck = makeDeck(this.rng);
      this.cards = this.players.map(() => null);
      this.contrib = this.players.map(() => 0);
      this.inHand = this.players.map(p => p.chips > 0);      // 파산자는 이번 판 빠짐
      this.folded = this.players.map(p => !(p.chips > 0));
      this.lastAct = this.players.map(() => '');
      this.peeked = this.players.map(() => false);           // 지난 판에 본 카드 정보는 무효
      this.pot = 0; this.bet = this.ante; this.lastAggressor = -1;
      this.lastResult = null; this.lastAction = null;
      // 앤티 1칩 + 카드 1장
      for (let s = 0; s < this.N; s++) {
        if (!this.inHand[s]) continue;
        const a = Math.min(this.ante, this.players[s].chips);
        this.players[s].chips -= a; this.contrib[s] = a; this.pot += a;
        this.cards[s] = this.deck.pop();
      }
      this.phase = 'bet';
      this.toActCount = this._countActive();                 // 레이즈가 없으면 한 바퀴
      this.turn = this._firstActive(0);
      this.dealSeq++;
      if (this.toActCount <= 0) { this._toShowdown(); return; }   // 전원 앤티 올인 → 바로 공개
      this._emit();
      this._maybeAI();
    }

    // ── 좌석 헬퍼 ─────────────────────────────────────────
    _aliveCount() { return this.players.filter(p => p.chips > 0).length; }
    // 살아서 이번 판에 남아 있는 사람(쇼다운 자격). 칩이 0이어도(올인) 포함된다.
    _liveCount() { let c = 0; for (let s = 0; s < this.N; s++) if (this.inHand[s] && !this.folded[s]) c++; return c; }
    // 실제로 '행동할 수 있는' 사람 — 올인(칩 0)은 더 낼 게 없으니 차례를 주지 않는다.
    _canAct(s) { return this.inHand[s] && !this.folded[s] && this.players[s].chips > 0; }
    _countActive() { let c = 0; for (let s = 0; s < this.N; s++) if (this._canAct(s)) c++; return c; }
    _countActiveExcept(seat) { let c = 0; for (let s = 0; s < this.N; s++) if (s !== seat && this._canAct(s)) c++; return c; }
    _firstActive(from) { for (let k = 0; k < this.N; k++) { const s = (from + k) % this.N; if (this._canAct(s)) return s; } return from; }
    _nextActive(from) { for (let k = 1; k <= this.N; k++) { const s = (from + k) % this.N; if (this._canAct(s)) return s; } return from; }

    // ── 베팅 ──────────────────────────────────────────────
    validActions(seat) {
      if (this.phase !== 'bet' || this.turn !== seat) return [];
      const acts = ['die'];
      const toCall = this.bet - (this.contrib[seat] || 0);
      const chips = this.players[seat].chips;
      if (toCall <= 0) acts.push('check');
      else if (toCall <= chips) acts.push('call');
      if (chips > toCall && chips > 0) acts.push('raise');
      return acts;
    }

    action(pid, a) {
      if (this._dead || !a || typeof a !== 'object') return;   // 클라가 a 없이 보내도 죽지 않게
      const seat = this.players.findIndex(p => p.pid === pid);
      if (seat < 0) return;
      if (a.type === 'peek') { this._doPeek(seat); return; }
      /* 온라인에서 '다음 판'을 누르는 사람이 정해져 있지 않다 — 앉아 있는 누구든 넘길 수 있게 한다.
         판이 끝난 뒤(result)에만 먹히므로 진행 중에 눌러도 아무 일도 없다. */
      if (a.type === 'nextHand') { if (this.phase === 'result') this.nextHand(); return; }
      if (this.phase !== 'bet' || this.turn !== seat) return;
      if (this._isAuto(seat)) return;                          // AI 자리는 사람이 대신 못 누른다
      this._bet(seat, a.type === 'bet' ? a.mode : a.type);     // {type:'bet',mode} 우선, 옛 형식도 받는다
    }

    _put(seat, amt) {
      amt = Math.max(0, Math.min(amt | 0, this.players[seat].chips));
      this.players[seat].chips -= amt;
      this.contrib[seat] = (this.contrib[seat] || 0) + amt;
      this.pot += amt;
      return amt;
    }

    _bet(seat, mode) {
      if (this.phase !== 'bet' || this.turn !== seat) return;
      this._clearTimer();
      const chips = this.players[seat].chips;
      const toCall = this.bet - (this.contrib[seat] || 0);
      let amount = 0, raised = false;
      if (mode === 'die') { this.folded[seat] = true; this.lastAct[seat] = '다이'; }
      else if (mode === 'check') { if (toCall > 0) return; this.lastAct[seat] = '체크'; }
      else if (mode === 'call') {
        if (toCall <= 0) return;
        amount = this._put(seat, Math.min(toCall, chips));
        this.lastAct[seat] = this.players[seat].chips === 0 ? '올인' : '콜';
      } else if (mode === 'raise') {
        const need = (this.bet + 1) - (this.contrib[seat] || 0);
        if (need > chips) {
          // 올릴 만큼이 없다 → 가진 걸 다 넣는 올인. 기준액(bet)은 안 올라가므로
          // 남들이 다시 응답할 필요가 없다(=콜과 같은 회계, toActCount를 그대로 깎는다).
          amount = this._put(seat, chips); this.lastAct[seat] = '올인';
        } else {
          amount = this._put(seat, need); this.lastAct[seat] = '레이즈';
          this.bet = this.contrib[seat]; this.lastAggressor = seat;
          this.toActCount = this._countActiveExcept(seat);     // 나머지가 다시 응답해야 한다
          raised = true;
        }
      } else return;
      this.lastAction = { seat, mode, amount, seq: ++this.actionSeq };
      this._afterAction(seat, raised);
    }

    _afterAction(seat, raised) {
      if (!raised) this.toActCount--;
      if (this._liveCount() <= 1 || this.toActCount <= 0) { this._toShowdown(); return; }
      this.turn = this._nextActive(seat);
      this._emit();
      this._maybeAI();
    }

    _toShowdown() {
      this.phase = 'showdown';        // 카드는 아직 안 깐다 — 클라가 '탁' 하는 사이를 둘 수 있게
      this._emit();
      this._clearTimer();
      this._timer = setTimeout(() => this._showdown(), this.showdownMs);
    }

    _showdown() {
      this._clearTimer();
      if (this._dead) return;
      const live = [];
      for (let s = 0; s < this.N; s++) if (this.inHand[s] && !this.folded[s]) live.push(s);
      let winners;
      if (live.length <= 1) winners = live.slice();
      else {
        const best = Math.max.apply(null, live.map(s => this.cards[s]));
        winners = live.filter(s => this.cards[s] === best);
      }
      const potBefore = this.pot;
      if (winners.length) {
        const share = Math.floor(potBefore / winners.length), rem = potBefore - share * winners.length;
        winners.forEach((w, i) => { this.players[w].chips += share + (i < rem ? 1 : 0); });
        this.pot = 0;
      }
      this.phase = 'result';
      this.lastResult = {
        winners: winners.slice(),
        winnerPids: winners.map(w => this.players[w].pid),
        pot: potBefore,
        showdown: live.length > 1,
        cards: this.players.map((p, s) => this.inHand[s] ? this.cards[s] : null)
      };
      this._emit();
    }

    // ── 아이템전: 🔍 내 카드 보기 ─────────────────────────
    /* 판이 아이템전이 아니거나 내 몫을 다 썼으면 무시한다(개수는 전원 동일 지급).
       내 차례에만, 한 판에 한 번만 — 이미 본 판에 또 쓰면 그냥 낭비라서 막는다. */
    _doPeek(seat) {
      if (!this.itemsOn) return;
      if (this.phase !== 'bet' || this.turn !== seat) return;
      if (!this.inHand[seat] || this.folded[seat]) return;
      if (!(this.items[seat] > 0)) return;
      if (this.peeked[seat]) return;
      if (this.cards[seat] == null) return;
      this.items[seat]--;
      this.peeked[seat] = true;
      this.peekSeq++;
      this.lastPeek = { seq: this.peekSeq, seat, value: this.cards[seat] };
      this._emit();
    }

    /* AI도 반드시 쓴다 — 사람만 쓰는 판은 공정하지 않다.
       정보가 가장 값어치 있는 순간은 '따라갈지 접을지'를 고민할 때(=돈이 이미 걸린 뒤)라
       팟이 커졌을 때만 쓴다. 첫 턴에 털어버리지도, 아끼다 죽지도 않게 두 단계로 나눴다. */
    _aiWantPeek(seat) {
      if (!this.itemsOn || !(this.items[seat] > 0) || this.peeked[seat]) return false;
      const toCall = this.bet - (this.contrib[seat] || 0);
      if (toCall <= 0) return false;                 // 공짜로 볼 수 있는 턴엔 안 쓴다
      const big = this.ante * (this.N + 2);          // '커진 팟'의 기준 (3인 앤티1 → 5칩)
      if (this.items[seat] >= 2) return this.pot >= big - this.ante;
      return this.pot >= big;                        // 마지막 한 장은 정말 큰 판에만
    }

    // ── AI 구동 ───────────────────────────────────────────
    _isAuto(seat) { const p = this.players[seat]; return !!p && (p.ai || p.connected === false); }
    _maybeAI() {
      this._clearTimer();
      if (this._dead || this.phase !== 'bet' || this.manualAI) return;
      if (!this._isAuto(this.turn)) return;
      const seat = this.turn;
      this._timer = setTimeout(() => this._aiAct(seat), this.aiMs);
    }
    aiTurnIfNeeded() {   // manualAI: 클라가 연출을 끝낸 뒤 직접 부른다
      if (this._dead || this.phase !== 'bet' || !this._isAuto(this.turn)) return false;
      this._aiAct(this.turn); return true;
    }
    _aiAct(seat) {
      if (this._dead || this.phase !== 'bet' || this.turn !== seat) return;
      if (this._aiWantPeek(seat)) this._doPeek(seat);
      const view = this.serialize(this.players[seat].pid);   // 자기 카드는 훔쳐봤을 때만 보인다
      const a = aiDecide(view, seat, this.players[seat].aiDiff, this.rng);
      this._bet(seat, a.mode);
    }

    // ── 스냅샷 ────────────────────────────────────────────
    serialize(viewerPid) {
      const v = this.players.findIndex(p => p.pid === viewerPid);
      const reveal = this.phase === 'result' || this.phase === 'gameover';
      const mine = (v >= 0 && this.cards[v] != null && (reveal || this.peeked[v])) ? this.cards[v] : null;
      return {
        game: 'indianpoker', phase: this.phase, handNo: this.handNo, turn: this.turn,
        pot: this.pot, bet: this.bet, ante: this.ante,
        dealSeq: this.dealSeq, gameStartTime: this.gameStartTime,
        itemsOn: this.itemsOn, items: this.items.slice(),
        myCard: mine, myPeeked: v >= 0 ? !!this.peeked[v] : false,
        // 훔쳐본 '값'은 본 사람에게만 실어 보낸다 — 남의 스냅샷에 섞이면 그게 곧 정보 누출이다
        lastPeek: (this.lastPeek && this.lastPeek.seat === v) ? Object.assign({}, this.lastPeek) : null,
        canPeek: !!(this.itemsOn && v >= 0 && this.phase === 'bet' && this.turn === v &&
                    this.items[v] > 0 && !this.peeked[v] && this.inHand[v] && !this.folded[v]),
        lastAction: this.lastAction ? Object.assign({}, this.lastAction) : null,
        lastResult: this.lastResult ? Object.assign({}, this.lastResult) : null,
        validActions: v >= 0 ? this.validActions(v) : [],
        winner: this.winner,
        players: this.players.map((p, s) => ({
          pid: p.pid, name: p.name, avatar: p.avatar, ai: p.ai, connected: p.connected, seat: s,
          chips: p.chips, inHand: !!this.inHand[s], folded: !!this.folded[s],
          contrib: this.contrib[s] || 0, act: this.lastAct[s] || '',
          peeked: !!this.peeked[s],        // 누가 아이템을 썼는지는 공개 정보(무엇을 봤는지는 아님)
          // 카드 공개 — **남의 카드는 늘 보이고 내 카드만 가린다**(인디언 포커의 핵심)
          card: (!this.inHand[s] || this.cards[s] == null) ? null
              : (s !== v || reveal || this.peeked[s]) ? this.cards[s] : null
        }))
      };
    }

    setConnected(pid, val) {
      const p = this.players.find(x => x.pid === pid); if (!p) return;
      p.connected = !!val;
      if (!val && p.seat === this.turn && this.phase === 'bet') this._maybeAI();
      this._emit();
    }

    _emit() {
      if (this._dead) return;
      // 함정 #2 — 여기서 에러를 삼키면 render가 조용히 죽는다. 반드시 드러낸다.
      try { this.onState(); }
      catch (e) { if (typeof console !== 'undefined' && console.error) console.error('indianpoker onState error:', e && e.message, e); }
    }
    _clearTimer() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }
    destroy() { this._dead = true; this._clearTimer(); }
  }

  return { IPEngine, makeDeck, aiDecide, estimateWin, RANKS, COPIES };
});
