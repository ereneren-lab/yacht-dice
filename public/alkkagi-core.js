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
  const BOMB_RADIUS = 20;              // 폭탄돌 폭발 반경(판 100 기준)
  const BOMB_IMPULSE = 88;             // 폭발 중심의 밀어내는 속도(가장자리로 갈수록 0)
  const MAGNET_RADIUS = 18;            // 자석돌 인력 반경
  const MAGNET_PULL = 1.4;             // 스텝당 아군에게 주는 인력(가까울수록 강)
  // 삑사리(미스샷): 파워가 이 값을 넘으면 세게 칠수록 빗나갈 확률이 오른다.
  const MISFIRE_THRESH = 0.72;         // 이 아래 파워는 절대 안 삑남 (안전 구간)
  const MISFIRE_MAX_CHANCE = 0.5;      // 파워 1.0에서의 삑사리 확률
  // 결정론 의사난수 [0,1) — Math.random 금지 규약을 지키려고 seq+플릭값을 해시(GLSL식 sin 해시).
  function _hashFrac(a, b, c) {
    const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
    return x - Math.floor(x);
  }

  // 판/돌 기본 사양 (셋업 옵션이 오면 덮어씀)
  const PRESETS = {
    mini:     { W: 80,  H: 80,  perTeam: 4, r: 3.5, friction: 0.98 },
    standard: { W: 100, H: 100, perTeam: 6, r: 3.5, friction: 0.98 },
    battle:   { W: 120, H: 120, perTeam: 8, r: 3.5, friction: 0.98 },
  };
  // 판 재질 → 마찰(스텝당 감쇠). 격차를 뚜렷이: 잔디=금방 멈춤, 얼음=쭉 미끄러짐.
  // (0.98 vs 0.988은 충돌 난무 중엔 체감이 안 돼 "다 똑같다"는 피드백 → 벌림)
  const SURFACE_FRICTION = { board: 0.98, ice: 0.992, grass: 0.96 };

  // ===== 순수 함수 유틸 =====
  function clone(state) {
    return {
      W: state.W, H: state.H, r: state.r, friction: state.friction,
      windX: state.windX || 0, windY: state.windY || 0,
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
    for (const s of st.stones) { s.falling = false; s.fallStart = -1; s._boom = false; }
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
        // 바람: 움직이는 돌에만 일정 가속(정지한 돌은 안 밀림 — 판이 어수선해지지 않게)
        if (st.windX && (s.vx * s.vx + s.vy * s.vy > 1)) { s.vx += st.windX * DT; s.vy += st.windY * DT; }
      }
      // 자석돌: 움직이는 자석이 반경 내 '아군' alive 돌을 자기 쪽으로 살짝 끌어당김(따라오게). 결정론(위치 기반).
      for (const m of st.stones) {
        if (!m.alive || m.type !== 'magnet') continue;
        if (m.vx * m.vx + m.vy * m.vy < 4) continue;   // 사실상 멈춰 있으면 인력 없음
        for (const s of st.stones) {
          if (!s.alive || s === m || s.team !== m.team) continue;
          const dx = m.x - s.x, dy = m.y - s.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 0.01 || d >= MAGNET_RADIUS) continue;
          const pull = MAGNET_PULL * (1 - d / MAGNET_RADIUS);
          s.vx += (dx / d) * pull;
          s.vy += (dy / d) * pull;
        }
      }
      // 충돌 (alive 끼리만)
      const alive = st.stones.filter(s => s.alive);
      const toExplode = [];
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          if (resolveCollision(alive[i], alive[j])) {
            events.push({ t, type: 'hit', ids: [alive[i].id, alive[j].id] });
            hitCount++;
            // 폭탄돌이 부딪히면 이번 프레임 끝에 터진다(한 번만)
            for (const s of [alive[i], alive[j]]) {
              if (s.type === 'bomb' && !s._boom) { s._boom = true; toExplode.push(s); }
            }
          }
        }
      }
      // 폭발 처리 — 반경 내 다른 돌을 바깥으로 밀치고 폭탄은 소멸(자기 팀 손실). Math.random 없이 위치 기반(결정론).
      for (const bomb of toExplode) {
        for (const s of st.stones) {
          if (!s.alive || s === bomb) continue;
          const dx = s.x - bomb.x, dy = s.y - bomb.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d >= BOMB_RADIUS) continue;
          const nx = d > 0.01 ? dx / d : ((s.id % 2) ? 1 : -1);
          const ny = d > 0.01 ? dy / d : ((s.id % 3) ? 1 : -0.7);
          const norm = Math.hypot(nx, ny) || 1;
          const push = BOMB_IMPULSE * (1 - d / BOMB_RADIUS);
          s.vx += (nx / norm) * push;
          s.vy += (ny / norm) * push;
        }
        bomb.alive = false;
        events.push({ t, type: 'boom', id: bomb.id, x: Math.round(bomb.x * 100) / 100, y: Math.round(bomb.y * 100) / 100, team: bomb.team });
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
  function initialLayout(W, H, perTeam, r, specials) {
    // 예전엔 각 팀이 판 가장자리에 '한 줄'로만 늘어서 밋밋했다(가운데는 텅, 세게 치면 빈 공간으로 자멸).
    // → 2줄 엇갈림 대형(뒷줄=가장자리, 앞줄=가운데 쪽, 앞줄이 뒷줄 틈에 위치)으로 깊이를 준다.
    // 팀 대칭 유지(team1은 y를 H-y로 미러) → AI 대칭성/공정성 보존.
    const stones = [];
    let id = 1;
    const back = Math.ceil(perTeam / 2);   // 뒷줄(가장자리) 수
    const front = perTeam - back;           // 앞줄(가운데 쪽) 수
    const yBack = 12, yFront = 24;           // team 0 기준(위). team 1은 미러.
    const rowX = (n, shift) => {             // n개를 가로로 고르게, shift로 엇갈림
      const margin = W * 0.15;
      const step = (W - margin * 2) / Math.max(1, n - 1);
      return Array.from({ length: n }, (_, i) => margin + step * i + shift);
    };
    const halfStep = (W - W * 0.3) / Math.max(1, back - 1) / 2;
    const push = (team, x, y) => stones.push({ id: id++, team, x, y, vx: 0, vy: 0, r, mass: 1, alive: true, type: 'normal' });
    // team 0 (위)
    rowX(back, 0).forEach(x => push(0, x, yBack));
    rowX(front, front < back ? halfStep : 0).forEach(x => push(0, x, yFront));
    // team 1 (아래) — 상하 미러
    rowX(back, 0).forEach(x => push(1, x, H - yBack));
    rowX(front, front < back ? halfStep : 0).forEach(x => push(1, x, H - yFront));
    // 특수 돌 — 각 팀 '앞줄 가운데' 한 개를 특수 돌로(대칭). 한 종류만(단일 선택).
    const specType = specials && specials.find(t => ['bomb', 'giant', 'magnet'].includes(t));
    if (specType) {
      for (const team of [0, 1]) {
        const row = stones.filter(s => s.team === team);
        const yMid = team === 0 ? yFront : H - yFront;
        const rowStones = row.filter(s => Math.abs(s.y - yMid) < 0.01);
        const pool = rowStones.length ? rowStones : row;
        pool.sort((a, b) => Math.abs(a.x - W / 2) - Math.abs(b.x - W / 2));
        const st = pool[0];
        if (st) {
          st.type = specType;
          if (specType === 'giant') { st.r = r * 1.4; st.mass = 2; }   // 거대돌: 크고 무겁게(밀고 나감)
        }
      }
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
      this.surface = SURFACE_FRICTION[opt.surface] != null ? opt.surface : 'board';
      this.friction = SURFACE_FRICTION[this.surface];
      this.r = preset.r;
      this.perTeam = preset.perTeam;
      this.specials = Array.isArray(opt.specials) ? opt.specials.filter(t => ['bomb', 'giant', 'magnet'].includes(t)) : [];
      this.stones = initialLayout(this.W, this.H, this.perTeam, this.r, this.specials);
      // 오늘의 규칙(선택식): doubleShot=턴당 2발, wind=일정 방향 가속. null=없음.
      this.rule = ['doubleShot', 'wind'].includes(opt.rule) ? opt.rule : null;
      this.misfire = opt.misfire !== false;   // 삑사리(미스샷): 기본 켜짐
      this.shotsThisTurn = 0;
      // 바람 벡터 — 판 시작 시 한 번 결정(시뮬 입력값이라 이후 결정론에 영향 없음).
      this.windX = 0; this.windY = 0;
      if (this.rule === 'wind') {
        // 바람은 '가로(좌↔우)'로만 분다. 팀 대결축이 세로라, 세로 성분이 있으면 한쪽에 유리(87% 편향)했다.
        // 가로 바람은 양쪽 발사를 똑같이 옆으로 밀어 공정하고, 조준을 비틀어 재미만 준다.
        const WIND_MAG = 9;
        const dir = opt.windDir != null ? opt.windDir : (Math.random() < 0.5 ? -1 : 1);
        this.windDir = dir;
        this.windX = dir * WIND_MAG;
        this.windY = 0;
      }
      // 밸런싱: 상대 돌 낙사 시 한 번 더 (기본 켜짐 · 실제 알까기 규칙)
      this.extraFlickOnKnockoff = opt.extraFlickOnKnockoff !== false;
      // 눈덩이 완화: "한 번 더"를 무한 연쇄가 아니라 턴당 최대 N번으로 제한(선공 이점·판 길이 조절).
      this.extraFlickCap = opt.extraFlickCap != null ? opt.extraFlickCap : 1;
      this.extraFlickCount = 0;
      this.phase = 'aim';               // 'aim' | 'sim' | 'over'
      this.turn = 0;                    // 0 or 1
      this.winner = null; this.winnerTeam = null;
      this.lastSim = null;              // { frames, events, final, actorSeat, flick }
      this.simSeq = 0;
      this.onState = opt.onState || function () {};
      this.aiMs = opt.aiMs != null ? opt.aiMs : 900;
      this.manualAI = !!opt.manualAI;
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

    // 좌석 → 팀. 2인이면 seat===team, 2v2(4인)면 seat 0,2=팀0 / seat 1,3=팀1.
    teamOf(seat) { return seat % 2; }
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
      if (stone.team !== this.teamOf(seat)) return null; // 자기 팀 돌만 튕김(2v2 포함)
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
      // 삑사리: 실행 직전에만 플릭을 틀어 준다. simulate()·AI 후보 채점은 깨끗한 값으로 돌아
      //   AI는 "정확히 맞았다면"을 기준으로 조준하고, 실제 발사에서 세게 치면 사람처럼 빗나간다.
      const misfire = this._applyMisfire(flick);
      flick = misfire.flick;
      const state = { W: this.W, H: this.H, r: this.r, friction: this.friction, stones: this.stones, windX: this.windX, windY: this.windY };
      const result = simulate(state, flick);
      // 최종 결과 반영
      this.stones = result.final.map((f, i) => {
        const prev = this.stones[i];
        return { ...prev, x: f.x, y: f.y, vx: 0, vy: 0, alive: f.alive, falling: false };
      });
      // 규칙: 상대 돌을 낙사시키면 한 번 더 (선공 밸런싱 · 실제 알까기 규칙과 일치)
      const actor = this.turn;
      const actorTeam = this.teamOf(actor);
      const oppOffCount = result.events.filter(e => e.type === 'off' && e.team === 1 - actorTeam).length;
      const myOffCount = result.events.filter(e => e.type === 'off' && e.team === actorTeam).length;
      // 한 번 더 — 단, 이번 턴에 이미 캡만큼 받았으면 더 안 준다(눈덩이 차단).
      const knocked = this.extraFlickOnKnockoff && oppOffCount > 0;
      const extraFlick = knocked && (this.extraFlickCount || 0) < this.extraFlickCap;
      // 더블샷: 낙사를 못 시켜도 이번 턴 2발까지는 같은 사람이 이어 던진다.
      this.shotsThisTurn = (this.shotsThisTurn || 0) + 1;
      const doubleShotContinue = this.rule === 'doubleShot' && !extraFlick && this.shotsThisTurn < 2;
      this.lastSim = {
        frames: result.frames, events: result.events, actorSeat: actor, flick,
        seq: ++this.simSeq, extraFlick, oppOffCount, myOffCount,
        doubleShot: doubleShotContinue, shotsThisTurn: this.shotsThisTurn,
        misfired: misfire.hit,
      };
      const w = this._checkWinner();   // 이기는 '팀'(0/1) 또는 -1(무) 또는 null
      if (w != null) {
        this.phase = 'over';
        this.winnerTeam = w;
        if (w >= 0) { const wp = this.players.find(p => this.teamOf(p.seat) === w); this.winner = wp ? wp.pid : null; }
      } else if (extraFlick) {
        this.extraFlickCount = (this.extraFlickCount || 0) + 1;
        this.shotsThisTurn = 0;   // 잡으면 새 턴(더블샷이면 2발 다시)
      } else if (doubleShotContinue) {
        // 턴 유지(2발째) — 카운터 그대로
      } else {
        this.turn = (actor + 1) % this.players.length;   // 다음 좌석(2v2면 0→1→2→3→0)
        this.shotsThisTurn = 0;
        this.extraFlickCount = 0;   // 턴 넘어가면 한 번 더 카운터 리셋
      }
      // 턴 유지(extraFlick 또는 더블샷 2발째)면 같은 사람이 다시 aim
      this._emit();
      this._maybeAI();
    }

    // 세게 칠수록 삑날 확률↑. 걸리면 각도가 틀어지고 힘도 일부 샌다. { flick, hit }
    _applyMisfire(flick) {
      if (this.misfire === false) return { flick, hit: false };
      const p = flick.power;
      if (p <= MISFIRE_THRESH) return { flick, hit: false };
      const over = (p - MISFIRE_THRESH) / (1 - MISFIRE_THRESH);   // 0..1 (안전구간 밖 정도)
      const chance = over * MISFIRE_MAX_CHANCE;
      const seq = (this.simSeq || 0) + 1;                          // 이 샷의 seq(아직 증가 전)
      if (_hashFrac(seq, p * 100, flick.angle) >= chance) return { flick, hit: false };
      // 삑! 각도 0.12~0.32rad 틀어지고 힘 20~40% 샘.
      const r = _hashFrac(seq * 7 + 3, flick.angle * 50, p);
      const dir = r < 0.5 ? -1 : 1;
      const dev = (0.12 + over * 0.20) * dir;
      return {
        hit: true,
        flick: { stoneId: flick.stoneId, angle: flick.angle + dev, power: p * (0.6 + r * 0.2) },
      };
    }

    _maybeAI() {
      this._clearTimer();
      if (this._dead || this.phase !== 'aim') return;
      const p = this.players[this.turn];
      if (!p) return;
      // manualAI: 엔진이 타이머로 자동 두지 않는다. 클라가 리플레이를 다 보여준 뒤 aiTurnIfNeeded()로 트리거.
      // (예전엔 900ms 뒤 자동으로 둬서 내 리플레이 도중 AI 수가 겹쳐 화면이 튀었다 = 정신없음)
      if (this.manualAI) return;
      if (p.ai || !p.connected) {
        this._timer = setTimeout(() => {
          if (this._dead || this.phase !== 'aim') return;
          const flick = this._pickAiFlick(this.turn, p.aiDiff);
          if (flick) this._runSim(flick);
        }, this.aiFast ? 130 : this.aiMs);
      }
    }

    // 클라가 리플레이 종료 후 호출 — 지금이 AI 차례면 한 수 두고 true. (manualAI 전용)
    aiTurnIfNeeded() {
      if (this._dead || this.phase !== 'aim') return false;
      const p = this.players[this.turn];
      if (!p || !(p.ai || !p.connected)) return false;
      const flick = this._pickAiFlick(this.turn, p.aiDiff);
      if (flick) { this._runSim(flick); return true; }
      return false;
    }

    // 단순 AI: 자기 돌 중 랜덤 하나를 골라 가장 가까운 상대 돌 방향으로 파워 0.6~0.9.
    // 난이도별 살짝 조정(easy=조준 흔들림 크게, hard=흔들림 작게).
    // 낡은 AI(무작위 돌 → 가까운 상대로 대충): 보통 상대로도 6:0으로 지던 수준이라 교체.
    // 새 AI는 simulate()가 순수 함수인 걸 이용해 후보 샷을 실제로 돌려보고 결과로 점수를 매긴다.
    _naiveFlick(seat) {   // easy가 가끔 섞어 쓰는 옛 방식(초보에게 이길 여지 남김)
      const mine = this._aliveOfTeam(this.teamOf(seat)), opps = this._aliveOfTeam(1 - this.teamOf(seat));
      if (!mine.length || !opps.length) return null;
      const me = mine[Math.floor(Math.random() * mine.length)];
      let best = opps[0], bestD = Infinity;
      for (const o of opps) { const d = (o.x - me.x) ** 2 + (o.y - me.y) ** 2; if (d < bestD) { bestD = d; best = o; } }
      const angle = Math.atan2(best.y - me.y, best.x - me.x) + (Math.random() - 0.5) * 0.35;
      return { stoneId: me.id, angle, power: 0.55 + Math.random() * 0.35 };
    }
    // 샷 결과 점수: 상대 낙사 +100 / 내 낙사 −140(자멸 회피) + 위치 보너스(내 돌 안전·상대 돌 가장자리로).
    _scoreShot(result, seat) {
      const myTeam = this.teamOf(seat);
      let score = 0;
      for (const e of result.events) {
        if (e.type === 'off') score += (e.team === myTeam ? -140 : 100);
        // 폭탄 소멸: 내 폭탄이 터지면 내 돌 하나를 잃는 셈(단, 그 폭발로 상대를 날렸으면 위 off 보상이 상쇄).
        else if (e.type === 'boom' && e.team === myTeam) score -= 95;
      }
      const stoneTeam = {}; for (const s of this.stones) stoneTeam[s.id] = s.team;
      const W = this.W, H = this.H;
      for (const f of result.final) {
        if (!f.alive) continue;
        const edge = Math.min(f.x, W - f.x, f.y, H - f.y);   // 가장자리까지 거리(작을수록 위험)
        const clamped = Math.min(edge, 20);
        score += (stoneTeam[f.id] === myTeam ? clamped : -clamped) * 0.35;   // 내 팀 돌 안쪽 = +, 상대 돌 가장자리 = +
      }
      return score;
    }
    _pickAiFlick(seat, diff) {
      const myTeam = this.teamOf(seat);
      const mine = this._aliveOfTeam(myTeam);
      const opps = this._aliveOfTeam(1 - myTeam);
      if (!mine.length || !opps.length) return null;
      // easy는 절반 확률로 옛 방식 → 실수 여지 남겨 초보도 이길 수 있게
      if (diff === 'easy' && Math.random() < 0.5) return this._naiveFlick(seat);

      // 난이도별 탐색 폭 — 뚜렷이 벌린다: hard=촘촘/정밀, normal=중간, easy=거칠게(+옛 방식 섞음).
      const powers = diff === 'hard' ? [0.55, 0.78, 1.0] : diff === 'easy' ? [0.8] : [0.75];
      const offsets = diff === 'hard' ? [-0.06, 0, 0.06] : [0];   // hard만 각도 미세 탐색
      const nOpp = diff === 'hard' ? 4 : diff === 'easy' ? 1 : 2;   // 겨눌 상대 후보 수
      const state = { W: this.W, H: this.H, r: this.r, friction: this.friction, stones: this.stones };

      let best = null, bestScore = -Infinity;
      for (const me of mine) {
        const near = opps.slice().sort((a, b) =>
          ((a.x - me.x) ** 2 + (a.y - me.y) ** 2) - ((b.x - me.x) ** 2 + (b.y - me.y) ** 2)).slice(0, nOpp);
        for (const o of near) {
          const base = Math.atan2(o.y - me.y, o.x - me.x);
          for (const off of offsets) {
            for (const pw of powers) {
              const flick = { stoneId: me.id, angle: base + off, power: pw };
              const score = this._scoreShot(simulate(state, flick), seat);
              // 동점이면 무작위로 갈라 매판 같은 수만 두지 않게
              if (score > bestScore || (score === bestScore && Math.random() < 0.5)) { bestScore = score; best = flick; }
            }
          }
        }
      }
      if (!best) return this._naiveFlick(seat);
      // 난이도별 조준 흔들림(easy 크게, hard 거의 없음) — 손맛/실수 재현
      const jitter = diff === 'hard' ? 0.02 : diff === 'easy' ? 0.18 : 0.12;
      return { stoneId: best.stoneId, angle: best.angle + (Math.random() - 0.5) * jitter, power: best.power };
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
        winner: this.winner, winnerTeam: (this.winnerTeam != null ? this.winnerTeam : null), teamMode: this.players.length > 2,
        W: this.W, H: this.H, r: this.r,
        friction: this.friction, surface: this.surface, specials: this.specials.slice(), rule: this.rule, shotsThisTurn: this.shotsThisTurn, windX: this.windX, windY: this.windY,
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
          misfired: !!this.lastSim.misfired,
        } : null,
        players: this.players.map((p, i) => ({
          pid: p.pid, name: p.name, avatar: p.avatar, ai: p.ai, connected: p.connected, seat: i, team: i % 2,
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
