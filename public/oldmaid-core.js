/* === oldmaid-core.js — 도둑잡기 엔진 (브라우저/Node 공용) ===
 *
 * 숨김 정보 (코어를 만들기 전에 한 줄로 적는다 — CLAUDE.md 함정 #14):
 *   **내 손패는 나만 본다. 남의 손패는 '장수'만 공개되고 내용은 아무도 못 본다
 *     — 누가 조커를 들었는지가 이 게임의 전부라, 조커 위치는 절대 스냅샷에 싣지 않는다.
 *     뽑을 카드의 정체도 뽑기 전엔 아무도 모른다.**
 *   → 라이어·섯다·원카드와 같은 '남을 가리는' 방향이다(인디언 포커만 반대).
 *
 * 규칙: 52장 + 조커 1장(53장)을 라운드로빈으로 전원에게 나눈다.
 *       손에 든 같은 숫자 2장은 짝으로 버린다(시작할 때 한 번 자동 정리).
 *       내 차례엔 **다음 사람**의 손패에서 1장을 뽑는다. 짝이 되면 즉시 버린다.
 *       손패가 0장이 되면 '세이프'로 빠진다. 마지막까지 카드를 든 사람(=조커 보유자)이 술래.
 *
 * 인터페이스:
 *   new OMEngine({players, itemsOn, itemCharges, aiMs, pairMs, stepMs, manualAI, rng, onState})
 *   .start() / .action(pid,a) / .serialize(viewerPid) / .setConnected(pid,b) / .destroy()
 *   a = {type:'draw', idx} | {type:'peek'}
 *   onState()은 인자 없이 호출된다 → 소비자가 serialize(viewerPid)를 직접 부른다(사람마다 손패가 다르다).
 *
 * 엔진은 '무슨 일이 있었나'만 남기고 그리지 않는다(연출은 클라가 seq 차이를 보고 만든다).
 *   dealSeq · lastAction{seat,kind,seq} · lastPair{seat,count,seq} · lastJoker{seat,seq} · lastSafe{seat,seq}
 *
 * ⚠️ 순서 누출 방지 — 차례가 시작될 때 **대상의 손패를 섞는다.**
 *    안 섞으면 방금 건네받은 카드가 늘 맨 끝에 있어서, 뽑는 쪽이 "끝자리는 방금 걔가 받은 것"을
 *    역산할 수 있다. 실물 게임에서 패를 든 사람이 섞어서 부채로 펴는 게 바로 이것 때문이다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OMCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function shuffle(a, rng) {
    rng = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 덱 — id는 덱 안에서만 유일하면 된다(0..52).
     예전 인라인 판은 모듈 최상위 `let CID`를 썼는데, 재시작할 때마다 값이 계속 커지는
     유령 상태였다(레시피 3: 최상위 let을 하나도 남기지 않는다). */
  function makeDeck(rng) {
    const d = [];
    let id = 0;
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s, joker: false, id: id++ });
    d.push({ r: 0, s: 0, joker: true, id: id++ });
    return shuffle(d, rng);
  }

  /* 손에서 짝(같은 숫자 2장)을 빼고 버린 카드를 돌려준다 — 순수 함수(DOM·상태 없음).
     조커는 짝이 없으므로 영원히 남는다. 그게 이 게임의 전부다. */
  function discardPairs(hand) {
    const removed = [];
    const byRank = {};
    for (const c of hand) { if (c.joker) continue; (byRank[c.r] = byRank[c.r] || []).push(c); }
    for (const r in byRank) {
      const arr = byRank[r];
      const pairs = Math.floor(arr.length / 2);
      for (let p = 0; p < pairs * 2; p++) removed.push(arr[p]);
    }
    if (removed.length) {
      const ids = new Set(removed.map(c => c.id));
      for (let i = hand.length - 1; i >= 0; i--) if (ids.has(hand[i].id)) hand.splice(i, 1);
    }
    return removed;
  }

  class OMEngine {
    constructor(opts) {
      opts = opts || {};
      this.rng = opts.rng || Math.random;
      this.onState = opts.onState || function () {};
      this.aiMs = opts.aiMs != null ? opts.aiMs : 780;
      this.pairMs = opts.pairMs != null ? opts.pairMs : 420;   // 뽑기 → 짝 판정 사이의 '뜸'
      this.stepMs = opts.stepMs != null ? opts.stepMs : 360;   // 짝 판정 → 다음 차례 사이
      this.manualAI = !!opts.manualAI;
      this.players = (opts.players || []).map((p, i) => ({
        pid: p.pid, name: p.name || ('P' + (i + 1)), avatar: p.avatar || null, ai: !!p.ai,
        aiDiff: p.aiDiff || 'normal', connected: p.connected !== false, seat: i
      }));
      this.N = this.players.length;

      /* 아이템전 — 켜면 **모든 자리(AI 포함)가 같은 개수**의 '👀 살짝 보기'를 받는다.
         상점에서 산 개수와 무관하다(돈으로 유리해지지 않게). 기본은 꺼짐.
         효과: 이번에 뽑을 상대 패에서 **조커가 몇 번째인지**(없으면 '없음')를 나에게만 알려준다.
         왜 이 아이템인가 — 도둑잡기의 긴장은 통째로 '눈 감고 한 장 집기'에 있다.
         그 한 번을 눈 뜨고 집게 해주는 것이라 판단이 개입한다. 반대로 '다시 뽑기'는
         조커를 도로 넣는 것이라 긴장 자체를 없애버려서 안 골랐다(레시피 8 기준). */
      this.itemsOn = !!opts.itemsOn;
      this.itemCharges = Math.max(0, Math.min(5, opts.itemCharges != null ? opts.itemCharges | 0 : 2));
      this.items = this.players.map(() => this.itemsOn ? this.itemCharges : 0);
      this.peekSeq = 0;
      this.peek = null;      // {seat, targetSeat, jokerIdx|null} — 이번 차례에만 유효

      this.phase = 'idle';   // 'idle' | 'play' | 'gameover'
      this.hands = []; this.out = []; this.lastAct = [];
      this.turn = 0; this.target = -1; this.loser = -1; this.loserPid = null;
      this.dealSeq = 0; this.actionSeq = 0;
      this.lastAction = null; this.lastPair = null; this.lastJoker = null; this.lastSafe = null;
      this.initialPairs = null;   // 시작 짝 정리 결과(클라가 순차 연출로 보여준다)
      this.gameStartTime = 0;
      this._dead = false; this._timer = null;
    }

    /* 연출용 '뜸'을 거는 자리. ms가 0 이하면 **동기로 즉시** 실행한다.
       헤드리스 시뮬이 pairMs:0/stepMs:0으로 엔진을 완전히 동기로 돌릴 수 있게 하려는 것 —
       안 그러면 동기 while 루프가 이벤트 루프를 안 놔줘서 짝 판정이 영영 안 돌고,
       그게 '엔진 교착'으로 보인다(실제로 이 시뮬을 처음 돌렸을 때 그렇게 오진했다). */
    _after(ms, fn) {
      if (!(ms > 0)) { fn(); return; }
      this._timer = setTimeout(fn, ms);
    }

    // ── 진행 ──────────────────────────────────────────────
    start() { this._dead = false; this.gameStartTime = Date.now(); this._newGame(); }

    _newGame() {
      this._clearTimer();
      if (this._dead) return;
      const deck = makeDeck(this.rng);
      this.hands = this.players.map(() => []);
      this.out = this.players.map(() => false);
      this.lastAct = this.players.map(() => '');
      this.items = this.players.map(() => this.itemsOn ? this.itemCharges : 0);
      this.peek = null;
      this.loser = -1; this.loserPid = null;
      this.lastAction = null; this.lastPair = null; this.lastJoker = null; this.lastSafe = null;
      // 라운드로빈 분배 (53장이라 인원에 따라 1장 차이가 난다 — 원래 규칙 그대로)
      let s = 0;
      while (deck.length) { this.hands[s % this.N].push(deck.pop()); s++; }

      /* 시작 짝 정리는 **엔진이 한 번에** 끝낸다. 연출(자리마다 순차로 보여주기)은
         initialPairs를 받은 클라가 만든다 — 엔진이 setTimeout 사슬로 게임을 진행하던
         옛 구조(initialCleanup)를 여기서 끊었다. */
      this.initialPairs = [];
      for (let i = 0; i < this.N; i++) {
        const removed = discardPairs(this.hands[i]);
        this.initialPairs.push({ seat: i, count: removed.length, cards: removed.map(c => Object.assign({}, c)) });
        if (this.hands[i].length === 0) { this.out[i] = true; this.lastAct[i] = '세이프'; }
      }
      this.phase = 'play';
      this.dealSeq++;
      if (this._checkEnd()) return;
      this._beginTurn(this._firstActive(0));
    }

    // ── 좌석 헬퍼 ─────────────────────────────────────────
    _holders() { const a = []; for (let s = 0; s < this.N; s++) if (this.hands[s].length > 0) a.push(s); return a; }
    _active(s) { return !this.out[s] && this.hands[s].length > 0; }
    _firstActive(from) { for (let k = 0; k < this.N; k++) { const s = (from + k) % this.N; if (this._active(s)) return s; } return from; }
    _nextActive(from) { for (let k = 1; k <= this.N; k++) { const s = (from + k) % this.N; if (this._active(s)) return s; } return from; }

    _checkEnd() {
      // 카드를 든 사람이 1명 이하면 끝 — 그 1명이 조커를 든 술래다
      const h = this._holders();
      if (h.length <= 1) {
        this.loser = h.length === 1 ? h[0] : -1;
        this.loserPid = this.loser >= 0 ? this.players[this.loser].pid : null;
        this.phase = 'gameover';
        this._clearTimer();
        this._emit();
        return true;
      }
      return false;
    }

    /* 차례 시작 — 대상을 정하고 **대상의 손패를 섞는다**(순서 누출 방지, 위 주석 참고).
       peek은 이번 차례에만 유효하므로 여기서 지운다. */
    _beginTurn(seat) {
      if (this._dead || this.phase !== 'play') return;
      if (!this._active(seat)) seat = this._firstActive(seat);
      this.turn = seat;
      const t = this._nextActive(seat);
      if (t === seat) { this._checkEnd(); return; }
      this.target = t;
      shuffle(this.hands[t], this.rng);
      this.peek = null;
      this._emit();
      this._maybeAI();
    }

    validActions(seat) {
      if (this.phase !== 'play' || this.turn !== seat) return [];
      const acts = ['draw'];
      if (this._canPeek(seat)) acts.push('peek');
      return acts;
    }

    // ── 액션 ──────────────────────────────────────────────
    action(pid, a) {
      if (this._dead || !a || typeof a !== 'object') return;   // 클라가 a 없이 보내도 죽지 않게
      const seat = this.players.findIndex(p => p.pid === pid);
      if (seat < 0) return;
      if (this.phase !== 'play' || this.turn !== seat) return;
      if (this._isAuto(seat)) return;                          // AI 자리는 사람이 대신 못 누른다
      if (a.type === 'peek') { this._doPeek(seat); return; }
      if (a.type === 'draw') { this._draw(seat, a.idx | 0); return; }
    }

    _draw(seat, idx) {
      if (this.phase !== 'play' || this.turn !== seat) return;
      const t = this.target;
      if (t < 0 || !this.hands[t] || !this.hands[t].length) return;
      this._clearTimer();
      if (!(idx >= 0 && idx < this.hands[t].length)) idx = 0;

      const card = this.hands[t].splice(idx, 1)[0];
      this.hands[seat].push(card);
      this.lastAct[seat] = '뽑기';
      this.peek = null;
      this.lastAction = { seat, from: t, kind: 'draw', seq: ++this.actionSeq };
      // 조커를 뽑았다는 사실은 **뽑은 사람에게만** 알린다(남에게 새면 게임이 무너진다)
      if (card.joker) { this.lastJoker = { seat, seq: this.actionSeq }; }
      // 대상이 손패를 다 털면 세이프
      if (this.hands[t].length === 0 && !this.out[t]) {
        this.out[t] = true; this.lastAct[t] = '세이프';
        this.lastSafe = { seat: t, seq: this.actionSeq };
      }
      this._emit();   // ① 카드가 옮겨간 순간 — 클라가 '날아가는' 연출을 할 틈을 준다

      this._after(this.pairMs, () => this._resolvePairs(seat));
    }

    // ② 방금 뽑은 카드로 짝이 맞는지 — 잠깐 뜸을 들인 뒤 판정한다(연출용 사이)
    _resolvePairs(seat) {
      this._clearTimer();
      if (this._dead || this.phase !== 'play') return;
      const removed = discardPairs(this.hands[seat]);
      if (removed.length) {
        this.lastAct[seat] = '짝!';
        this.lastPair = { seat, count: removed.length, cards: removed.map(c => Object.assign({}, c)), seq: ++this.actionSeq };
      }
      if (this.hands[seat].length === 0 && !this.out[seat]) {
        this.out[seat] = true; this.lastAct[seat] = '세이프';
        this.lastSafe = { seat, seq: ++this.actionSeq };
      }
      this._emit();
      this._after(this.stepMs > 0 ? this.stepMs + (removed.length ? 160 : 0) : 0, () => {
        this._clearTimer();
        if (this._dead || this.phase !== 'play') return;
        this.lastAct = this.players.map(() => '');
        if (this._checkEnd()) return;
        this._beginTurn(this._nextActive(seat));
      });
    }

    // ── 아이템전: 👀 살짝 보기 ────────────────────────────
    /* 아이템전이 아니거나 내 몫을 다 썼으면 무시한다(개수는 전원 동일 지급).
       내 차례에, 아직 안 뽑았을 때만 — 뽑고 나서 보는 건 아무 의미가 없다. */
    _canPeek(seat) {
      return !!(this.itemsOn && this.phase === 'play' && this.turn === seat &&
                this.items[seat] > 0 && !this.peek &&
                this.target >= 0 && this.hands[this.target] && this.hands[this.target].length > 0);
    }
    _doPeek(seat) {
      if (!this._canPeek(seat)) return;
      this.items[seat]--;
      const t = this.target;
      const idx = this.hands[t].findIndex(c => c.joker);
      // jokerIdx가 null이면 '이 사람은 조커를 안 들었다' — 그것도 값진 정보다
      this.peek = { seat, targetSeat: t, jokerIdx: idx >= 0 ? idx : null, seq: ++this.peekSeq };
      this.lastAct[seat] = '👀';
      this._emit();
    }

    /* AI도 반드시 쓴다 — 사람만 쓰는 판은 공정하지 않다.
       정보가 가장 값어치 있는 순간은 **상대 패가 적을 때**다(조커일 확률이 높다).
       마지막 한 장은 더 조여서 쓴다 — 첫 턴에 털지도, 아끼다 조커를 집지도 않게 2단계. */
    _aiWantPeek(seat) {
      if (!this.itemsOn || !(this.items[seat] > 0) || this.peek) return false;
      const t = this.target;
      if (t < 0 || !this.hands[t] || !this.hands[t].length) return false;
      const n = this.hands[t].length;
      return this.items[seat] >= 2 ? n <= 4 : n <= 3;
    }

    // AI가 뽑을 자리 — peek으로 조커 위치를 알면 피한다(아이템 전용 분기 없이 같은 정보를 쓴다)
    _aiPickIdx(seat) {
      const t = this.target, n = this.hands[t].length;
      if (this.peek && this.peek.seat === seat && this.peek.targetSeat === t) {
        const j = this.peek.jokerIdx;
        if (j == null) return Math.floor(this.rng() * n);       // 조커 없음 → 아무거나
        if (n <= 1) return 0;                                    // 피할 데가 없다
        let i = Math.floor(this.rng() * (n - 1));                // 조커만 빼고 고른다
        if (i >= j) i++;
        return i;
      }
      return Math.floor(this.rng() * n);
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
    aiTurnIfNeeded() {   // manualAI: 클라(또는 테스트)가 직접 부른다
      if (this._dead || this.phase !== 'play' || !this._isAuto(this.turn)) return false;
      this._aiAct(this.turn); return true;
    }
    _aiAct(seat) {
      if (this._dead || this.phase !== 'play' || this.turn !== seat) return;
      if (this._aiWantPeek(seat)) this._doPeek(seat);
      this._draw(seat, this._aiPickIdx(seat));
    }

    // ── 스냅샷 ────────────────────────────────────────────
    /* 남의 손패는 **스냅샷에 싣지 않는다** — 조커가 어디 있는지가 이 게임의 전부다.
       장수만 나간다. 조커를 뽑았다는 사실도 뽑은 본인에게만 실어 보낸다. */
    serialize(viewerPid) {
      const v = this.players.findIndex(p => p.pid === viewerPid);
      const reveal = this.phase === 'gameover';
      const mine = (v >= 0 && this.hands[v]) ? this.hands[v].map(c => Object.assign({}, c)) : [];
      const myPeek = (this.peek && this.peek.seat === v) ? Object.assign({}, this.peek) : null;
      return {
        game: 'oldmaid', phase: this.phase, turn: this.turn, target: this.target,
        dealSeq: this.dealSeq, gameStartTime: this.gameStartTime,
        itemsOn: this.itemsOn, items: this.items.slice(),
        canPeek: v >= 0 ? this._canPeek(v) : false,
        myPeek,                                   // 훔쳐본 결과는 본 사람에게만
        mySeat: v, myHand: mine,
        // 내가 방금 조커를 집었나 — 남의 스냅샷엔 절대 안 실린다
        myJoker: (this.lastJoker && this.lastJoker.seat === v) ? Object.assign({}, this.lastJoker) : null,
        lastAction: this.lastAction ? Object.assign({}, this.lastAction) : null,
        // 버린 짝은 공개 정보(실물에서도 앞면으로 버린다) — 다만 남의 것은 장수만
        lastPair: this.lastPair
          ? { seat: this.lastPair.seat, count: this.lastPair.count, seq: this.lastPair.seq,
              cards: this.lastPair.seat === v ? this.lastPair.cards : null }
          : null,
        lastSafe: this.lastSafe ? Object.assign({}, this.lastSafe) : null,
        initialPairs: this.initialPairs
          ? this.initialPairs.map(p => ({ seat: p.seat, count: p.count, cards: p.seat === v ? p.cards : null }))
          : null,
        validActions: v >= 0 ? this.validActions(v) : [],
        loser: this.loser, loserPid: this.loserPid,
        players: this.players.map((p, s) => ({
          pid: p.pid, name: p.name, avatar: p.avatar, ai: p.ai, connected: p.connected, seat: s,
          count: this.hands[s] ? this.hands[s].length : 0,   // 장수만 — 내용은 싣지 않는다
          out: !!this.out[s], act: this.lastAct[s] || '',
          items: this.items[s] || 0,                          // 남은 아이템 수는 공개 정보
          // 술래의 패는 게임이 끝난 뒤에만 공개한다
          hand: (reveal && s === this.loser && this.hands[s]) ? this.hands[s].map(c => Object.assign({}, c)) : null
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
      catch (e) { if (typeof console !== 'undefined' && console.error) console.error('oldmaid onState error:', e && e.message, e); }
    }
    _clearTimer() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }
    destroy() { this._dead = true; this._clearTimer(); }
  }

  return { OMEngine, makeDeck, discardPairs, shuffle, SUITS, RANKS };
});
