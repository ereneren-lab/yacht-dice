/* === onecard-core.js — 원카드 엔진 (브라우저/Node 공용) ===
 *
 * 숨김 정보 (코어를 만들기 전에 한 줄로 적는다 — CLAUDE.md 함정 #14):
 *   **내 손패는 나만 본다. 남의 손패는 '장수'만 공개되고 내용은 아무도 못 본다.
 *     더미(draw)는 전원 못 본다. 버림패 맨 위·지정 무늬·공격 스택·방향은 전원 공개.**
 *   → 라이어·섯다와 같은 '남을 가리는' 방향이다(인디언 포커만 반대).
 *     남의 손패는 화면에서 안 그리는 걸론 부족하고 **스냅샷에 싣지도 않는다.**
 *
 * 규칙: 52장 + 조커 2장. 각자 7장. 버림패 맨 위와 같은 무늬 or 같은 숫자를 낸다.
 *       못 내면 1장 뽑고, 뽑은 게 낼 수 있으면 내거나 넘긴다.
 *       특수: 2=공격+2 · A(1)=스킵 · J(11)=한번더 · Q(12)=방향전환(2인은 한번더)
 *             조커=만능+공격5, 무늬 지정. 공격은 2/조커로 이어치기(누적), 못 막으면 다 먹고 스킵.
 *       손패 0장이 되면 승리.
 *
 * 인터페이스:
 *   new OCEngine({players, itemsOn, itemCharges, aiMs, rng, manualAI, onState})
 *   .start() / .action(pid,a) / .serialize(viewerPid) / .setConnected(pid,b) / .destroy()
 *   a = {type:'play', cardId, suit?} | {type:'draw'} | {type:'pass'} | {type:'take'} | {type:'shield'}
 *       suit는 조커를 낼 때만 쓴다(0~3). 무늬 선택은 클라가 먼저 받아 액션에 실어 보낸다
 *       — 엔진에 '무늬 고르는 중' 같은 UI 하위상태를 만들지 않기 위해서다.
 *   onState()은 인자 없이 호출된다 → 소비자가 serialize(viewerPid)를 직접 부른다(사람마다 손패가 다르다).
 *
 * 엔진은 '무슨 일이 있었나'만 남기고 그리지 않는다(연출은 클라가 seq 차이를 보고 만든다).
 *   dealSeq(새 판 딜) · lastAction{seat,kind,card,amount,seq} · lastShield{seq,seat,blocked}
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OCCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = ['♠', '♥', '♦', '♣'];          // 0,3=black · 1,2=red
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SPECIAL_TAG = { 1: '스킵', 2: '공격2', 11: '한번더', 12: '방향' };
  const JOKER_ATTACK = 5;
  const HAND_SIZE = 7;

  /* 덱 — id는 덱 안에서만 유일하면 된다(0..53).
     예전 인라인 판은 모듈 최상위 `let CID`를 썼는데, 재시작할 때마다 값이 계속 커지는
     유령 상태였다(레시피 3: 최상위 let을 하나도 남기지 않는다). */
  function makeDeck(rng) {
    rng = rng || Math.random;
    const d = [];
    let id = 0;
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s, joker: false, id: id++ });
    d.push({ r: 0, s: 0, joker: true, jk: 'B', id: id++ });
    d.push({ r: 0, s: 1, joker: true, jk: 'R', id: id++ });
    return shuffle(d, rng);
  }

  // 셔플·AI 난수는 반드시 주입 rng로 (Math.random 직접 호출 금지 — 5종 규약)
  function shuffle(a, rng) {
    rng = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function isSpecial(c) { return !!c && (c.joker || c.r === 1 || c.r === 2 || c.r === 11 || c.r === 12); }

  /* 낼 수 있나 — 순수 함수. 판정에 필요한 건 전부 공개 정보라
     클라(내 손패 강조)와 엔진(합법수 계산)이 같은 함수를 쓴다. */
  function canPlayOn(card, top, reqSuit, attack) {
    if (!card || !top) return false;
    if (attack > 0) return card.joker || card.r === 2;   // 공격 중엔 이어치기만
    if (card.joker) return true;                          // 조커는 만능
    const es = (reqSuit != null) ? reqSuit : (top.joker ? null : top.s);
    const er = top.joker ? null : top.r;
    return card.s === es || (er != null && card.r === er);
  }

  /* AI 판단 — 엔진이 만든 view(=그 자리에서 본 serialize)만 보고 결정한다.
     사람이 화면에서 보는 정보와 정확히 같은 것만 본다(남의 손패는 장수뿐). */
  function aiPickMove(view, legal, rng) {
    rng = rng || Math.random;
    if (view.attack > 0) return legal[0];                 // 공격 중엔 무조건 이어치기
    // 상대 중 최소 손패 — 누가 곧 이길 것 같으면 공격/스킵으로 끊는다
    let oppMin = 99;
    for (const p of view.players) if (p.seat !== view.mySeat) oppMin = Math.min(oppMin, p.count);
    const specials = legal.filter(isSpecial), normals = legal.filter(c => !isSpecial(c));
    if (oppMin <= 1 && specials.length) {
      return specials.find(c => c.r === 2 || c.joker) || specials.find(c => c.r === 1) || specials[0];
    }
    // 평소엔 일반 카드부터 내고 특수는 아껴둠(조커는 최후)
    if (normals.length) return normals[Math.floor(rng() * normals.length)];
    const nonJoker = specials.filter(c => !c.joker);
    if (nonJoker.length) return nonJoker[0];
    return legal[0];
  }

  // 조커를 낼 때 지정할 무늬 — 내 손에 가장 많은 무늬
  function aiPickSuit(hand) {
    const cnt = [0, 0, 0, 0];
    for (const c of hand) if (!c.joker) cnt[c.s]++;
    let best = 0;
    for (let s = 1; s < 4; s++) if (cnt[s] > cnt[best]) best = s;
    return best;
  }

  class OCEngine {
    constructor(opts) {
      opts = opts || {};
      this.rng = opts.rng || Math.random;
      this.onState = opts.onState || function () {};
      this.aiMs = opts.aiMs != null ? opts.aiMs : 780;
      this.manualAI = !!opts.manualAI;
      this.players = (opts.players || []).map((p, i) => ({
        pid: p.pid, name: p.name || ('P' + (i + 1)), avatar: p.avatar || null, ai: !!p.ai,
        aiDiff: p.aiDiff || 'normal', connected: p.connected !== false, seat: i
      }));
      this.N = this.players.length;

      /* 아이템전 — 켜면 **모든 자리(AI 포함)가 같은 개수**의 '🛡 공격 막기'를 받는다.
         상점에서 산 개수와 무관하다(돈으로 유리해지지 않게). 기본은 꺼짐.
         효과: 쌓인 공격(2·조커 누적)을 0으로 지우고 카드를 안 먹은 채 차례를 넘긴다.
         왜 이 아이템인가 — 원카드에서 판을 가장 크게 뒤집는 건 '조커 맞고 +5장 먹는 순간'이다.
         그래서 '지금 +2에 쓸까, 뒤에 올지 모를 +5를 위해 아껴둘까'가 진짜 선택이 된다
         (레시피 8: 이름이 예쁜 것보다 '선택이 되는가'가 기준). */
      this.itemsOn = !!opts.itemsOn;
      this.itemCharges = Math.max(0, Math.min(5, opts.itemCharges != null ? opts.itemCharges | 0 : 2));
      this.items = this.players.map(() => this.itemsOn ? this.itemCharges : 0);
      this.shieldSeq = 0; this.lastShield = null;

      this.phase = 'idle';        // 'idle' | 'play' | 'gameover'
      this.hands = []; this.draw = []; this.discard = [];
      this.dir = 1; this.turn = 0; this.attack = 0; this.reqSuit = null;
      this.lastAct = []; this.pendingDrawn = null;   // {seat, card} — 뽑은 카드를 낼지 넘길지 고르는 중
      this.winner = null; this.winnerSeat = -1;
      this.dealSeq = 0; this.actionSeq = 0; this.lastAction = null;
      this.gameStartTime = 0;
      this._dead = false; this._timer = null;
    }

    // ── 진행 ──────────────────────────────────────────────
    start() { this._dead = false; this.gameStartTime = Date.now(); this._newGame(); }

    _newGame() {
      this._clearTimer();
      if (this._dead) return;
      const deck = makeDeck(this.rng);
      this.hands = this.players.map(() => []);
      for (let k = 0; k < HAND_SIZE; k++) for (let i = 0; i < this.N; i++) this.hands[i].push(deck.pop());
      // 시작 카드는 특수카드가 아닌 일반 카드가 나올 때까지 (첫 수부터 공격/스킵이면 사고다)
      let startCard = deck.pop();
      while (deck.length && isSpecial(startCard)) { deck.unshift(startCard); startCard = deck.pop(); }
      this.discard = [startCard];
      this.draw = deck;
      this.dir = 1; this.turn = 0; this.attack = 0; this.reqSuit = null;
      this.lastAct = this.players.map(() => '');
      this.pendingDrawn = null;
      this.winner = null; this.winnerSeat = -1;
      this.lastAction = null; this.lastShield = null;
      this.items = this.players.map(() => this.itemsOn ? this.itemCharges : 0);
      this.phase = 'play';
      this.dealSeq++;
      this._emit();
      this._maybeAI();
    }

    // ── 카드/좌석 헬퍼 ────────────────────────────────────
    top() { return this.discard[this.discard.length - 1]; }
    _nextSeat(from, steps) { let s = from; for (let k = 0; k < steps; k++) s = (s + this.dir + this.N) % this.N; return s; }
    legalMoves(seat) {
      const t = this.top();
      return (this.hands[seat] || []).filter(c => canPlayOn(c, t, this.reqSuit, this.attack));
    }
    // 더미가 마르면 버림패(맨 위 1장 남기고)를 섞어 되쓴다
    _reshuffle() {
      if (this.draw.length > 0) return;
      if (this.discard.length <= 1) return;
      const t = this.discard.pop();
      const rest = this.discard;
      this.discard = [t];
      this.draw = shuffle(rest, this.rng);
    }
    _drawCard(seat) {
      this._reshuffle();
      if (this.draw.length === 0) return null;
      const c = this.draw.pop();
      this.hands[seat].push(c);
      return c;
    }

    validActions(seat) {
      if (this.phase !== 'play' || this.turn !== seat) return [];
      const acts = [];
      if (this.pendingDrawn && this.pendingDrawn.seat === seat) {
        // 뽑은 카드를 낼 수 있으면 '내기', 아니면 '넘기기'만
        if (canPlayOn(this.pendingDrawn.card, this.top(), this.reqSuit, this.attack)) acts.push('play');
        acts.push('pass');
        return acts;
      }
      if (this.attack > 0) {
        if (this.legalMoves(seat).length) acts.push('play');
        acts.push('take');
        if (this._canShield(seat)) acts.push('shield');
        return acts;
      }
      if (this.legalMoves(seat).length) acts.push('play');
      acts.push('draw');
      return acts;
    }

    // ── 액션 ──────────────────────────────────────────────
    action(pid, a) {
      if (this._dead || !a || typeof a !== 'object') return;   // 클라가 a 없이 보내도 죽지 않게
      const seat = this.players.findIndex(p => p.pid === pid);
      if (seat < 0) return;
      if (this.phase !== 'play' || this.turn !== seat) return;
      if (this._isAuto(seat)) return;                          // AI 자리는 사람이 대신 못 누른다
      switch (a.type) {
        case 'play': {
          const hand = this.hands[seat];
          const card = hand.find(c => c.id === a.cardId);
          if (!card) return;
          // 뽑은 카드를 고르는 중이면 그 카드만 낼 수 있다
          if (this.pendingDrawn && this.pendingDrawn.seat === seat && this.pendingDrawn.card.id !== card.id) return;
          if (!canPlayOn(card, this.top(), this.reqSuit, this.attack)) return;
          this._play(seat, card, a.suit);
          return;
        }
        case 'draw':   this._draw(seat); return;
        case 'pass':   this._pass(seat); return;
        case 'take':   this._take(seat); return;
        case 'shield': this._shield(seat); return;
      }
    }

    _play(seat, card, suit) {
      this._clearTimer();
      const h = this.hands[seat];
      const idx = h.findIndex(c => c.id === card.id);
      if (idx < 0) return;
      h.splice(idx, 1);
      this.discard.push(card);
      this.reqSuit = null;
      this.pendingDrawn = null;
      this.lastAct[seat] = this._actLabel(card);
      this.lastAction = { seat, kind: 'play', card: Object.assign({}, card), amount: 0, seq: ++this.actionSeq };

      // 손패를 다 털면 그 자리에서 끝 — 마지막 장의 효과는 적용하지 않는다(이미 이겼다)
      if (h.length === 0) { this._finish(seat); return; }

      let advance = 1, skip = false;
      if (card.joker) { this.attack += JOKER_ATTACK; this.reqSuit = (suit == null) ? card.s : (suit | 0); }
      else if (card.r === 2) { this.attack += 2; }
      else if (card.r === 1) { skip = true; }
      else if (card.r === 11) { advance = 0; }                       // 한 번 더
      else if (card.r === 12) { this.dir *= -1; if (this.N === 2) advance = 0; }
      if (advance !== 0) this.turn = this._nextSeat(seat, skip ? 2 : 1);
      this._emit();
      this._maybeAI();
    }

    _draw(seat) {
      if (this.attack > 0) return;                 // 공격 중엔 '받기'지 '뽑기'가 아니다
      if (this.pendingDrawn) return;
      this._clearTimer();
      const c = this._drawCard(seat);
      this.lastAction = { seat, kind: 'draw', card: null, amount: 1, seq: ++this.actionSeq };
      if (c && canPlayOn(c, this.top(), this.reqSuit, this.attack)) {
        this.pendingDrawn = { seat, card: c };     // 낼지 넘길지는 본인이 고른다
        this.lastAct[seat] = '뽑기';
        this._emit();
        this._maybeAI();
        return;
      }
      this.lastAct[seat] = '뽑기';
      this.turn = this._nextSeat(seat, 1);
      this._emit();
      this._maybeAI();
    }

    _pass(seat) {
      this._clearTimer();
      this.pendingDrawn = null;
      this.lastAct[seat] = '넘김';
      this.lastAction = { seat, kind: 'pass', card: null, amount: 0, seq: ++this.actionSeq };
      this.turn = this._nextSeat(seat, 1);
      this._emit();
      this._maybeAI();
    }

    _take(seat) {
      if (this.attack <= 0) return;
      this._clearTimer();
      const n = this.attack;
      this.attack = 0;
      let got = 0;
      for (let k = 0; k < n; k++) { if (this._drawCard(seat) == null) break; got++; }
      this.lastAct[seat] = '+' + got + '장';
      this.lastAction = { seat, kind: 'take', card: null, amount: got, seq: ++this.actionSeq };
      this.turn = this._nextSeat(seat, 1);
      this._emit();
      this._maybeAI();
    }

    // ── 아이템전: 🛡 공격 막기 ────────────────────────────
    /* 아이템전이 아니거나 내 몫을 다 썼으면 무시한다(개수는 전원 동일 지급).
       공격이 실제로 쌓여 있을 때만 — 공격이 없으면 막을 게 없어서 그냥 낭비다. */
    _canShield(seat) {
      return !!(this.itemsOn && this.phase === 'play' && this.turn === seat &&
                this.attack > 0 && this.items[seat] > 0 && !this.pendingDrawn);
    }
    _shield(seat) {
      if (!this._canShield(seat)) return;
      this._clearTimer();
      const blocked = this.attack;
      this.items[seat]--;
      this.attack = 0;
      this.shieldSeq++;
      this.lastShield = { seq: this.shieldSeq, seat, blocked };
      this.lastAct[seat] = '🛡 막음';
      this.lastAction = { seat, kind: 'shield', card: null, amount: blocked, seq: ++this.actionSeq };
      this.turn = this._nextSeat(seat, 1);   // 카드를 안 먹고 차례만 넘긴다
      this._emit();
      this._maybeAI();
    }

    /* AI도 반드시 쓴다 — 사람만 쓰는 판은 공정하지 않다.
       이어치기(2·조커)로 막을 수 있으면 아이템을 아끼고, 정말 못 막을 때만 쓴다.
       그리고 마지막 한 장은 더 큰 공격에만 — 첫 +2에 털어버리지도, 아끼다 +5를 맞지도 않게 2단계. */
    _aiWantShield(seat) {
      if (!this.itemsOn || !(this.items[seat] > 0)) return false;
      if (this.attack <= 0) return false;
      if (this.legalMoves(seat).length) return false;      // 카드로 막을 수 있으면 안 쓴다
      const big = this.items[seat] >= 2 ? 4 : 5;           // 마지막 한 장은 조커급(+5)에만
      return this.attack >= big;
    }

    // ── AI 구동 ───────────────────────────────────────────
    _isAuto(seat) { const p = this.players[seat]; return !!p && (p.ai || p.connected === false); }
    _maybeAI() {
      this._clearTimer();
      if (this._dead || this.phase !== 'play' || this.manualAI) return;
      if (!this._isAuto(this.turn)) return;
      const seat = this.turn;
      this._timer = setTimeout(() => this._aiAct(seat), this.aiMs);
    }
    aiTurnIfNeeded() {   // manualAI: 클라가 연출을 끝낸 뒤 직접 부른다
      if (this._dead || this.phase !== 'play' || !this._isAuto(this.turn)) return false;
      this._aiAct(this.turn); return true;
    }
    _aiAct(seat) {
      if (this._dead || this.phase !== 'play' || this.turn !== seat) return;

      // 뽑은 카드를 고르는 중이면 — 낼 수 있으면 내고 아니면 넘긴다
      if (this.pendingDrawn && this.pendingDrawn.seat === seat) {
        const c = this.pendingDrawn.card;
        if (canPlayOn(c, this.top(), this.reqSuit, this.attack)) {
          this._play(seat, c, c.joker ? aiPickSuit(this.hands[seat]) : null);
        } else this._pass(seat);
        return;
      }

      if (this.attack > 0) {
        const legal = this.legalMoves(seat);
        if (legal.length) { const c = legal[0]; this._play(seat, c, c.joker ? aiPickSuit(this.hands[seat]) : null); return; }
        if (this._aiWantShield(seat)) { this._shield(seat); return; }
        this._take(seat);
        return;
      }

      const legal = this.legalMoves(seat);
      if (legal.length) {
        const view = this.serialize(this.players[seat].pid);   // 사람이 보는 것과 같은 정보만 본다
        const c = aiPickMove(view, legal, this.rng) || legal[0];
        this._play(seat, c, c.joker ? aiPickSuit(this.hands[seat]) : null);
        return;
      }
      this._draw(seat);
    }

    _actLabel(card) {
      if (card.joker) return '조커! ' + SUITS[card.s === 1 ? 1 : 0];
      if (card.r === 2) return '공격2';
      if (card.r === 1) return '스킵';
      if (card.r === 11) return '한번더';
      if (card.r === 12) return '방향';
      return '냄';
    }

    _finish(seat) {
      this._clearTimer();
      this.phase = 'gameover';
      this.winnerSeat = seat;
      this.winner = this.players[seat] ? this.players[seat].pid : null;
      this._emit();
    }

    // ── 스냅샷 ────────────────────────────────────────────
    /* 남의 손패는 **스냅샷에 싣지 않는다**(화면에서 안 그리는 걸론 부족 — 있으면 그게 곧 누출이다).
       더미(draw)도 내용 없이 장수만 나간다. */
    serialize(viewerPid) {
      const v = this.players.findIndex(p => p.pid === viewerPid);
      const t = this.top();
      const myHand = (v >= 0 && this.hands[v]) ? this.hands[v].map(c => Object.assign({}, c, {
        playable: this.phase === 'play' && this.turn === v &&
          (this.pendingDrawn ? (this.pendingDrawn.seat === v && this.pendingDrawn.card.id === c.id) : true) &&
          canPlayOn(c, t, this.reqSuit, this.attack)
      })) : [];
      return {
        game: 'onecard', phase: this.phase, turn: this.turn, dir: this.dir,
        attack: this.attack, reqSuit: this.reqSuit,
        top: t ? Object.assign({}, t) : null,
        drawCount: this.draw.length, discardCount: this.discard.length,
        dealSeq: this.dealSeq, gameStartTime: this.gameStartTime,
        itemsOn: this.itemsOn, items: this.items.slice(),
        canShield: v >= 0 ? this._canShield(v) : false,
        lastShield: this.lastShield ? Object.assign({}, this.lastShield) : null,
        lastAction: this.lastAction ? Object.assign({}, this.lastAction) : null,
        mySeat: v,
        myHand,
        // 뽑은 카드를 고르는 중 — 그 사람에게만 알린다(남에겐 무슨 카드를 뽑았는지 비밀)
        myPendingDrawnId: (this.pendingDrawn && this.pendingDrawn.seat === v) ? this.pendingDrawn.card.id : null,
        pendingSeat: this.pendingDrawn ? this.pendingDrawn.seat : -1,
        validActions: v >= 0 ? this.validActions(v) : [],
        winner: this.winner, winnerSeat: this.winnerSeat,
        players: this.players.map((p, s) => ({
          pid: p.pid, name: p.name, avatar: p.avatar, ai: p.ai, connected: p.connected, seat: s,
          count: this.hands[s] ? this.hands[s].length : 0,   // 장수만 — 내용은 싣지 않는다
          act: this.lastAct[s] || '',
          items: this.items[s] || 0                          // 누가 아이템이 몇 개 남았는지는 공개 정보
        }))
      };
    }

    setConnected(pid, val) {
      const p = this.players.find(x => x.pid === pid); if (!p) return;
      p.connected = !!val;
      if (!val && p.seat === this.turn && this.phase === 'play') this._maybeAI();
      this._emit();
    }

    _emit() {
      if (this._dead) return;
      // 함정 #2 — 여기서 에러를 삼키면 render가 조용히 죽는다. 반드시 드러낸다.
      try { this.onState(); }
      catch (e) { if (typeof console !== 'undefined' && console.error) console.error('onecard onState error:', e && e.message, e); }
    }
    _clearTimer() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }
    destroy() { this._dead = true; this._clearTimer(); }
  }

  return { OCEngine, makeDeck, shuffle, canPlayOn, isSpecial, aiPickMove, aiPickSuit, SUITS, RANKS, SPECIAL_TAG, HAND_SIZE, JOKER_ATTACK };
});
