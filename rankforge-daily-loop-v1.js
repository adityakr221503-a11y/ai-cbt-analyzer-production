(function(){
"use strict";

const LOOP_KEY="rankforgeDailyLoopV1";
const MENTOR_KEY="rankforgeMentorDecisionV1";
const DPP_KEY="rankforgeAdaptiveDPPV1";
const INTEL_KEY="rankforgeDPPIntelligenceV1";
const HISTORY_KEY="cbtHistory";
const MISTAKE_KEY="rankforgeMistakesV1";

function read(k,f){
  try{
    const x=localStorage.getItem(k);
    return x?JSON.parse(x):f;
  }catch(e){return f;}
}

function write(k,v){
  try{
    localStorage.setItem(k,JSON.stringify(v));
    return true;
  }catch(e){return false;}
}

function arr(x){return Array.isArray(x)?x:[];}
function s(x){return String(x==null?"":x).trim();}
function now(){return Date.now();}

function today(){
  const d=new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

function getMentor(){
  return read(MENTOR_KEY,null);
}

function getDPP(){
  return read(DPP_KEY,null);
}

function getIntel(){
  const x=read(INTEL_KEY,[]);
  if(Array.isArray(x))return x;
  if(x&&Array.isArray(x.history))return x.history;
  return [];
}

function getHistory(){
  const x=read(HISTORY_KEY,[]);
  if(Array.isArray(x))return x;
  if(x&&Array.isArray(x.tests))return x.tests;
  if(x&&Array.isArray(x.history))return x.history;
  return [];
}

function getMistakes(){
  const x=read(MISTAKE_KEY,[]);
  if(Array.isArray(x))return x;
  if(x&&Array.isArray(x.mistakes))return x.mistakes;
  return [];
}

function currentState(){
  return read(LOOP_KEY,{
    date:today(),
    status:"pending",
    startedAt:null,
    completedAt:null,
    action:null,
    result:null,
    cycle:0
  });
}

function normalizeAction(a){
  if(!a)return null;

  return {
    title:s(a.title)||"Adaptive practice",
    topic:s(a.topic)||"Mixed Weak Areas",
    size:Number(a.size)||15,
    difficulty:s(a.difficulty)||"medium",
    priority:s(a.priority)||"practice",
    reason:s(a.reason)||"Based on your latest evidence."
  };
}

function createDailyAction(){
  const mentor=normalizeAction(getMentor());

  if(mentor){
    return mentor;
  }

  const dpp=getDPP();

  return {
    title:"Take an adaptive DPP",
    topic:"Mixed Weak Areas",
    size:15,
    difficulty:"medium",
    priority:"baseline",
    reason:dpp
      ?"Continue building performance evidence."
      :"No mentor decision is available yet."
  };
}

function ensureToday(){
  let state=currentState();

  if(state.date!==today()){
    state={
      date:today(),
      status:"pending",
      startedAt:null,
      completedAt:null,
      action:createDailyAction(),
      result:null,
      cycle:(Number(state.cycle)||0)+1
    };
    write(LOOP_KEY,state);
    return state;
  }

  if(!state.action){
    state.action=createDailyAction();
    write(LOOP_KEY,state);
  }

  return state;
}

function start(){
  const state=ensureToday();

  state.status="started";
  state.startedAt=now();
  state.action=createDailyAction();

  write(LOOP_KEY,state);

  try{
    if(
      window.RankForgeAdaptiveDPPV1 &&
      typeof window.RankForgeAdaptiveDPPV1.start==="function"
    ){
      window.RankForgeAdaptiveDPPV1.start(
        state.action.size,
        state.action.difficulty,
        state.action.topic
      );
      return state;
    }
  }catch(e){}

  location.href="question-bank.html?mode=adaptive-dpp";
  return state;
}

function latestHistoryItem(){
  const h=getHistory();
  return h.length?h[h.length-1]:null;
}

function isRelevantResult(t,state){
  if(!t)return false;

  const title=s(
    t.title||
    t.testTitle||
    t.testName||
    t.name
  ).toLowerCase();

  const source=s(
    t.source||
    t.testSource||
    t.mode
  ).toLowerCase();

  const id=s(
    t.id||
    t.testId||
    t.sessionId||
    t.attemptId
  );

  const actionTopic=s(state.action&&state.action.topic).toLowerCase();

  return (
    source.includes("adaptive")||
    source.includes("rankforge")||
    title.includes("adaptive dpp")||
    title.includes("rankforge")||
    id.includes("RF-DPP")||
    actionTopic && title.includes(actionTopic)
  );
}

function calculateCompletion(state){
  const latest=latestHistoryItem();

  if(!latest||!isRelevantResult(latest,state)){
    return {
      completed:false,
      result:null
    };
  }

  const total=Number(
    latest.totalQuestions||
    latest.questionCount||
    latest.total||
    (Array.isArray(latest.questions)?latest.questions.length:0)
  )||0;

  const correct=Number(
    latest.correct||
    latest.correctCount
  )||0;

  const wrong=Number(
    latest.wrong||
    latest.wrongCount
  )||0;

  const unanswered=Number(
    latest.unanswered||
    latest.skipped
  )||0;

  let accuracy=Number(
    latest.accuracy||
    latest.percentage||
    latest.scorePercent
  )||0;

  if(!accuracy&&total){
    accuracy=Math.round(correct/total*100);
  }

  return {
    completed:true,
    result:{
      testId:s(latest.id||latest.testId||latest.sessionId),
      total:total,
      correct:correct,
      wrong:wrong,
      unanswered:unanswered,
      accuracy:accuracy,
      completedAt:now()
    }
  };
}

function refresh(){
  let state=ensureToday();

  if(state.status==="started"){
    const completion=calculateCompletion(state);

    if(completion.completed){
      state.status="completed";
      state.completedAt=completion.result.completedAt;
      state.result=completion.result;

      write(LOOP_KEY,state);

      /*
       * Give the existing intelligence/mentor engines time
       * to process the newly written CBT result.
       */
      setTimeout(function(){
        try{
          if(
            window.RankForgeDPPIntelligenceV1 &&
            typeof window.RankForgeDPPIntelligenceV1.processLatest==="function"
          ){
            window.RankForgeDPPIntelligenceV1.processLatest();
          }
        }catch(e){}

        setTimeout(function(){
          try{
            if(
              window.RankForgeMentorDecisionV1 &&
              typeof window.RankForgeMentorDecisionV1.decide==="function"
            ){
              window.RankForgeMentorDecisionV1.decide();
            }
          }catch(e){}
        },300);
      },300);
    }
  }

  return state;
}

function progress(){
  const state=refresh();

  if(state.status==="completed"){
    return {
      state:state,
      label:"Completed",
      progress:100
    };
  }

  if(state.status==="started"){
    return {
      state:state,
      label:"In progress",
      progress:50
    };
  }

  return {
    state:state,
    label:"Ready",
    progress:0
  };
}

function render(){
  const path=location.pathname.toLowerCase();

  // Daily Loop is a command-center component, not a second dashboard action card.
  if(
    !path.includes("ranker-command-center")
  )return;

  const state=refresh();
  const action=state.action||createDailyAction();

  const old=document.getElementById("rankforgeDailyLoopV1");
  if(old)old.remove();

  const panel=document.createElement("section");
  panel.id="rankforgeDailyLoopV1";

  let statusText="Ready for today";
  if(state.status==="started")statusText="Action in progress";
  if(state.status==="completed")statusText="Today's action completed";

  panel.innerHTML=
    '<div class="rdl-head">'+
      '<div>'+
        '<div class="rdl-label">RANKFORGE DAILY LOOP</div>'+
        '<div class="rdl-title">📅 '+statusText+'</div>'+
      '</div>'+
      '<div class="rdl-day">'+
        escapeHTML(state.date)+
      '</div>'+
    '</div>'+

    '<div class="rdl-action">'+
      '<small>AI PRIORITY</small>'+
      '<strong>'+escapeHTML(action.title)+'</strong>'+
      '<span>'+escapeHTML(action.topic)+'</span>'+
    '</div>'+

    '<div class="rdl-grid">'+
      '<div><small>SIZE</small><b>'+action.size+'Q</b></div>'+
      '<div><small>LEVEL</small><b>'+escapeHTML(action.difficulty)+'</b></div>'+
      '<div><small>STATUS</small><b>'+escapeHTML(state.status)+'</b></div>'+
    '</div>'+

    '<div class="rdl-reason">'+
      '<small>WHY THIS ACTION</small>'+
      '<p>'+escapeHTML(action.reason)+'</p>'+
    '</div>'+

    (
      state.result
      ?
      '<div class="rdl-result">'+
        '<small>RESULT FED BACK INTO AI</small>'+
        '<strong>'+
          state.result.accuracy+
          '% accuracy · '+
          state.result.correct+
          '/'+
          state.result.total+
        '</strong>'+
      '</div>'
      :
      ''
    )+

    (
      state.status!=="completed"
      ?
      '<button id="rdlStart">'+
        (state.status==="started"
          ?"Continue Recommended Action"
          :"Start Today’s Action")+
      '</button>'
      :
      '<button id="rdlRefresh">Recalculate Next Action</button>'
    );

  const css=document.createElement("style");
  css.id="rankforgeDailyLoopV1CSS";
  css.textContent=
`#rankforgeDailyLoopV1{
margin:18px 0;
padding:20px;
border:1px solid #dbe3ee;
border-radius:22px;
background:#fff;
box-shadow:0 8px 28px rgba(15,23,42,.08);
position:relative;
z-index:95;
}
.rdl-head{
display:flex;
justify-content:space-between;
align-items:center;
gap:12px;
}
.rdl-label{
font-size:9px;
font-weight:900;
letter-spacing:1.5px;
color:#64748b;
}
.rdl-title{
font-size:20px;
font-weight:900;
margin-top:4px;
}
.rdl-day{
font-size:10px;
font-weight:800;
color:#64748b;
}
.rdl-action{
margin-top:16px;
padding:15px;
border-radius:15px;
background:#f8fafc;
}
.rdl-action small,
.rdl-reason small,
.rdl-result small{
display:block;
font-size:9px;
font-weight:900;
color:#64748b;
}
.rdl-action strong{
display:block;
font-size:16px;
margin-top:5px;
}
.rdl-action span{
display:block;
font-size:12px;
color:#64748b;
margin-top:4px;
}
.rdl-grid{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:8px;
margin-top:10px;
}
.rdl-grid div{
padding:10px;
text-align:center;
border-radius:12px;
background:#f8fafc;
}
.rdl-grid b{
display:block;
font-size:13px;
margin-top:4px;
text-transform:uppercase;
}
.rdl-grid small{
font-size:9px;
font-weight:900;
color:#64748b;
}
.rdl-reason,
.rdl-result{
margin-top:10px;
padding:12px;
border-radius:13px;
background:#f8fafc;
}
.rdl-reason p{
margin:5px 0 0;
font-size:12px;
line-height:1.45;
color:#475569;
}
.rdl-result strong{
display:block;
margin-top:5px;
font-size:14px;
}
#rdlStart,
#rdlRefresh{
width:100%;
margin-top:12px;
padding:13px 16px;
border:0;
border-radius:13px;
font-weight:800;
cursor:pointer;
}
@media(max-width:520px){
.rdl-title{font-size:18px}
.rdl-grid{grid-template-columns:repeat(3,1fr)}
}`;

  if(!document.getElementById("rankforgeDailyLoopV1CSS")){
    document.head.appendChild(css);
  }

  const target=
    document.querySelector("main")||
    document.querySelector(".container")||
    document.body;

  target.insertBefore(panel,target.firstChild);

  const start=document.getElementById("rdlStart");

  if(start){
    start.addEventListener("click",start);
  }

  const refreshButton=document.getElementById("rdlRefresh");

  if(refreshButton){
    refreshButton.addEventListener("click",function(){
      try{
        if(
          window.RankForgeMentorDecisionV1 &&
          typeof window.RankForgeMentorDecisionV1.decide==="function"
        ){
          window.RankForgeMentorDecisionV1.decide();
        }
      }catch(e){}
      location.reload();
    });
  }
}

function escapeHTML(x){
  return s(x)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

window.RankForgeDailyLoopV1={
  getState:ensureToday,
  start:start,
  refresh:refresh,
  progress:progress
};

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",render);
}else{
  render();
}

setInterval(function(){
  try{refresh();}catch(e){}
},3000);

})();
