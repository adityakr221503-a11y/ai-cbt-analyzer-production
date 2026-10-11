(function(){
"use strict";

const FLOW = {
  rankers: "rankers-test-series.html",
  bank: "question-bank.html",
  pdf: "pdf-to-cbt.html",
  biology: "biology360/index.html",
  mistake: "mistake.html",
  retry: "retry.html",
  history: "history.html",
  analysis: "analysis.html",
  orbit: "orbit-test-analysis.html"
};

function has(v){
  return typeof v === "string" && v.trim() !== "";
}

function safeJSON(key){
  try{
    const x=JSON.parse(localStorage.getItem(key)||"null");
    return x;
  }catch(e){
    return null;
  }
}

function go(url){
  window.location.href=url;
}

function startRankers(){
  go(FLOW.rankers);
}

function startBank(){
  go(FLOW.bank);
}

function startPDF(){
  go(FLOW.pdf);
}

function startBiology(){
  go(FLOW.biology);
}

function openMistakes(){
  go(FLOW.mistake);
}

function openRetry(){
  go(FLOW.retry);
}

function openHistory(){
  go(FLOW.history);
}

function openAnalysis(){
  go(FLOW.analysis);
}

function openOrbit(){
  go(FLOW.orbit);
}

/* -------------------------------------------------------
   COMMON FLOW STATE
------------------------------------------------------- */

function getFlowState(){
  const history=safeJSON("cbtHistory");
  const sessions=safeJSON("cbtTestSessions");
  const retry=safeJSON("cbtRetryQuestion");
  const mistakes=safeJSON("cbtAnalyzer.retryQueue");
  const mastery=safeJSON("cbtMasteryV2");
  const pdf=safeJSON("pdfCbtQuestions");
  const ranker=safeJSON("rankBoosterQuestionBankV1");

  return {
    history:Array.isArray(history)?history:[],
    sessions:Array.isArray(sessions)?sessions:[],
    retry,
    retryQueue:Array.isArray(mistakes)?mistakes:[],
    mastery:Array.isArray(mastery)?mastery:[],
    pdf:Array.isArray(pdf)?pdf:[],
    ranker:Array.isArray(ranker)?ranker:[]
  };
}

/* -------------------------------------------------------
   BASIC STATUS
------------------------------------------------------- */

function getStatus(){
  const s=getFlowState();

  return {
    tests:s.history.length+s.sessions.length,
    rankerQuestions:s.ranker.length,
    pdfQuestions:s.pdf.length,
    retryReady:!!s.retry,
    retryQueue:s.retryQueue.length,
    mastery:s.mastery.length
  };
}

/* -------------------------------------------------------
   DASHBOARD QUICK ACTIONS
------------------------------------------------------- */

function mount(){
  if(document.getElementById("basicBackboneActionsV1"))
    return;

  const host=
    document.getElementById("basicFeatureHubV1") ||
    document.querySelector(".container") ||
    document.body;

  if(!host)return;

  const box=document.createElement("section");
  box.id="basicBackboneActionsV1";
  box.className="card";

  box.innerHTML=
    '<h2>🎯 Start Learning</h2>'+
    '<p style="color:#64748b">'+
      'Direct entry into the complete CBT learning flow.'+
    '</p>'+
    '<div class="basic-backbone-grid">'+
      '<button data-basic-flow="rankers">👑 Start Test</button>'+
      '<button data-basic-flow="bank">🏆 Practice Questions</button>'+
      '<button data-basic-flow="pdf">📄 Convert PDF → CBT</button>'+
      '<button data-basic-flow="biology">🧬 Biology 360°</button>'+
      '<button data-basic-flow="mistake">🔁 Mistake Bank</button>'+
      '<button data-basic-flow="retry">🎯 Retry</button>'+
      '<button data-basic-flow="history">📊 Test History</button>'+
      '<button data-basic-flow="analysis">📈 Analysis</button>'+
      '<button data-basic-flow="orbit">🌐 Orbit Analysis</button>'+
    '</div>'+
    '<div id="basicBackboneStatusV1" '+
      'style="margin-top:13px;color:#64748b;font-size:13px">'+
    '</div>';

  host.appendChild(box);

  updateStatus();
}

function updateStatus(){
  const el=document.getElementById("basicBackboneStatusV1");
  if(!el)return;

  const s=getStatus();

  el.innerHTML=
    "Tests: <b>"+s.tests+"</b> • "+
    "Ranker Questions: <b>"+s.rankerQuestions+"</b> • "+
    "PDF Questions: <b>"+s.pdfQuestions+"</b> • "+
    "Retry Queue: <b>"+s.retryQueue+"</b> • "+
    "Mastered: <b>"+s.mastery+"</b>";
}

document.addEventListener("click",function(e){
  const b=e.target.closest("[data-basic-flow]");
  if(!b)return;

  const type=b.getAttribute("data-basic-flow");

  if(type==="rankers")startRankers();
  if(type==="bank")startBank();
  if(type==="pdf")startPDF();
  if(type==="biology")startBiology();
  if(type==="mistake")openMistakes();
  if(type==="retry")openRetry();
  if(type==="history")openHistory();
  if(type==="analysis")openAnalysis();
  if(type==="orbit")openOrbit();
});

const style=document.createElement("style");
style.textContent=`
.basic-backbone-grid{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:10px;
margin-top:13px;
}

.basic-backbone-grid button{
width:100%;
padding:13px;
border:0;
border-radius:11px;
background:#172033;
color:#fff;
font-weight:800;
cursor:pointer;
}

@media(max-width:700px){
.basic-backbone-grid{
grid-template-columns:repeat(2,1fr);
}
}

@media(max-width:450px){
.basic-backbone-grid{
grid-template-columns:1fr;
}
}
`;
document.head.appendChild(style);

window.CBTBasicTestingBackbone={
  FLOW,
  getFlowState,
  getStatus,
  startRankers,
  startBank,
  startPDF,
  startBiology,
  openMistakes,
  openRetry,
  openHistory,
  openAnalysis,
  openOrbit
};

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",mount);
}else{
  mount();
}

setTimeout(mount,500);
setTimeout(updateStatus,1500);

})();
