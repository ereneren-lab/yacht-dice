#!/usr/bin/env node
/**
 * 라이어 — **판이 어디서 갈리는지** 센다(라운드 단위가 아니라 게임 단위).
 *
 * 왜 (2026-08-10)
 *   어려움은 라운드당 주사위 손실이 분명히 낮은데(32.2% vs 보통 35.1%) 900판 승률은 동률이었다.
 *   "라운드는 이기는데 판은 못 이긴다" — 그 사이 어디서 새는지 보려고 만들었다.
 *
 * 무엇이 나왔나 (300판씩)
 *   보통   우승 36.7% · 1대1 진출 64.7% · **생존 시 우승 56.7%** · 1대1 시작 주사위 2.71 vs 2.54
 *   어려움 우승 30.3% · 1대1 진출 66.0% · **생존 시 우승 46.0%** · 1대1 시작 주사위 2.72 vs 2.58
 *   → 살아남는 것도, 들고 들어가는 주사위도 같다. **단둘이 남은 뒤가 문제다.**
 *
 * 시도했다 실패한 것 세 가지(전부 되돌렸다 — 소음 ±3.6%p를 못 넘었다):
 *   ① 1대1에서 블러프 올리기(0.08→0.26) → 42.9%로 오히려 나빠짐
 *   ② 1대1에서 도전 문턱 낮추기(0.47→0.40) → 46.5% (변화 없음)
 *   ③ 1대1에서 무작위성 넣기(0→0.28) → 46.5% (변화 없음)
 *   ④ 1대1에서 아예 '보통'처럼 두기 → 51.0%. 올라가 보이지만 1.4σ라 단정 못 한다.
 *
 * 왜 안 움직이나(관찰): 주사위가 몇 개 안 남으면 확률이 성겨서, 문턱을 조금 옮겨도
 *   고르는 수가 그대로다. 여기서 더 가려면 **상대 성향을 읽는 눈**이 필요하고
 *   (지금 AI엔 그게 없다) 표본도 1대1 200판이 아니라 훨씬 커야 한다.
 *
 * 사용: node scripts/sim/ld-flow.js      (브라우저 불필요 · 300판씩 약 3분)
 */
const { LDEngine } = require('/Users/jaesung/yacht-dice/public/ld-core.js');
const REAL={setTimeout:global.setTimeout,clearTimeout:global.clearTimeout,setInterval:global.setInterval,clearInterval:global.clearInterval,setImmediate:global.setImmediate,now:Date.now};
function makeClock(){let now=0,seq=0,q=new Map();const push=(cb,ms,every,args)=>{const id=++seq;q.set(id,{id,at:now+Math.max(0,ms||0),seq:id,cb,every,args});return id;};
return{install(){global.setTimeout=(cb,ms,...a)=>push(cb,ms,0,a);global.setInterval=(cb,ms,...a)=>push(cb,ms,Math.max(1,ms||1),a);global.clearTimeout=(id)=>q.delete(id&&id.id?id.id:id);global.clearInterval=global.clearTimeout;Date.now=()=>now;},
restore(){global.setTimeout=REAL.setTimeout;global.clearTimeout=REAL.clearTimeout;global.setInterval=REAL.setInterval;global.clearInterval=REAL.clearInterval;Date.now=REAL.now;},
async drain(done,maxMs,maxSteps){let steps=0;while(!done()){if(!q.size)return'idle';let b=null;for(const t of q.values())if(!b||t.at<b.at||(t.at===b.at&&t.seq<b.seq))b=t;if(b.at>maxMs)return'stuck';now=b.at;if(b.every){b.at=now+b.every;b.seq=++seq;}else q.delete(b.id);try{b.cb.apply(null,b.args||[]);}catch(e){return'err';}await new Promise(r=>REAL.setImmediate(r));if(++steps>maxSteps)return'stuck';}return'done';}};}
function mkRng(seed){let a=seed>>>0;return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function seedOf(i){let x=(0x9E37 ^ Math.imul(i+1,2654435761))>>>0;x^=x>>>15;x=Math.imul(x,2246822519);x^=x>>>13;return x>>>0;}

(async()=>{
  for (const diff of ['normal','hard']) {
    const t={우승:0, 헤드업진출:0, 헤드업승:0, 판:0, 초반탈락:0, 주사위합:0, 상대주사위합:0};
    for(let i=0;i<300;i++){
      const testSeat=i%3;
      const pl=[0,1,2].map(s=>({pid:'p'+s,name:'P'+s,ai:true,aiDiff:s===testSeat?diff:'normal',connected:true}));
      const clock=makeClock(); clock.install(); let eng=null, v='';
      let sawHeadsUp=false, myDiceAtHeadsUp=0, oppDiceAtHeadsUp=0;
      try{
        eng=new LDEngine({aiFast:false,itemsOn:false,players:pl,spotOn:true,diceCount:5,wild:true,turnMs:45000,rng:mkRng(seedOf(i)),
          onState(){
            try{
              const alive=eng.players.filter(p=>p.alive);
              if(alive.length===2 && !sawHeadsUp && alive.some(p=>p.seat===testSeat)){
                sawHeadsUp=true;
                myDiceAtHeadsUp=(eng.players[testSeat].dice||[]).length;
                const opp=alive.find(p=>p.seat!==testSeat);
                oppDiceAtHeadsUp=opp?(opp.dice||[]).length:0;
              }
            }catch(e){}
          }});
        eng.start();
        v=await clock.drain(()=>eng.phase==='over'||eng.phase==='gameover',60*60*1000,300000);
      }catch(e){}
      finally{clock.restore();}
      if(v!=='done') continue;
      t.판++;
      const win=(eng.serialize(pl[0].pid)||{}).winner;
      const iWon = win===('p'+testSeat);
      if(iWon) t.우승++;
      if(sawHeadsUp){ t.헤드업진출++; if(iWon) t.헤드업승++; t.주사위합+=myDiceAtHeadsUp; t.상대주사위합+=oppDiceAtHeadsUp; }
      else t.초반탈락++;   // 2인이 되기 전에 내가 먼저 죽었다
    }
    const pc=(a,b)=>b? (a/b*100).toFixed(1)+'%' : '-';
    const avg=(x)=>t.헤드업진출? (x/t.헤드업진출).toFixed(2) : '-';
    console.log(`${diff.padEnd(7)} 우승 ${pc(t.우승,t.판)} · 1대1 진출 ${pc(t.헤드업진출,t.판)} · 생존 시 우승 ${pc(t.헤드업승,t.헤드업진출)}`);
    console.log(`        └ **1대1 시작 시 내 주사위 ${avg(t.주사위합)}개 vs 상대 ${avg(t.상대주사위합)}개**`);
  }
})();
