(function(){
"use strict";

function hideLegacy(){
  ["rfConnectedShell","rfFeatureDrawer","revisionSheet","rankersTestSeriesDashboard"]
    .forEach(function(id){
      var e=document.getElementById(id);
      if(e)e.style.display="none";
    });
  document.querySelectorAll(".rf-quick,.rf-all").forEach(function(e){
    e.style.display="none";
  });
}

var sections=[
["🏠","HOME","Today’s action — continue your preparation",[
["▶️","Continue","Resume your latest learning/test flow","ranker-command-center.html"],
["⚡","Adaptive DPP","Personalized weak-area practice","ranker-command-center.html"],
["🎯","Today’s #1 Action","Next focused action from your progress","ranker-command-center.html"],
["📈","Quick Progress","Accuracy • speed • consistency","analysis.html"]
]],

["📚","LEARN","Build concepts before chasing scores",[
["📖","NCERT Learning","NCERT-first chapter learning","ranker-revision/index.html"],
["🧠","Concepts","Concept-focused learning","question-bank.html"],
["📚","Subjects & Chapters","Subject → unit → chapter flow","question-bank.html"],
["🔄","Smart Revision","Formulas • reactions • key facts","ranker-revision/index.html"],
["📕","Notes","Keep revision material organized","ranker-revision/index.html"],
["🤖","AI Learning","AI-assisted explanations and learning","rankforge-ai-new-questions.html"]
]],

["✍️","PRACTICE","Targeted practice that improves weak areas",[
["🎯","Topic Practice","Focused concept practice","question-bank.html"],
["📚","Chapter Practice","Chapter-wise question sets","question-bank.html"],
["🧠","Weak Area Practice","Practice detected weak concepts","question-bank.html"],
["🔀","Mixed Concepts","Cross-concept application","question-bank.html"],
["⏱️","Speed Practice","Accuracy under time pressure","question-bank.html"],
["🔥","Exam-Level Practice","NEET and rank-booster level","question-bank.html"],
["🏆","Rank Booster Question Bank","NCERT-first topper-level practice","question-bank.html"],
["⚡","Adaptive DPP","Personalized 15/20-question practice","ranker-command-center.html"],
["🤖","AI Practice","Fresh variations and focused practice","rankforge-ai-new-questions.html"]
]],

["🏆","TESTS","Serious, distraction-free CBT experience",[
["🏆","Ranker Test Series","Ranker-level full/part/subject tests","rankers-test-series.html"],
["💎","Topper Test 180","Protected 180-question full test","rankers-test-series.html"],
["📑","Part Tests","Selected portions and units","rankers-test-series.html"],
["🧪","Subject Tests","Physics • Chemistry • Biology","rankers-test-series.html"],
["📝","Full Syllabus","Complete-syllabus simulation","rankers-test-series.html"],
["⚙️","Custom Test","Choose your own configuration","rankers-test-series.html"],
["📄","PDF → CBT","Import PDF questions into an independent CBT","pdf-to-cbt.html"]
]],

["📊","PROGRESS","Turn every attempt into measurable improvement",[
["📈","Performance","Score • accuracy • speed • consistency","analysis.html"],
["🧠","Mastery","Concept mastery and retention","analysis.html"],
["🎯","Weak Areas","Priority concepts needing work","mistake.html"],
["📕","Mistake Book","Reason-based mistake tracking","mistake.html"],
["🔄","Retests","Retry and prove improvement","retry.html"],
["🚀","Improvement","Track growth across attempts","analysis.html"],
["🗂️","Test History","All completed test attempts","history.html"]
]]
];

var support=[
["🤖","AI Mentor","Next-best study action","ranker-command-center.html"],
["📖","Revision","Structured revision","ranker-revision/index.html"],
["🎯","720 Approach","Target and score planning","ranker-command-center.html"],
["🧰","Tools","Additional study utilities","ranker-command-center.html"]
];

function card(x){
  return '<a class="rfp-card" href="'+x[3]+'">'+
    '<span class="rfp-icon">'+x[0]+'</span>'+
    '<span class="rfp-title">'+x[1]+'<small>'+x[2]+'</small></span>'+
    '<b class="rfp-arrow">›</b></a>';
}

function render(){
  if(document.getElementById("rankforgePremiumHomeV3"))return;

  hideLegacy();

  var root=document.createElement("section");
  root.id="rankforgePremiumHomeV3";

  root.innerHTML=
  '<style>'+
  '#rankforgePremiumHomeV3{max-width:980px;margin:14px auto 34px;padding:0 14px;color:#0f172a;font-family:Arial,sans-serif}'+
  '.rfp-hero{padding:20px;border-radius:24px;background:linear-gradient(135deg,#eef2ff,#fff);border:1px solid #dbe3ff;box-shadow:0 10px 30px rgba(15,23,42,.07);margin-bottom:14px}'+
  '.rfp-brand{font-size:29px;font-weight:900;letter-spacing:-1px}.rfp-brand em{font-style:normal;opacity:.5}'+
  '.rfp-tag{margin-top:5px;color:#64748b;font-size:13px;line-height:1.5}'+
  '.rfp-flow{display:flex;gap:6px;flex-wrap:wrap;margin-top:13px}'+
  '.rfp-flow span{padding:6px 9px;border-radius:999px;background:#fff;border:1px solid #dbe3ff;font-size:10px;font-weight:800}'+
  '.rfp-section{margin:13px 0;padding:14px;border-radius:21px;background:#fff;border:1px solid rgba(100,116,139,.14);box-shadow:0 6px 22px rgba(15,23,42,.05)}'+
  '.rfp-head{display:flex;align-items:center;gap:9px;margin-bottom:2px}'+
  '.rfp-phase{font-size:23px}.rfp-head h2{margin:0;font-size:18px}'+
  '.rfp-sub{margin:0 0 11px;color:#64748b;font-size:11px}'+
  '.rfp-grid,.rfp-support{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}'+
  '.rfp-card{position:relative;display:flex;align-items:center;gap:9px;min-height:58px;padding:10px 30px 10px 11px;text-decoration:none;color:inherit;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc}'+
  '.rfp-icon{font-size:20px}.rfp-title{font-size:12px;font-weight:800;line-height:1.3}'+
  '.rfp-title small{display:block;margin-top:2px;color:#64748b;font-weight:500;font-size:10px}'+
  '.rfp-arrow{position:absolute;right:11px;font-size:20px;opacity:.35}'+
  '.rfp-note{margin-top:11px;padding:10px 12px;border-radius:13px;background:#f8fafc;border:1px dashed #cbd5e1;color:#475569;font-size:10px;line-height:1.5}'+
  '@media(max-width:560px){.rfp-brand{font-size:25px}.rfp-grid,.rfp-support{grid-template-columns:1fr}.rfp-section{padding:12px}.rfp-hero{padding:18px 15px}}'+
  '</style>'+

  '<div class="rfp-hero">'+
    '<div class="rfp-brand">🏆 RankForge <em>AI</em></div>'+
    '<div class="rfp-tag">Premium student-first learning system — clear action, focused practice and measurable improvement.</div>'+
    '<div class="rfp-flow">'+
      '<span>LEARN</span><span>PRACTICE</span><span>TEST</span><span>ANALYSE</span>'+
      '<span>FIX</span><span>MASTER</span><span>RETEST</span>'+
    '</div>'+
  '</div>'+

  sections.map(function(p){
    return '<section class="rfp-section">'+
      '<div class="rfp-head"><span class="rfp-phase">'+p[0]+'</span><h2>'+p[1]+'</h2></div>'+
      '<p class="rfp-sub">'+p[2]+'</p>'+
      '<div class="rfp-grid">'+p[3].map(card).join("")+'</div>'+
    '</section>';
  }).join("")+

  '<section class="rfp-section">'+
    '<div class="rfp-head"><span class="rfp-phase">🧩</span><h2>SUPPORT</h2></div>'+
    '<p class="rfp-sub">Helpful tools without cluttering the main journey.</p>'+
    '<div class="rfp-support">'+support.map(card).join("")+'</div>'+
    '<div class="rfp-note">Internal intelligence stays in the background. Student-facing navigation stays focused and clean.</div>'+
  '</section>';

  var h=document.querySelector("header");

  if(h&&h.parentNode)
    h.parentNode.insertBefore(root,h.nextSibling);
  else
    document.body.prepend(root);
}

if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded",render,{once:true});
else
  render();

window.RankForgePremiumHomeV3={render};

})();
