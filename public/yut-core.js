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
    if (steps > 0) {   // 모서리(5·10·22)에 정확히 서면 무조건 꺾기(지름길) — 가기/꺾기 선택 없음
      if (route === 'outer' && node === 5) { seq = SEQ.sc5; i = 0; }
      else if (route === 'outer' && node === 10) { seq = SEQ.sc10; i = 0; }
      else if (route === 'sc5' && node === 22) { seq = SEQ.sc10; i = SEQ.sc10.indexOf(22); }
    }
    if (i < 0) return { noMove: true };
    const rname = (seq === SEQ.sc5) ? 'sc5' : (seq === SEQ.sc10) ? 'sc10' : 'outer';
    if (steps < 0) {
      if (i <= 0) return { noMove: true };
      const prev = seq[i - 1];
      if (prev === 0) return { done: true };   // 빽도로 출발점(0) 복귀 → 그대로 나감(완주)
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
      this.rankings = [];  // 완주 순서(개인전 순위)
      this.goal = (opt.goal && opt.goal <= nm) ? opt.goal : nm;  // 승리 목표(완주시킬 말 수)
      this.players = (opt.players || []).map((p, i) => ({
        pid: p.pid, name: p.name || ('P' + (i + 1)), avatar: p.avatar || null,
        ai: !!p.ai, aiDiff: p.aiDiff || 'normal', seat: i, team: (!!opt.teamMode ? (p.team != null ? p.team : (i % 2)) : i), catches: 0, connected: p.connected !== false,
        pieces: Array.from({ length: nm }, (_, k) => ({ id: k, out: false, node: 0, route: 'outer', done: false }))
      }));
      this.N = this.players.length;
      // 팀전: 팀당 말 한 세트 공유 — 각 팀 첫 멤버(대표)에게만 말, 나머지 팀원은 빈 세트.
      // 두 팀원이 자기 차례에 대표의 말을 함께 움직인다.
      this.teamHolder = {};
      if (this.teamMode) {
        this.players.forEach(p => { if (this.teamHolder[p.team] == null) this.teamHolder[p.team] = p.seat; });
        this.players.forEach(p => { if (p.seat !== this.teamHolder[p.team]) p.pieces = []; });
      }
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
      // 구렁텅이: 매판 랜덤으로 순수 outer 칸(지름길·합류칸 제외) 하나에 함정
      { const pitCand = [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14]; this.pitNode = pitCand[Math.floor(this.rng() * pitCand.length)]; }
      this.pitSeq = 0; this.pitFall = null;  // 구렁텅이 연출용
      this.limitMs = opt.limitMs || 0; this.gameStartTime = null; this.timedOut = false;
      this.onState = opt.onState || function () {};
      this.aiMs = opt.aiMs != null ? opt.aiMs : 900;
      this.turnMs = opt.turnMs || 0;
      this.aiFast = !!opt.aiFast;
      // 선 뽑기: 게임 시작 전 각자 한 번씩 던져 높은 끗수 순으로 순서 결정(동점자끼리 재대결). 팀전 제외.
      this.decideOrder = !!opt.decideOrder && this.N > 1 && !this.teamMode;
      this.orderStack = null; this.orderRound = {}; this.orderThrowIdx = 0;
      this.orderFinal = []; this.orderTie = false; this.orderSeq = 0; this.orderResult = null;
      this._timer = null; this._dead = false;
    }
    _emit() { try { this.onState(); } catch (e) { if(typeof console!=='undefined'&&console.error)console.error('onState/render error:', e && e.message, e && e.stack); } }
    _clear() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }

    start() { if (this._dead) return; this.pending = []; this.gameStartTime = Date.now();
      if (this.decideOrder) { this._orderStart(); }
      else { this.turn = 0; this.phase = 'throw'; this.throwsLeft = 1; }
      this._emit(); this._maybeAI(); }

    // ===== 선 뽑기(순서 결정) — 스택 기반 동점 재대결 =====
    _orderStart() {
      this.phase = 'order';
      this.orderStack = [ this.players.map((_, i) => i) ];   // 스택: 각 원소는 경쟁 중인 seat 배열(같은 값이면 재대결)
      this.orderFinal = []; this.orderRound = {}; this.orderThrowIdx = 0; this.orderTie = false; this.orderResult = null;
      this._orderCollapse();
    }
    _orderCollapse() {
      // 크기 1인 top 풀은 순위 확정 → orderFinal로. 남은 풀의 첫 던질 사람으로 세팅.
      while (this.orderStack.length && this.orderStack[this.orderStack.length - 1].length === 1) {
        this.orderFinal.push(this.orderStack.pop()[0]);
      }
      if (!this.orderStack.length) { this._orderFinish(); return; }
      this.orderRound = {}; this.orderThrowIdx = 0;
      this.turn = this.orderStack[this.orderStack.length - 1][0];
    }
    _orderThrow(pid, power) {
      if (this._dead || this.phase !== 'order' || !this.orderStack.length) return;
      const pool = this.orderStack[this.orderStack.length - 1];
      const seat = pool[this.orderThrowIdx];
      if (!this.players[seat] || this.players[seat].pid !== pid) return;
      const r = throwYut(this.rng, power);
      this.lastThrow = { name: r.name, step: r.step }; this.throwSeq++;   // 던지기 애니/연출 재사용
      this.orderRound[seat] = r.step; this.orderSeq++; this.orderTie = false;
      this.orderThrowIdx++;
      if (this.orderThrowIdx < pool.length) { this.turn = pool[this.orderThrowIdx]; this._emit(); this._maybeAI(); return; }
      // 라운드 완료 → 값별 그룹으로 분해(동점 그룹만 재대결)
      this.orderStack.pop();
      const byVal = {}; pool.forEach(s => { const v = this.orderRound[s]; (byVal[v] = byVal[v] || []).push(s); });
      const vals = Object.keys(byVal).map(Number).sort((a, b) => a - b);   // 오름차순
      vals.forEach(v => this.orderStack.push(byVal[v]));                    // 오름차순 push → 최고값이 top
      this.orderTie = (vals.length === 1);                                 // 전원 동점 → 재대결
      this._emit();               // 라운드 결과 노출(클라가 잠깐 보여줌)
      this._orderCollapse();      // 확정자 정리 + 다음 라운드 준비
      this._emit(); this._maybeAI();
    }
    _orderFinish() {
      const old = this.players;
      this.players = this.orderFinal.map(si => old[si]);   // 정해진 순서대로 재배열
      this.players.forEach((p, i) => { p.seat = i; });
      this.N = this.players.length;
      this.orderResult = this.players.map(p => p.pid);     // 발표용 순서(pid)
      this.orderStack = null; this.orderRound = {};
      this.turn = 0; this.phase = 'throw'; this.throwsLeft = 1; this.pending = [];
    }
    timeUp() {
      if (this._dead || this.phase === 'over') return;
      const prog = p => { let s = 0; for (const pc of p.pieces) { if (pc.done) s += 100; else if (pc.out) s += 1; } return s; };
      if (this.teamMode) { // 팀전: 팀별 진행도 합으로 승리팀 결정
        const teams = {}; this.players.forEach(p => { teams[p.team] = (teams[p.team] || 0) + prog(p); });
        let best = null, bs = -Infinity; for (const t in teams) { if (teams[t] > bs) { bs = teams[t]; best = +t; } }
        this.winnerTeam = best; const rep = this.players.find(p => p.team === best); this.winner = rep ? rep.pid : null;
      } else { // 개인전: 진행도 순으로 남은 순위 채움
        const rem = this.players.filter(p => !this.rankings.includes(p.pid));
        rem.sort((a, b) => prog(b) - prog(a));
        rem.forEach(p => { if (!this.rankings.includes(p.pid)) this.rankings.push(p.pid); });
        this.winner = this.rankings[0];
      }
      this.phase = 'over'; this.timedOut = true; this._emit();
    }
    // 남은 AI를 즉시 진행도 순으로 순위 확정하고 종료(개인전 "빠르게 마무리")
    finishNow() {
      if (this._dead || this.phase === 'over' || this.teamMode) return;
      this._clear();
      const prog = p => { let s = 0; for (const pc of p.pieces) { if (pc.done) s += 100; else if (pc.out) s += 1; } return s; };
      const rem = this.players.filter(p => !this.rankings.includes(p.pid));
      rem.sort((a, b) => prog(b) - prog(a));
      rem.forEach(p => { if (!this.rankings.includes(p.pid)) this.rankings.push(p.pid); });
      this.winner = this.rankings[0];
      this.phase = 'over'; this._emit();
    }

    // 던지기
    doThrow(pid, power) {
      if (this._dead) return;
      if (this.phase === 'order') { this._orderThrow(pid, power); return; }
      if (this.phase !== 'throw') return;
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

    // 말 소유자: 팀전이면 팀 대표(공유 말), 아니면 자기 자신
    _pieceOwner(seat) { return this.teamMode ? this.teamHolder[this.players[seat].team] : seat; }
    _anyMovable(seat) {
      const pl = this.players[this._pieceOwner(seat)];
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
      // 소유자: 팀전이면 팀 공유 말(대표), 아니면 자기 말
      const owner = this._pieceOwner(seat);
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
      const group = sameCell;   // 업으면 무조건 같이 이동(따로 가기 선택 없음)

      if (r.done) {
        group.forEach(g => { g.done = true; g.out = false; });
      } else {
        group.forEach(g => { g.out = true; g.node = r.node; g.route = r.route; });
        // 잡기: 도착 노드에 다른 편 말이 있으면 원위치
        let caught = false, caughtN = 0;
        for (const op of this.players) {
          if (op.seat === seat) continue;
          if (this.teamMode && op.team === pl.team) continue; // 같은 팀은 안 잡음
          for (const opc of op.pieces) {
            if (!opc.done && opc.out && opc.node === r.node) {
              opc.out = false; opc.node = 0; opc.route = 'outer';
              caught = true; caughtN++;
            }
          }
        }
        if (caught) { pl.catches += caughtN; this.throwsLeft++; this.captured = { seat, node: r.node }; } // 잡으면 한 번 더

        // 구렁텅이: 순수 outer 함정 칸에 멈추면 그 말(업은 말 포함) 처음으로
        if (r.route === 'outer' && r.node === this.pitNode) {
          group.forEach(g => { g.out = false; g.node = 0; g.route = 'outer'; });
          this.pitSeq++; this.pitFall = { seq: this.pitSeq, seat: owner, node: this.pitNode, count: group.length, pieceIds: group.map(g => g.id) };
        }
      }

      // 승리 판정
      if (pl.pieces.filter(p => p.done).length >= this.goal) {
        if (this.teamMode) { this.phase = 'over'; this.winner = pl.pid; this.winnerTeam = pl.team; this._emit(); return; }
        // 개인전: 순위 기록 후 게임 계속 (꼴찌까지 가림)
        if (!this.rankings.includes(pl.pid)) this.rankings.push(pl.pid);
        const remaining = this.players.filter(p => !this.rankings.includes(p.pid));
        if (remaining.length <= 1) { if (remaining.length === 1) this.rankings.push(remaining[0].pid); this.phase = 'over'; this.winner = this.rankings[0]; this._emit(); return; }
        this._endTurn(); return;  // 이 플레이어는 완주 → 다음 사람으로
      }

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
      for (let k = 1; k <= this.N; k++) { const s = (this.turn + k) % this.N; if (!this.rankings.includes(this.players[s].pid)) { n = s; break; } }
      this.turn = n;
      this._emit();
      this._maybeAI();
    }

    // ---- AI ----
    // 착지 노드가 상대 말의 다음 사정거리(뒤 1~5칸)에 노출되는지 (잡기는 노드 일치만 봄)
    _catchRisk(node, seat, pl) {
      for (const op of this.players) {
        if (op.seat === seat) continue;
        if (this.teamMode && op.team === pl.team) continue;
        for (const opc of op.pieces) {
          if (opc.done || !opc.out) continue;
          const odirs = isBranch(opc.node, opc.route) ? ['shortcut', null] : [null];
          for (let os = 1; os <= 5; os++) {
            for (const od of odirs) {
              const orr = step(opc.node, opc.route, opc.out, os, od);
              if (!orr.noMove && !orr.done && orr.node === node) return true;
            }
          }
        }
      }
      return false;
    }
    _bestMove(seat) {
      const me = this.players[seat];
      const pl = this.players[this._pieceOwner(seat)];   // 팀전이면 공유 말(대표) 기준으로 후보 생성
      const diff = me.aiDiff || 'normal';
      const cands = [];
      for (let pi = 0; pi < this.pending.length; pi++) {
        const s = this.pending[pi];
        for (const pc of pl.pieces) {
          if (pc.done) continue;
          const dirs = isBranch(pc.node, pc.route) ? ['shortcut', null] : [null];
          for (const dir of dirs) {
            const r = step(pc.node, pc.route, pc.out, s, dir);
            if (r.noMove) continue;
            let sc = 0;
            if (r.done) { sc += 100; if (diff === 'hard') sc -= s; } // 고수: 완주는 최소 필요 수 우선(큰 수 아껴 다른 말 전진)
            else {
              for (const op of this.players) {
                if (op.seat === seat) continue;
                if (this.teamMode && op.team === pl.team) continue;
                for (const opc of op.pieces) {
                  if (!opc.done && opc.out && opc.node === r.node) sc += (diff === 'hard' ? 85 : 60);
                }
              }
              sc += (r.route === 'sc10' ? 25 : r.route === 'sc5' ? 15 : 0);
              sc += (pc.out ? 5 : 0);
              if (diff === 'hard' && r.route === 'outer' && r.node === this.pitNode) sc -= 120; // 고수: 늪 회피
              if (diff === 'hard' && this._catchRisk(r.node, seat, pl)) sc -= 30; // 고수: 착지 칸이 상대 사정거리(뒤 1~5칸)면 감점
            }
            cands.push({ mv: { pieceId: pc.id, pendingIndex: pi, dir }, sc });
          }
        }
      }
      if (!cands.length) return null;
      if (diff === 'easy' && this.rng() < 0.45) return cands[Math.floor(this.rng() * cands.length)].mv; // 초보: 가끔 아무 말이나
      cands.sort((a, b) => b.sc - a.sc);
      return cands[0].mv;
    }
    _maybeAI() {
      this._clear();
      this.turnDeadline = 0;   // 현재 차례 사람 턴 제한시간(epoch ms). 아래 non-auto 분기에서만 설정.
      if (this._dead || this.phase === 'over') return;
      const p = this.players[this.turn];
      const auto = p && (p.ai || !p.connected);
      const ms = this.aiFast ? 130 : this.aiMs;
      if (this.phase === 'order') {   // 선 뽑기: 현재 던질 사람이 AI/끊김이면 자동, 사람이면 턴 제한
        if (auto) { this._timer = setTimeout(() => this._orderThrow(p.pid, p.aiDiff === 'hard' ? 0.6 : null), ms); }
        else if (this.turnMs > 0) { this.turnDeadline = Date.now() + this.turnMs; this._timer = setTimeout(() => { if (!this._dead && this.phase === 'order') this._orderThrow(p.pid); }, this.turnMs); }
        return;
      }
      if (this.phase === 'throw' && auto) {
        const power = (p.aiDiff === 'hard') ? 0.82 : null; // 고수: 윷 확률 up
        this._timer = setTimeout(() => this.doThrow(p.pid, power), ms);
      } else if (this.phase === 'move' && auto) {
        this._timer = setTimeout(() => {
          const mv = this._bestMove(this.turn);
          if (mv) this.doMove(p.pid, mv.pieceId, mv.pendingIndex, mv.dir);
          else this._endTurn();
        }, ms);
      } else if (this.turnMs > 0 && !auto) {
        this.turnDeadline = Date.now() + this.turnMs;   // 클라 카운트다운 표시용
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
        teamHolder: this.teamMode ? Object.assign({}, this.teamHolder) : null,   // 팀전 공유 말 소유 seat (team→seat)
        pending: this.pending.slice(), throwsLeft: this.throwsLeft,
        lastThrow: this.lastThrow ? { ...this.lastThrow } : null, throwSeq: this.throwSeq,
        winner: this.winner, rankings: this.rankings.slice(), captured: this.captured ? { ...this.captured } : null, lastMovePath: this.lastMovePath, lastSkip: this.lastSkip,
        pitNode: this.pitNode, pitFall: this.pitFall ? { ...this.pitFall } : null,
        limitMs: this.limitMs, gameStartTime: this.gameStartTime, timedOut: this.timedOut,
        turnMs: this.turnMs, turnDeadline: this.turnDeadline || 0,
        decideOrder: this.decideOrder,
        order: this.phase === 'order' ? {
          thrower: this.turn,
          pool: (this.orderStack && this.orderStack.length) ? this.orderStack[this.orderStack.length - 1].slice() : [],
          round: Object.assign({}, this.orderRound),
          final: this.orderFinal.slice(),
          tie: !!this.orderTie, seq: this.orderSeq
        } : null,
        orderResult: this.orderResult || null,
        players: this.players.map((p, i) => ({
          pid: p.pid, name: p.name, avatar: p.avatar, ai: p.ai, connected: p.connected, seat: i, team: p.team, catches: p.catches||0,
          pieces: p.pieces.map(pc => ({ id: pc.id, out: pc.out, node: pc.node, route: pc.route, done: pc.done })),
          doneCount: p.pieces.filter(pc => pc.done).length
        }))
      };
    }
    destroy() { this._dead = true; this._clear(); }
  }

  return { YutEngine, throwYut, SEQ };
});
