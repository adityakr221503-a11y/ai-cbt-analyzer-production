(function(){
"use strict";

/* =====================================================
   CBT STRATEGY V7
   4 ADDITIVE FEATURES
   Attempt/Skip + 720 + Topic Practice + Mentor
===================================================== */

const K={
 history:"cbtHistory",
 sessions:"cbtTestSessions",
 result:"cbtCoreResultV6",
 cross:"cbtCoreCrossFeatureStateV6",
 ranker:"rankBoosterAttemptHistory",
 mastery:"cbtMasteryV2"
};

function read(k,f){
 try{
  const v=JSON.parse(localStorage.getItem(k));
  return v==null?f:v;
 }catch(e){return f;}
}

function arr(v){return Array.isArray(v)?v:[];}
function n(v){return Number.isFinite(Number(v))?Number(v):0;}
function s(v){return v==null?"":String(v).trim();}

/* =====================================================
   1. ATTEMPT / SKIP STRATEGY
===================================================== */

function buildAttemptStrategy(){
 const r=read(K.result,null);
 const h=arr(read(K.history,[]));

 const latest=r||h[h.length-1]||{};
 const total=n(latest.totalQuestions);
 const answered=n(latest.answered);
 const correct=n(latest.correct);
 const wrong=n(latest.wrong);
 const skipped=n(latest.skipped);

 const attempted=answered;
 const accuracy=
  attempted>0
   ?Math.round((correct/attempted)*100)
   :0;

 let diagnosis="Balanced attempt strategy";

 if(skipped>total*0.25)
  diagnosis="Too many questions skipped";

 else if(wrong>correct && attempted>0)
  diagnosis="Over-attempting with low accuracy";

 else if(accuracy<70 && attempted>0)
  diagnosis="Attempt selection needs improvement";

 else if(accuracy>=90 && skipped>total*0.15)
  diagnosis="Accuracy is strong; selective attempts can increase score";

 const strategy={
  version:7,
  updatedAt:Date.now(),
  total,
  answered,
  correct,
  wrong,
  skipped,
  accuracy,
  diagnosis,
  rules:[
   "First pass: attempt only questions with high confidence",
   "Skip questions causing excessive time loss",
   "Return to marked questions after securing easy marks",
   "Avoid guessing when elimination is weak",
   "Protect accuracy before increasing attempt count"
  ]
 };

 localStorage.setItem(
  "cbtAttemptStrategyV7",
  JSON.stringify(strategy)
 );

 return strategy;
}

/* =====================================================
   2. 720 APPROACH ENGINE
===================================================== */

function build720(){
 const r=read(K.result,null);
 const latest=r||{};
 const correct=n(latest.correct);
 const wrong=n(latest.wrong);
 const skipped=n(latest.skipped);

 /*
   NEET-style +4/-1 scoring model.
   This is a planning engine, not a guarantee.
 */
 const score=Math.max(0,correct*4-wrong);
 const gap=Math.max(0,720-score);

 let priority="Maintain accuracy";

 if(gap>200)
  priority="Build accuracy + high-yield coverage";

 else if(gap>100)
  priority="Close weak-topic gaps";

 else if(gap>40)
  priority="Reduce mistakes and skipped marks";

 else
  priority="Fine-tune speed and consistency";

 const plan={
  version:7,
  updatedAt:Date.now(),
  score,
  target:720,
  gap,
  correct,
  wrong,
  skipped,
  priority,
  subjectTarget:{
   Biology:360,
   Chemistry:180,
   Physics:180
  },
  focus:[
   "NCERT coverage",
   "weak-topic revision",
   "mistake reduction",
   "speed improvement",
   "accuracy protection"
  ]
 };

 localStorage.setItem(
  "cbt720ApproachV7",
  JSON.stringify(plan)
 );

 return plan;
}

/* =====================================================
   3. TOPIC-WISE PRACTICE BRIDGE
===================================================== */

function buildTopicPractice(){
 const r=read(K.result,null);
 const evidence=arr(r&&r.evidence);

 const map={};

 evidence.forEach(q=>{
  const topic=s(q.topic)||s(q.chapter)||"Unknown";

  if(!map[topic])
   map[topic]={
    topic,
    total:0,
    correct:0,
    wrong:0,
    skipped:0
   };

  map[topic].total++;

  if(q.status==="correct")
   map[topic].correct++;

  else if(q.status==="wrong")
   map[topic].wrong++;

  else
   map[topic].skipped++;
 });

 const topics=Object.values(map)
  .map(x=>{
   const attempted=x.correct+x.wrong;
   x.accuracy=
    attempted
     ?Math.round(x.correct/attempted*100)
     :0;

   x.priority=
    x.accuracy<60?"HIGH":
    x.accuracy<75?"MEDIUM":
    "LOW";

   return x;
  })
  .sort((a,b)=>{
   const p={HIGH:0,MEDIUM:1,LOW:2};
   return p[a.priority]-p[b.priority]||
          a.accuracy-b.accuracy;
  });

 const state={
  version:7,
  updatedAt:Date.now(),
  topics,
  weakTopics:topics.filter(x=>x.priority!=="LOW")
 };

 localStorage.setItem(
  "cbtTopicPracticeV7",
  JSON.stringify(state)
 );

 return state;
}

/* =====================================================
   4. POST-TEST MENTOR ACTION
===================================================== */

function buildMentor(){
 const attempt=buildAttemptStrategy();
 const approach=build720();
 const practice=buildTopicPractice();

 let action="START NEXT TEST";
 let reason="Current performance supports continued testing";

 if(practice.weakTopics.length){
  action="TARGET WEAK TOPIC";
  reason=
   "Weak topic detected: "+
   practice.weakTopics[0].topic;
 }
 else if(attempt.skipped>0){
  action="FIX ATTEMPT STRATEGY";
  reason="Skipped questions are affecting score";
 }
 else if(attempt.accuracy<85){
  action="REVISION FIRST";
  reason="Accuracy needs improvement";
 }
 else if(attempt.wrong>0){
  action="REDUCE MISTAKES";
  reason="Wrong answers are reducing score";
 }

 const mentor={
  version:7,
  updatedAt:Date.now(),
  action,
  reason,
  attemptStrategy:attempt,
  approach720:approach,
  topicPractice:practice,
  nextSteps:[
   action,
   "Review mistake reasons",
   "Practice the weakest topic",
   "Retry unresolved mistakes",
   "Take the next appropriate test"
  ]
 };

 localStorage.setItem(
  "cbtPostTestMentorV7",
  JSON.stringify(mentor)
 );

 window.CBTStrategyV7=mentor;
 return mentor;
}

/* =====================================================
   UI — ADDITIVE ONLY
===================================================== */

function mount(){
 if(document.getElementById("cbtStrategyV7"))
  return;

 const mentor=buildMentor();

 const box=document.createElement("section");
 box.id="cbtStrategyV7";

 box.style.cssText=
  "margin:18px 0;padding:18px;border:1px solid #ddd;"+
  "border-radius:14px;background:#fff;";

 box.innerHTML=
  '<h2>🎯 Smart Strategy & Mentor</h2>'+
  '<div style="display:grid;gap:10px">'+
  '<div><b>720 Approach:</b> '+
  mentor.approach720.priority+
  '</div>'+
  '<div><b>Attempt Strategy:</b> '+
  mentor.attemptStrategy.diagnosis+
  '</div>'+
  '<div><b>Next Best Action:</b> '+
  mentor.action+
  '</div>'+
  '<div><b>Reason:</b> '+
  mentor.reason+
  '</div>'+
  '</div>';

 const target=
  document.querySelector("#rankerMasterLoop")||
  document.querySelector("main")||
  document.body;

 target.appendChild(box);
}

/* =====================================================
   PUBLIC API
===================================================== */

window.CBTStrategyV7={
 buildAttemptStrategy,
 build720,
 buildTopicPractice,
 buildMentor,
 getState:function(){
  return {
   attempt:read("cbtAttemptStrategyV7",null),
   approach720:read("cbt720ApproachV7",null),
   topicPractice:read("cbtTopicPracticeV7",null),
   mentor:read("cbtPostTestMentorV7",null)
  };
 }
};

function boot(){
 try{
  buildMentor();
  mount();
 }catch(e){
  console.warn("CBT Strategy V7:",e);
 }
}

if(document.readyState==="loading")
 document.addEventListener("DOMContentLoaded",boot);
else
 boot();

})();
