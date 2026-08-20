#!/usr/bin/env node
/**
 * 라이어 — **추정기가 맞는가**를 잰다(보정 검사). `npm run sim:ldcalib`
 *
 * 왜 (2026-08-20)
 *   난이도 진단은 "어려움이 보통을 못 넘는다"까지 왔는데, 시도한 것은 전부 **손잡이 더하기**였고
 *   전부 실패했다(파라미터 스윕·추정기 조건화). 8/07 섯다에서 **먹힌 것은 딱 하나 — 틀린 값 고치기**였다
 *   (강도값이 확률이 아니어서 갑오를 0.37로 읽었다). 그래서 라이어도 "틀린 값이 있나"부터 봤다.
 *
 * 무엇을 재나
 *   AI가 입찰을 볼 때 쓰는 `pTrue = atLeast(unknown, qty-myc, p)`는 **모르는 주사위를 전부 무작위**로 본다.
 *   그런데 상대가 그 수량을 불렀다는 것 자체가 "그 눈을 갖고 있다"는 신호다 → pTrue가 낮게 나온다.
 *   구간별로 **예측 확률 vs 실제 참이었던 비율**을 맞대 본다. 맞으면 두 값이 같아야 한다.
 *
 * ⚠️ 도전한 것만 세면 안 된다 — AI는 pTrue가 낮을 때만 도전하므로 평균 회귀로도 차이가 난다.
 *    그래서 **모든 입찰**을 센다(선택 편향 없음).
 *
 * 실측(2026-08-20, 220판·입찰 4,532건, 3인·와일드·주사위 5):
 *   예측 34.3% vs 실제 56.8% — **+22.5%p 낮게 본다.** 전 구간에서 같은 방향.
 *   → AI가 과도하게 도전한다. 어려움은 도전 문턱이 더 높아(0.47 vs 0.40) 그 손해를 더 크게 먹는다.
 *     "어려움 ≤ 보통"의 유력한 정체다.
 */
const { LDEngine } = require('/Users/jaesung/yacht-dice/public/ld-core.js');
const REAL={setTimeout:global.setTimeout,clearTimeout:global.clearTimeout,setInterval:global.setInterval,clearInterval:global.clearInterval,setImmediate:global.setImmediate,now:Date.now};
function makeClock(){let now=0,seq=0,q=new Map();const push=(cb,ms,every,args)=>{const id=++seq;q.set(id,{id,at:now+Math.max(0,ms||0),seq:id,cb,every,args});return id;};
return{install(){global.setTimeout=(cb,ms,...a)=>push(cb,ms,0,a);global.setInterval=(cb,ms,...a)=>push(cb,ms,Math.max(1,ms||1),a);global.clearTimeout=(id)=>q.delete(id&&id.id?id.id:id);global.clearInterval=global.clearTimeout;Date.now=()=>now;},
restore(){global.setTimeout=REAL.setTimeout;global.clearTimeout=REAL.clearTimeout;global.setInterval=REAL.setInterval;global.clearInterval=REAL.clearInterval;Date.now=REAL.now;},
async drain(done,maxMs,maxSteps){let steps=0;while(!done()){if(!q.size)return'idle';let b=null;for(const t of q.values())if(!b||t.at<b.at||(t.at===b.at&&t.seq<b.seq))b=t;if(b.at>maxMs)return'stuck';now=b.at;if(b.every){b.at=now+b.every;b.seq=++seq;}else q.delete(b.id);try{b.cb.apply(null,b.args||[]);}catch(e){return'err';}await new Promise(r=>REAL.setImmediate(r));if(++steps>maxSteps)return'stuck';}return'done';}};}
function mkRng(seed){let a=seed>>>0;return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function seedOf(i){let x=(0x9E37 ^ Math.imul(i+1,2654435761))>>>0;x^=x>>>15;x=Math.imul(x,2246822519);x^=x>>>13;return x>>>0;}

function C(n,k){ if(k<0||k>n)return 0; let r=1; for(let i=0;i<k;i++) r=r*(n-i)/(i+1); return r; }
function atLeast(U,t,p){ if(t<=0)return 1; if(t>U)return 0; let s=0; for(let i=t;i<=U;i++) s+=C(U,i)*Math.pow(p,i)*Math.pow(1-p,U-i); return s; }
/* ⚠️ 자는 **AI가 실제로 쓰는 식**을 그대로 써야 한다. ld-core에 보정(BIDDER_EXCESS)이 들어갔으니
   여기도 같이 맞춘다 — 안 맞추면 "AI 행동은 바뀌었는데 옛 식으로 재는" 꼴이 된다.
   BIAS=0 으로 두면 보정 전 식으로 잰다(비교용). */
const BIAS = process.env.LDCALIB_BIAS != null ? parseFloat(process.env.LDCALIB_BIAS) : 0.8;
function atLeastFrac(U,t,p){ const lo=Math.floor(t), f=t-lo; return atLeast(U,lo,p)*(1-f) + atLeast(U,lo+1,p)*f; }

const WILD=true, P=1/3;
const bins=[[0,.15],[.15,.3],[.3,.45],[.45,.6],[.6,.75],[.75,1.01]];
const acc=bins.map(()=>({n:0,t:0,psum:0}));
let dudos=0;


/* 도전 순간을 _apply에서 직접 잡는다 — serialize 필드를 추측하지 않아도 된다. */
const origApply = LDEngine.prototype._apply;
let CUR=null;
LDEngine.prototype._apply = function(seat, a){
  try{
    /* 선택 편향을 없애려면 **모든 입찰**을 봐야 한다.
       도전한 것만 보면 'pTrue가 낮을 때만' 표본이 모여 평균 회귀로도 차이가 생긴다. */
    if(a && a.type==='bid' && CUR){
      const alive=(this.players||[]).filter(p=>p.alive);
      const all=alive.flatMap(p=>p.dice||[]);
      const nxt=this._nextAlive ? this._nextAlive(seat) : null;
      const viewer=(nxt!=null && this.players[nxt]) ? this.players[nxt] : null;
      if(all.length && viewer){
        const actual=all.filter(d=>d===a.face||(WILD&&d===1)).length;
        const wasTrue=actual>=a.qty;
        const myd=viewer.dice||[];
        const myc=myd.filter(d=>d===a.face||(WILD&&d===1)).length;
        const unknown=Math.max(0,all.length-myd.length);
        const pt=atLeastFrac(unknown, a.qty-myc-BIAS, P);
        const bi=bins.findIndex(([lo,hi])=>pt>=lo&&pt<hi);
        if(bi>=0){ acc[bi].n++; acc[bi].psum+=pt; if(wasTrue)acc[bi].t++; CUR.dudos++; }
      }
    }
    if(false && a && a.type==='dudo' && this.bid && CUR){
      const alive=(this.players||[]).filter(p=>p.alive);
      const all=alive.flatMap(p=>p.dice||[]);
      if(all.length){
        const b=this.bid;
        const actual=all.filter(d=>d===b.face||(WILD&&d===1)).length;
        const wasTrue=actual>=b.qty;
        const myd=(this.players[seat]&&this.players[seat].dice)||[];
        const myc=myd.filter(d=>d===b.face||(WILD&&d===1)).length;
        const unknown=Math.max(0,all.length-myd.length);
        const pt=atLeast(unknown, b.qty-myc, P);
        const bi=bins.findIndex(([lo,hi])=>pt>=lo&&pt<hi);
        if(bi>=0){ acc[bi].n++; acc[bi].psum+=pt; if(wasTrue)acc[bi].t++; CUR.dudos++; }
      }
    }
  }catch(e){}
  return origApply.call(this, seat, a);
};

(async()=>{
  CUR={dudos:0};
  for(let i=0;i<220;i++){
    const pl=[0,1,2].map(s=>({pid:'p'+s,name:'P'+s,ai:true,aiDiff:'normal',connected:true}));
    const clock=makeClock(); clock.install(); let eng=null;
    try{
      eng=new LDEngine({aiFast:false,itemsOn:false,players:pl,spotOn:false,diceCount:5,wild:WILD,
                        turnMs:45000,rng:mkRng(seedOf(i)),onState(){}});
      eng.start();
      await clock.drain(()=>eng.phase==='over'||eng.phase==='gameover',60*60*1000,300000);
    }catch(e){}
    finally{clock.restore();}
  }
  const dudos=CUR.dudos;
  console.log('입찰 표본', dudos);
  if(!dudos){ console.log('(_apply를 못 잡았다)'); return; }
  console.log('\npTrue 구간    AI 예측   실제 참    차이     n');
  bins.forEach((b,i)=>{ const a=acc[i]; if(!a.n) return;
    const pred=a.psum/a.n, real=a.t/a.n;
    console.log(`  ${b[0].toFixed(2)}~${b[1].toFixed(2)}  ${(pred*100).toFixed(0).padStart(6)}%  ${(real*100).toFixed(0).padStart(7)}%  ${((real-pred)*100).toFixed(0).padStart(6)}%p  ${String(a.n).padStart(5)}`);
  });
  const N=acc.reduce((s,a)=>s+a.n,0), PR=acc.reduce((s,a)=>s+a.psum,0)/N, RE=acc.reduce((s,a)=>s+a.t,0)/N;
  console.log(`\n  전체        ${(PR*100).toFixed(1)}%    ${(RE*100).toFixed(1)}%   ${((RE-PR)*100).toFixed(1)}%p   n=${N}`);
  console.log(RE>PR+0.03 ? '\n→ 실제가 예측보다 높다 = pTrue가 낮게 나온다 = **과도한 도전**(가설 지지)'
                          : '\n→ 편향이 크지 않다 = 추정기는 대체로 맞다(가설 기각)');
})();
