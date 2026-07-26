/* LCR (좌·중·우) 엔진 — UMD. 순수 운빨 게임.
   주사위 6면: L(왼쪽에 칩), C(가운데 팟), R(오른쪽에 칩), • • • (유지)
   보유 칩 수만큼(최대 3) 굴림. 칩 0이면 턴 건너뜀(받을 순 있음).
   칩>0인 사람이 1명 남으면 승리 + 팟 전부 획득. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LCRCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const FACES = ['L', 'C', 'R', '.', '.', '.'];

  class LCREngine {
    constructor(opt) {
      opt = opt || {};
      this.players = (opt.players || []).map((p, i) => ({
        pid: p.pid, name: p.name || ('P' + (i + 1)), avatar: p.avatar || null,
        ai: !!p.ai, aiDiff: p.aiDiff || 'normal', seat: i, connected: p.connected !== false
      }));
      this.N = this.players.length;
      const start = opt.startChips || 3;
      this.chips = this.players.map(() => start);
      this.startChips = start;
      this.pot = 0;
      this.maxPot = 0;
      /* 아이템전 — 켜면 **모든 자리(AI 포함)가 같은 개수**의 '칩 지키기'를 받는다.
         상점에서 산 개수와 무관하다(돈으로 유리해지지 않게). 기본은 꺼짐.
         좌·중·우는 굴리면 즉시 반영돼서 '다시 굴리기'가 규칙에 안 맞는다
         → 굴리기 **전에** 켜두면 이번 굴림에서 나갈 칩 1개를 막아주는 방식으로 만들었다. */
      this.itemsOn = !!opt.itemsOn;
      this.itemCharges = Math.max(0, Math.min(5, opt.itemCharges != null ? opt.itemCharges | 0 : 2));
      this.items = [];
      this.shield = [];             // 자리별 '이번 굴림 보호' 예약 여부
      this.shieldSeq = 0; this.lastShield = null;   // 막은 순간 연출용
      this.turn = 0;
      this.phase = 'roll';          // 'roll' | 'over'
      this.winner = null;
      this.lastRoll = null;          // {seat, name, dice:[], moves:[]}
      this.rollSeq = 0;              // 굴림 일련번호 — 클라가 "새 굴림"을 확실히 구분하는 용도
      this.rng = opt.rng || Math.random;
      this.onState = opt.onState || function () {};
      this.aiMs = opt.aiMs != null ? opt.aiMs : 950;
      this.turnMs = opt.turnMs || 0; // 사람 자동굴림 타임아웃(온라인)
      this.aiFast = !!opt.aiFast;
      this._timer = null;
      this._dead = false;
    }
    aliveCount() { return this.chips.filter(c => c > 0).length; }
    _firstAlive(from) { for (let k = 0; k < this.N; k++) { const s = (from + k) % this.N; if (this.chips[s] > 0) return s; } return from; }
    _nextAlive(from) { for (let k = 1; k <= this.N; k++) { const s = (from + k) % this.N; if (this.chips[s] > 0) return s; } return from; }
    _emit() { try { this.onState(); } catch (e) { try { console.error('[lcr] render error', e); } catch (_) {} } }

    start() {
      if (this._dead) return;
      this.gameStartTime = Date.now();
      this.items = this.players.map(() => this.itemsOn ? this.itemCharges : 0);
      this.shield = this.players.map(() => false);
      this.turn = this._firstAlive(0);
      this._emit();
      this._maybeAI();
    }
    rollFace() { return FACES[Math.floor(this.rng() * 6)]; }

    action(pid, a) {
      if (!a || typeof a !== 'object') return;   // 클라가 a 없이 보내도 죽지 않게(서버는 m.a를 그대로 넘긴다)
      if (this._dead || this.phase !== 'roll') return;
      const seat = this.players.findIndex(p => p.pid === pid);
      if (seat < 0 || seat !== this.turn) return;
      if (a.type === 'shield') { this._arm(seat); return; }
      if (a.type !== 'roll') return;
      this._clearTimer();
      this._doRoll(seat);
    }
    /* 아이템전 '칩 지키기' 예약 — 굴리기 전에만, 내 차례에만, 이미 켜뒀으면 무시(중복 소모 방지).
       개수는 전원이 똑같이 받으므로(엔진이 지급) 돈으로 유리해질 여지가 없다. */
    _arm(seat) {
      if (!this.itemsOn) return;
      if (this.phase !== 'roll' || seat !== this.turn) return;
      if (this.shield[seat]) return;
      if (!(this.items[seat] > 0)) return;
      this.items[seat]--;
      this.shield[seat] = true;
      this._emit();
    }
    _doRoll(seat) {
      this._clearTimer();
      if (this._dead || this.phase !== 'roll') return;
      const n = Math.min(3, this.chips[seat]);
      const dice = [], moves = [];
      let guard = !!this.shield[seat];          // 이번 굴림에서 딱 한 번 막는다
      for (let i = 0; i < n; i++) {
        const f = this.rollFace(); dice.push(f);
        if (guard && (f === 'L' || f === 'R' || f === 'C')) {
          guard = false;                        // 한 번만 쓰고 소진
          this.shieldSeq++;
          this.lastShield = { seq: this.shieldSeq, seat, face: f };
          moves.push({ f, to: seat, blocked: true });   // 칩은 그대로 — 클라가 '막았다'로 표시
          continue;
        }
        const mv = this._apply(f, seat); if (mv) moves.push(mv);
      }
      this.shield[seat] = false;                // 예약은 이번 굴림에만 유효
      this.lastRoll = { seat, name: this.players[seat].name, dice, moves };
      this.rollSeq++;
      if (this.aliveCount() <= 1) {
        this.phase = 'over';
        const w = this.chips.findIndex(c => c > 0);
        if (w >= 0) { this.chips[w] += this.pot; this.pot = 0; this.winner = this.players[w].pid; }
        this._emit();
        return;
      }
      this.turn = this._nextAlive(seat);
      this._emit();
      this._maybeAI();
    }
    _apply(f, seat) {
      if (this.chips[seat] <= 0) return null;
      const L = (seat - 1 + this.N) % this.N, R = (seat + 1) % this.N;
      if (f === 'L') { this.chips[seat]--; this.chips[L]++; return { f, to: L }; }
      if (f === 'R') { this.chips[seat]--; this.chips[R]++; return { f, to: R }; }
      if (f === 'C') { this.chips[seat]--; this.pot++; if (this.pot > this.maxPot) this.maxPot = this.pot; return { f, to: -1 }; }
      return null; // '.'
    }
    _maybeAI() {
      this._clearTimer();
      if (this._dead || this.phase !== 'roll') return;
      const p = this.players[this.turn];
      if (p && (p.ai || !p.connected)) {
        this._timer = setTimeout(() => {
          if (this._dead || this.phase !== 'roll') return;
          const seat = this.turn;
          /* 아이템전에서는 AI도 쓴다 — 사람만 쓰면 그건 공정한 판이 아니다.
             칩이 1~2개면 한 번 나가는 게 곧 탈락이라 그때 쓴다. 넉넉할 땐 아껴둔다. */
          if (this.itemsOn && this.items[seat] > 0 && !this.shield[seat] && this.chips[seat] <= 2) this._arm(seat);
          this._doRoll(seat);
        }, this.aiFast ? 130 : this.aiMs);
      } else if (this.turnMs > 0) {
        this._timer = setTimeout(() => { if (!this._dead && this.phase === 'roll') this._doRoll(this.turn); }, this.turnMs);
      }
    }
    _clearTimer() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }

    setConnected(pid, v) { const p = this.players.find(x => x.pid === pid); if (p) p.connected = v; this._maybeAI(); }
    serialize(viewer) {
      return {
        gameStartTime: this.gameStartTime||0,   // 판 고유키 — 클라가 '같은 판 결과 중복 기록'을 막는 데 쓴다
        game: 'lcr', phase: this.phase, turn: this.turn, pot: this.pot, maxPot: this.maxPot, winner: this.winner,
        startChips: this.startChips, rollSeq: this.rollSeq,
        itemsOn: this.itemsOn, items: (this.items || []).slice(), shield: (this.shield || []).slice(),
        lastShield: this.lastShield ? { ...this.lastShield } : null,
        lastRoll: this.lastRoll ? { seat: this.lastRoll.seat, name: this.lastRoll.name, dice: this.lastRoll.dice.slice(), moves: this.lastRoll.moves.map(m => ({ ...m })) } : null,
        players: this.players.map((p, i) => ({ pid: p.pid, name: p.name, avatar: p.avatar, ai: p.ai, connected: p.connected, seat: i, chips: this.chips[i], alive: this.chips[i] > 0 }))
      };
    }
    destroy() { this._dead = true; this._clearTimer(); }
  }

  return { LCREngine, FACES };
});
