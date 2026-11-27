/* =========================================================
   js/dashboard.js — HOME view:
   mode switch + reset, period filter, KPI cards, health,
   growth chart, expense pie, calendar, day popup CRUD,
   saved packages / expense items, confirm dialog.
   ========================================================= */
import { state, saveEntries, savePresets, loadActiveData, makeDemo, saveModePref } from './storage.js';
import { $, MONTHS, PALETTE, pad, ym, fmt, compact, esc, uid, sums, periodDate, filterEntries, healthStatus, growthSeries, groupBy, latestMonth } from './calc.js';

/* ===== 1. MODULE-LOCAL UI STATE ===== */
let growth=null, pie=null;
let modalDate=null, editId=null, formType='income';
let mgrType='income', mgrEditId=null, confCb=null;

/* ===== 2. KPIs + HEALTH ===== */
function renderKPIs(list){
  const {inc,exp,net}=sums(list);
  $('kProfit').textContent=fmt(inc); $('kExp').textContent=fmt(exp);
  const kn=$('kNet'); kn.textContent=fmt(net); kn.style.color=net<0?'var(--neg-hi)':'var(--pos-hi)';
  const pd=periodDate(state.period,state.view);
  $('periodLabel').textContent = state.period==='all'?'All time':`${MONTHS[pd.getMonth()]} ${pd.getFullYear()}`;
  const h=healthStatus(inc,exp,net);
  $('healthBadge').className='badge '+h.cls; $('healthText').textContent=h.txt; $('healthSub').textContent=h.sub;
  const f=$('healthFill'); f.style.background=h.col; f.style.width=Math.max(0,Math.min(100,h.margin))+'%';
}

/* ===== 3. GROWTH CHART (net profit over time) ===== */
function renderGrowth(list){
  const {labels,data,byMonth}=growthSeries(list,state.period,state.view);
  $('growthSub').textContent = byMonth?'· net profit per month':'· net profit per day';
  $('growthEmpty').style.display=list.length?'none':'flex';
  const Chart=window.Chart;
  if(typeof Chart==='undefined'){ $('growthEmpty').style.display='flex'; $('growthEmpty').textContent='Chart library could not load (check internet)'; return; }
  if(!growth){
    growth=new Chart($('growthChart'),{type:'line',
      data:{labels,datasets:[{data,borderColor:'#22C55E',backgroundColor:'rgba(34,197,94,.12)',fill:true,tension:.3,pointRadius:3,
        segment:{borderColor:c=>c.p1.parsed.y<0?'#F43F5E':'#22C55E'}}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' Net: '+fmt(c.parsed.y)}}},
        scales:{x:{grid:{display:false},ticks:{maxTicksLimit:10}},y:{grid:{color:'#232D31'},ticks:{callback:v=>compact(v)}}}}});
  }else{ growth.data.labels=labels; growth.data.datasets[0].data=data; growth.update(); }
}

/* ===== 4. EXPENSE PIE CHART ===== */
function renderPie(list){
  const rows=groupBy(list,'expense'), total=rows.reduce((s,r)=>s+r.v,0);
  $('pieEmpty').style.display=rows.length?'none':'flex';
  $('pieLegend').innerHTML=rows.map((r,i)=>`<div><b style="background:${PALETTE[i%PALETTE.length]}"></b>${esc(r.name)}<em>${fmt(r.v)} · ${(r.v/total*100).toFixed(1)}%</em></div>`).join('');
  const Chart=window.Chart; if(typeof Chart==='undefined') return;
  const d={labels:rows.map(r=>r.name),datasets:[{data:rows.map(r=>r.v),backgroundColor:rows.map((_,i)=>PALETTE[i%PALETTE.length]),borderColor:'#12181A',borderWidth:2}]};
  if(!pie){ pie=new Chart($('pieChart'),{type:'doughnut',data:d,options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
    plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.label}: ${fmt(c.parsed)} (${(c.parsed/total*100).toFixed(1)}%)`}}}}}); }
  else{ pie.data=d; pie.update(); }
}
export function resizeCharts(){ [growth,pie].forEach(c=>c&&c.resize()); }

/* ===== 5. CALENDAR ===== */
function renderCalendar(){
  const v=state.view;
  $('calTitle').textContent=`${MONTHS[v.getMonth()]} ${v.getFullYear()}`;
  const first=new Date(v.getFullYear(),v.getMonth(),1).getDay(), dim=new Date(v.getFullYear(),v.getMonth()+1,0).getDate(), today=`${ym(new Date())}-${pad(new Date().getDate())}`;
  const net={}; state.entries.forEach(e=>{ if(e.date.slice(0,7)===ym(v)) net[e.date]=(net[e.date]||0)+(e.type==='income'?e.amount:-e.amount); });
  let h=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="dow">${d}</div>`).join('');
  for(let i=0;i<first;i++) h+='<div class="day blank"></div>';
  for(let d=1;d<=dim;d++){
    const ds=`${ym(v)}-${pad(d)}`, n=net[ds], has=n!==undefined;
    h+=`<button class="day ${ds===today?'today':''}" data-d="${ds}"><span class="d">${d}</span>${has?`<span class="amt ${n<0?'neg':'pos'}">${n>0?'+':''}${compact(n)}</span>`:''}</button>`;
  }
  $('calGrid').innerHTML=h;
}

/* ===== 6. RENDER ALL (call after every change) ===== */
export function renderDashboard(){
  const list=filterEntries(state.entries,state.period,state.view);
  renderKPIs(list); renderGrowth(list); renderPie(list); renderCalendar();
  document.querySelectorAll('#modeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.mode===state.mode));
  document.querySelectorAll('#periodSeg button').forEach(b=>b.classList.toggle('on',b.dataset.p===state.period));
  $('resetBtn').textContent = state.mode==='demo'?'Restore Sample':'Clear Live Data';
  $('modeNote').textContent = state.mode==='demo'?'Demo Mode: sample data. Your Live data is stored separately and is never touched.':'Live Mode: your own data, saved in this browser only.';
  if(modalDate) renderDay();
}

/* ===== 7. DAY MODAL: READ ===== */
function openDay(ds){ modalDate=ds; resetForm(); $('dayOv').classList.add('open'); renderDay(); }
function closeDay(){ modalDate=null; $('dayOv').classList.remove('open'); }
function renderDay(){
  const list=state.entries.filter(e=>e.date===modalDate), t=sums(list), [y,m,d]=modalDate.split('-');
  $('dayTitle').textContent=`${+d} ${MONTHS[+m-1]} ${y}`;
  $('dayTotals').innerHTML=`<span style="color:var(--pos-hi)">Income ${fmt(t.inc)}</span><span style="color:var(--neg-hi)">Expenses ${fmt(t.exp)}</span><span>Net ${fmt(t.net)}</span>`;
  $('dayList').innerHTML=list.length?list.map(e=>`<div class="entry"><div class="info"><b>${esc(e.title)}</b><small>${e.type}</small>${e.note?`<small style="display:block;font-style:italic">“${esc(e.note)}”</small>`:''}</div>
    <span class="a" style="color:${e.type==='income'?'var(--pos-hi)':'var(--neg-hi)'}">${e.type==='income'?'+':'-'}${fmt(e.amount)}</span>
    <button class="icon" data-edit="${e.id}" aria-label="Edit">✎</button><button class="icon" data-del="${e.id}" aria-label="Delete">🗑</button></div>`).join('')
    :'<div class="muted">No entries for this day yet.</div>';
}

/* ===== 8. DAY MODAL: CREATE / UPDATE / DELETE ===== */
function setType(t){ formType=t; document.querySelectorAll('#typeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.t===t)); renderChips(); }
function resetForm(){ editId=null; $('entryForm').reset(); setType('income'); $('formTitle').textContent='Add entry'; $('fSave').textContent='Add entry'; $('fCancel').style.display='none'; }
function startEdit(id){ const e=state.entries.find(x=>x.id===id); if(!e) return; editId=id; setType(e.type);
  $('fTitle').value=e.title; $('fAmount').value=e.amount; $('fNote').value=e.note||'';
  $('formTitle').textContent='Edit entry'; $('fSave').textContent='Save changes'; $('fCancel').style.display='block'; $('fTitle').focus(); }
function submitEntry(ev){
  ev.preventDefault();
  const title=$('fTitle').value.trim(), amount=parseFloat($('fAmount').value), note=$('fNote').value.trim();
  if(!title||!(amount>=0)) return;
  if(editId){ const e=state.entries.find(x=>x.id===editId); Object.assign(e,{type:formType,title,amount,note}); }
  else state.entries.push({id:uid(),date:modalDate,type:formType,title,amount,note});
  saveEntries(); resetForm(); renderDashboard();
}
function deleteEntry(id){ ask('Delete this entry?',()=>{ state.entries=state.entries.filter(e=>e.id!==id); if(editId===id) resetForm(); saveEntries(); renderDashboard(); }); }

/* ===== 9. SAVED SERVICE PACKAGES & SAVED EXPENSE ITEMS ===== */
const listFor = t => t==='income' ? state.presets.packages : state.presets.items;
function renderChips(){   // 1-tap chips inside the entry form
  const inc=formType==='income', l=listFor(formType);
  $('chipLabel').textContent = inc ? 'Service packages (tap to fill)' : 'Saved expense items (tap to fill)';
  $('chipRow').innerHTML = l.map(p=>`<button type="button" class="chip" data-pid="${p.id}">${esc(p.name)}<span class="num">${fmt(p.amount)}</span></button>`).join('')
    + `<button type="button" class="chip add" data-mgr="1">+ ${inc?'Add Package':'Add Expense Item'}</button>`
    + (l.length?'<button type="button" class="chip add" data-mgr="1">✎ Manage</button>':'');
}
function openManager(t){ mgrType=t; mgrEditId=null; $('mgrForm').reset(); $('mgrOv').classList.add('open'); renderManager(); }
function closeManager(){ $('mgrOv').classList.remove('open'); }
function renderManager(){
  const l=listFor(mgrType), inc=mgrType==='income';
  $('mgrTitle').textContent = inc ? 'Service Packages' : 'Saved Expense Items';
  $('mgrName').placeholder = inc ? 'e.g. Hair + Beard' : 'e.g. Electricity';
  $('mgrSave').textContent = mgrEditId ? 'Save changes' : (inc ? '+ Add Package' : '+ Add Expense Item');
  $('mgrCancel').style.display = mgrEditId ? 'block' : 'none';
  $('mgrList').innerHTML = l.length ? l.map(p=>`<div class="entry"><div class="info"><b>${esc(p.name)}</b></div><span class="a">${fmt(p.amount)}</span>
    <button class="icon" data-pe="${p.id}" aria-label="Edit">✎</button><button class="icon" data-pd="${p.id}" aria-label="Delete">🗑</button></div>`).join('')
    : '<div class="muted">Nothing saved yet. Add your first one below.</div>';
}

/* ===== 10. CONFIRM DIALOG ===== */
function ask(msg,cb){ $('confMsg').textContent=msg; confCb=cb; $('confOv').classList.add('open'); }
function closeConf(){ $('confOv').classList.remove('open'); confCb=null; }

/* ===== 11. EVENT WIRING (called once from app.js) ===== */
export function initDashboard(){
  // mode switch (Demo <-> Live): separate storage keys, never overwritten
  $('modeSeg').onclick=e=>{ const m=e.target.dataset.mode; if(!m||m===state.mode) return;
    state.mode=m; saveModePref(); loadActiveData(); closeManager(); closeDay(); state.sumView=latestMonth(state.entries); renderDashboard(); };
  $('periodSeg').onclick=e=>{ const p=e.target.dataset.p; if(!p) return; state.period=p; renderDashboard(); };
  $('resetBtn').onclick=()=>ask(state.mode==='demo'?'Restore the original sample data? Your Live data is not affected.':'Permanently clear ALL Live data? This cannot be undone.',
    ()=>{ state.entries=state.mode==='demo'?makeDemo():[]; saveEntries(); closeDay(); renderDashboard(); });
  // calendar navigation + day popup
  $('prevM').onclick=()=>{ state.view=new Date(state.view.getFullYear(),state.view.getMonth()-1,1); renderDashboard(); };
  $('nextM').onclick=()=>{ state.view=new Date(state.view.getFullYear(),state.view.getMonth()+1,1); renderDashboard(); };
  $('calGrid').onclick=e=>{ const b=e.target.closest('.day[data-d]'); if(b) openDay(b.dataset.d); };
  $('dayClose').onclick=closeDay;
  $('dayOv').onclick=e=>{ if(e.target.id==='dayOv') closeDay(); };
  $('typeSeg').onclick=e=>{ if(e.target.dataset.t) setType(e.target.dataset.t); };
  $('entryForm').onsubmit=submitEntry;
  $('fCancel').onclick=resetForm;
  $('dayList').onclick=e=>{ const ed=e.target.closest('[data-edit]'), dl=e.target.closest('[data-del]'); if(ed) startEdit(ed.dataset.edit); if(dl) deleteEntry(dl.dataset.del); };
  // chips: tap fills title + amount (amount stays editable)
  $('chipRow').onclick=e=>{
    const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.mgr) return openManager(formType);
    const p=listFor(formType).find(x=>x.id===b.dataset.pid); if(!p) return;
    $('fTitle').value=p.name; $('fAmount').value=p.amount; $('fAmount').focus(); $('fAmount').select();
  };
  // manage packages / expense items modal
  $('mgrForm').onsubmit=e=>{
    e.preventDefault();
    const name=$('mgrName').value.trim(), amount=parseFloat($('mgrAmount').value); if(!name||!(amount>=0)) return;
    const l=listFor(mgrType);
    if(mgrEditId){ const p=l.find(x=>x.id===mgrEditId); if(p){p.name=name;p.amount=amount;} } else l.push({id:uid(),name,amount});
    mgrEditId=null; $('mgrForm').reset(); savePresets(); renderManager(); renderChips();
  };
  $('mgrList').onclick=e=>{
    const ed=e.target.closest('[data-pe]'), dl=e.target.closest('[data-pd]');
    if(ed){ const p=listFor(mgrType).find(x=>x.id===ed.dataset.pe); if(p){ mgrEditId=p.id; $('mgrName').value=p.name; $('mgrAmount').value=p.amount; renderManager(); $('mgrName').focus(); } }
    if(dl) ask('Delete this saved item? Existing entries are not affected.',()=>{ const k=mgrType==='income'?'packages':'items'; state.presets[k]=state.presets[k].filter(x=>x.id!==dl.dataset.pd); mgrEditId=null; savePresets(); renderManager(); renderChips(); });
  };
  $('mgrCancel').onclick=()=>{ mgrEditId=null; $('mgrForm').reset(); renderManager(); };
  $('mgrClose').onclick=closeManager;
  $('mgrOv').onclick=e=>{ if(e.target.id==='mgrOv') closeManager(); };
  // confirm dialog
  $('confNo').onclick=closeConf;
  $('confYes').onclick=()=>{ const cb=confCb; closeConf(); if(cb) cb(); };
}
