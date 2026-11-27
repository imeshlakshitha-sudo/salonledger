/* =========================================================
   js/app.js — ENTRY POINT. Boots the app and wires navigation.
   Import order: storage/calc (data) -> views (dashboard, summary, settings).
   ========================================================= */
import { state, loadModePref, loadActiveData, loadView, saveView } from './storage.js';
import { $, latestMonth } from './calc.js';
import { initDashboard, renderDashboard, resizeCharts } from './dashboard.js';
import { initSummary, renderSummary } from './summary.js';
import { initSettings } from './settings.js';

/* ===== 1. NAVIGATION (Home / Month Summary / Settings) ===== */
function showView(v){
  ['home','summary','settings'].forEach(n=>$('view-'+n).classList.toggle('active',n===v));
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
  saveView(v);
  if(v==='home'){ renderDashboard(); resizeCharts(); }
  if(v==='summary') renderSummary();
  window.scrollTo(0,0);
}

/* ===== 2. START-UP ===== */
function init(){
  const Chart=window.Chart;
  if(typeof Chart!=='undefined'){ Chart.defaults.color='#94A3B8'; Chart.defaults.font.family="'Plus Jakarta Sans','Inter',system-ui,sans-serif"; }
  loadModePref();            // remembered Demo/Live choice
  loadActiveData();          // entries + presets for the active mode
  initDashboard(); initSummary(); initSettings();
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  state.sumView=latestMonth(state.entries);
  showView(loadView());      // reopen the last used tab
}
init();
