/** Pure descriptive statistics; non-finite inputs are ignored. */
const clean=a=>a.map(Number).filter(Number.isFinite);
export function mean(a){const x=clean(a);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null}
export function variance(a,sample=true){const x=clean(a);if(x.length<(sample?2:1))return null;const m=mean(x);return x.reduce((s,v)=>s+(v-m)**2,0)/(x.length-(sample?1:0))}
export function standardDeviation(a,sample=true){const v=variance(a,sample);return v===null?null:Math.sqrt(v)}
export function quantile(a,q){const x=clean(a).sort((u,v)=>u-v);if(!x.length||q<0||q>1)return null;const p=(x.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return x[l]+(x[h]-x[l])*(p-l)}
export function describe(a){const x=clean(a).sort((u,v)=>u-v);return{count:x.length,mean:mean(x),sampleVariance:variance(x),standardDeviation:standardDeviation(x),min:x.length?x[0]:null,q1:quantile(x,.25),median:quantile(x,.5),q3:quantile(x,.75),max:x.length?x.at(-1):null}}
