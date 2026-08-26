import { setTimeout as sleep } from 'node:timers/promises';

const START = new Date('2012-01-01T00:00:00Z');
const END = new Date('2026-08-27T00:00:00Z');
const CONCURRENCY = 24;
const MAX_RETRIES = 5;
const cfg = {
  initialEquity: 10000, riskPct: 0.50, maxDailyRiskPct: 1.50, maxTradesPerDay: 3,
  rr: 1.50, costPoints: 0, slippagePoints: 0,
  originalThresholdPct: 0.20, originalMalafideFactor: 1.30,
  atrPeriod: 14, atrStopMult: 1.00, emaPeriod: 20,
  obLookback: 40, bosLookback: 8, displacementAtr: 1.20, obBufferAtr: 0.15,
  sessionStart: '09:30', sessionEndBar: '15:45'
};
const isoDay = d => d.toISOString().slice(0,10);
function weekdays(){const a=[];for(let d=new Date(START);d<END;d=new Date(d.getTime()+86400000)){const w=d.getUTCDay();if(w!==0&&w!==6)a.push(new Date(d));}return a;}
function endpoint(d){return `https://jetta.dukascopy.com/candles/minute/USA500.IDX-USD/BID/${d.getUTCFullYear()}/${d.getUTCMonth()+1}/${d.getUTCDate()}?amount=15`;}
async function getDay(d){
  for(let n=0;n<=MAX_RETRIES;n++){
    try{
      const r=await fetch(endpoint(d),{headers:{accept:'application/json','user-agent':'SP500-OrderBlock-Research/1.0'}});
      if(r.status===200)return await r.json();
      if(r.status===404)return null;
      if(r.status===429||r.status>=500){if(n<MAX_RETRIES){const ra=Number(r.headers.get('retry-after'));await sleep(Number.isFinite(ra)&&ra>0?ra*1000:Math.min(20000,500*2**n));continue;}}
      throw new Error(`${r.status} ${r.statusText}`);
    }catch(e){if(n===MAX_RETRIES)throw e;await sleep(Math.min(20000,500*2**n));}
  }
}
function decimals(m){const [c,e='0']=String(m).toLowerCase().split('e');return Math.max(0,(c.split('.')[1]||'').length-Number(e));}
function normalise(x){
  if(!x||!Array.isArray(x.times)||!x.times.length)return [];
  const n=x.times.length, cols=['opens','highs','lows','closes','volumes'];
  if(!cols.every(k=>Array.isArray(x[k])&&x[k].length===n))throw new Error('bad-columns');
  const m=Number(x.multiplier), sh=Number(x.shift);if(!(m>0)||!(sh>0))throw new Error('bad-header');
  const sc=decimals(m);let ts=Number(x.timestamp);if(ts<1e11)ts*=1000;
  let o=Math.round(Number(x.open)/m),h=Math.round(Number(x.high)/m),l=Math.round(Number(x.low)/m),c=Math.round(Number(x.close)/m);
  const out=[];
  for(let i=0;i<n;i++){
    const dt=Number(x.times[i]);if(!Number.isInteger(dt)||dt<0)continue;ts+=dt*sh;
    o+=Number(x.opens[i]);h+=Number(x.highs[i]);l+=Number(x.lows[i]);c+=Number(x.closes[i]);
    const O=Number((o*m).toFixed(sc)),H=Number((h*m).toFixed(sc)),L=Number((l*m).toFixed(sc)),C=Number((c*m).toFixed(sc));
    if([ts,O,H,L,C].every(Number.isFinite)&&H>=Math.max(O,C)&&L<=Math.min(O,C))out.push({ts,open:O,high:H,low:L,close:C,volume:Number(x.volumes[i])||0});
  }
  return out;
}
async function download(){
  const ds=weekdays(), all=[];let empty=0,fail=0,done=0;
  console.log(`DATA_REQUEST 2012-01-01 -> 2026-08-26 | weekdays=${ds.length} | 2011=EXCLUDED`);
  for(let i=0;i<ds.length;i+=CONCURRENCY){
    const b=ds.slice(i,i+CONCURRENCY);const res=await Promise.all(b.map(async d=>{try{return [d,await getDay(d)]}catch(e){fail++;console.error('FETCH_FAIL',isoDay(d),e.message);return[d,null]}}));
    for(const [d,x] of res){try{const r=normalise(x);if(r.length)all.push(...r);else empty++;}catch(e){fail++;console.error('PARSE_FAIL',isoDay(d),e.message);}}
    done+=b.length;if(done%240===0||done===ds.length)console.log(`DOWNLOAD ${done}/${ds.length} bars=${all.length} empty=${empty} fail=${fail}`);
    if(fail>40)throw new Error(`too-many-failures:${fail}`);await sleep(100);
  }
  all.sort((a,b)=>a.ts-b.ts);const u=[];let last=-1;for(const r of all){if(r.ts!==last){u.push(r);last=r.ts;}}
  if(u.length<100000)throw new Error(`insufficient-bars:${u.length}`);
  const first=new Date(u[0].ts), end=new Date(u.at(-1).ts);if(first.getUTCFullYear()!==2012)throw new Error(`first-year:${first.toISOString()}`);if(end.getUTCFullYear()<2026)throw new Error(`last-year:${end.toISOString()}`);
  console.log(`DATASET_OK bars=${u.length} first=${first.toISOString()} last=${end.toISOString()} failedDays=${fail}`);return u;
}
function ema(p,x,n){const a=2/(n+1);return p==null?x:a*x+(1-a)*p;}
function bucket(ts,h){const q=h*3600000,r=((ts%q)+q)%q;return r===0?ts:ts-r+q;}
function indicators(rows){
  let e=null,sum=0;const q=[];for(let i=0;i<rows.length;i++){const r=rows[i],pc=i?rows[i-1].close:r.close,tr=Math.max(r.high-r.low,Math.abs(r.high-pc),Math.abs(r.low-pc));q.push(tr);sum+=tr;if(q.length>cfg.atrPeriod)sum-=q.shift();r.atr=q.length===cfg.atrPeriod?sum/cfg.atrPeriod:null;e=ema(e,r.close,cfg.emaPeriod);r.ema15=e;}
  function tf(h){const a=[];let k=null,z=null;for(const r of rows){const n=bucket(r.ts,h);if(n!==k){if(z)a.push(z);k=n;z={ts:n,close:r.close};}else z.close=r.close;}if(z)a.push(z);let e=null;for(const x of a){e=ema(e,x.close,cfg.emaPeriod);x.ema=e;}return a;}
  const h1=tf(1),h4=tf(4);let a=0,b=0;for(const r of rows){while(a+1<h1.length&&h1[a+1].ts<=r.ts)a++;while(b+1<h4.length&&h4[b+1].ts<=r.ts)b++;const x=h1[a]?.ts<=r.ts?h1[a]:null,y=h4[b]?.ts<=r.ts?h4[b]:null;r.h1Close=x?.close;r.h1Ema=x?.ema;r.h4Close=y?.close;r.h4Ema=y?.ema;}
}
const nyf=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function ny(ts){const o={};for(const p of nyf.formatToParts(new Date(ts)))if(p.type!=='literal')o[p.type]=p.value;return {date:`${o.year}-${o.month}-${o.day}`,time:`${o.hour}:${o.minute}`};}
function mtf(r){if([r.ema15,r.h1Close,r.h1Ema,r.h4Close,r.h4Ema].some(v=>v==null||!Number.isFinite(v)))return 0;let s=0;s+=r.close>r.ema15?.5:-.5;s+=r.h1Close>r.h1Ema?.3:-.3;s+=r.h4Close>r.h4Ema?.2:-.2;return s>=.6?1:s<=-.6?-1:0;}
function sigA(r,i){if(i<20)return null;const x=r[i],p=r[i-1];if(p.h1Close==null||p.h4Close==null)return null;const av=(p.close+p.h1Close+p.h4Close)/3,diff=(x.open-av)/av*100,d=diff>cfg.originalThresholdPct?1:diff<-cfg.originalThresholdPct?-1:0;if(!d)return null;let lo=Infinity,hi=-Infinity;for(let k=Math.max(0,i-10);k<i;k++){lo=Math.min(lo,r[k].low);hi=Math.max(hi,r[k].high);}if(d===1&&!(x.open>lo))return null;if(d===-1&&!(x.open<hi))return null;return{d,risk:Math.max(1e-9,(p.high-p.low)*cfg.originalMalafideFactor)};}
function sigB(r,i){if(i<cfg.atrPeriod+2)return null;const p=r[i-1],d=mtf(p);return d&&p.atr?{d,risk:Math.max(1e-9,p.atr*cfg.atrStopMult)}:null;}
function findOB(r,i,d){if(i<cfg.obLookback+cfg.bosLookback+5)return null;for(let j=i-3;j>=Math.max(cfg.bosLookback+3,i-cfg.obLookback);j--){const ob=r[j],im=r[j+1],rt=r[i-1];if(!im.atr)continue;let hi=-Infinity,lo=Infinity;for(let k=Math.max(0,j-cfg.bosLookback);k<j;k++){hi=Math.max(hi,r[k].high);lo=Math.min(lo,r[k].low);}if(d===1){if(!(ob.close<ob.open&&(im.close-im.open)>=cfg.displacementAtr*im.atr&&im.close>hi))continue;let prior=false;for(let k=j+2;k<=i-2;k++)if(r[k].low<=ob.high){prior=true;break;}if(prior||!(rt.low<=ob.high&&rt.close>ob.high&&rt.close>rt.open))continue;let inv=false;for(let k=j+1;k<=i-2;k++)if(r[k].close<ob.low){inv=true;break;}if(!inv)return{low:ob.low,high:ob.high};}else{if(!(ob.close>ob.open&&(im.open-im.close)>=cfg.displacementAtr*im.atr&&im.close<lo))continue;let prior=false;for(let k=j+2;k<=i-2;k++)if(r[k].high>=ob.low){prior=true;break;}if(prior||!(rt.high>=ob.low&&rt.close<ob.low&&rt.close<rt.open))continue;let inv=false;for(let k=j+1;k<=i-2;k++)if(r[k].close>ob.high){inv=true;break;}if(!inv)return{low:ob.low,high:ob.high};}}return null;}
function sigC(r,i){const p=r[i-1],d=mtf(p);if(!d||!p?.atr)return null;const ob=findOB(r,i,d);if(!ob)return null;const e=r[i].open,s=d===1?ob.low-p.atr*cfg.obBufferAtr:ob.high+p.atr*cfg.obBufferAtr,risk=d===1?e-s:s-e;return risk>0?{d,risk}:null;}
function simulate(rows,v){let equity=cfg.initialEquity,pos=null;const tr=[],curve=[];const count=new Map(),riskd=new Map();for(let i=0;i<rows.length;i++){const row=rows[i],n=row.ny||(row.ny=ny(row.ts));if(n.time<cfg.sessionStart||n.time>cfg.sessionEndBar)continue;if(!count.has(n.date)){count.set(n.date,0);riskd.set(n.date,0);}if(pos){const hs=pos.d===1?row.low<=pos.stop:row.high>=pos.stop,ht=pos.d===1?row.high>=pos.target:row.low<=pos.target;let ex=null;if(hs)ex=pos.stop;else if(ht)ex=pos.target;else if(n.time===cfg.sessionEndBar)ex=row.close;if(ex!=null){const R=pos.d*(ex-pos.entry)/pos.risk-(cfg.costPoints+cfg.slippagePoints)/pos.risk,pnl=equity*cfg.riskPct/100*R;equity+=pnl;tr.push({R,equity});pos=null;}}if(n.time!==cfg.sessionEndBar&&!pos&&count.get(n.date)<cfg.maxTradesPerDay&&riskd.get(n.date)+cfg.riskPct<=cfg.maxDailyRiskPct+1e-12){const s=v==='A'?sigA(rows,i):v==='B'?sigB(rows,i):sigC(rows,i);if(s){const e=row.open,stop=s.d===1?e-s.risk:e+s.risk,target=s.d===1?e+cfg.rr*s.risk:e-cfg.rr*s.risk;pos={d:s.d,entry:e,risk:s.risk,stop,target};count.set(n.date,count.get(n.date)+1);riskd.set(n.date,riskd.get(n.date)+cfg.riskPct);}}curve.push(equity);}return{tr,curve,equity};}
function met(s){const R=s.tr.map(x=>x.R),w=R.filter(x=>x>0),l=R.filter(x=>x<0),ws=w.reduce((a,b)=>a+b,0),ls=l.reduce((a,b)=>a+b,0);let peak=cfg.initialEquity,dd=0;for(const e of s.curve){peak=Math.max(peak,e);dd=Math.max(dd,(peak-e)/peak*100);}return{trades:R.length,win_rate_pct:R.length?w.length/R.length*100:0,profit_factor:l.length?ws/Math.abs(ls):null,expectancy_R:R.length?R.reduce((a,b)=>a+b,0)/R.length:0,return_pct:(s.equity/cfg.initialEquity-1)*100,max_dd_pct:dd};}
const rows=await download();console.log('INDICATORS_BEGIN');indicators(rows);console.log('INDICATORS_OK');const out={};for(const v of ['A','B','C']){console.log(`BACKTEST_${v}_BEGIN`);out[v]=met(simulate(rows,v));console.log(`BACKTEST_${v}`,JSON.stringify(out[v]));}console.log('SP500_BACKTEST_SUMMARY_BEGIN');console.log(JSON.stringify({period:{from:'2012-01-01',to:'2026-08-26',timeframe:'M15',instrument:'USA500IDXUSD',session:'09:30-15:45 America/New_York',initial_equity:10000,risk_pct:0.5,rr:1.5,cost_points:0},variants:out},null,2));console.log('SP500_BACKTEST_SUMMARY_END');
