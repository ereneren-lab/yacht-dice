/* game-core.js — 서버(Node)와 브라우저가 공유하는 요트 다이스 엔진
   UMD: Node에서는 module.exports, 브라우저에서는 window.GameCore */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GameCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- dice helpers ----------
  const cnt = d => { const c = [0,0,0,0,0,0,0]; d.forEach(v => { if (v>=1&&v<=6) c[v]++; }); return c; };
  const tot = d => d.reduce((a,b)=>a+b,0);
  const nKind = (d,n) => cnt(d).some(x=>x>=n);
  const maxKind = d => Math.max.apply(null, cnt(d));
  const isFull = d => { const c=cnt(d).filter(x=>x>0); return (c.indexOf(3)>=0&&c.indexOf(2)>=0)||cnt(d).some(x=>x===5); };
  const seqStr = d => [1,2,3,4,5,6].filter(v=>cnt(d)[v]>0).join('');
  const has4 = d => ['1234','2345','3456'].some(q=>seqStr(d).indexOf(q)>=0);
  const has5 = d => { const s=seqStr(d); return s.indexOf('12345')>=0||s.indexOf('23456')>=0; };
  const isExact = (d,a) => { const u=[1,2,3,4,5,6].filter(v=>cnt(d)[v]>0); return u.length===a.length&&u.every((v,i)=>v===a[i]); };
  const sumKind = (d,n) => { const c=cnt(d); for (let v=6;v>=1;v--) if (c[v]>=n) return v*n; return 0; };
  const up = (f,l) => ({ id:['','aces','twos','threes','fours','fives','sixes'][f], label:l, sec:'up', face:f, score:d=>cnt(d)[f]*f });
  const U = [up(1,'에이스'),up(2,'듀얼'),up(3,'트리플'),up(4,'쿼드'),up(5,'펜타'),up(6,'헥사')];

  const RULES = {
    yacht_kr:{ name:'요트 다이스', desc:'국내 앱 규칙. 포카드·풀하우스는 주사위 5개 합산, 상단 63점↑ 보너스 +35.', bonus:{th:63,pts:35}, cats:[...U,
      {id:'choice',label:'초이스',sec:'low',score:d=>tot(d)},
      {id:'fourKind',label:'포 오브 어 카인드',sec:'low',score:d=>nKind(d,4)?tot(d):0},
      {id:'fullHouse',label:'풀하우스',sec:'low',score:d=>isFull(d)?tot(d):0},
      {id:'sStraight',label:'스몰 스트레이트',sec:'low',score:d=>has4(d)?15:0},
      {id:'lStraight',label:'라지 스트레이트',sec:'low',score:d=>has5(d)?30:0},
      {id:'yacht',label:'요트',sec:'low',score:d=>maxKind(d)>=5?50:0}]},
    yahtzee:{ name:'야찌', desc:'해즈브로 Yahtzee 규칙. 풀하우스 25 / 스트레이트 30·40 고정, 트리플 추가. 보너스 +35.', bonus:{th:63,pts:35}, cats:[...U,
      {id:'threeKind',label:'쓰리 오브 어 카인드',sec:'low',score:d=>nKind(d,3)?tot(d):0},
      {id:'fourKind',label:'포 오브 어 카인드',sec:'low',score:d=>nKind(d,4)?tot(d):0},
      {id:'fullHouse',label:'풀하우스',sec:'low',score:d=>isFull(d)?25:0},
      {id:'sStraight',label:'스몰 스트레이트',sec:'low',score:d=>has4(d)?30:0},
      {id:'lStraight',label:'라지 스트레이트',sec:'low',score:d=>has5(d)?40:0},
      {id:'chance',label:'찬스',sec:'low',score:d=>tot(d)},
      {id:'yahtzee',label:'야찌',sec:'low',score:d=>maxKind(d)>=5?50:0}]},
    yacht_og:{ name:'오리지널', desc:'1938 원조 규칙. 포카드는 4개 합, 스트레이트는 1-5·2-6 정확히 30점, 보너스 없음.', bonus:{th:0,pts:0}, cats:[...U,
      {id:'fourKind',label:'포 오브 어 카인드',sec:'low',score:d=>maxKind(d)>=4?sumKind(d,4):0},
      {id:'fullHouse',label:'풀하우스',sec:'low',score:d=>isFull(d)?tot(d):0},
      {id:'sStraight',label:'리틀 스트레이트',sec:'low',score:d=>isExact(d,[1,2,3,4,5])?30:0},
      {id:'lStraight',label:'빅 스트레이트',sec:'low',score:d=>isExact(d,[2,3,4,5,6])?30:0},
      {id:'choice',label:'초이스',sec:'low',score:d=>tot(d)},
      {id:'yacht',label:'요트',sec:'low',score:d=>maxKind(d)>=5?50:0}]},
  };
  const UPPER_IDS=['aces','twos','threes','fours','fives','sixes'];
  const CEIL={yacht:50,yahtzee:50,lStraight:40,fullHouse:25,fourKind:24,sStraight:30,threeKind:18,choice:30,chance:30,
              aces:5,twos:10,threes:15,fours:20,fives:25,sixes:30};
  const DUMP=['aces','twos','yacht','yahtzee','threes','lStraight','sStraight','threeKind','fourKind','fullHouse','fours','fives','sixes','choice','chance'];

  function scoreOf(catId,d,rule){ const c=rule.cats.find(x=>x.id===catId); return c?c.score(d):0; }
  function emptyScores(rule){ const s={}; rule.cats.forEach(c=>s[c.id]=null); return s; }
  function openCats(rule,scores){ return rule.cats.filter(c=>scores[c.id]===null).map(c=>c.id); }
  function bestOpen(d,open,rule){ let b=0; for (const id of open){ const s=scoreOf(id,d,rule); if (s>b) b=s; } return b; }

  // ---------- AI ----------
  const HI=['yacht','yahtzee','lStraight','sStraight','fullHouse','fourKind'];
  const PERSONAS={ safe:{label:'안정',wHi:1.0,wUp:1.0,noise:0}, aggro:{label:'공격',wHi:1.55,wUp:1.0,noise:0.05}, bonus:{label:'보너스',wHi:1.0,wUp:1.6,noise:0}, gambler:{label:'도박',wHi:1.3,wUp:1.0,noise:0.35} };
  const PK=Object.keys(PERSONAS);
  function pw(id,per){ if(UPPER_IDS.indexOf(id)>=0)return per.wUp; if(HI.indexOf(id)>=0)return per.wHi; return 1; }
  function bestOpenW(d,open,rule,per){ let b=0; for(const id of open){ const s=scoreOf(id,d,rule)*pw(id,per); if(s>b)b=s; } return b; }
  function aiHoldMask(d, open, rule, diff, per){
    per=per||PERSONAS.safe;
    if (diff==='easy' && Math.random()<0.3) return Math.floor(Math.random()*32);
    if (per.noise && Math.random()<per.noise) return Math.floor(Math.random()*32);
    const N = diff==='hard'?60 : diff==='easy'?16 : 32;
    let bm=0, bev=-1;
    for (let m=0;m<32;m++){
      let ev=0;
      for (let s=0;s<N;s++){ const t=d.map((v,i)=>(m>>i&1)?v:1+Math.floor(Math.random()*6)); ev+=bestOpenW(t,open,rule,per); }
      ev/=N; if (ev>bev){ bev=ev; bm=m; }
    }
    return bm;
  }
  function aiHoldMask_OLD(d, open, rule, diff){
    if (diff==='easy' && Math.random()<0.3) return Math.floor(Math.random()*32);
    const N = diff==='hard'?60 : diff==='easy'?16 : 32;
    let bm=0, bev=-1;
    for (let m=0;m<32;m++){
      let ev=0;
      for (let s=0;s<N;s++){ const t=d.map((v,i)=>(m>>i&1)?v:1+Math.floor(Math.random()*6)); ev+=bestOpen(t,open,rule); }
      ev/=N; if (ev>bev){ bev=ev; bm=m; }
    }
    return bm;
  }
  function aiPickCat(d, open, rule, scores, diff, per){
    per=per||PERSONAS.safe;
    const scored = open.map(id=>({id, s:scoreOf(id,d,rule)}));
    if (diff==='easy'){ scored.sort((a,b)=>b.s-a.s); return scored[0].id; }
    const curUpper = UPPER_IDS.reduce((a,id)=>a+(scores[id]||0),0);
    function value(id,s){
      let v=s;
      if (rule.bonus.pts>0 && UPPER_IDS.indexOf(id)>=0){
        const face=UPPER_IDS.indexOf(id)+1, par=face*3;
        v += (s-par)*1.4;
        if (curUpper<rule.bonus.th && curUpper+s>=rule.bonus.th) v+=18;
      }
      if (s===0) v -= (CEIL[id]||0)*0.5;
      v *= pw(id,per);
      if (per.noise) v += (Math.random()-0.5)*per.noise*30;
      return v;
    }
    if (scored.every(o=>o.s===0)){ for (const id of DUMP) if (open.indexOf(id)>=0) return id; }
    let best=scored[0], bv=-1e9;
    scored.forEach(o=>{ const v=value(o.id,o.s); if (v>bv){ bv=v; best=o; } });
    return best.id;
  }

  // ---------- engine ----------
  const now = () => Date.now();
  class GameEngine {
    constructor(opts){
      this.rule = RULES[opts.mode] ? opts.mode : 'yacht_kr';
      this.mode = this.rule; this.rule = RULES[this.mode];
      this.difficulty = opts.difficulty || 'normal';
      this.TURN_MS = opts.turnMs || 15000;
      this.AID = opts.aiFast ? 0.45 : 1;   // AI 템포 배수
      this.rng = opts.rng || Math.random;
      this.onState = opts.onState || function(){};
      this.onRoll = opts.onRoll || function(){};
      this.players = (opts.players||[]).map(p=>({ pid:p.pid, name:p.name, color:p.color, avatar:p.avatar||null, ai:!!p.ai, persona: p.ai?(PERSONAS[p.persona]?p.persona:PK[Math.floor(Math.random()*PK.length)]):null, connected:p.connected!==false, scores:emptyScores(this.rule) }));
      this.phase='play'; this.current=0; this.rollsLeft=3; this.rolled=false;
      this.dice=[0,1,2,3,4].map(()=>({value:0,held:false}));
      this.deadline=0; this._timer=null; this._busy=false; this._dead=false;
    }
    start(){ this.phase='play'; this.current=0; this.players.forEach(p=>p.scores=emptyScores(this.rule)); this._beginTurn(); }
    destroy(){ this._dead=true; if(this._timer){clearTimeout(this._timer);this._timer=null;} }
    _d6(){ return 1+Math.floor(this.rng()*6); }
    _seat(pid){ return this.players.findIndex(p=>p.pid===pid); }
    _open(seat){ return openCats(this.rule, this.players[seat].scores); }
    _done(p){ return this.rule.cats.every(c=>p.scores[c.id]!==null); }

    _beginTurn(){
      if(this._dead) return;
      this.rollsLeft=3; this.rolled=false;
      this.dice=[0,1,2,3,4].map(()=>({value:0,held:false}));
      const p=this.players[this.current];
      const auto = p.ai || p.connected===false;     // 끊긴 사람도 자동 진행
      this.deadline = auto ? 0 : now()+this.TURN_MS;
      this._busy = !!auto;
      this._emit(); this._armTimer();
      if (auto) setTimeout(()=>this._aiTurn(), 700*this.AID);
    }
    _armTimer(){
      if(this._timer){ clearTimeout(this._timer); this._timer=null; }
      if(this.deadline>0){ const ms=Math.max(0,this.deadline-now())+60; this._timer=setTimeout(()=>this._timeout(), ms); }
    }
    _timeout(){
      if(this._dead||this.phase!=='play') return;
      this._busy=true;
      const seat=this.current, open=this._open(seat);
      const finish=()=>{ if(this._dead)return; const cat=aiPickCat(this.dice.map(d=>d.value),open,this.rule,this.players[seat].scores,this.difficulty,PERSONAS[this.players[seat].persona]); this._busy=false; this._commit(seat,cat); };
      if(!this.rolled){ this._doRoll(); setTimeout(finish, 900); } else finish();
    }
    action(pid,a){
      if(this._dead||this.phase!=='play'||this._busy) return;
      const seat=this._seat(pid);
      if(seat<0||seat!==this.current) return;
      if(a.type==='roll'){ if(this.rollsLeft>0) this._doRoll(); }
      else if(a.type==='hold'){ this._hold(a.i); }
      else if(a.type==='pick'){ this._commit(seat,a.cat); }
    }
    _doRoll(){
      if(this.rollsLeft<=0) return;
      this.rollsLeft--; this.rolled=true;
      const idx=[],vals=[];
      this.dice.forEach((d,i)=>{ if(!d.held){ const v=this._d6(); d.value=v; idx.push(i); vals.push(v); } });
      const cp=this.players[this.current];
      if(!cp.ai && cp.connected!==false){ this.deadline=now()+this.TURN_MS; this._armTimer(); } // 굴릴 때마다 15초
      this.onRoll(idx,vals);
      this._emit();
    }
    _hold(i){ if(!this.rolled||this.rollsLeft<=0||i<0||i>4) return; this.dice[i].held=!this.dice[i].held; this._emit(); }
    _commit(seat,catId){
      const p=this.players[seat];
      if(!this.rolled||!p||p.scores[catId]!==null||!this.rule.cats.find(c=>c.id===catId)) return;
      p.scores[catId]=scoreOf(catId,this.dice.map(d=>d.value),this.rule);
      if(this.players.every(pp=>this._done(pp))){ this.phase='over'; if(this._timer){clearTimeout(this._timer);this._timer=null;} this._emit(); return; }
      do { this.current=(this.current+1)%this.players.length; } while(this._done(this.players[this.current]));
      this._beginTurn();
    }
    async _aiTurn(){
      if(this._dead||this.phase!=='play') return;
      const seat=this.current, open=this._open(seat);
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      this._doRoll(); await wait(800*this.AID);
      while(this.rollsLeft>0 && !this._dead){
        const mask=aiHoldMask(this.dice.map(d=>d.value),open,this.rule,this.difficulty,PERSONAS[this.players[seat].persona]);
        if(mask===31) break;
        this.dice.forEach((d,i)=>d.held=!!(mask>>i&1)); this._emit(); await wait(650*this.AID);
        this._doRoll(); await wait(800*this.AID);
      }
      if(this._dead) return;
      const cat=aiPickCat(this.dice.map(d=>d.value),open,this.rule,this.players[seat].scores,this.difficulty,PERSONAS[this.players[seat].persona]);
      await wait(450*this.AID);
      if(this._dead||this.phase!=='play') return;
      this._busy=false; this._commit(seat,cat);
    }
    setConnected(pid,v){ const s=this._seat(pid); if(s>=0 && this.players[s].connected!==v){ this.players[s].connected=v;
      if(!v && s===this.current && this.phase==='play' && !this._busy){ this._busy=true; this.deadline=0; this._armTimer(); setTimeout(()=>this._aiTurn(),500); }
      this._emit(); } }
    skipNow(){ if(this._dead||this.phase!=='play'||this._busy) return; this._busy=true; this.deadline=0; this._armTimer(); setTimeout(()=>this._aiTurn(),250); }

    _upper(p){ return UPPER_IDS.reduce((a,id)=>a+(p.scores[id]||0),0); }
    _bonus(p){ return this.rule.bonus.pts>0 && this._upper(p)>=this.rule.bonus.th ? this.rule.bonus.pts : 0; }
    _total(p){ const low=this.rule.cats.filter(c=>c.sec==='low').reduce((a,c)=>a+(p.scores[c.id]||0),0); return this._upper(p)+this._bonus(p)+low; }
    _preview(){
      if(!this.rolled) return null;
      const d=this.dice.map(x=>x.value), p=this.players[this.current], out={};
      this.rule.cats.forEach(c=>{ if(p.scores[c.id]===null) out[c.id]=scoreOf(c.id,d,this.rule); });
      return out;
    }
    _winners(){
      const arr=this.players.map(p=>({p, t:this._total(p), u:this._upper(p), y:(p.scores.yacht||0)+(p.scores.yahtzee||0)}));
      arr.sort((a,b)=> b.t-a.t || b.u-a.u || b.y-a.y);
      const top=arr[0];
      const tied=arr.filter(x=> x.t===top.t && x.u===top.u && x.y===top.y);
      return { top:top.t, names:tied.map(x=>x.p.name), pids:tied.map(x=>x.p.pid) };
    }
    serialize(){
      return {
        phase:this.phase, mode:this.mode, modeName:this.rule.name,
        cats:this.rule.cats.map(c=>({id:c.id,label:c.label,sec:c.sec})),
        bonus:this.rule.bonus,
        current:this.current, rollsLeft:this.rollsLeft, rolled:this.rolled,
        dice:this.dice.map(d=>({value:d.value,held:d.held})),
        deadline:this.deadline, preview:this._preview(),
        players:this.players.map((p,seat)=>({ pid:p.pid, name:p.name, color:p.color, avatar:p.avatar, ai:p.ai, persona:p.persona, personaLabel:p.persona?PERSONAS[p.persona].label:null, connected:p.connected,
          seat, scores:p.scores, upperSum:this._upper(p), bonusGot:this._bonus(p)>0, total:this._total(p) })),
        winners: this.phase==='over' ? this._winners() : null,
      };
    }
    _emit(){ if(!this._dead) this.onState(this.serialize()); }
  }

  return { RULES, GameEngine, scoreOf, openCats };
});
