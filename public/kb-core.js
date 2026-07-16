/* === kb-core.js — 너클본즈 엔진 (브라우저/Node 공용, 서버 권위형) ===
 * 인터페이스는 요트 GameEngine과 동일한 패턴:
 *   new KBEngine({players, onState, onRoll, turnMs, rng})
 *   .start() / .action(pid,a) / .setConnected(pid,b) / .skipNow() / .serialize() / .destroy()
 *   a = {type:'roll'} | {type:'place', col}
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KBCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const now = () => Date.now();

  // ---- pure scoring ----
  function colScore(col){ const c={}; for(const v of col) c[v]=(c[v]||0)+1; let s=0; for(const v in c){ s+=(+v)*c[v]*c[v]; } return s; }
  function boardScore(b){ return b.reduce((a,col)=>a+colScore(col),0); }
  function isFull(b){ return b.every(col=>col.length>=3); }

  // ---- AI ----
  function aiChooseCol(boards, p, val, diff){
    const opp=1-p, legal=[0,1,2].filter(c=>boards[p][c].length<3);
    if(!legal.length) return 0;
    if(diff==='easy' && Math.random()<0.62) return legal[(Math.random()*legal.length)|0];
    let best=[], bs=-1e9;
    for(const c of legal){
      const gain = colScore(boards[p][c].concat(val)) - colScore(boards[p][c]);
      const destroy = colScore(boards[opp][c]) - colScore(boards[opp][c].filter(x=>x!==val));
      let s;
      if(diff==='hard'){
        s = gain + destroy*1.2 + (boards[p][c].includes(val)?2:0);
        // 1-ply 응수: 이 자리에 두면 상대가 다음 턴에 내 열을 파괴할 수 있는 최선 이득만큼 감점
        const myNext = boards[p].map((col,i)=> i===c ? col.concat(val) : col);
        let risk=0;
        for(let d=1; d<=6; d++){
          let bestDes=0;
          for(let oc=0; oc<3; oc++){
            if(boards[opp][oc].length>=3) continue; // 상대 열이 가득이면 둘 수 없음
            const des = colScore(myNext[oc]) - colScore(myNext[oc].filter(x=>x!==d));
            if(des>bestDes) bestDes=des;
          }
          risk += bestDes; // 주사위 값은 무작위 → 6면 기대값
        }
        s -= (risk/6)*1.1;
      }
      else s = gain + destroy + (Math.random()*6-3);
      if(s>bs){ bs=s; best=[c]; } else if(s===bs) best.push(c);
    }
    return best[(Math.random()*best.length)|0];
  }

  class KBEngine {
    constructor(opts){
      opts = opts || {};
      this.rng = opts.rng || Math.random;
      this.onState = opts.onState || function(){};
      this.onRoll = opts.onRoll || function(){};
      this.TURN_MS = opts.turnMs || 45000;
      this.aiFast = !!opts.aiFast;
      this.AID = this.aiFast ? 0.45 : 1;
      // exactly 2 seats
      const ps = (opts.players||[]).slice(0,2);
      while(ps.length<2) ps.push({ pid:'p'+ps.length, name:'P'+(ps.length+1), ai:true });
      this.players = ps.map((p,seat)=>({
        pid:p.pid, name:p.name, avatar:p.avatar||null, ai:!!p.ai,
        aiDiff: p.aiDiff || 'normal', connected: p.connected!==false, seat
      }));
      this.boards = [[[],[],[]],[[],[],[]]];
      this.turn = 0; this.die = null; this.phase='roll';
      this.deadline = 0; this._timer=null; this._busy=false; this._dead=false;
    }

    _die(){ return 1 + Math.floor(this.rng()*6); }
    _emit(){ if(!this._dead) this.onState(this.serialize()); }
    _isAuto(seat){ const p=this.players[seat]; return p.ai || p.connected===false; }

    start(){ this._dead=false; this.turn=0; this.phase='roll'; this.die=null; this._beginTurn(); }

    _beginTurn(){
      this._clearTimer();
      this.phase='roll'; this.die=null;
      const auto = this._isAuto(this.turn);
      this.deadline = auto ? 0 : now()+this.TURN_MS;
      this._emit();
      if(auto){ this._busy=true; setTimeout(()=>this._aiTurn(), 650*this.AID); }
      else this._armTimer();
    }

    _armTimer(){ this._clearTimer(); if(this.deadline>0){ const ms=Math.max(0,this.deadline-now())+60; this._timer=setTimeout(()=>this._timeout(), ms); } }
    _clearTimer(){ if(this._timer){ clearTimeout(this._timer); this._timer=null; } }

    _timeout(){
      if(this._dead || this.phase==='over') return;
      // AFK: auto-roll(if needed) then auto-place
      const seat=this.turn;
      if(this.phase==='roll'){ this.die=this._die(); this.onRoll(seat,this.die); this.phase='place'; }
      const col=aiChooseCol(this.boards, seat, this.die, 'normal');
      this._doPlace(seat, col);
    }

    action(pid, a){
      if(this._dead || this.phase==='over' || this._busy) return;
      const seat=this.players.findIndex(p=>p.pid===pid);
      if(seat<0 || seat!==this.turn) return;
      if(this._isAuto(seat)) return; // auto seats handled internally
      if(a.type==='roll'){
        if(this.phase!=='roll') return;
        this.die=this._die(); this.onRoll(seat,this.die); this.phase='place';
        // refresh deadline for the place step
        this.deadline = now()+this.TURN_MS; this._armTimer(); this._emit();
      } else if(a.type==='place'){
        if(this.phase!=='place') return;
        const col=a.col|0; if(col<0||col>2||this.boards[seat][col].length>=3) return;
        this._doPlace(seat, col);
      }
    }

    _doPlace(seat, col){
      this._clearTimer();
      const opp=1-seat, val=this.die;
      this.boards[seat][col].push(val);
      const destroyed = this.boards[opp][col].filter(x=>x===val);
      this.boards[opp][col] = this.boards[opp][col].filter(x=>x!==val);
      this.die=null;
      // emit a placement event via onRoll? keep simple: state carries lastMove
      this._moveSeq=(this._moveSeq||0)+1;
      this._lastMove = { seq:this._moveSeq, seat, col, val, destroyed: destroyed.length };
      if(isFull(this.boards[0]) || isFull(this.boards[1])){
        this.phase='over'; this._busy=false; this._emit(); return;
      }
      this.turn = opp; this._busy=false; this._beginTurn();
    }

    async _aiTurn(){
      if(this._dead) return;
      const seat=this.turn;
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      if(this.phase==='roll' || this.die==null){
        this.die=this._die(); this.onRoll(seat,this.die); this.phase='place'; this._emit();
        await wait(620*this.AID);
        if(this._dead || this.turn!==seat) return;
      }
      const diff = this.players[seat].ai ? this.players[seat].aiDiff : 'normal';
      const col = aiChooseCol(this.boards, seat, this.die, diff);
      this._doPlace(seat, col);
    }

    setConnected(pid, v){
      const p=this.players.find(x=>x.pid===pid); if(!p) return;
      p.connected=!!v;
      if(!v && p.seat===this.turn && this.phase!=='over' && !this._busy){
        // AFK auto-takeover
        this._busy=true; this.deadline=0; this._clearTimer(); setTimeout(()=>this._aiTurn(), 400);
      }
      this._emit();
    }

    skipNow(){ if(this._dead||this.phase==='over'||this._busy) return; this._busy=true; this._clearTimer(); this.deadline=0; setTimeout(()=>this._aiTurn(), 250); }

    _winner(){
      const a=boardScore(this.boards[0]), b=boardScore(this.boards[1]);
      if(a===b) return { tie:true, pids:[this.players[0].pid,this.players[1].pid] };
      const w = a>b?0:1;
      return { tie:false, pid:this.players[w].pid, seat:w };
    }

    serialize(){
      const totals=[boardScore(this.boards[0]), boardScore(this.boards[1])];
      return {
        game:'kb',
        phase:this.phase, turn:this.turn, die:this.die,
        deadline:this.deadline, turnMs:this.TURN_MS,
        boards:this.boards.map(b=>b.map(col=>col.slice())),
        colScores:this.boards.map(b=>b.map(col=>colScore(col))),
        lastMove:this._lastMove||null,
        players:this.players.map(p=>({ pid:p.pid, name:p.name, avatar:p.avatar, ai:p.ai, connected:p.connected, seat:p.seat, total:totals[p.seat] })),
        winner: this.phase==='over' ? this._winner() : null
      };
    }

    destroy(){ this._dead=true; this._clearTimer(); }
  }

  return { KBEngine, colScore, boardScore, isFull, aiChooseCol };
});
