/* =========================================================
   js/storage.js — Shared app state + ALL localStorage access.
   Demo and Live data live under separate keys (never mixed).
   ========================================================= */
import { uid, ymd } from './calc.js';

/* ===== 1. KEYS (unchanged from the single-file version) ===== */
export const KEYS = { demo:'salonledger_demo_v1', live:'salonledger_live_v1' };
export const PRESET_KEYS = { demo:'salonledger_demo_presets_v1', live:'salonledger_live_presets_v1' };
export const MODE_KEY = 'salonledger_mode_v1';
export const VIEW_KEY = 'salonledger_view_v1';
export const PROFILE_KEY = 'salonledger_profile_v1';

/* ===== 2. SHARED STATE (imported & mutated by other modules) ===== */
const firstOfMonth = () => { const d=new Date(); d.setDate(1); return d; };
export const state = {
  mode:'demo',
  entries:[],
  presets:{ packages:[], items:[] },
  period:'this',
  view:firstOfMonth(),      // month shown on the Home calendar
  sumView:firstOfMonth(),   // month shown on Month Summary
  profile:{ name:'', title:'' }
};

/* ===== 3. DEMO DATA GENERATOR (last 6 months, deterministic) ===== */
export function makeDemo(){
  let s=7; const r=()=>(s=(s*16807)%2147483647)/2147483647;
  const out=[], t=new Date(), svc=['Haircut','Beard Trim','Hair Colour','Facial','Bridal Package'];
  for(let m=5;m>=0;m--){
    const base=new Date(t.getFullYear(),t.getMonth()-m,1);
    const dim=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
    const last=m===0?t.getDate():dim;
    for(let d=1;d<=last;d++){
      const dt=new Date(base.getFullYear(),base.getMonth(),d);
      if(dt.getDay()===1) continue;                       // closed on Mondays
      const n=1+Math.floor(r()*3);
      for(let i=0;i<n;i++){ const k=Math.floor(r()*svc.length);
        out.push({id:uid(),date:ymd(dt),type:'income',title:svc[k],amount:Math.round((700+r()*1800)*(1+k*.25)/50)*50,note:''}); }
    }
    [['Rent',40000,1],['Electricity',8000+Math.round(r()*3000),5],['Water',2500,6],['Supplies',12000+Math.round(r()*5000),10],['Salaries',38000,Math.min(28,last)]]
      .forEach(([title,amount,day])=>{ if(day<=last) out.push({id:uid(),date:ymd(new Date(base.getFullYear(),base.getMonth(),day)),type:'expense',title,amount,note:''}); });
  }
  return out;
}

/* ===== 4. ENTRIES (active mode) ===== */
export function loadEntries(){
  try{ const r=localStorage.getItem(KEYS[state.mode]); if(r) return JSON.parse(r); }catch(e){}
  return state.mode==='demo' ? makeDemo() : [];
}
export function saveEntries(){ try{ localStorage.setItem(KEYS[state.mode],JSON.stringify(state.entries)); }catch(e){} }

/* ===== 5. SAVED PACKAGES & EXPENSE ITEMS (Demo starters only; Live starts clean) ===== */
export function defaultPresets(){
  if(state.mode!=='demo') return {packages:[],items:[]};
  const p=(name,amount)=>({id:uid(),name,amount});
  return {packages:[p('Haircut',500),p('Hair + Beard',800),p('Head Massage',600),p('Facial',1500)],
          items:[p('Rent',40000),p('Electricity',9000),p('Water',2500),p('Blades & Supplies',12000),p('Salaries',38000)]};
}
export function loadPresets(){
  try{ const r=localStorage.getItem(PRESET_KEYS[state.mode]); if(r){ const p=JSON.parse(r); return {packages:p.packages||[],items:p.items||[]}; } }catch(e){}
  return defaultPresets();
}
export function savePresets(){ try{ localStorage.setItem(PRESET_KEYS[state.mode],JSON.stringify(state.presets)); }catch(e){} }

/* Load + persist entries & presets for the active mode (used at start-up and on mode switch) */
export function loadActiveData(){ state.entries=loadEntries(); saveEntries(); state.presets=loadPresets(); savePresets(); }

/* ===== 6. MODE, LAST VIEW, PROFILE ===== */
export function loadModePref(){ try{ const m=localStorage.getItem(MODE_KEY); if(m==='demo'||m==='live') state.mode=m; }catch(e){} }
export function saveModePref(){ try{ localStorage.setItem(MODE_KEY,state.mode); }catch(e){} }
export function loadView(){ try{ const v=localStorage.getItem(VIEW_KEY); if(['home','summary','settings'].includes(v)) return v; }catch(e){} return 'home'; }
export function saveView(v){ try{ localStorage.setItem(VIEW_KEY,v); }catch(e){} }
export function loadProfile(){ try{ const r=JSON.parse(localStorage.getItem(PROFILE_KEY)); if(r) state.profile={name:r.name||'',title:r.title||''}; }catch(e){} }
export function saveProfile(){ try{ localStorage.setItem(PROFILE_KEY,JSON.stringify(state.profile)); }catch(e){} }
