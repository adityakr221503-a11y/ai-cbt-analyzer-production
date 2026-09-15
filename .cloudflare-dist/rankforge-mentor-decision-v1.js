(function(){
"use strict";

const KEY="rankforgeMentorDecisionV1";
const HISTORY="cbtHistory";
const MISTAKES="rankforgeMistakesV1";
const MASTERY="cbtMasteryV2";
const DPP="rankforgeDPPIntelligenceV1";

function read(k,f){
  try{
    const x=localStorage.getItem(k);
    return x?JSON.parse(x):f;
  }catch(e){return f;}
}
function arr(x){return Array.isArray(x)?x:[];}
function s(x){return String(x==null?"":x).trim();}
function num(x){const n=Number(x);return Number.isFinite(n)?n:0;}

function getMistakes(){
  const x=read(MISTAKES,[]);
  if(Array.isArray(x)) return x;
  if(x&&Array.isArray(x.mistakes)) return x.mistakes;
  return [];
}

function getDPP(){
  const x=read(DPP,[]);
  if(Array.isArray(x)) return x;
  if(x&&Array.isArray(x.history)) return x.history;
  return [];
}

function topicOf(x){
  return s(
    x&&(
      x.topic||
      x.chapter||
      x.unit||
      x.subjectTopic||
      x.subtopic
    )
  )||"Unknown";
}

function activeMistakes(){
  return getMistakes().filter(function(m){
    const st=s(
      m&&(
        m.status||
        m.state||
        m.masteryStatus
      )
    ).toLowerCase();

    return !(
      st==="mastered"||
      st==="resolved"||
      st==="closed"
    );
  });
}

function topicLoads(){
  const map={};

  activeMistakes().forEach(function(m){
    const t=topicOf(m);
    if(!map[t]){
      map[t]={
        topic:t,
        mistakes:0,
        concept:0,
        calculation:0,
        misread:0,
        guess:0,
        time:0
      };
    }

    map[t].mistakes++;

    const r=s(
      m&&(
        m.reason||
        m.mistakeReason||
        m.errorType||
        m.mistakeType||
        m.classification
      )
    ).toLowerCase();

    if(r.includes("concept"))map[t].concept++;
    else if(r.includes("calculation"))map[t].calculation++;
    else if(r.includes("misread"))map[t].misread++;
    else if(r.includes("guess"))map[t].guess++;
    else if(r.includes("time"))map[t].time++;
  });

  return Object.values(map).sort(function(a,b){
    return b.mistakes-a.mistakes;
  });
}

function latestDPP(){
  const x=getDPP();
  return x.length?x[x.length-1]:null;
}

function latestPerformance(){
  const d=latestDPP();

  if(!d)return null;

  const o=d.overall||{};

  return {
    accuracy:num(o.accuracy),
    correct:num(o.correct),
    wrong:num(o.wrong),
    unanswered:num(o.unanswered),
    avgTime:num(d.avgTime),
    difficulty:s(d.nextDifficulty)||"medium"
  };
}

function historyStats(){
  const h=read(HISTORY,[]);
  const list=Array.isArray(h)
    ?h
    :(h&&Array.isArray(h.tests)?h.tests:[]);

  let total=0;
  let score=0;

  list.slice(-10).forEach(function(t){
    total++;

    const p=num(
      t&&(
        t.percentage||
        t.accuracy||
        t.scorePercent
      )
    );

    if(p)score+=p;
  });

  return {
    tests:total,
    avgRecentAccuracy:total?Math.round(score/total):0
  };
}

function chooseAction(){
  const weak=topicLoads();
  const dpp=latestPerformance();
  const hs=historyStats();

  let action={
    priority:"practice",
    title:"Take an adaptive DPP",
    topic:weak[0]?weak[0].topic:"Mixed Weak Areas",
    size:15,
    difficulty:"medium",
    reason:"Build fresh performance evidence.",
    score:50
  };

  if(weak[0]){
    const w=weak[0];

    if(w.concept>=2){
      action={
        priority:"concept-revision",
        title:"Revise the concept before testing",
        topic:w.topic,
        size:15,
        difficulty:"easy",
        reason:
          w.concept+
          " concept-gap mistakes are active.",
        score:95
      };
    }else if(w.mistakes>=3){
      action={
        priority:"weak-topic",
        title:"Target your weakest topic",
        topic:w.topic,
        size:20,
        difficulty:"medium",
        reason:
          w.mistakes+
          " active mistakes are concentrated here.",
        score:90
      };
    }
  }

  if(
    dpp &&
    dpp.accuracy<50 &&
    action.score<95
  ){
    action={
      priority:"reinforcement",
      title:"Reinforce weak concepts",
      topic:weak[0]?weak[0].topic:"Recent DPP",
      size:15,
      difficulty:"easy",
      reason:
        "Latest DPP accuracy is "+
        dpp.accuracy+
        "%. Build accuracy before increasing difficulty.",
      score:92
    };
  }

  if(
    dpp &&
    dpp.accuracy>=85 &&
    action.priority==="practice"
  ){
    action={
      priority:"challenge",
      title:"Attempt a harder adaptive DPP",
      topic:weak[0]?weak[0].topic:"Mixed",
      size:20,
      difficulty:"hard",
      reason:
        "Latest DPP accuracy reached "+
        dpp.accuracy+
        "%. Increase challenge.",
      score:88
    };
  }

  if(
    !weak.length &&
    !dpp &&
    hs.tests===0
  ){
    action={
      priority:"baseline",
      title:"Take your first diagnostic CBT",
      topic:"Full Syllabus",
      size:20,
      difficulty:"medium",
      reason:"The Mentor needs performance evidence.",
      score:100
    };
  }

  return {
    ...action,
    generatedAt:Date.now(),
    evidence:{
      activeMistakes:activeMistakes().length,
      weakTopics:weak.length,
      latestDPP:dpp,
      recentTests:hs.tests,
      recentAverageAccuracy:hs.avgRecentAccuracy
    }
  };
}

function save(x){
  localStorage.setItem(KEY,JSON.stringify(x));
  return x;
}

function decide(){
  const x=chooseAction();
  save(x);
  return x;
}

function escapeHTML(x){
  return s(x)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function render(){
  const path=location.pathname.toLowerCase();

  if(
    !path.includes("index.html") &&
    !path.endsWith("/") &&
    !path.includes("ranker-command-center")
  )return;

  const x=decide();

  const old=document.getElementById("rankforgeMentorDecisionV1");
  if(old)old.remove();

  const panel=document.createElement("section");
  panel.id="rankforgeMentorDecisionV1";

  panel.innerHTML=
    '<div class="rmd-head">'+
      '<div>'+
        '<div class="rmd-label">AI MENTOR</div>'+
        '<div class="rmd-title">🎯 Today’s #1 Action</div>'+
      '</div>'+
      '<div class="rmd-priority">'+
        escapeHTML(x.priority)+
      '</div>'+
    '</div>'+
    '<div class="rmd-action">'+
      '<strong>'+escapeHTML(x.title)+'</strong>'+
      '<span>'+escapeHTML(x.topic)+'</span>'+
    '</div>'+
    '<div class="rmd-grid">'+
      '<div><small>QUESTIONS</small><b>'+x.size+'Q</b></div>'+
      '<div><small>LEVEL</small><b>'+escapeHTML(x.difficulty)+'</b></div>'+
      '<div><small>ACTIVE MISTAKES</small><b>'+
        x.evidence.activeMistakes+
      '</b></div>'+
    '</div>'+
    '<div class="rmd-reason">'+
      '<small>WHY NOW</small>'+
      '<p>'+escapeHTML(x.reason)+'</p>'+
    '</div>'+
    '<button id="rmdStart">Start Recommended Practice</button>';

  const css=document.createElement("style");
  css.id="rankforgeMentorDecisionV1CSS";
  css.textContent=
`#rankforgeMentorDecisionV1{
margin:18px 0;
padding:20px;
border:1px solid #dbe3ee;
border-radius:22px;
background:#fff;
box-shadow:0 8px 28px rgba(15,23,42,.08);
position:relative;
z-index:90;
}
.rmd-head{
display:flex;
justify-content:space-between;
align-items:center;
gap:12px;
}
.rmd-label{
font-size:10px;
font-weight:900;
letter-spacing:1.4px;
color:#64748b;
}
.rmd-title{
font-size:21px;
font-weight:900;
margin-top:3px;
}
.rmd-priority{
font-size:10px;
font-weight:900;
text-transform:uppercase;
padding:6px 9px;
border-radius:9px;
background:#f1f5f9;
}
.rmd-action{
margin-top:16px;
padding:15px;
border-radius:15px;
background:#f8fafc;
}
.rmd-action strong{
display:block;
font-size:16px;
}
.rmd-action span{
display:block;
margin-top:5px;
font-size:13px;
color:#64748b;
}
.rmd-grid{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:8px;
margin-top:10px;
}
.rmd-grid div{
padding:10px;
text-align:center;
border-radius:12px;
background:#f8fafc;
}
.rmd-grid small,
.rmd-reason small{
display:block;
font-size:9px;
font-weight:900;
color:#64748b;
}
.rmd-grid b{
display:block;
margin-top:4px;
font-size:14px;
}
.rmd-reason{
margin-top:10px;
padding:12px;
border-radius:13px;
background:#f8fafc;
}
.rmd-reason p{
margin:5px 0 0;
font-size:12px;
line-height:1.45;
color:#475569;
}
#rmdStart{
width:100%;
margin-top:12px;
padding:13px 16px;
border:0;
border-radius:13px;
font-weight:800;
cursor:pointer;
}
@media(max-width:520px){
.rmd-grid{grid-template-columns:1fr 1fr 1fr}
.rmd-title{font-size:18px}
}`;

  if(!document.getElementById("rankforgeMentorDecisionV1CSS"))
    document.head.appendChild(css);

  const target=
    document.querySelector("main")||
    document.querySelector(".container")||
    document.body;

  target.insertBefore(panel,target.firstChild);

  const btn=document.getElementById("rmdStart");

  if(btn){
    btn.addEventListener("click",function(){
      try{
        if(
          window.RankForgeAdaptiveDPPV1 &&
          typeof window.RankForgeAdaptiveDPPV1.start==="function"
        ){
          window.RankForgeAdaptiveDPPV1.start(
            x.size,
            x.difficulty,
            x.topic
          );
          return;
        }

        location.href="question-bank.html?mode=adaptive-dpp";
      }catch(e){
        location.href="question-bank.html?mode=adaptive-dpp";
      }
    });
  }
}

window.RankForgeMentorDecisionV1={
  decide:decide,
  getDecision:function(){
    return read(KEY,null);
  },
  getWeakTopics:topicLoads,
  getLatestDPP:latestPerformance
};

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",render);
}else{
  render();
}

setTimeout(render,1200);

})();
