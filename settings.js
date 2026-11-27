/* =========================================================
   js/settings.js — SETTINGS view: editable Profile (persisted).
   Subscription + Privacy Policy text live in index.html.
   ========================================================= */
import { state, saveProfile, loadProfile } from './storage.js';
import { $ } from './calc.js';

/* ===== 1. SHOW PROFILE (header line on Home + sidebar footer) ===== */
export function renderProfile(){
  const l=[state.profile.name,state.profile.title].filter(Boolean).join(' · ');
  $('profileLine').textContent=l; $('sideProfile').textContent=l;
}

/* ===== 2. LOAD + WIRE (called once from app.js) ===== */
export function initSettings(){
  loadProfile(); renderProfile();
  $('pName').value=state.profile.name; $('pTitle').value=state.profile.title;
  $('pSave').onclick=()=>{
    state.profile={name:$('pName').value.trim(),title:$('pTitle').value.trim()};
    saveProfile(); renderProfile();
    $('pStatus').textContent='Saved ✓'; setTimeout(()=>$('pStatus').textContent='',2000);
  };
}
