/* 윷놀이 엔진 — UMD. 정통 규칙: 빽도·지름길·업기·잡기.
   경로: 외곽 20칸(0~19) + 지름길(우상5→중앙, 좌상10→중앙→출발).
   말: out(판에 나옴)·node·route·done. 다 완주하면 승리. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YutCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // 경로 시퀀스 (노드 번호). 끝을 지나면 완주.
  const SEQ = {
    outer: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    sc5:   [5, 20, 21, 22, 23, 24, 15, 16, 17, 18, 19],   // 우상(5) 지름길 → 중앙(22) → 좌하(15) 합류
    sc10:  [10, 25, 26, 22, 27, 28],                       // 좌상(10) 지름길 → 중앙(22) → 출발 직행
  };
  const THROWS = [
    { name: '빽도', step: -1, again: false },
    { name: '도', step: 1, again: false },
    { name: '개', step: 2, again: false },
    { name: '걸', step: 3, again: false },
    { name: '윷', step: 4, again: true },
    { name: '모', step: 5, again: true },
  ];

  function throwYut(rng, power) {
    // 윷가락 4개, index0 = 뒷도 표시. 앞(true)/뒤(false). power(0~1)로 앞면 확률 미세 가중.
    const th = 0.5 + ((power==null?0.5:power) - 0.5) * 0.26;
    const s = [rng() < th, rng() < th, rng() < th, rng() < th];
    const front = s.filter(Boolean).length;
    if (front === 0) return THROWS[5];            // 모
    if (front === 4) return THROWS[4];            // 윷
    if (front === 1) return s[0] ? THROWS[0] : THROWS[1]; // 뒷도만 앞 → 빽도, 아니면 도
    if (front === 2) return THROWS[2];            // 개
    return THROWS[3];                             // 걸
  }

  // 말 한 칸 이동 결과: {done} 또는 {node, route} 또는 {noMove}
  function isBranch(node, route) {
    return (route === 'outer' && (node === 5 || node === 10)) || (route === 'sc5' && node === 22);
  }
  function step(node, route, out, steps, dir) {
    if (!out) {
      if (steps < 0) return { noMove: true };
      if (steps >= SEQ.outer.length) return { done: true };
      return { node: SEQ.outer[steps], route: 'outer', out: true };
    }
    let seq = SEQ[route], i = seq.indexOf(node);
    if (dir === 'shortcut' && steps > 0) {
      if (route === 'outer' && node === 5) { seq = SEQ.sc5; i = 0; }
      else if (route === 'outer' && node === 10) { seq = SEQ.sc10; i = 0; }
      else if (route === 'sc5' && node === 22) { seq = SEQ.sc10; i = SEQ.sc10.indexOf(22); }
    }
    if (i < 0) return { noMove: true };
    const rname = (seq === SEQ.sc5) ? 'sc5' : (seq === SEQ.sc10) ? 'sc10' : 'outer';
    if (steps < 0) {
      if (i <= 0) return { noMove: true };
      return { node: seq[i - 1], route: rname, out: true };
    }
    const ni = i + steps;
    if (ni >= seq.length) return { done: true };
    let nn = seq[ni], nr = rname;
    return { node: nn, route: nr, out: true };
  }

  class YutEngine {
    constructor(opt) {
      opt = opt || {};
      const nm = opt.markers || 4;
      this.markers = nm;
      this.teamMode = !!opt.teamMode;
      this.winnerTeam = null;
      this.goal = (opt.goal && opt.goal <= nm) ? opt.goal : nm;  // 승리 목표(완주시킬 말 수)
      this.players = (opt.players || []).map((p, i) => ({
        pid: p.pid, name: p.name || ('P' + (i + 1)), avatar: p.avatar || null,
        ai: !!p.ai, aiDiff: p.aiDiff || 'normal', seat: i, team: (!!opt.teamMode ? (i % 2) : i), connected: p.connected !== false,
        pieces: Array.from({ length: nm }, (_, k) => ({ id: k, out: false, node: 0, route: 'outer', done: false }))
      }));
      this.N = this.players.length;
      this.turn = 0;
      this.phase = 'throw';        // 'throw' | 'move' | 'over'
      this.pending = [];           // 굴린 step 대기열
      this.throwsLeft = 1;         // 남은 던질 횟수
      this.lastThrow = null;       // {name, step}
      this.throwSeq = 0;           // 던지기 고유 카운터(연출용)
      this.winner = null;
      this.captured = null;        // 마지막 잡기 정보(연출용)
      this.moveSeq = 0; this.lastMovePath = null;  // 말 이동 경로(연출용)
      this.skipSeq = 0; this.lastSkip = null;  // 이동 불가 턴 넘김(연출용)
      this.rng = opt.rng || Math.random;
      this.onState = opt.onState || function () {};
      this.aiMs = opt.aiMs != null ? opt.aiMs : 900;
      this.turnMs = opt.turnMs || 0;
      this.aiFast = !!opt.aiFast;
      this._timer = null; this._dead = false;
    }
    _emit() { try { this.onState(); } catch (e) {} }
    _clear() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }

    start() { if (this._dead) return; this.turn = 0; this.phase = 'throw'; this.throwsLeft = 1; this.pending = []; this._emit(); this._maybeAI(); }

    // 던지기
    doThrow(pid, power) {
      if (this._dead || this.phase !== 'throw') return;
      const seat = this.players.findIndex(p => p.pid === pid);
      if (seat !== this.turn || this.throwsLeft <= 0) return;
      this._clear();
      const r = throwYut(this.rng, power);
      this.lastThrow = { name: r.name, step: r.step }; this.throwSeq++;
      this.throwsLeft--;
      this.pending.push(r.step);
      if (r.again) this.throwsLeft++;             // 윷·모 → 한 번 더
      // 이동할 말이 없고 빽도뿐이면 스킵 처리는 move 단계에서
      if (this.throwsLeft > 0) { this._emit(); this._maybeAI(); return; }
      this.phase = 'move';
      // 움직일 수 있는 말이 하나도 없으면 턴 넘김
      if (!this._anyMovable(seat)) { this._skipTurn(seat); return; }
      this._emit(); this._maybeAI();
    }

    _anyMovable(seat) {
      const pl = this.players[seat];
      for (const s of this.pending) {
        for (const pc of pl.pieces) {
          if (pc.done) continue;
          const r = step(pc.node, pc.route, pc.out, s);
          if (!r.noMove) return true;
        }
      }
      return false;
    }

    // 말 이동: pendingIndex 의 step 으로 pieceId 이동 (업힌 말 함께)
    doMove(pid, pieceId, pendingIndex, dir, carry, ownerSeat) {
      if (this._dead || this.phase !== 'move') return;
      const seat = this.players.findIndex(p => p.pid === pid);
      if (seat !== this.turn) return;
      if (pendingIndex == null) pendingIndex = 0;
      if (pendingIndex < 0 || pendingIndex >= this.pending.length) return;
      const steps = this.pending[pendingIndex];
      // 소유자: 기본은 자기 말, 팀전이면 같은 팀 팀원 말도 제어 가능
      let owner = seat;
      if (ownerSeat != null && this.teamMode) { const os = this.players[ownerSeat]; if (os && os.team === this.players[seat].team) owner = ownerSeat; }
      const pl = this.players[owner];
      const pc = pl.pieces.find(p => p.id === pieceId);
      if (!pc || pc.done) return;
      const r = step(pc.node, pc.route, pc.out, steps, dir);
      if (r.noMove) return;                       // 이 말은 이 step으로 못 감
      // 이동 경로(한 칸씩) 기록 — 연출용
      const mpath = []; { let cn = pc.node, cr = pc.route, co = pc.out; const dstep = steps < 0 ? -1 : 1; const cnt = Math.abs(steps);
        for (let k = 0; k < cnt; k++) { const rr = step(cn, cr, co, dstep, k === 0 ? dir : null); if (rr.noMove) break; if (rr.done) { mpath.push({ done: true }); break; } mpath.push({ node: rr.node, route: rr.route }); cn = rr.node; cr = rr.route; co = true; } }
      this.moveSeq++; this.lastMovePath = { seq: this.moveSeq, seat: owner, pieceId, path: mpath };
      this._clear();
      this.pending.splice(pendingIndex, 1);
      this.captured = null;

      // 업기: 같은 칸의 말들. 팀전이면 같은 팀 전체, 아니면 자기 말만. carry===false면 이 말만
      const mates = this.teamMode ? this.players.filter(p => p.team === pl.team) : [pl];
      const sameCell = (pc.out && !pc.done)
        ? mates.reduce((a, tp) => a.concat(tp.pieces.filter(x => !x.done && x.out && x.node === pc.node && x.route === pc.route)), [])
        : [pc];
      const group = (carry === false) ? [pc] : sameCell;

      if (r.done) {
        group.forEach(g => { g.done = true; g.out = false; });
      } else {
        group.forEach(g => { g.out = true; g.node = r.node; g.route = r.route; });
        // 잡기: 도착 노드에 다른 편 말이 있으면 원위치
        let caught = false;
        for (const op of this.players) {
          if (op.seat === seat) continue;
          if (this.teamMode && op.team === pl.team) continue; // 같은 팀은 안 잡음
          for (const opc of op.pieces) {
            if (!opc.done && opc.out && opc.node === r.node) {
              opc.out = false; opc.node = 0; opc.route = 'outer';
              caught = true;
            }
          }
        }
        if (caught) { this.throwsLeft++; this.captured = { seat, node: r.node }; } // 잡으면 한 번 더
      }

      // 승리 판정
      if (pl.pieces.filter(p => p.done).length >= this.goal) { this.phase = 'over'; this.winner = pl.pid; this.winnerTeam = pl.team; this._emit(); return; }

      // 다음 단계
      if (this.throwsLeft > 0) { this.phase = 'throw'; this._emit(); this._maybeAI(); return; }
      if (this.pending.length > 0) {
        if (!this._anyMovable(seat)) { this._skipTurn(seat); return; }
        this._emit(); this._maybeAI(); return;
      }
      this._endTurn();
    }

    _skipTurn(seat) { this.skipSeq++; this.lastSkip = { seq: this.skipSeq, seat, backdo: !!(this.lastThrow && this.lastThrow.step === -1) }; this._endTurn(); }
    _endTurn() {
      this.pending = []; this.throwsLeft = 1; this.phase = 'throw';
      let n = this.turn;
      for (let k = 1; k <= this.N; k++) { const s = (this.turn + k) % this.N; n = s; break; }
      this.turn = n;
      this._emit();
      this._maybeAI();
    }

    // ---- AI ----
    _bestMove(seat) {
      const pl = this.players[seat];
      let best = null, bestScore = -Infinity;
      for (let pi = 0; pi < this.pending.length; pi++) {
        const s = this.pending[pi];
        for (const pc of pl.pieces) {
          if (pc.done) continue;
          const dirs = isBranch(pc.node, pc.route) ? ['shortcut', null] : [null];
          for (const dir of dirs) {
            const r = step(pc.node, pc.route, pc.out, s, dir);
            if (r.noMove) continue;
            let sc = 0;
            if (r.done) sc += 100;
            else {
              for (const op of this.players) {
                if (op.seat === seat) continue;
                if (this.teamMode && op.team === pl.team) continue;
                for (const opc of op.pieces) {
                  if (!opc.done && opc.out && opc.node === r.node) sc += 60;
                }
              }
              sc += (r.route === 'sc10' ? 25 : r.route === 'sc5' ? 15 : 0);
              sc += (pc.out ? 5 : 0);
            }
            if (sc > bestScore) { bestScore = sc; best = { pieceId: pc.id, pendingIndex: pi, dir }; }
          }
        }
      }
      return best;
    }
    _maybeAI() {
      this._clear();
      if (this._dead || this.phase === 'over') return;
      const p = this.players[this.turn];
      const auto = p && (p.ai || !p.connected);
      const ms = this.aiFast ? 120 : this.aiMs;
      if (this.phase === 'throw' && auto) {
        this._timer = setTimeout(() => this.doThrow(p.pid), ms);
      } else if (this.phase === 'move' && auto) {
        this._timer = setTimeout(() => {
          const mv = this._bestMove(this.turn);
          if (mv) this.doMove(p.pid, mv.pieceId, mv.pendingIndex, mv.dir);
          else this._endTurn();
        }, ms);
      } else if (this.turnMs > 0 && !auto) {
        this._timer = setTimeout(() => {
          if (this._dead) return;
          if (this.phase === 'throw') this.doThrow(p.pid);
          else if (this.phase === 'move') { const mv = this._bestMove(this.turn); if (mv) this.doMove(p.pid, mv.pieceId, mv.pendingIndex, mv.dir); else this._endTurn(); }
        }, this.turnMs);
      }
    }

    setConnected(pid, v) { const p = this.players.find(x => x.pid === pid); if (p) p.connected = v; this._maybeAI(); }
    action(pid, a) {
      if (!a) return;
      if (a.type === 'throw') this.doThrow(pid, a.power);
      else if (a.type === 'move') this.doMove(pid, a.pieceId, a.pendingIndex, a.dir, a.carry, a.ownerSeat);
    }
    serialize() {
      return {
        game: 'yut', phase: this.phase, turn: this.turn, markers: this.markers, goal: this.goal, teamMode: this.teamMode, winnerTeam: this.winnerTeam,
        pending: this.pending.slice(), throwsLeft: this.throwsLeft,
        lastThrow: this.lastThrow ? { ...this.lastThrow } : null, throwSeq: this.throwSeq,
        winner: this.winner, captured: this.captured ? { ...this.captured } : null, lastMovePath: this.lastMovePath, lastSkip: this.lastSkip,
        players: this.players.map((p, i) => ({
          pid: p.pid, name: p.name, avatar: p.avatar, ai: p.ai, connected: p.connected, seat: i, team: p.team,
          pieces: p.pieces.map(pc => ({ id: pc.id, out: pc.out, node: pc.node, route: pc.route, done: pc.done })),
          doneCount: p.pieces.filter(pc => pc.done).length
        }))
      };
    }
    destroy() { this._dead = true; this._clear(); }
  }

  return { YutEngine, throwYut, SEQ };
});
