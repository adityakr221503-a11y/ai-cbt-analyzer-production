/* =========================================================
   CBT ANALYZER PRO — RANKER MENTOR DECISION ENGINE V5
   Evidence → Root Cause → Priority → Action → Verification
   ========================================================= */
(function(){
"use strict";

const K = {
  history: "cbtHistory",
  rankerAttempts: "rankBoosterAttemptHistory",
  mastery: "cbtMasteryV2",
  revision: "rankerRevisionHistoryV1",
  retry: "cbtRetryQuestion"
};

function read(key,fallback){
  try{
    const v=JSON.parse(localStorage.getItem(key)||"null");
    return v==null?fallback:v;
  }catch(e){
    return fallback;
  }
}

function arr(v){
  return Array.isArray(v)?v:[];
}

function str(v){
  return String(v==null?"":v).trim();
}

function num(v){
  const n=Number(v);
  return Number.isFinite(n)?n:0;
}

function esc(v){
  return str(v)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

/* ---------------------------------------------------------
   EVIDENCE
--------------------------------------------------------- */

function getMistakes(){
  try{
    if(
      window.RankerMasterEngineV3 &&
      typeof window.RankerMasterEngineV3.mistakes==="function"
    ){
      return arr(window.RankerMasterEngineV3.mistakes());
    }
  }catch(e){}

  return [];
}

function getWeak(){
  try{
    if(
      window.RankerMasterEngineV3 &&
      typeof window.RankerMasterEngineV3.weakDue==="function"
    ){
      return arr(window.RankerMasterEngineV3.weakDue());
    }
  }catch(e){}

  return [];
}

function getChapters(){
  try{
    if(
      window.RankerMasterEngineV3 &&
      typeof window.RankerMasterEngineV3.chapterStats==="function"
    ){
      return arr(window.RankerMasterEngineV3.chapterStats());
    }
  }catch(e){}

  return [];
}

function getMasteredCount(){
  try{
    if(
      window.RankerMasterEngineV3 &&
      typeof window.RankerMasterEngineV3.masteryCount==="function"
    ){
      return num(window.RankerMasterEngineV3.masteryCount());
    }
  }catch(e){}

  const m=arr(read(K.mastery,[]));
  return m.filter(x =>
    x &&
    (
      x.mastered===true ||
      str(x.status).toLowerCase()==="mastered" ||
      str(x.masteryState).toLowerCase()==="mastered"
    )
  ).length;
}

/* ---------------------------------------------------------
   ROOT CAUSE
--------------------------------------------------------- */

function classify(m){
  const type=str(
    m.mistakeType ||
    m.reason ||
    m.mistakeReason
  ).toLowerCase();

  if(type.includes("calculation"))
    return "Calculation";

  if(type.includes("misread"))
    return "Question Reading";

  if(type.includes("guess"))
    return "Guessing";

  if(type.includes("time"))
    return "Time Pressure";

  if(type.includes("concept"))
    return "Concept Gap";

  return "Concept / Pattern Gap";
}

function rootCause(m){
  const cause=classify(m);

  if(cause==="Calculation"){
    return {
      cause:"Calculation weakness",
      fix:"Revise the calculation method, then solve a short targeted numerical set."
    };
  }

  if(cause==="Question Reading"){
    return {
      cause:"Question-reading error",
      fix:"Practice identifying keywords, conditions and what the question actually asks."
    };
  }

  if(cause==="Guessing"){
    return {
      cause:"Uncertain attempt selection",
      fix:"Use Skip / Attempt Strategy before attempting similar questions."
    };
  }

  if(cause==="Time Pressure"){
    return {
      cause:"Time-management weakness",
      fix:"Practice timed questions and reduce time spent on low-confidence questions."
    };
  }

  return {
    cause:"Concept or pattern gap",
    fix:"Revise the underlying concept and immediately verify it with targeted practice."
  };
}

/* ---------------------------------------------------------
   PRIORITY
--------------------------------------------------------- */

function priorityScore(m){
  const mistakes=num(m.count || m.mistakes || 1);

  const accuracy=num(m.accuracy);

  let score=mistakes*10;

  if(accuracy>0 && accuracy<60)
    score+=35;
  else if(accuracy>0 && accuracy<75)
    score+=20;

  if(str(m.chapter)==="Unknown")
    score-=5;

  if(str(m.topic)==="Unknown")
    score-=2;

  return score;
}

function chooseTarget(){
  const mistakes=getMistakes()
    .map(x => Object.assign({},x,{
      _priority:priorityScore(x)
    }))
    .sort((a,b)=>b._priority-a._priority);

  if(mistakes.length)
    return {
      type:"mistake",
      target:mistakes[0]
    };

  const weak=getWeak()
    .filter(x=>str(x.chapter))
    .sort((a,b)=>{
      const aa=num(a.accuracy);
      const bb=num(b.accuracy);
      return aa-bb;
    });

  if(weak.length)
    return {
      type:"chapter",
      target:weak[0]
    };

  const chapters=getChapters()
    .filter(x=>str(x.chapter));

  if(chapters.length)
    return {
      type:"chapter",
      target:chapters[0]
    };

  return {
    type:"none",
    target:null
  };
}

/* ---------------------------------------------------------
   DECISION
--------------------------------------------------------- */

function decision(){
  const selected=chooseTarget();

  if(selected.type==="mistake"){
    const m=selected.target;
    const rc=rootCause(m);

    return {
      type:"retry",
      title:"🎯 Highest-value correction",
      target:m,
      cause:rc.cause,
      reason:
        "This question is carrying the strongest unresolved mistake signal.",
      action:
        "Retry this question first, then verify mastery.",
      button:"🎯 Retry Now"
    };
  }

  if(selected.type==="chapter"){
    const c=selected.target;

    return {
      type:"practice",
      title:"📚 Weak-area intervention",
      target:c,
      cause:"Chapter-level performance weakness",
      reason:
        "Chapter evidence shows that revision/practice should happen before another broad test.",
      action:
        "Revise the weak chapter and follow it with targeted practice.",
      button:"📖 Start Revision"
    };
  }

  return {
    type:"test",
    target:null,
    title:"🚀 No urgent correction detected",
    cause:"No strong unresolved weakness signal",
    reason:
      "The available evidence does not identify a high-priority mistake right now.",
    action:
      "Continue with a fresh Ranker/CBT test to generate new evidence.",
    button:"🏆 Continue Testing"
  };
}

/* ---------------------------------------------------------
   ACTIONS
--------------------------------------------------------- */

function retryTarget(m){
  if(!m)return;

  localStorage.setItem(
    K.retry,
    JSON.stringify({
      questionId:m.id || m.questionId || "",
      question:m.question || "",
      subject:m.subject || "Unknown",
      chapter:m.chapter || "Unknown",
      topic:m.topic || "General",
      concept:m.concept || "",
      selectedAnswer:m.selectedAnswer,
      correctAnswer:m.correctAnswer,
      mode:"mentor-retry",
      createdAt:Date.now(),
      masteryRequired:true
    })
  );

  window.location.href="retry.html?source=mentor";
}

function reviseTarget(t){
  if(!t)return;

  if(
    window.RankerMasterEngineV4 &&
    typeof window.RankerMasterEngineV4.revise==="function"
  ){
    window.RankerMasterEngineV4.revise({
      subject:t.subject || "",
      chapter:t.chapter || "",
      topic:t.topic || ""
    });
    return;
  }

  const p=[];

  if(str(t.subject))
    p.push("subject="+encodeURIComponent(t.subject));

  if(str(t.chapter))
    p.push("chapter="+encodeURIComponent(t.chapter));

  if(str(t.topic))
    p.push("topic="+encodeURIComponent(t.topic));

  window.location.href=
    "question-bank.html"+(p.length?"?"+p.join("&"):"");
}

function continueTesting(){
  window.location.href="rankers-test-series.html";
}

/* ---------------------------------------------------------
   MENTOR PANEL
--------------------------------------------------------- */

function render(){
 /* MAIN_DASHBOARD_MENTOR_GATE_FINAL */
 if(window.CBT_MAIN_DASHBOARD === true){
  return;
 }

  if(!document.body)return;

  let box=document.getElementById(
    "rankerMentorV5"
  );

  if(!box){
    box=document.createElement("section");
    box.id="rankerMentorV5";
    box.className="card";

    const master=
      document.getElementById("rankerMasterLoop");

    if(master && master.parentNode){
      master.parentNode.insertBefore(
        box,
        master.nextSibling
      );
    }else{
      document.body.appendChild(box);
    }
  }

  const d=decision();
  const mastered=getMasteredCount();
  const ms=getMistakes().length;
  const weak=getWeak().length;

  let targetText="";

  if(d.target){
    targetText=
      d.type==="mistake"
        ? str(d.target.question)
        : (
          str(d.target.subject)+" • "+
          str(d.target.chapter)
        );
  }else{
    targetText="No immediate target";
  }

  let button="";

  if(d.type==="retry"){
    button=
      '<button type="button" id="mentorV5Action">'+
      esc(d.button)+
      '</button>';
  }else if(d.type==="practice"){
    button=
      '<button type="button" id="mentorV5Action">'+
      esc(d.button)+
      '</button>';
  }else{
    button=
      '<button type="button" id="mentorV5Action">'+
      esc(d.button)+
      '</button>';
  }

  box.innerHTML=
    '<div class="top-row">'+
      '<div>'+
        '<span class="badge">🧠 RANKER MENTOR V5</span>'+
        '<h2 style="margin:10px 0 4px">'+
          esc(d.title)+
        '</h2>'+
      '</div>'+
    '</div>'+

    '<div class="stats" style="margin-top:12px">'+
      '<div class="stat">'+
        '<div class="stat-value">'+ms+'</div>'+
        '<div class="stat-label">Active Mistakes</div>'+
      '</div>'+
      '<div class="stat">'+
        '<div class="stat-value">'+weak+'</div>'+
        '<div class="stat-label">Weak Areas</div>'+
      '</div>'+
      '<div class="stat">'+
        '<div class="stat-value">'+mastered+'</div>'+
        '<div class="stat-label">Mastered</div>'+
      '</div>'+
    '</div>'+

    '<div class="test" style="margin-top:14px">'+
      '<div class="muted">CURRENT BOTTLENECK</div>'+
      '<h3>'+esc(targetText)+'</h3>'+
      '<p><strong>Root cause:</strong> '+
        esc(d.cause)+
      '</p>'+
      '<p>'+esc(d.reason)+'</p>'+
      '<strong>'+esc(d.action)+'</strong>'+
      '<div style="margin-top:12px">'+
        button+
      '</div>'+
    '</div>';
}

/* ---------------------------------------------------------
   BUTTON
--------------------------------------------------------- */

document.addEventListener("click",function(e){
  if(e.target.id!=="mentorV5Action")return;

  const d=decision();

  if(d.type==="retry"){
    retryTarget(d.target);
    return;
  }

  if(d.type==="practice"){
    reviseTarget(d.target);
    return;
  }

  continueTesting();
});

/* ---------------------------------------------------------
   PUBLIC API
--------------------------------------------------------- */

window.RankerMentorV5={
  decision,
  chooseTarget,
  rootCause,
  priorityScore,
  retryTarget,
  reviseTarget,
  continueTesting,
  render
};

function boot(){
  render();
}

if(document.readyState==="loading"){
  document.addEventListener(
    "DOMContentLoaded",
    boot
  );
}else{
  boot();
}

setTimeout(render,500);
setTimeout(render,1500);
setTimeout(render,3000);

})();
