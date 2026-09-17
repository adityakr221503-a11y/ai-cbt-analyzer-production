(function(){
"use strict";

function hideLegacy(){
  ["rfConnectedShell","rfFeatureDrawer","revisionSheet","rankersTestSeriesDashboard"]
    .forEach(function(id){var e=document.getElementById(id);if(e)e.style.display="none";});
  document.querySelectorAll(".rf-quick,.rf-all").forEach(function(e){e.style.display="none";});
}

var phases=[
["🔵","PRE-TEST","Prepare → practise → revise → enter the test",
[
["📚","Question Bank","Rank Booster + NCERT-first practice","question-bank.html"],
["⚡","Adaptive DPP","Weak-topic targeted practice","ranker-command-center.html"],
["🎯","Topic / Chapter Practice","Focused concept practice","question-bank.html"],
["📖","Smart Revision","NCERT, formulas, reactions & key facts","ranker-revision/index.html"],
["🤖","AI Practice","New variations and focused practice","rankforge-ai-new-questions.html"],
["⏱️","Exam Strategy","Attempt, skip and time planning","ranker-command-center.html"]
]],
["🟣","TEST","Distraction-free serious CBT",
[
["🏆","Ranker Tests","Full Syllabus • Part Test • Subject Test • Custom","rankers-test-series.html"],
["📝","Full Syllabus","Complete-syllabus simulation","rankers-test-series.html"],
["📑","Part Test","Selected portions / units","rankers-test-series.html"],
["🧪","Subject Test","Physics • Chemistry • Biology","rankers-test-series.html"],
["⚙️","Custom Test","Choose your own configuration","rankers-test-series.html"]
]],
["🟢","POST-TEST","Every attempt becomes measurable improvement",
[
["📊","Result","Score • accuracy • time • attempts","analysis.html"],
["🧠","Analysis","Subject • chapter • topic • speed • accuracy","analysis.html"],
["🔍","Question Review","Understand correct, wrong and skipped","analysis.html"],
["📕","Mistake Book","Reason-based mistake intelligence","mistake.html"],
["🔄","Retry / Mastery","Retry mistakes until mastery","retry.html"],
["📈","Test History","Track improvement across attempts","history.html"]
]]
];

var support=[
["🤖","AI Mentor","Next-best action from your performance","ranker-command-center.html"],
["📖","Revision","Structured chapter-wise revision","ranker-revision/index.html"],
["🎯","720 Approach","Score-gap and target planning","ranker-command-center.html"],
["🧰","Tools","PDF → CBT • NICHOD • Reports","ranker-command-center.html"]
];

function card(x){
return '<a class="rfp-card" href="'+x[2]+'"><span class="rfp-icon">'+x[0]+
'</span><span class="rfp-title">'+x[1]+'<small>'+x[3]+'</small></span><b class="rfp-arrow">›</b></a>';
}

function render(){
if(document.getElementById("rankforgePremiumHomeV2"))return;
hideLegacy();

var root=document.createElement("section");
root.id="rankforgePremiumHomeV2";

root.innerHTML=
'<style>'+
'#rankforgePremiumHomeV2{max-width:980px;margin:18px auto 34px;padding:0 14px;color:#0f172a;font-family:Arial,sans-serif}'+
'.rfp-hero{padding:22px 20px;border-radius:24px;background:linear-gradient(135deg,#eef2ff,#fff);border:1px solid #dbe3ff;box-shadow:0 10px 30px rgba(15,23,42,.07);margin-bottom:18px}'+
'.rfp-brand{font-size:30px;font-weight:900;letter-spacing:-1px}.rfp-brand em{font-style:normal;opacity:.5}'+
'.rfp-tag{margin-top:6px;color:#64748b;font-size:14px;line-height:1.5}'+
'.rfp-flow{display:flex;gap:7px;flex-wrap:wrap;margin-top:15px}.rfp-flow span{padding:7px 10px;border-radius:999px;background:#fff;border:1px solid #dbe3ff;font-size:11px;font-weight:800}'+
'.rfp-section{margin:16px 0;padding:16px;border-radius:22px;background:#fff;border:1px solid rgba(100,116,139,.14);box-shadow:0 7px 24px rgba(15,23,42,.055)}'+
'.rfp-head{display:flex;align-items:center;gap:10px;margin-bottom:3px}.rfp-phase{font-size:25px}.rfp-head h2{margin:0;font-size:19px}.rfp-sub{margin:0 0 13px;color:#64748b;font-size:12px}'+
'.rfp-grid,.rfp-support{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}'+
'.rfp-card{position:relative;display:flex;align-items:center;gap:10px;min-height:65px;padding:12px 32px 12px 12px;text-decoration:none;color:inherit;border:1px solid #e5e7eb;border-radius:15px;background:#f8fafc;transition:.15s}'+
'.rfp-card:hover{transform:translateY(-1px);border-color:#a5b4fc;box-shadow:0 5px 16px rgba(15,23,42,.07)}'+
'.rfp-icon{font-size:22px}.rfp-title{font-size:13px;font-weight:800;line-height:1.35}.rfp-title small{display:block;margin-top:3px;color:#64748b;font-weight:500;font-size:11px}.rfp-arrow{position:absolute;right:12px;font-size:21px;opacity:.4}'+
'.rfp-note{margin-top:13px;padding:12px 13px;border-radius:14px;background:#f8fafc;border:1px dashed #cbd5e1;color:#475569;font-size:11px;line-height:1.55}'+
'@media(max-width:560px){.rfp-brand{font-size:25px}.rfp-grid,.rfp-support{grid-template-columns:1fr}.rfp-section{padding:13px}.rfp-hero{padding:19px 16px}}'+
'</style>'+
'<div class="rfp-hero"><div class="rfp-brand">🏆 RankForge <em>AI</em></div>'+
'<div class="rfp-tag">Topper-first learning system — prepare, test, analyse, fix, master and improve.</div>'+
'<div class="rfp-flow"><span>PREPARE</span><span>TEST</span><span>RESULT</span><span>ANALYSE</span><span>FIX</span><span>MASTER</span><span>RETEST</span></div></div>'+
phases.map(function(p){
return '<section class="rfp-section"><div class="rfp-head"><span class="rfp-phase">'+p[0]+
'</span><h2>'+p[1]+'</h2></div><p class="rfp-sub">'+p[2]+
'</p><div class="rfp-grid">'+p[3].map(card).join("")+'</div></section>';
}).join("")+
'<section class="rfp-section"><div class="rfp-head"><span class="rfp-phase">🧩</span><h2>SUPPORT SYSTEM</h2></div>'+
'<p class="rfp-sub">Always available without disturbing the main topper workflow.</p>'+
'<div class="rfp-support">'+support.map(card).join("")+'</div>'+
'<div class="rfp-note">PDF → CBT and NICHOD remain available as tools. Internal LIVE status, BUG labels, diagnostics, raw JSON, test IDs and duplicate navigation are hidden from the student interface.</div></section>';

var h=document.querySelector("header");
if(h&&h.parentNode)h.parentNode.insertBefore(root,h.nextSibling);
else document.body.prepend(root);
}

if(document.readyState==="loading")
document.addEventListener("DOMContentLoaded",render,{once:true});
else render();

window.RankForgePremiumHomeV2={render};
})();
