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
    yacht_kr:{ name:'요트 다이스', desc:'국내 앱 규칙. 포카드·풀하우스는 주사위 5개 합산, 상단 63점↑ 보너스 +35. 하단 4콤보 완성 시 +50.', bonus:{th:63,pts:35}, lowBonus:{ids:['fourKind','fullHouse','sStraight','lStraight'],pts:50}, cats:[...U,
      {id:'choice',label:'초이스',sec:'low',score:d=>tot(d)},
      {id:'fourKind',label:'포 오브 어 카인드',sec:'low',score:d=>nKind(d,4)?tot(d):0},
      {id:'fullHouse',label:'풀하우스',sec:'low',score:d=>isFull(d)?tot(d):0},
      {id:'sStraight',label:'스몰 스트레이트',sec:'low',score:d=>has4(d)?15:0},
      {id:'lStraight',label:'라지 스트레이트',sec:'low',score:d=>has5(d)?30:0},
      {id:'yacht',label:'요트',sec:'low',score:d=>maxKind(d)>=5?50:0}]},
    yahtzee:{ name:'야찌', desc:'해즈브로 Yahtzee 규칙. 풀하우스 25 / 스트레이트 30·40 고정, 트리플 추가. 보너스 +35. 하단 5콤보 완성 시 +50.', bonus:{th:63,pts:35}, lowBonus:{ids:['threeKind','fourKind','fullHouse','sStraight','lStraight'],pts:50}, cats:[...U,
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
  // '5개 동일' 칸의 id는 규칙마다 다르다 — yacht_kr·yacht_og는 'yacht', yahtzee는 'yahtzee'.
  // 조커 판정이 이 칸의 점수를 보므로, 하드코딩하면 요트 다이스에서 조커가 영영 안 걸린다.
  const yachtId = rule => (rule.cats.some(c=>c.id==='yahtzee') ? 'yahtzee' : 'yacht');
  // 조커 규칙 판정 — 켜져 있고 + 5개 동일 + 요트/야찌 칸이 '이미 50점으로' 채워졌으면 그 눈(1~6), 아니면 0.
  // (그 칸이 비었거나 0점이면 조커도 추가 보너스도 발동하지 않는다 — 정통 Yahtzee와 같다)
  // ⚠️ 옛 시그니처는 (mode, scores, d)로 야찌 모드에 잠겨 있었다. 이제 rule을 받아 모드와 무관하게 돈다.
  function jokerFace(on, rule, scores, d){
    if (!on || maxKind(d)<5) return 0;
    if (scores[yachtId(rule)] !== 50) return 0;
    const c=cnt(d); for (let f=1;f<=6;f++) if (c[f]===5) return f; return 0;
  }
  // 조커를 켤 수 있는 모드 — 오리지널(1938)엔 조커 규칙이 없어서 제외한다.
  const JOKER_MODES = ['yacht_kr','yahtzee'];
  const jokerDefault = mode => mode==='yahtzee';   // 야찌는 정통 규칙상 기본 켜짐(기존 동작 보존)
  function emptyScores(rule){ const s={}; rule.cats.forEach(c=>s[c.id]=null); return s; }
  function openCats(rule,scores){ return rule.cats.filter(c=>scores[c.id]===null).map(c=>c.id); }
  function bestOpen(d,open,rule){ let b=0; for (const id of open){ const s=scoreOf(id,d,rule); if (s>b) b=s; } return b; }

  // ---------- AI ----------
  const HI=['yacht','yahtzee','lStraight','sStraight','fullHouse','fourKind'];
  const PERSONAS={ safe:{label:'안정',wHi:1.0,wUp:1.0,noise:0}, aggro:{label:'공격',wHi:1.55,wUp:1.0,noise:0.05}, bonus:{label:'보너스',wHi:1.0,wUp:1.6,noise:0}, gambler:{label:'도박',wHi:1.3,wUp:1.0,noise:0.35} };
  const PK=Object.keys(PERSONAS);
  function pw(id,per){ if(UPPER_IDS.indexOf(id)>=0)return per.wUp; if(HI.indexOf(id)>=0)return per.wHi; return 1; }
  function bestOpenW(d,open,rule,per){ let b=0; for(const id of open){ const s=scoreOf(id,d,rule)*pw(id,per); if(s>b)b=s; } return b; }
  /* ⚠️ rnd는 넘겨받는다(2026-08-07) — 몬테카를로 표본과 실수 확률에 Math.random을 쓰고 있어서
     같은 시드로도 결과가 달라졌다. 저장소 규약: "셔플·AI 랜덤은 주입 rng 사용". */
  function aiHoldMask(d, open, rule, diff, per, ctx, rnd){
    rnd = rnd || Math.random;
    per=per||PERSONAS.safe;
    if (ctx && ctx.end){                       // 종반 견제/역전 (hard·멀티 전용): 홀드 성향 보정
      per = Object.assign({}, per);
      if (ctx.gap < 0) per.wHi = per.wHi*1.5;   // 뒤짐 → 야찌·스트레이트 등 고배당 추격
      else per.wHi = Math.min(per.wHi, 1.05);   // 앞섬 → 안전(현 최선) 지향
    }
    if (diff==='easy' && rnd()<0.3) return Math.floor(rnd()*32);
    if (per.noise && rnd()<per.noise) return Math.floor(rnd()*32);
    const N = diff==='hard'?60 : diff==='easy'?16 : 32;
    let bm=0, bev=-1;
    for (let m=0;m<32;m++){
      let ev=0;
      for (let s=0;s<N;s++){ const t=d.map((v,i)=>(m>>i&1)?v:1+Math.floor(rnd()*6)); ev+=bestOpenW(t,open,rule,per); }
      ev/=N; if (ev>bev){ bev=ev; bm=m; }
    }
    return bm;
  }
  function aiHoldMask_OLD(d, open, rule, diff){
    if (diff==='easy' && rnd()<0.3) return Math.floor(rnd()*32);
    const N = diff==='hard'?60 : diff==='easy'?16 : 32;
    let bm=0, bev=-1;
    for (let m=0;m<32;m++){
      let ev=0;
      for (let s=0;s<N;s++){ const t=d.map((v,i)=>(m>>i&1)?v:1+Math.floor(rnd()*6)); ev+=bestOpen(t,open,rule); }
      ev/=N; if (ev>bev){ bev=ev; bm=m; }
    }
    return bm;
  }
  // sc — 칸 점수 계산기(기본은 눈 그대로). 조커 상태에선 엔진이 _scoreCat을 넘겨서
  // 스트레이트를 만점으로 보게 한다. 안 넘기면 AI가 조커 스트레이트를 0점으로 보고 피한다.
  function aiPickCat(d, open, rule, scores, diff, per, ctx, sc, rnd){
    rnd = rnd || Math.random;
    per=per||PERSONAS.safe;
    const S = sc || ((id,dd)=>scoreOf(id,dd,rule));
    const scored = open.map(id=>({id, s:S(id,d)}));
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
      if (ctx && ctx.end){                       // 종반 상대 격차 반영 (hard·멀티 전용)
        const ceil=CEIL[id]||0;
        if (ctx.gap < 0){ if (HI.indexOf(id)>=0 && s>0) v += ceil*0.2; }  // 뒤짐 → 잡은 고배당 확정
        else if (s===0) v -= ceil*0.4;             // 앞섬 → 아까운 칸 0점 처리 회피(안전)
      }
      v *= pw(id,per);
      if (per.noise) v += (rnd()-0.5)*per.noise*30;
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
      this.TURN_MS = (typeof opts.turnMs === 'number') ? opts.turnMs : 45000;  // 0 = 시간 제한 없음(로컬)
      this.AID = opts.aiFast ? 0.45 : (opts.pace != null ? opts.pace : 1);   // AI 템포 배수(pace: 공통 진행 속도 배수, pace.js)
      // 아이템전 — 켜면 **모든 자리(AI 포함)가 같은 개수**의 '한 번 더 굴리기'를 받는다.
      // 상점 보유량과 무관하다(돈으로 유리해지지 않게). 기본은 꺼짐.
      this.itemsOn = !!opts.itemsOn;
      // 🃏 조커 규칙 — 요트/야찌 칸을 50점으로 이미 채운 뒤 또 5개 동일이 나왔을 때:
      //   ① 그 눈의 상단 칸에 강제 배치(비어 있으면) ② 상단이 찼으면 하단 아무 칸 —
      //   이때 스트레이트는 패턴이 없어도 만점 인정 ③ 추가 야찌 +100 보너스.
      // 오리지널(1938)은 조커 규칙이 없어 켤 수 없다. 야찌는 정통 규칙이라 기본 켜짐.
      this.joker = (JOKER_MODES.indexOf(this.mode)<0) ? false
                 : (opts.joker!=null ? !!opts.joker : jokerDefault(this.mode));
      this.itemCharges = Math.max(0, Math.min(5, opts.itemCharges!=null ? opts.itemCharges|0 : 2));
      this.rng = opts.rng || Math.random;
      this.onState = opts.onState || function(){};
      this.onRoll = opts.onRoll || function(){};
      this.players = (opts.players||[]).map(p=>({ pid:p.pid, name:p.name, color:p.color, avatar:p.avatar||null, ai:!!p.ai, persona: p.ai?(PERSONAS[p.persona]?p.persona:PK[Math.floor(this.rng()*PK.length)]):null, connected:p.connected!==false, scores:emptyScores(this.rule), yBonus:0 }));
      this.phase='play'; this.current=0; this.rollsLeft=3; this.rolled=false;
      this.items=this.players.map(()=>this.itemsOn?this.itemCharges:0);   // 자리별 남은 아이템(전원 동일)
      this.dice=[0,1,2,3,4].map(()=>({value:0,held:false}));
      this.deadline=0; this._timer=null; this._busy=false; this._dead=false;
      this._aiGen=0;   // AI 대행(자동 진행) 세대 토큰 — 재접속 등으로 무효화할 때 증가
    }
    start(){ this.phase='play'; this.gameStartTime=Date.now(); this.current=0; this.players.forEach(p=>{ p.scores=emptyScores(this.rule); p.yBonus=0; }); this._beginTurn(); }
    destroy(){ this._dead=true; if(this._timer){clearTimeout(this._timer);this._timer=null;} }
    _d6(){ return 1+Math.floor(this.rng()*6); }
    _seat(pid){ return this.players.findIndex(p=>p.pid===pid); }
    _open(seat){ return openCats(this.rule, this.players[seat].scores); }
    _done(p){ return this.rule.cats.every(c=>p.scores[c.id]!==null); }
    // yahtzee 조커 배치 제한 — 조커가 아니면 열린 칸 전체를 그대로 반환.
    // 조커면: (1) 그 눈의 상단 칸이 비었으면 거기에만, (2) 상단이 찼으면 남은 하단 아무 칸,
    //         (3) 하단도 다 찼으면 남은 상단 아무 칸(0점).
    _legalCats(seat,d){
      const open=this._open(seat), f=jokerFace(this.joker,this.rule,this.players[seat].scores,d);
      if(!f) return open;
      const upperId=UPPER_IDS[f-1];
      if(open.indexOf(upperId)>=0) return [upperId];
      const lower=open.filter(id=>{ const c=this.rule.cats.find(x=>x.id===id); return c&&c.sec==='low'; });
      return lower.length?lower:open;
    }
    // 조커 상태의 스트레이트는 패턴이 없어도 조커 값(스몰 30 / 라지 40, yahtzee 모드 고정값)으로 인정.
    // 풀하우스는 5개 동일 시 isFull이 이미 참이라 자연 득점(25)되므로 별도 처리 불필요.
    _scoreCat(seat,catId,d){
      const f=jokerFace(this.joker,this.rule,this.players[seat].scores,d);
      if(f && catId==='sStraight') return scoreOf('sStraight',[1,2,3,4,5],this.rule); // 조커: 스몰 스트레이트 고정값(30)
      if(f && catId==='lStraight') return scoreOf('lStraight',[2,3,4,5,6],this.rule); // 조커: 라지 스트레이트 고정값(40)
      return scoreOf(catId,d,this.rule);
    }
    // 종반 상대 격차 컨텍스트 — hard·멀티(상대 존재)·남은 칸 ≤3 일 때만. 아니면 null(현행 유지)
    _aiCtx(seat){
      if(this.difficulty!=='hard') return null;
      const others=this.players.filter((_,i)=>i!==seat);
      if(!others.length) return null;                       // 솔로면 상대 없음 → 현행
      if(this._open(seat).length>3) return null;            // 종반 아니면 현행
      const myT=this._total(this.players[seat]);
      const bestOpp=Math.max.apply(null, others.map(p=>this._total(p)));
      return { end:true, gap: myT-bestOpp };                // gap>0 앞섬, <0 뒤짐
    }

    _beginTurn(){
      if(this._dead) return;
      this._aiGen++;                                // 이전 턴의 자동 진행은 모두 무효화
      this.rollsLeft=3; this.rolled=false;
      this.dice=[0,1,2,3,4].map(()=>({value:0,held:false}));
      const p=this.players[this.current];
      const auto = p.ai || p.connected===false;     // 끊긴 사람도 자동 진행
      this.deadline = (auto || this.TURN_MS<=0) ? 0 : now()+this.TURN_MS;   // TURN_MS 0 = 무제한
      this._busy = !!auto;
      this._emit(); this._armTimer();
      if (auto) this._scheduleAuto(700*this.AID);
    }
    // 자동 진행(AI 대행) 예약 — 세대 토큰이 바뀌면 예약된 것도 취소된다
    _scheduleAuto(ms){ const g=++this._aiGen; setTimeout(()=>{ if(this._aiGen===g) this._aiTurn(g); }, ms); }
    _armTimer(){
      if(this._timer){ clearTimeout(this._timer); this._timer=null; }
      if(this.deadline>0){ const ms=Math.max(0,this.deadline-now())+60; this._timer=setTimeout(()=>this._timeout(), ms); }
    }
    _timeout(){
      if(this._dead||this.phase!=='play') return;
      const g=++this._aiGen;
      this._busy=true;
      const seat=this.current, open=this._open(seat);
      const finish=()=>{ if(this._dead||this._aiGen!==g||this.phase!=='play')return; const legal=this._legalCats(seat,this.dice.map(d=>d.value)); const cat=aiPickCat(this.dice.map(d=>d.value),legal,this.rule,this.players[seat].scores,this.difficulty,PERSONAS[this.players[seat].persona],this._aiCtx(seat),(id,dd)=>this._scoreCat(seat,id,dd),this.rng); this._busy=false; this._commit(seat,cat); };
      if(!this.rolled){ this._doRoll(); setTimeout(finish, 900); } else finish();
    }
    action(pid,a){
      if (!a || typeof a !== 'object') return;   // 클라가 a 없이 보내도 죽지 않게(서버는 m.a를 그대로 넘긴다)
      if(this._dead||this.phase!=='play'||this._busy) return;
      const seat=this._seat(pid);
      if(seat<0||seat!==this.current) return;
      if(a.type==='roll'){ if(this.rollsLeft>0) this._doRoll(); }
      else if(a.type==='extraRoll'){
        // 아이템전 전용 '한 번 더'(4번째 굴림). 아이템전이 아니거나 내 몫을 다 썼으면 무시.
        if(!this.itemsOn) return;
        if(!this.rolled || this.rollsLeft>0) return;   // 아직 굴릴 게 남았으면 쓸 이유가 없다
        if(!(this.items[seat]>0)) return;
        this.items[seat]--;
        this.rollsLeft=1; this._doRoll();
      }
      else if(a.type==='hold'){ this._hold(a.i); }
      else if(a.type==='pick'){ this._commit(seat,a.cat); }
    }
    _doRoll(){
      if(this.rollsLeft<=0) return;
      this.rollsLeft--; this.rolled=true;
      const idx=[],vals=[];
      this.dice.forEach((d,i)=>{ if(!d.held){ const v=this._d6(); d.value=v; idx.push(i); vals.push(v); } });
      const cp=this.players[this.current];
      if(!cp.ai && cp.connected!==false && this.TURN_MS>0){ this.deadline=now()+this.TURN_MS; this._armTimer(); } // 굴릴 때마다 시간 리셋
      this.onRoll(idx,vals);
      this._emit();
    }
    // NaN/undefined는 i<0·i>4 비교를 둘 다 통과해버려 dice[NaN]에서 터진다 → 정수인지 먼저 확인
    _hold(i){ if(!this.rolled||this.rollsLeft<=0||!Number.isInteger(i)||i<0||i>=this.dice.length) return; this.dice[i].held=!this.dice[i].held; this._emit(); }
    _commit(seat,catId){
      const p=this.players[seat];
      if(!this.rolled||!p||p.scores[catId]!==null||!this.rule.cats.find(c=>c.id===catId)) return;
      const d=this.dice.map(x=>x.value);
      if(this._legalCats(seat,d).indexOf(catId)<0) return;   // 조커 배치 제한 위반은 거부
      const f=jokerFace(this.joker,this.rule,p.scores,d);
      if(f) p.yBonus=(p.yBonus||0)+100;                      // 추가 야찌 보너스 누적(+100)
      p.scores[catId]=this._scoreCat(seat,catId,d);
      if(this.players.every(pp=>this._done(pp))){ this.phase='over'; if(this._timer){clearTimeout(this._timer);this._timer=null;} this._emit(); return; }
      do { this.current=(this.current+1)%this.players.length; } while(this._done(this.players[this.current]));
      this._beginTurn();
    }
    async _aiTurn(gen){
      if(gen===undefined) gen=++this._aiGen;
      // 매 재개 지점에서 세대 토큰 확인 — 재접속 등으로 무효화됐으면 즉시 중단
      const alive=()=>!this._dead && this.phase==='play' && this._aiGen===gen;
      if(!alive()) return;
      const seat=this.current, open=this._open(seat);
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      this._doRoll(); await wait(800*this.AID);
      while(alive() && this.rollsLeft>0){
        const mask=aiHoldMask(this.dice.map(d=>d.value),open,this.rule,this.difficulty,PERSONAS[this.players[seat].persona],this._aiCtx(seat),this.rng);
        if(mask===31) break;
        this.dice.forEach((d,i)=>d.held=!!(mask>>i&1)); this._emit(); await wait(650*this.AID);
        if(!alive()) return;
        this._doRoll(); await wait(800*this.AID);
      }
      if(!alive()) return;
      // 아이템전: AI도 쓴다 — 사람만 쓰면 공정한 판이 아니다.
      // 지금 확정하면 받을 최선 점수가 시원찮을 때만 한 번 더 굴린다.
      if(this.itemsOn && this.items[seat]>0 && this._aiWantsExtra(seat, open)){
        this.items[seat]--;
        this.rollsLeft=1; this._doRoll(); await wait(800*this.AID);
        if(!alive()) return;
      }
      const legal=this._legalCats(seat,this.dice.map(d=>d.value));
      const cat=aiPickCat(this.dice.map(d=>d.value),legal,this.rule,this.players[seat].scores,this.difficulty,PERSONAS[this.players[seat].persona],this._aiCtx(seat),(id,dd)=>this._scoreCat(seat,id,dd),this.rng);
      await wait(450*this.AID);
      if(!alive()) return;
      this._busy=false; this._commit(seat,cat);
    }
    /* AI가 '한 번 더'를 쓸지 — 지금 손패로 받을 최선 점수가 남은 칸 기대치에 못 미칠 때만.
       기준을 후하게 잡으면 매 턴 써버려 아이템전이 그냥 '4굴림 게임'이 된다 →
       열린 칸 상한 평균의 0.45배(어려움 0.55)로 확실히 나쁠 때만 쓰게 했다. */
    _aiWantsExtra(seat, open){
      try{
        const d=this.dice.map(x=>x.value);
        const cur=bestOpen(d,open,this.rule);
        let ceil=0; open.forEach(id=>{ ceil+=(CEIL[id]||0); });
        const avg = open.length ? ceil/open.length : 0;
        const k = this.difficulty==='hard' ? 0.55 : this.difficulty==='easy' ? 0.35 : 0.45;
        return cur < avg*k;
      }catch(e){ return false; }
    }

    setConnected(pid,v){ const s=this._seat(pid); if(s<0) return; const p=this.players[s]; if(p.connected===v) return;
      p.connected=v;
      if(this.phase==='play' && s===this.current && !p.ai){
        if(!v){ if(!this._busy){ this._busy=true; this.deadline=0; this._armTimer(); this._scheduleAuto(500); } }
        else {  // 재접속: 진행 중/예약된 AI 대행을 무효화하고 턴을 사람에게 돌려준다
          this._aiGen++;
          this._busy=false;
          this.deadline = this.TURN_MS>0 ? now()+this.TURN_MS : 0;
          this._armTimer();
        }
      }
      this._emit(); }
    skipNow(){ if(this._dead||this.phase!=='play'||this._busy) return; this._busy=true; this.deadline=0; this._armTimer(); this._scheduleAuto(250); }

    _upper(p){ return UPPER_IDS.reduce((a,id)=>a+(p.scores[id]||0),0); }
    _bonus(p){ return this.rule.bonus.pts>0 && this._upper(p)>=this.rule.bonus.th ? this.rule.bonus.pts : 0; }
    _lowBonus(p){ const lb=this.rule.lowBonus; if(!lb||!lb.pts)return 0; return lb.ids.every(id=>(p.scores[id]||0)>0)?lb.pts:0; }
    _total(p){ const low=this.rule.cats.filter(c=>c.sec==='low').reduce((a,c)=>a+(p.scores[c.id]||0),0); return this._upper(p)+this._bonus(p)+this._lowBonus(p)+low+(p.yBonus||0); }
    _preview(){
      if(!this.rolled) return null;
      const seat=this.current, d=this.dice.map(x=>x.value), p=this.players[seat], out={};
      this.rule.cats.forEach(c=>{ if(p.scores[c.id]===null) out[c.id]=this._scoreCat(seat,c.id,d); });
      return out;
    }
    // 현재 차례 플레이어의 조커 상태(있으면 눈·허용 칸·추가보너스 여부) — UI 제한/표시용
    _jokerInfo(){
      if(!this.rolled) return null;
      const d=this.dice.map(x=>x.value), f=jokerFace(this.joker,this.rule,this.players[this.current].scores,d);
      if(!f) return null;
      return { face:f, legal:this._legalCats(this.current,d), bonus:100 };
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
        gameStartTime: this.gameStartTime||0,   // 판 고유키 — 클라가 '같은 판 결과 중복 기록'을 막는 데 쓴다
        phase:this.phase, mode:this.mode, modeName:this.rule.name,
        cats:this.rule.cats.map(c=>({id:c.id,label:c.label,sec:c.sec})),
        bonus:this.rule.bonus, lowBonus:this.rule.lowBonus||null,
        current:this.current, rollsLeft:this.rollsLeft, rolled:this.rolled, itemsOn:this.itemsOn, items:(this.items||[]).slice(),
        dice:this.dice.map(d=>({value:d.value,held:d.held})),
        deadline:this.deadline, turnMs:this.TURN_MS, preview:this._preview(), joker:this._jokerInfo(),
        jokerOn:!!this.joker,   // 규칙 켜짐 여부(표시용) — joker는 '지금 조커가 걸렸나'라 다르다
        players:this.players.map((p,seat)=>({ pid:p.pid, name:p.name, color:p.color, avatar:p.avatar, ai:p.ai, persona:p.persona, personaLabel:p.persona?PERSONAS[p.persona].label:null, connected:p.connected,
          seat, scores:p.scores, upperSum:this._upper(p), bonusGot:this._bonus(p)>0, lowBonusGot:this._lowBonus(p)>0, yBonus:p.yBonus||0, total:this._total(p) })),
        winners: this.phase==='over' ? this._winners() : null,
      };
    }
    _emit(){ if(!this._dead) this.onState(this.serialize()); }
  }

  return { RULES, GameEngine, scoreOf, openCats };
});
