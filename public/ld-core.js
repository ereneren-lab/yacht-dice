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
  /* 입찰자가 무작위보다 더 갖고 있는 그 눈의 개수(실측 ~0.8). 아래 pTrue 주석 참고. */
  const BIDDER_EXCESS = 0.8;
  /* 문턱이 소수일 때 — atLeast는 정수만 받으므로 앞뒤를 보간한다. */
  function atLeastFrac(U,t,p){ const lo=Math.floor(t), f=t-lo; return atLeast(U,lo,p)*(1-f) + atLeast(U,lo+1,p)*f; }

  // ---- AI ----
  function legalRaises(bid, total){
    const out=[];
    for(let f=bid.face+1; f<=6; f++) out.push({qty:bid.qty, face:f});
    for(let q=bid.qty+1; q<=total; q++) for(let f=2; f<=6; f++) out.push({qty:q, face:f});
    return out;
  }
  /* ⚠️ rnd는 **반드시 넘겨받는다**(2026-08-07). 여기 있던 `Math.random()` 7곳 때문에
     같은 시드로 돌려도 AI가 매번 다른 수를 둬서, 난이도를 잴 때마다 답이 흔들렸다
     (보통 대 보통이 33.3%여야 하는데 30.7%~37.7% 사이를 오갔다).
     저장소 규약이기도 하다 — "셔플·AI 랜덤은 주입 rng 사용". */
  function aiDecide(view, seat, diff, wild, spotOn, rnd){
    rnd = rnd || Math.random;
    const p = wild ? 1/3 : 1/6;
    const total = view.totalDice;
    const my = view.players[seat].dice || [];
    /* 아이템전 '훔쳐보기'로 알아낸 상대 주사위도 '아는 눈'에 넣는다.
       이렇게 하면 아래 확률 계산(unknown/myMatch)이 그대로 쓰이면서 판단이 정확해진다
       → AI 전용 분기를 따로 만들 필요가 없다. 사람도 같은 정보를 화면에서 본다. */
    const known = my.concat(view.peeked || []);
    const unknown = Math.max(0, total - known.length);
    const myMatch = f => known.filter(d=>d===f || (wild && d===1)).length;
    const bid = view.bid;
    if(!bid){
      let bestF=2, bestC=-1;
      for(let f=2; f<=6; f++){ const c=myMatch(f); if(c>bestC || (c===bestC&&f>bestF)){ bestC=c; bestF=f; } }
      let qty = Math.max(1, Math.round(myMatch(bestF) + unknown*p));
      if(diff==='easy') qty = Math.max(1, qty + (rnd()<.5?0:1));
      /* 🔴 2026-08-07 — 예전엔 hard가 25% 확률로 **손패와 무관한 눈**을 부르고 수량까지 올렸다.
         읽히지 않게 하려던 것인데, 확률로 판단하는 상대에겐 그냥 도전당해 주사위를 잃는 짓이다
         (실측: 어려움 승률 21.3% — 보통 37.7%보다 한참 낮았다).
         이제 **가진 눈으로 한 단계만**, 그것도 8%만. 0%가 아주 조금 더 세지만(라운드당 손실 31.9 vs 32.2%)
         전혀 안 지르는 상대는 사람에게 읽힌다 — 그 0.3%p로 예측 불가를 산다. */
      if(diff==='hard' && rnd()<0.08) qty = qty + 1;
      qty = Math.min(qty, total);
      return { type:'bid', qty, face:bestF };
    }
    /* 🔴 2026-08-20 — **자가 틀렸다.** atLeast는 모르는 주사위를 전부 무작위(p)로 본다.
       그런데 **상대가 그 수량을 불렀다는 것 자체가 신호**다 — 그 눈을 갖고 있을 확률이 높다.
       실측(npm run sim:ldcalib · 입찰 4,532건): 예측 34.3% vs 실제 56.8% — **22.5%p 낮게 봤다.**
       전 구간에서 같은 방향이라 소음이 아니다. 그래서 AI가 과도하게 도전했고,
       도전 문턱이 더 높은 '어려움'이 그 손해를 더 크게 먹었다("어려움 ≤ 보통"의 정체).

       얼마나 더 갖고 있나도 쟀다(입찰 4,077건):
         와일드   주사위당 0.597 (무작위 0.333) → 초과 +0.81개
         일반     주사위당 0.429 (무작위 0.167) → 초과 +0.78개
       **초과분이 모드와 무관하게 ~0.8개**라 상수 하나로 보정한다(비율이 아니라 개수로 잡는 이유). */
    const myc = myMatch(bid.face);
    const pTrue = atLeastFrac(unknown, bid.qty - myc - BIDDER_EXCESS, p);
    /* 도전 임계값: 높은 난이도일수록 최적(~0.5)에 가깝게.
       ⚠️ 2026-08-07에 0.38~0.52를 쓸어 봤다. 라운드당 주사위 손실률(시드 3벌·각 2500라운드)은
          0.42가 조금 낫고(32.8% vs 0.47의 33.7%) **승률로 재면 반대로 나왔다.**
          자마다 답이 달라 증명이 안 됐으므로 **그대로 둔다.** 다시 건드리려면 두 자를 같이 볼 것. */
    const chT = diff==='hard'?0.47 : diff==='normal'?0.40 : 0.25;
    if(bid.qty > total) return { type:'dudo' };
    if(pTrue < chT) return { type:'dudo' };   // 거짓일 확률 높음 → 도전
    if(spotOn){
      const pEx = exactly(unknown, bid.qty - myc, p);
      /* 스팟온(칼자)은 **정확히 맞아야만** 이득이고 틀리면 내 주사위가 준다.
         예전 hard는 문턱이 낮고(0.36) 자주 시도해서(35%) 실측 79%가 빗나갔다 — 보통은 50%였다.
         고수라면 확실할 때만 부른다: 문턱은 제일 높이고(0.50) 빈도는 10%로. */
      const soT = diff==='hard'?0.50 : 0.44;
      const soChance = diff==='easy'?0.05 : diff==='normal'?0.2 : 0.10;
      if(pEx > soT && rnd() < soChance) return { type:'calza' };
    }
    // 참일 만함 → 가장 안전한 최소 레이즈 (강할수록 정확, 약할수록 무작위)
    const cands = legalRaises(bid, total);
    if(!cands.length) return { type:'dudo' };
    const window = cands.slice(0, 18);
    let best=window[0], bestPr=-1;
    for(const r of window){ const pr=atLeast(unknown, r.qty - myMatch(r.face), p); if(pr>bestPr){ bestPr=pr; best=r; } }
    let choice=best;
    /* ⚠️ '확률 최대' 대신 **0.5를 넘는 최소 레이즈**로 판을 낮게 유지하는 수를 시험해 봤다가 뺐다
       (2026-08-07). 다음 사람에게 어려운 자리를 넘긴다는 발상이었는데, 라운드당 주사위 손실이
       시드 3벌에서 32.3% → 33.5%로 **오히려 늘었다.** 확률 최대가 낫다. */
    const noise = diff==='easy'?0.6 : diff==='normal'?0.28 : 0.0;
    if(rnd() < noise){ choice = window[Math.floor(rnd()*window.length)]; }
    // 볼더 레이즈도 25% → 6%. 위 블러프와 같은 이유다(과감함은 이 게임에서 값을 못 한다).
    else if(diff==='hard' && rnd()<0.06){ // 블러프: 확률 대비 한 단계 과감한 레이즈 (같은 눈 수량+1, 없으면 다음 후보 — 모두 legalRaises라 합법)
      const bolder=cands.find(r=>r.qty===choice.qty+1 && r.face===choice.face);
      if(bolder) choice=bolder; else { const i=cands.indexOf(choice); if(cands[i+1]) choice=cands[i+1]; } }
    else if(rnd() < (diff==='hard'?0.12:0.08)){ const i=cands.indexOf(choice); if(cands[i+1]) choice=cands[i+1]; }
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
      /* 아이템전 — 켜면 **모든 자리(AI 포함)가 같은 개수**의 '훔쳐보기'를 받는다.
         상점에서 산 개수와 무관하다(돈으로 유리해지지 않게). 기본은 꺼짐.
         효과: 상대 주사위 1개를 나에게만 공개. 공개는 그 라운드 동안 유지되고 새 라운드에 지워진다. */
      this.itemsOn = !!opts.itemsOn;
      this.itemCharges = Math.max(0, Math.min(5, opts.itemCharges!=null ? opts.itemCharges|0 : 2));
      this.items = this.players.map(()=>this.itemsOn?this.itemCharges:0);
      this.peeks = {};        // 보는 사람 seat → [{t:상대seat, i:주사위번호}]
      this.peekSeq = 0; this.lastPeek = null;   // 연출용
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

    start(){ this._dead=false; this.gameStartTime=Date.now(); this._newRound(this.turn||0); }

    _newRound(starter){
      this._clear();
      this.players.forEach(p=>{ p.dice = p.alive ? Array.from({length:p.dice.length||this.startDice}, ()=>this._d()) : []; });
      // ensure alive players who never rolled get startDice
      this.players.forEach(p=>{ if(p.alive && p.dice.length===0) p.dice=Array.from({length:this.startDice},()=>this._d()); });
      this.bid=null; this.lastResult=null; this.phase='bid';
      this.peeks = {};   // 주사위를 새로 굴렸으니 지난 라운드의 훔쳐본 정보는 무효
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
      /* 아이템전에서는 AI도 쓴다 — 사람만 쓰면 그건 공정한 판이 아니다.
         정보가 가장 값어치 있는 순간은 '도전할지 말지' 고민할 때(=이미 베팅이 올라와 있을 때)라
         그때 라운드당 한 번만 쓴다. 아껴 죽지도, 첫 턴에 털리지도 않는다. */
      if(this.itemsOn && this.items[seat]>0 && this.bid && !(this.peeks[seat]||[]).length){
        this._doPeek(seat);
      }
      const view = this.serialize(this.players[seat].pid); // 자기 주사위 + 훔쳐본 것만 보인다
      const a = aiDecide(view, seat, this.players[seat].aiDiff, this.wild, this.spotOn, this.rng);
      this._busy=false;
      this._apply(seat, a);
    }

    _autoAct(seat){   // 연결됐지만 시간 초과한 사람 대신 자동 결정
      if(this._dead || this.phase!=='bid' || this.turn!==seat) return;
      const view = this.serialize(this.players[seat].pid);
      const a = aiDecide(view, seat, 'normal', this.wild, this.spotOn, this.rng);
      this._clearTurn();
      this.lastAuto = { seat, pid:this.players[seat].pid, seq:++this.autoSeq, act:{...a} };  // 클라가 "시간 초과 자동 베팅" 안내
      this._apply(seat, a);
    }

    action(pid, a){
      if (!a || typeof a !== 'object') return;   // 클라가 a 없이 보내도 죽지 않게(서버는 m.a를 그대로 넘긴다)
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
      } else if(a.type==='peek'){
        this._doPeek(seat, a.target);
      }
    }

    /* 아이템전 '훔쳐보기' — 상대 주사위 1개를 **나에게만** 공개한다.
       판이 아이템전이 아니거나 내 몫을 다 썼으면 무시한다(개수는 전원 동일하게 지급). */
    _doPeek(seat, target){
      if(!this.itemsOn) return;
      if(this.phase!=='bid') return;
      if(!(this.items[seat]>0)) return;
      const mine = this.peeks[seat] || (this.peeks[seat]=[]);
      // 표적: 지정이 없으면 주사위가 가장 많이 남은 상대(정보 가치가 가장 큼)
      let t = (target!=null) ? (target|0) : -1;
      const okTarget = s => s>=0 && s<this.players.length && s!==seat && this.players[s].alive && this.players[s].dice.length>0;
      if(!okTarget(t)){
        t = -1; let bestN = 0;
        for(const p of this.players){
          if(p.seat===seat || !p.alive) continue;
          const left = p.dice.length - mine.filter(x=>x.t===p.seat).length;   // 아직 안 본 것만 셈
          if(left>0 && p.dice.length>bestN){ bestN=p.dice.length; t=p.seat; }
        }
      }
      if(t<0) return;                                   // 볼 게 없으면 아이템을 쓰지 않는다(낭비 방지)
      const seen = mine.filter(x=>x.t===t).map(x=>x.i);
      const cand = this.players[t].dice.map((_,i)=>i).filter(i=>seen.indexOf(i)<0);
      if(!cand.length) return;
      const i = cand[Math.floor(this.rng()*cand.length)];
      this.items[seat]--;
      mine.push({ t, i });
      this.peekSeq++;
      this.lastPeek = { seq:this.peekSeq, by:seat, target:t, value:this.players[t].dice[i] };
      this._emit();
    }

    /* 이 사람이 훔쳐본 상대 주사위 눈 목록 — serialize와 AI가 함께 쓴다.
       주사위를 잃어 배열이 짧아졌을 수 있으니 인덱스 유효성을 매번 확인한다. */
    _peekedValues(seat){
      const mine = this.peeks[seat] || [];
      const out = [];
      for(const x of mine){
        const p = this.players[x.t];
        if(p && p.alive && x.i < p.dice.length) out.push(p.dice[x.i]);
      }
      return out;
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
      const vSeat = this.players.findIndex(p=>p.pid===viewerPid);
      // 훔쳐본 정보는 **보는 사람 것만** 실어 보낸다 — 남의 정보가 스냅샷에 섞이면 그게 곧 정보 누출이다
      const myPeeks = vSeat>=0 ? (this.peeks[vSeat]||[]).map(x=>{
        const p=this.players[x.t];
        return (p && p.alive && x.i<p.dice.length) ? { seat:x.t, i:x.i, v:p.dice[x.i] } : null;
      }).filter(Boolean) : [];
      return {
        itemsOn:this.itemsOn, items:(this.items||[]).slice(),
        peeked: myPeeks.map(x=>x.v),      // aiDecide가 '아는 눈'으로 쓴다
        myPeeks: myPeeks,                 // 클라가 어느 주사위인지 표시하는 데 쓴다
        lastPeek: this.lastPeek && vSeat===this.lastPeek.by ? {...this.lastPeek} : null,
        gameStartTime: this.gameStartTime||0,   // 판 고유키 — 클라가 '같은 판 결과 중복 기록'을 막는 데 쓴다
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
