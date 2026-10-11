/* Ranker Pro V313 — Mentor Automatic Recovery Loop */
(function(){
  'use strict';
  const KEY='rankerProMentorRecoveryLoopV1';
  const HISTORY='cbtHistory';
  const EVIDENCE='rankerProMentorExecutionEvidenceV1';

  function read(k,d){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d));}catch(e){return d;}}
  function save(k,v){localStorage.setItem(k,JSON.stringify(v));}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
  function history(){
    const h=read(HISTORY,[]);
    return Array.isArray(h)?h:[];
  }
  function score(x){
    if(!x||typeof x!=='object') return null;
    return num(x.accuracy ?? x.scorePercent ?? x.percentage ?? x.percent);
  }
  function latestTwo(){
    const h=history().map((x,i)=>({x,i,s:score(x)})).filter(a=>a.s!==null);
    if(!h.length) return {latest:null,previous:null};
    return {latest:h[h.length-1],previous:h.length>1?h[h.length-2]:null};
  }
  function evidence(){return read(EVIDENCE,{status:'PENDING'});}
  function state(){
    const e=evidence(), old=read(KEY,{});
    const t=latestTwo();
    let s=old.status||'WAITING';
    let reason=old.reason||'No verified action yet.';
    let action=old.action||'Start an evidence loop from Mentor Execution Evidence.';
    if(e.status==='IN_PROGRESS' && t.latest){
      const baseline=num(e.baselineAccuracy);
      if(baseline!==null){
        const d=t.latest.s-baseline;
        if(d>=5){s='RECOVERED';reason=`Accuracy improved by ${d.toFixed(1)} points after the action.`;action='Lock the improvement with one transfer test.';}
        else if(d<=-5){s='RECOVERY_NEEDED';reason=`Accuracy moved ${Math.abs(d).toFixed(1)} points lower; the weakness needs another repair cycle.`;action='Repeat the weakest-topic repair, then retest.';}
        else {s='MONITOR';reason=`Change is ${d.toFixed(1)} points; improvement is not yet conclusive.`;action='Keep the same repair action and retest once more.';}
      }
    }
    const out={status:s,reason,action,updatedAt:Date.now(),latestAccuracy:t.latest?t.latest.s:null};
    save(KEY,out); return out;
  }
  function render(){
    const box=document.getElementById('mentorRecoveryLoopV313');
    if(!box) return;
    const s=state();
    const cls=s.status==='RECOVERED'?'VERIFIED':(s.status==='RECOVERY_NEEDED'?'REPLAN':'MONITOR');
    box.innerHTML='<div class="row"><div><strong>🔁 Mentor Automatic Recovery Loop</strong><div class="muted small">'+s.reason+'</div></div><span class="chip">'+cls+'</span></div><div class="muted small" style="margin-top:8px"><b>Next:</b> '+s.action+'</div>';
  }
  function mount(){
    if(document.getElementById('mentorRecoveryLoopV313')) return;
    const anchor=document.getElementById('mentorEvidenceStatus')?.closest('section') || document.querySelector('.panel:last-of-type') || document.body;
    const el=document.createElement('section');
    el.id='mentorRecoveryLoopV313'; el.className='panel'; el.style.marginTop='12px';
    el.innerHTML='<div class="muted small">Evaluating mentor recovery state…</div>';
    if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(el,anchor.nextSibling); else document.body.appendChild(el);
    render();
  }
  document.addEventListener('DOMContentLoaded',mount);
  window.RankerProMentorRecoveryV313={state,render};
})();
