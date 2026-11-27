/* =========================================================
   js/calc.js — Pure helpers, formatting & calculations.
   No localStorage here. Safe to edit totals / health logic here.
   ========================================================= */

/* ===== 1. CONSTANTS ===== */
export const CURRENCY = 'Rs. ';                       // change currency symbol here
export const PALETTE = ['#FF8A65','#F43F5E','#F59E0B','#22C55E','#38BDF8','#A78BFA','#F472B6','#94A3B8'];
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ===== 2. DOM / FORMAT HELPERS ===== */
export const $ = id => document.getElementById(id);
export const pad = n => String(n).padStart(2,'0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const ym = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
export const fmt = n => CURRENCY + Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
export const compact = n => { const a=Math.abs(n); const s=a>=1e6?(a/1e6).toFixed(1)+'M':a>=1e4?Math.round(a/1e3)+'k':a>=1e3?(a/1e3).toFixed(1)+'k':Math.round(a); return (n<0?'-':'')+s; };
export const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid = () => 'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

/* ===== 3. TOTALS, PERIOD FILTER ===== */
export function sums(list){ let i=0,x=0; list.forEach(e=>{ e.type==='income'?i+=e.amount:x+=e.amount; }); return {inc:i,exp:x,net:i-x}; }
export const periodDate = (period,view) => period==='this' ? new Date() : view;
export function filterEntries(entries,period,view){
  if(period==='all') return entries;
  return entries.filter(e=>e.date.slice(0,7)===ym(periodDate(period,view)));
}

/* ===== 4. BUSINESS HEALTH (red <0, yellow margin <15%, green otherwise) ===== */
export function healthStatus(inc,exp,net){
  const margin = inc>0 ? net/inc*100 : 0;
  let cls='', txt='No data yet', col='var(--muted)', sub='Add income and expenses to see your health.';
  if(inc||exp){
    if(net<0||exp>inc){cls='bad';txt='Bad';col='var(--neg)';sub=`Expenses exceed income by ${fmt(exp-inc)}`;}
    else if(margin<15){cls='mod';txt='Moderate';col='var(--warn)';sub=`Profit margin is tight: ${margin.toFixed(1)}%`;}
    else{cls='good';txt='Good';col='var(--pos)';sub=`Healthy profit margin: ${margin.toFixed(1)}%`;}
  }
  return {cls,txt,col,sub,margin};
}

/* ===== 5. GROWTH SERIES (net profit per month for "All", per day for one month) ===== */
export function growthSeries(list,period,view){
  const byMonth = period==='all', map={}, labels=[], data=[];
  list.forEach(e=>{ const k=byMonth?e.date.slice(0,7):e.date.slice(8); map[k]=(map[k]||0)+(e.type==='income'?e.amount:-e.amount); });
  if(byMonth){ Object.keys(map).sort().forEach(k=>{ labels.push(MONTHS[+k.slice(5)-1].slice(0,3)+' '+k.slice(2,4)); data.push(map[k]); }); }
  else{ const d=periodDate(period,view), dim=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    for(let i=1;i<=dim;i++){ labels.push(i); data.push(map[pad(i)]||0); } }
  return {labels,data,byMonth};
}

/* ===== 6. GROUP BY TITLE (pie chart + Month Summary breakdowns) ===== */
export function groupBy(list,type){
  const m={}; list.filter(e=>e.type===type).forEach(e=>{ const k=e.title.trim().toLowerCase(); const g=m[k]=m[k]||{name:e.title.trim(),v:0,n:0}; g.v+=e.amount; g.n++; });
  return Object.values(m).sort((a,b)=>b.v-a.v);
}

/* ===== 7. MONTH HELPERS ===== */
export function latestMonth(entries){   // current month, else latest month that has data
  const n=new Date(), cur=new Date(n.getFullYear(),n.getMonth(),1);
  if(!entries.length||entries.some(e=>e.date.slice(0,7)===ym(cur))) return cur;
  const l=entries.map(e=>e.date).sort().pop(); return new Date(+l.slice(0,4),+l.slice(5,7)-1,1);
}
