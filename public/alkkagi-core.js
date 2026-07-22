/* 알까기 (Alkkagi) 엔진 — UMD.
   전통 알까기: 자기 돌을 손끝으로 튕겨 상대 돌을 판 밖으로 밀어내는 2인 게임.
   - 좌표: 판 (0,0) ~ (W,H). 표준 판 W=H=100, 돌 반경 3.5.
   - 물리: 60Hz 고정 timestep, 최대 180프레임(3초). 마찰 감쇠 + 원-원 탄성 충돌.
   - 낙사: 돌 중심이 판 밖으로 나가면 그 판에서 탈락.
   - 결정론: simulate()는 순수 함수. Math.random 사용 금지(오늘의 규칙은 seed PRNG로).
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlkkagiCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // ===== 상수 =====
  const DT = 1 / 60;                   // 스텝 시간
  const MAX_FRAMES = 210;              // 최대 3.5초 (낙사 애니 여유 포함)
  const STOP_EPS = 0.5;                // 모든 돌 속력이 이 이하이면 정지 간주
  const RESTITUTION = 0.9;             // 탄성 계수
  const MAX_INITIAL_SPEED = 140;       // 파워 1.0일 때 초기 속도 상한 (표준 판 100단위 왕복 여유)
  const MIN_POWER = 0.05;              // 이 아래는 무시
  const FALL_STEPS = 40;               // 낙사 후 애니 지속 스텝 (판 밖으로 미끄러지는 시간 ≈ 0.67s)
  const FALL_BEYOND = 40;              // 판 밖 이 거리 이상 나가면 즉시 gone

  // 판/돌 기본 사양 (셋업 옵션이 오면 덮어씀)
  const PRESETS = {
    mini:     { W: 80,  H: 80,  perTeam: 4, r: 3.5, friction: 0.98 },
    standard: { W: 100, H: 100, perTeam: 6, r: 3.5, friction: 0.98 },
    battle:   { W: 120, H: 120, perTeam: 8, r: 3.5, friction: 0.98 },
  };

  // ===== 순수 함수 유틸 =====
  function clone(state) {
    return {
      W: state.W, H: state.H, r: state.r, friction: state.friction,
      stones: state.stones.map(s => ({ ...s })),
    };
  }

  // 시뮬 종료 조건: 살아있는 돌 모두 정지 + 낙사 애니 중인 돌 없음
  function stopped(stones) {
    for (const s of stones) {
      if (s.alive) {
        if (s.vx * s.vx + s.vy * s.vy > STOP_EPS * STOP_EPS) return false;
      } else if (s.falling) {
        return false;   // 낙사 애니 진행 중
      }
    }
    return true;
  }

  // 두 원 간 충돌 해소(위치 분리 + 임펄스). 접근 중일 때만 속도 변경.
  function resolveCollision(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const distSq = dx * dx + dy * dy;
    const rr = a.r + b.r;
    if (distSq <= 0 || distSq >= rr * rr) return false;
    const dist = Math.sqrt(distSq);
    const nx = dx / dist, ny = dy / dist;
    // 위치 분리 — 질량 비율로 나눔
    const overlap = rr - dist;
    const totalMass = a.mass + b.mass;
    const aRatio = b.mass / totalMass;
    const bRatio = a.mass / totalMass;
    a.x -= nx * overlap * aRatio;
    a.y -= ny * overlap * aRatio;
    b.x += nx * overlap * bRatio;
    b.y += ny * overlap * bRatio;
    // 상대 속도의 법선 성분
    const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
    const rvn = rvx * nx + rvy * ny;
    if (rvn > 0) return true; // 이미 분리 중 — 위치만 보정
    // 탄성 임펄스
    const j = -(1 + RESTITUTION) * rvn / (1 / a.mass + 1 / b.mass);
    a.vx -= j / a.mass * nx;
    a.vy -= j / a.mass * ny;
    b.vx += j / b.mass * nx;
    b.vy += j / b.mass * ny;
    return true;
  }

  // 결정론적 시뮬. 입력 상태를 변경하지 않음.
  // state: { W, H, r, friction, stones:[{id,team,x,y,vx,vy,r,mass,alive}...] }
  // flick: { stoneId, angle, power }  (angle: radian, power: 0..1)
  //   angle과 power만 결과에 영향.
  // 반환: { frames, events, final, hitCount, offCount }
  //   frames: 각 프레임의 [{id,x,y,vx,vy}...] (살아있는 돌만)
  //   events: [{t,type:'off'|'hit',id,...}]
  //   final:  [{id,x,y,alive}...] (모든 돌 · alive 포함)
  function simulate(state, flick) {
    const st = clone(state);
    // 진입 시 falling 초기화(외부 상태에서 남아있을 수 있음)
    for (const s of st.stones) { s.falling = false; s.fallStart = -1; }
    const target = st.stones.find(s => s.id === flick.stoneId);
    if (!target || !target.alive) {
      return { frames: [], events: [], final: st.stones.map(s => ({ id: s.id, x: s.x, y: s.y, alive: s.alive })), hitCount: 0, offCount: 0 };
    }
    const power = Math.max(0, Math.min(1, flick.power));
    const speed = power * MAX_INITIAL_SPEED;
    target.vx = Math.cos(flick.angle) * speed;
    target.vy = Math.sin(flick.angle) * speed;

    const frames = [];
    const events = [];
    let hitCount = 0, offCount = 0;

    for (let t = 0; t < MAX_FRAMES; t++) {
      // 위치 적분 + 마찰 — alive이거나 falling인 돌 모두
      for (const s of st.stones) {
        if (!s.alive && !s.falling) continue;
        s.x += s.vx * DT;
        s.y += s.vy * DT;
        s.vx *= st.friction;
        s.vy *= st.friction;
      }
      // 충돌 (alive 끼리만)
      const alive = st.stones.filter(s => s.alive);
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          if (resolveCollision(alive[i], alive[j])) {
            events.push({ t, type: 'hit', ids: [alive[i].id, alive[j].id] });
            hitCount++;
          }
        }
      }
      // alive → falling: 판 밖으로 나가는 순간 (경계에서 판정)
      for (const s of st.stones) {
        if (!s.alive) continue;
        if (s.x < 0 || s.x > st.W || s.y < 0 || s.y > st.H) {
          s.alive = false;
          s.falling = true;
          s.fallStart = t;
          events.push({ t, type: 'off', id: s.id, team: s.team });
          offCount++;
        }
      }
      // falling → gone: 시간·거리 조건
      for (const s of st.stones) {
        if (!s.falling) continue;
        const beyond = Math.max(-s.x, s.x - st.W, -s.y, s.y - st.H);
        if (t - s.fallStart > FALL_STEPS || beyond > FALL_BEYOND) {
          s.falling = false;   // 이제 완전히 사라짐 — 다음 프레임부턴 렌더도 안 됨
        }
      }
      // 스냅샷 저장 (alive 또는 falling만) — f: 1 = 낙사 애니 중
      frames.push(st.stones.filter(s => s.alive || s.falling).map(s => ({
        id: s.id,
        x: Math.round(s.x * 100) / 100,
        y: Math.round(s.y * 100) / 100,
        vx: Math.round(s.vx * 100) / 100,
        vy: Math.round(s.vy * 100) / 100,
        f: s.falling ? 1 : 0,
      })));
      // 종료 판정 — 살아있는 돌 정지 + falling 없음
      if (stopped(st.stones)) break;
    }
    return {
      frames,
      events,
      final: st.stones.map(s => ({ id: s.id, x: s.x, y: s.y, alive: s.alive })),
      hitCount, offCount,
    };
  }

  // 시작 배치 — 각 팀 한 줄로 나열. 팀0 아래(y=15), 팀1 위(y=H-15).
  function initialLayout(W, H, perTeam, r) {
    const stones = [];
    const yBottom = 15, yTop = H - 15;
    const margin = W * 0.15;
    const step = (W - margin * 2) / Math.max(1, perTeam - 1);
    let id = 1;
    for (let i = 0; i < perTeam; i++) {
      const x = margin + step * i;
      stones.push({ id: id++, team: 0, x, y: yBottom, vx: 0, vy: 0, r, mass: 1, alive: true, type: 'normal' });
    }
    for (let i = 0; i < perTeam; i++) {
      const x = margin + step * i;
      stones.push({ id: id++, team: 1, x, y: yTop, vx: 0, vy: 0, r, mass: 1, alive: true, type: 'normal' });
    }
    return stones;
  }

  class AlkkagiEngine {
    constructor(opt) {
      opt = opt || {};
      this.players = (opt.players || []).map((p, i) => ({
        pid: p.pid, name: p.name || ('P' + (i + 1)), avatar: p.avatar || null,
        ai: !!p.ai, aiDiff: p.aiDiff || 'normal', seat: i, connected: p.connected !== false,
      }));
      // 알까기는 2인 고정 (2v2 팀전은 나중에)
      const preset = PRESETS[opt.preset] || PRESETS.standard;
      this.W = preset.W;
      this.H = preset.H;
      this.friction = preset.friction;
      this.r = preset.r;
      this.perTeam = preset.perTeam;
      this.stones = initialLayout(this.W, this.H, this.perTeam, this.r);
      // 밸런싱: 상대 돌 낙사 시 한 번 더 (기본 켜짐 · 실제 알까기 규칙)
      this.extraFlickOnKnockoff = opt.extraFlickOnKnockoff !== false;
      this.phase = 'aim';               // 'aim' | 'sim' | 'over'
      this.turn = 0;                    // 0 or 1
      this.winner = null;
      this.lastSim = null;              // { frames, events, final, actorSeat, flick }
      this.simSeq = 0;
      this.onState = opt.onState || function () {};
      this.aiMs = opt.aiMs != null ? opt.aiMs : 900;
      this.aiFast = !!opt.aiFast;
      this._timer = null;
      this._dead = false;
      this.gameStartTime = 0;
    }

    _emit() { try { this.onState(); } catch (e) { try { console.error('[alk] render error', e); } catch (_) {} } }
    _clearTimer() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }

    start() {
      if (this._dead) return;
      this.gameStartTime = Date.now();
      this._emit();
      this._maybeAI();
    }

    _aliveOfTeam(team) { return this.stones.filter(s => s.alive && s.team === team); }
    _checkWinner() {
      const a0 = this._aliveOfTeam(0).length;
      const a1 = this._aliveOfTeam(1).length;
      if (a0 === 0 && a1 === 0) return -1; // 무승부는 매우 드묾. 우선 -1로.
      if (a0 === 0) return 1;
      if (a1 === 0) return 0;
      return null;
    }

    _validateFlick(seat, flick) {
      if (!flick || typeof flick !== 'object') return null;
      const stone = this.stones.find(s => s.id === flick.stoneId);
      if (!stone || !stone.alive) return null;
      if (stone.team !== seat) return null; // 남의 돌은 못 튕김
      const power = Math.max(0, Math.min(1, +flick.power || 0));
      if (power < MIN_POWER) return null;
      const angle = +flick.angle;
      if (!isFinite(angle)) return null;
      return { stoneId: stone.id, angle, power };
    }

    action(pid, a) {
      if (!a || typeof a !== 'object') return;
      if (this._dead || this.phase !== 'aim') return;
      const seat = this.players.findIndex(p => p.pid === pid);
      if (seat < 0 || seat !== this.turn) return;
      if (a.type !== 'flick') return;
      const flick = this._validateFlick(seat, a);
      if (!flick) return;
      this._clearTimer();
      this._runSim(flick);
    }

    _runSim(flick) {
      const state = { W: this.W, H: this.H, r: this.r, friction: this.friction, stones: this.stones };
      const result = simulate(state, flick);
      // 최종 결과 반영
      this.stones = result.final.map((f, i) => {
        const prev = this.stones[i];
        return { ...prev, x: f.x, y: f.y, vx: 0, vy: 0, alive: f.alive, falling: false };
      });
      // 규칙: 상대 돌을 낙사시키면 한 번 더 (선공 밸런싱 · 실제 알까기 규칙과 일치)
      const actor = this.turn;
      const oppOffCount = result.events.filter(e => e.type === 'off' && e.team === 1 - actor).length;
      const myOffCount = result.events.filter(e => e.type === 'off' && e.team === actor).length;
      const extraFlick = this.extraFlickOnKnockoff && oppOffCount > 0;
      this.lastSim = {
        frames: result.frames, events: result.events, actorSeat: actor, flick,
        seq: ++this.simSeq, extraFlick, oppOffCount, myOffCount,
      };
      const w = this._checkWinner();
      if (w != null) {
        this.phase = 'over';
        if (w >= 0) this.winner = this.players[w].pid;
      } else if (!extraFlick) {
        this.turn = 1 - actor;
      }
      // extraFlick이면 turn 유지 → 같은 사람이 다시 aim
      this._emit();
      this._maybeAI();
    }

    _maybeAI() {
      this._clearTimer();
      if (this._dead || this.phase !== 'aim') return;
      const p = this.players[this.turn];
      if (!p) return;
      if (p.ai || !p.connected) {
        this._timer = setTimeout(() => {
          if (this._dead || this.phase !== 'aim') return;
          const flick = this._pickAiFlick(this.turn, p.aiDiff);
          if (flick) this._runSim(flick);
        }, this.aiFast ? 130 : this.aiMs);
      }
    }

    // 단순 AI: 자기 돌 중 랜덤 하나를 골라 가장 가까운 상대 돌 방향으로 파워 0.6~0.9.
    // 난이도별 살짝 조정(easy=조준 흔들림 크게, hard=흔들림 작게).
    _pickAiFlick(seat, diff) {
      const mine = this._aliveOfTeam(seat);
      const opps = this._aliveOfTeam(1 - seat);
      if (!mine.length || !opps.length) return null;
      const me = mine[Math.floor(Math.random() * mine.length)];
      // 가장 가까운 상대 찾기
      let best = opps[0], bestD = Infinity;
      for (const o of opps) {
        const d = (o.x - me.x) ** 2 + (o.y - me.y) ** 2;
        if (d < bestD) { bestD = d; best = o; }
      }
      const angle = Math.atan2(best.y - me.y, best.x - me.x);
      const jitter = diff === 'hard' ? 0.08 : diff === 'easy' ? 0.35 : 0.18;
      const aimAngle = angle + (Math.random() - 0.5) * jitter;
      const power = 0.55 + Math.random() * 0.35;
      return { stoneId: me.id, angle: aimAngle, power };
    }

    setConnected(pid, v) {
      const p = this.players.find(x => x.pid === pid);
      if (p) p.connected = v;
      this._maybeAI();
    }

    serialize(viewer) {
      return {
        gameStartTime: this.gameStartTime || 0,
        game: 'alkkagi',
        phase: this.phase,
        turn: this.turn,
        winner: this.winner,
        W: this.W, H: this.H, r: this.r,
        friction: this.friction,
        stones: this.stones.map(s => ({
          id: s.id, team: s.team, x: s.x, y: s.y,
          alive: s.alive, type: s.type, r: s.r, mass: s.mass,
        })),
        lastSim: this.lastSim ? {
          seq: this.lastSim.seq,
          actorSeat: this.lastSim.actorSeat,
          flick: this.lastSim.flick,
          frames: this.lastSim.frames,
          events: this.lastSim.events,
          extraFlick: !!this.lastSim.extraFlick,
          oppOffCount: this.lastSim.oppOffCount || 0,
          myOffCount: this.lastSim.myOffCount || 0,
        } : null,
        players: this.players.map((p, i) => ({
          pid: p.pid, name: p.name, avatar: p.avatar, ai: p.ai, connected: p.connected, seat: i,
        })),
      };
    }

    destroy() { this._dead = true; this._clearTimer(); }
  }

  return {
    AlkkagiEngine,
    simulate,           // 결정론 시뮬(외부 검증·리플레이용)
    initialLayout,      // 테스트용
    PRESETS,
    DT, MAX_FRAMES, STOP_EPS, RESTITUTION, MAX_INITIAL_SPEED, MIN_POWER,
  };
});
