/* === ld-core.js — 라이어 다이스 엔진 (브라우저/Node 공용, 숨김정보) ===
 * 규칙: 1=와일드, 베팅은 face 2..6 "전체에 qty개 이상". 도전(dudo)/정확히(calza, 옵션).
 * 인터페이스:
 *   new LDEngine({players, diceCount, wild, spotOn, onState, rng, aiFast, revealMs})
 *   .start() / .action(pid,a) / .serialize(viewerPid) / .setConnected(pid,b) / .destroy()
 *   a = {type:'bid',qty,face} | {type:'dudo'} | {type:'calza'}
 *   onState() 콜백은 인자 없이 호출 → 소비자가 serialize(viewerPid)를 직접 호출 (플레이어마다 다른 화면)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LDCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- math ----
  function C(n,k){ if(k<0||k>n)return 0; let r=1; for(let i=0;i<k;i++) r=r*(n-i)/(i+1); return r; }
  function atLeast(U,t,p){ if(t<=0)return 1; if(t>U)return 0; let s=0; for(let i=t;i<=U;i++) s+=C(U,i)*Math.pow(p,i)*Math.pow(1-p,U-i); return s; }
  function exactly(U,t,p){ if(t<0||t>U)return 0; return C(U,t)*Math.pow(p,t)*Math.pow(1-p,U-t); }

  // ---- AI ----
  function legalRaises(bid, total){
    const out=[];
    for(let f=bid.face+1; f<=6; f++) out.push({qty:bid.qty, face:f});
    for(let q=bid.qty+1; q<=total; q++) for(let f=2; f<=6; f++) out.push({qty:q, face:f});
    return out;
  }
  function aiDecide(view, seat, diff, wild, spotOn){
    const p = wild ? 1/3 : 1/6;
    const total = view.totalDice;
    const my = view.players[seat].dice || [];
    const myLen = my.length;
    const unknown = total - myLen;
    const myMatch = f => my.filter(d=>d===f || (wild && d===1)).length;
    const bid = view.bid;
    if(!bid){
      let bestF=2, bestC=-1;
      for(let f=2; f<=6; f++){ const c=myMatch(f); if(c>bestC || (c===bestC&&f>bestF)){ bestC=c; bestF=f; } }
      let qty = Math.max(1, Math.round(myMatch(bestF) + unknown*p));
      if(diff==='easy') qty = Math.max(1, qty + (Math.random()<.5?0:1));
      qty = Math.min(qty, total);
      return { type:'bid', qty, face:bestF };
    }
    const myc = myMatch(bid.face);
    const pTrue = atLeast(unknown, bid.qty - myc, p);
    // 도전 임계값: 높은 난이도일수록 최적(~0.5)에 가깝게
    const chT = diff==='hard'?0.47 : diff==='normal'?0.40 : 0.25;
    if(bid.qty > total) return { type:'dudo' };
    if(pTrue < chT) return { type:'dudo' };   // 거짓일 확률 높음 → 도전
    if(spotOn){
      const pEx = exactly(unknown, bid.qty - myc, p);
      const soT = diff==='hard'?0.36 : 0.44;
      const soChance = diff==='easy'?0.05 : diff==='normal'?0.2 : 0.35;
      if(pEx > soT && Math.random() < soChance) return { type:'calza' };
    }
    // 참일 만함 → 가장 안전한 최소 레이즈 (강할수록 정확, 약할수록 무작위)
    const cands = legalRaises(bid, total);
    if(!cands.length) return { type:'dudo' };
    const window = cands.slice(0, 18);
    let best=window[0], bestPr=-1;
    for(const r of window){ const pr=atLeast(unknown, r.qty - myMatch(r.face), p); if(pr>bestPr){ bestPr=pr; best=r; } }
    let choice=best;
    const noise = diff==='easy'?0.6 : diff==='normal'?0.28 : 0.0;
    if(Math.random() < noise){ choice = window[Math.floor(Math.random()*window.length)]; }
    else if(Math.random() < (diff==='hard'?0.12:0.08)){ const i=cands.indexOf(choice); if(cands[i+1]) choice=cands[i+1]; }
    return { type:'bid', qty:choice.qty, face:choice.face };
  }

  class LDEngine {
    constructor(opts){
      opts = opts||{};
      this.rng = opts.rng || Math.random;
      this.onState = opts.onState || function(){};
      this.wild = opts.wild!==false;
      this.spotOn = opts.spotOn!==false;
      this.startDice = opts.diceCount || 5;
      this.aiFast = !!opts.aiFast;
      this.AID = this.aiFast ? 0.4 : 1;
      this.AI_MS = opts.aiMs!=null ? opts.aiMs : (this.aiFast ? 380 : 900);
      this.REVEAL_MS = opts.revealMs!=null ? opts.revealMs : 4200;
      this.turnMs = opts.turnMs!=null ? opts.turnMs : 0;   // 0 = 무제한(로컬 싱글). 온라인은 서버가 설정.
      this.players = (opts.players||[]).map((p,i)=>({
        pid:p.pid, name:p.name||('P'+(i+1)), avatar:p.avatar||null, ai:!!p.ai,
        aiDiff:p.aiDiff||'normal', connected:p.connected!==false,
        dice:[], alive:true, seat:i
      }));
      this.phase='bid'; this.turn=0; this.bid=null; this.lastResult=null;
      this._busy=false; this._dead=false; this._timer=null; this._turnTimer=null;
      this.turnDeadline=0;              // 제한시간 있는 사람 턴의 마감 시각(ms). 0 = 없음
      this.lastAuto=null; this.autoSeq=0;  // 시간 초과 자동 베팅 알림용
    }

    _d(){ return 1 + Math.floor(this.rng()*6); }
    _emit(){ if(!this._dead) this.onState(); }
    _aliveSeats(){ return this.players.filter(p=>p.alive).map(p=>p.seat); }
    _totalDice(){ return this.players.reduce((a,p)=>a+(p.alive?p.dice.length:0),0); }
    _isAuto(seat){ const p=this.players[seat]; return p.ai || p.connected===false; }

    start(){ this._dead=false; this._newRound(this.turn||0); }

    _newRound(starter){
      this._clear();
      this.players.forEach(p=>{ p.dice = p.alive ? Array.from({length:p.dice.length||this.startDice}, ()=>this._d()) : []; });
      // ensure alive players who never rolled get startDice
      this.players.forEach(p=>{ if(p.alive && p.dice.length===0) p.dice=Array.from({length:this.startDice},()=>this._d()); });
      this.bid=null; this.lastResult=null; this.phase='bid';
      this.turn = this.players[starter] && this.players[starter].alive ? starter : this._nextAlive(starter);
      this._maybeAI();   // 먼저 턴 마감시각을 잡아야 emit에 turnLeft가 실린다
      this._emit();
    }

    _nextAlive(seat){ const n=this.players.length; for(let i=1;i<=n;i++){ const s=(seat+i)%n; if(this.players[s].alive) return s; } return seat; }

    _maybeAI(){
      if(this._dead || this.phase!=='bid') return;
      this._clearTurn();
      if(this._isAuto(this.turn)){ this._busy=true; setTimeout(()=>this._aiTurn(), this.AI_MS); }
      else if(this.turnMs>0){ const seat=this.turn; this.turnDeadline=Date.now()+this.turnMs; this._turnTimer=setTimeout(()=>this._autoAct(seat), this.turnMs); }
    }

    _aiTurn(){
      if(this._dead || this.phase!=='bid') { this._busy=false; return; }
      const seat=this.turn;
      const view = this.serialize(this.players[seat].pid); // AI sees only its own dice
      const a = aiDecide(view, seat, this.players[seat].aiDiff, this.wild, this.spotOn);
      this._busy=false;
      this._apply(seat, a);
    }

    _autoAct(seat){   // 연결됐지만 시간 초과한 사람 대신 자동 결정
      if(this._dead || this.phase!=='bid' || this.turn!==seat) return;
      const view = this.serialize(this.players[seat].pid);
      const a = aiDecide(view, seat, 'normal', this.wild, this.spotOn);
      this._clearTurn();
      this.lastAuto = { seat, pid:this.players[seat].pid, seq:++this.autoSeq, act:{...a} };  // 클라가 "시간 초과 자동 베팅" 안내
      this._apply(seat, a);
    }

    action(pid, a){
      if(this._dead || this.phase!=='bid' || this._busy) return;
      const seat=this.players.findIndex(p=>p.pid===pid && p.alive);
      if(seat<0 || seat!==this.turn) return;
      if(this._isAuto(seat)) return;
      this._clearTurn();
      this._apply(seat, a);
    }

    _countFace(face){
      let n=0;
      for(const p of this.players){ if(!p.alive) continue; for(const d of p.dice){ if(d===face || (this.wild && d===1)) n++; } }
      return n;
    }

    _apply(seat, a){
      if(a.type==='bid'){
        const qty=a.qty|0, face=a.face|0;
        if(face<2||face>6||qty<1) return;
        if(this.bid){ const ok = qty>this.bid.qty || (qty===this.bid.qty && face>this.bid.face); if(!ok) return; }
        if(qty>this._totalDice()) return;
        this.bid={ qty, face, by:seat };
        this.turn=this._nextAlive(seat);
        this._maybeAI();   // 먼저 턴 마감시각을 잡아야 emit에 turnLeft가 실린다
        this._emit();
      } else if(a.type==='dudo'){
        if(!this.bid) return;
        this._resolveDudo(seat);
      } else if(a.type==='calza'){
        if(!this.bid || !this.spotOn) return;
        this._resolveCalza(seat);
      }
    }

    _loseDie(seat){ const p=this.players[seat]; if(p.dice.length>0) p.dice.pop(); if(p.dice.length===0) p.alive=false; }

    _finishRound(result){
      this.phase='reveal'; this.lastResult=result;
      // 판정 당시 주사위 박제 — _loseDie 이후(over)에도 reveal 근거가 그대로 보이게
      result.snapshot = this.players.map(p=>({ pid:p.pid, seat:p.seat, name:p.name, dice:p.dice.slice() }));
      // 주사위는 아직 그대로 — reveal에 공개되는 주사위 수가 actual과 정확히 일치
      this._emit();
      this._timer=setTimeout(()=>this._advanceRound(), this.REVEAL_MS);
    }
    // reveal 종료 → 패자 주사위 차감 후 다음 라운드(또는 게임 종료). 타이머 만료·수동 스킵 공용.
    _advanceRound(){
      if(this._dead) return;
      if(this._timer){ clearTimeout(this._timer); this._timer=null; }
      if(this.phase!=='reveal') return;   // 이미 진행됨 — 중복 스킵 방지
      const result=this.lastResult;
      this._loseDie(result.loserSeat);            // 이제 잃음 (다음 라운드에 컵 줄어듦으로 반영)
      const aliveNow=this.players.filter(p=>p.alive);
      if(aliveNow.length<=1){
        result.winner = aliveNow.length?aliveNow[0].pid:null;
        this.phase='over'; this._emit(); return;
      }
      let starter=result.loserSeat;
      if(!this.players[starter].alive) starter=this._nextAlive(starter);
      this._newRound(starter);
    }
    // 로컬 reveal 남은 시간 스킵 — 주사위는 이미 전부 공개돼 있음
    skipReveal(){ if(this.phase==='reveal') this._advanceRound(); }

    _resolveDudo(challenger){
      const actual=this._countFace(this.bid.face);
      const bidder=this.bid.by;
      const bidTrue = actual >= this.bid.qty;
      const loserSeat = bidTrue ? challenger : bidder;  // 도전 실패→도전자 / 성공→베팅한 사람
      this._finishRound({ type:'dudo', caller:challenger, bidder, bid:{...this.bid}, actual, bidTrue, loserSeat });
    }

    _resolveCalza(caller){
      const actual=this._countFace(this.bid.face);
      const exact = actual === this.bid.qty;
      // 정확하면 caller 안전 + 베팅한 사람이 1개 잃음 / 틀리면 caller가 1개 잃음
      const loserSeat = exact ? this.bid.by : caller;
      this._finishRound({ type:'calza', caller, bidder:this.bid.by, bid:{...this.bid}, actual, exact, loserSeat });
    }

    setConnected(pid, v){
      const p=this.players.find(x=>x.pid===pid); if(!p) return; p.connected=!!v;
      if(!v && p.seat===this.turn && this.phase==='bid' && !this._busy){ this._clearTurn(); this._busy=true; setTimeout(()=>this._aiTurn(), 500); }
      this._emit();
    }

    serialize(viewerPid){
      const reveal = this.phase==='reveal' || this.phase==='over';
      return {
        game:'ld', phase:this.phase, turn:this.turn, bid:this.bid?{...this.bid}:null,
        wild:this.wild, spotOn:this.spotOn, totalDice:this._totalDice(),
        lastResult:this.lastResult?{...this.lastResult}:null,
        revealMs:this.REVEAL_MS,
        turnMs:this.turnMs,
        turnLeft: (this.phase==='bid' && this.turnDeadline) ? Math.max(0, this.turnDeadline-Date.now()) : 0,
        lastAuto: this.lastAuto?{...this.lastAuto}:null,
        winner: this.phase==='over' && this.lastResult ? (this.lastResult.winner||null) : null,
        players: this.players.map(p=>({
          pid:p.pid, name:p.name, avatar:p.avatar, ai:p.ai, alive:p.alive, connected:p.connected, seat:p.seat,
          diceCount:p.dice.length,
          dice: (reveal || p.pid===viewerPid) ? p.dice.slice() : null
        }))
      };
    }

    destroy(){ this._dead=true; this._clear(); }
    _clear(){ if(this._timer){ clearTimeout(this._timer); this._timer=null; } this._clearTurn(); }
    _clearTurn(){ if(this._turnTimer){ clearTimeout(this._turnTimer); this._turnTimer=null; } this.turnDeadline=0; }
  }

  return { LDEngine, aiDecide, atLeast, exactly, legalRaises };
});
