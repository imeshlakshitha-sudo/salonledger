/* =========================================================
   js/summary.js — MONTH SUMMARY view:
   month selector, totals, breakdowns, entry list,
   CSV download and printable (Save as PDF) download.
   ========================================================= */
import { state } from './storage.js';
import { $, MONTHS, PALETTE, ym, fmt, esc, sums, groupBy } from './calc.js';

/* ===== 1. DATA FOR THE SELECTED MONTH ===== */
const monthEntries = () => state.entries.filter(e=>e.date.slice(0,7)===ym(state.sumView)).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);

/* ===== 2. RENDER ===== */
export function renderSummary(){
  const list=monthEntries(), t=sums(list), sv=state.sumView;
  $('sumTitle').textContent=`${MONTHS[sv.getMonth()]} ${sv.getFullYear()}`;
  $('sumMode').textContent=`Showing ${state.mode==='demo'?'Demo':'Live'} data`;
  $('sProfit').textContent=fmt(t.inc); $('sExp').textContent=fmt(t.exp); $('sNet').textContent=fmt(t.net);
  $('sNet').style.color=t.net<0?'var(--neg-hi)':'var(--pos-hi)';
  $('sumCount').textContent=`${list.length} entries`+(t.inc?` · profit margin ${(t.net/t.inc*100).toFixed(1)}%`:'');
  const rows=(g,tot)=>g.length?g.map((r,i)=>`<div><b style="background:${PALETTE[i%PALETTE.length]}"></b>${esc(r.name)}${r.n>1?' ×'+r.n:''}<em>${fmt(r.v)} · ${(r.v/tot*100).toFixed(1)}%</em></div>`).join(''):'<div class="muted">Nothing this month.</div>';
  $('sumInc').innerHTML=rows(groupBy(list,'income'),t.inc); $('sumExp').innerHTML=rows(groupBy(list,'expense'),t.exp);
  $('sumEntries').innerHTML=list.length?list.map(e=>`<div class="entry"><div class="info"><b>${esc(e.title)}</b><small>${+e.date.slice(8)} ${MONTHS[sv.getMonth()].slice(0,3)} · ${e.type}</small>${e.note?`<small style="display:block;font-style:italic">“${esc(e.note)}”</small>`:''}</div><span class="a" style="color:${e.type==='income'?'var(--pos-hi)':'var(--neg-hi)'}">${e.type==='income'?'+':'-'}${fmt(e.amount)}</span></div>`).join(''):'<div class="muted">No entries this month.</div>';
}

/* ===== 3. FILE SAVING (hosted `downloads` capability when present; normal download otherwise) ===== */
async function saveFile(name,text,type){
  const blob=new Blob([text],{type});
  try{ const dl=window.claude&&await window.claude.use('downloads'); if(dl){ await dl.save({filename:name,data:blob}); return; } }catch(e){ if(e&&e.code==='declined') return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
const csvCell=v=>{ let s=String(v); if(/^[=+\-@]/.test(s)) s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; };

/* ===== 4. EVENT WIRING (called once from app.js) ===== */
export function initSummary(){
  $('sumPrev').onclick=()=>{ state.sumView=new Date(state.sumView.getFullYear(),state.sumView.getMonth()-1,1); renderSummary(); };
  $('sumNext').onclick=()=>{ state.sumView=new Date(state.sumView.getFullYear(),state.sumView.getMonth()+1,1); renderSummary(); };

  // CSV report for the selected month
  $('dlCsv').onclick=()=>{
    const list=monthEntries(), t=sums(list), sv=state.sumView, p=state.profile;
    const L=[['SalonLedger Month Summary',`${MONTHS[sv.getMonth()]} ${sv.getFullYear()}`],['Mode',state.mode],['Prepared by',[p.name,p.title].filter(Boolean).join(', ')],[],['Profit (Income)',t.inc],['Expenses',t.exp],['Net Profit',t.net],[],['Date','Type','Title','Amount','Note'],...list.map(e=>[e.date,e.type,e.title,e.amount,e.note||''])];
    saveFile(`salonledger-${ym(sv)}-${state.mode}.csv`,'\ufeff'+L.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv');
  };

  // printable page (open it, then Print -> Save as PDF)
  $('dlPrint').onclick=()=>{
    const list=monthEntries(), t=sums(list), sv=state.sumView, p=state.profile, mName=`${MONTHS[sv.getMonth()]} ${sv.getFullYear()}`;
    const tr=e=>`<tr><td>${e.date}</td><td>${e.type}</td><td>${esc(e.title)}</td><td style="text-align:right">${fmt(e.amount)}</td><td>${esc(e.note||'')}</td></tr>`;
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>SalonLedger ${mName}</title><style>body{font:14px system-ui,sans-serif;color:#111;max-width:760px;margin:24px auto;padding:0 16px}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left;font-variant-numeric:tabular-nums}</style></head><body><h1>SalonLedger – ${mName}</h1><p>${esc([p.name,p.title].filter(Boolean).join(', '))} (${state.mode} data)</p><table><tr><th>Profit (Income)</th><th>Expenses</th><th>Net Profit</th></tr><tr><td>${fmt(t.inc)}</td><td>${fmt(t.exp)}</td><td>${fmt(t.net)}</td></tr></table><table><tr><th>Date</th><th>Type</th><th>Title</th><th>Amount</th><th>Note</th></tr>${list.map(tr).join('')}</table><p style="color:#666">Use Print → Save as PDF.</p></body></html>`;
    saveFile(`salonledger-${ym(sv)}-${state.mode}.html`,html,'text/html');
  };
}
