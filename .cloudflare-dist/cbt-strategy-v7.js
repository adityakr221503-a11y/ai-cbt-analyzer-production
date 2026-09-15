(function(){
"use strict";

/*
=========================================================
 CBT STRATEGY V7 — REPAIR / INTEGRATION
 4 FEATURES:
 1. Attempt / Skip Strategy
 2. 720 Approach
 3. Topic-wise Practice
 4. Post-Test Mentor

 PRESERVE-FIRST:
 Existing CBT/UI/flow/logic is NOT replaced.
=========================================================
*/

const K={
 history:"cbtHistory",
 sessions:"cbtTestSessions",
 resultV6:"cbtCoreResultV6",
 resultV4:"cbtCoreResultV4",
 resultV5:"cbtCoreV5State",
 cross:"cbtCoreCrossFeatureStateV6",
 mastery:"cbtMasteryV2"
};

function arr(v){
 return Array.isArray(v)?v:[];
}

function n(v){
 const x=Number(v);
 return Number.isFinite(x)?x:0;
}

function s(v){
 return v==null?"":String(v).trim();
}

function read(key,fallback){
 try{
  const raw=localStorage.getItem(key);
  if(!raw)return fallback;
  const value=JSON.parse(raw);
  return value==null?fallback:value;
 }catch(e){
  return fallback;
 }
}

function write(key,value){
 try{
  localStorage.setItem(key,JSON.stringify(value));
  return true;
 }catch(e){
  return false;
 }
}

/* =====================================================
   FIND LATEST REAL RESULT
===================================================== */

function latestResult(){

 const direct=read(K.resultV6,null);

 if(
  direct &&
  Array.isArray(direct.evidence) &&
  direct.evidence.length
 ){
  return direct;
 }

 const h=arr(read(K.history,[]));

 for(let i=h.length-1;i>=0;i--){
  const x=h[i];

  if(
   x &&
   (
    Array.isArray(x.evidence) ||
    Array.isArray(x.questionEvidence)
   )
  ){
   return normalizeResult(x);
  }
 }

 const sessions=arr(read(K.sessions,[]));

 for(let i=sessions.length-1;i>=0;i--){
  const x=sessions[i];

  if(x && (
    x.correct!==undefined ||
    x.score!==undefined
  )){
   return normalizeResult(x);
  }
 }

 return normalizeResult(
  read(K.resultV4,null) ||
  read(K.resultV5,null) ||
  {}
 );
}

function normalizeResult(x){

 x=x||{};

 const evidence=
  arr(x.evidence).length
   ?arr(x.evidence)
   :arr(x.questionEvidence);

 const total=
  n(x.totalQuestions)||evidence.length;

 const correct=n(x.correct);
 const wrong=n(x.wrong);
 const skipped=
  x.skipped!==undefined
   ?n(x.skipped)
   :Math.max(0,total-correct-wrong);

 const answered=
  x.answered!==undefined
   ?n(x.answered)
   :correct+wrong;

 const accuracy=
  x.accuracy!==undefined
   ?n(x.accuracy)
   :answered
    ?Math.round(correct/answered*100)
    :0;

 const score=
  x.score!==undefined
   ?n(x.score)
   :Math.max(0,correct*4-wrong);

 return {
  ...x,
  totalQuestions:total,
  answered,
  correct,
  wrong,
  skipped,
  accuracy,
  score,
  percentage:
   x.percentage!==undefined
    ?n(x.percentage)
    :total
     ?Math.round(score/(total*4)*100)
     :0,
  evidence
 };
}

/* =====================================================
   1. ATTEMPT / SKIP STRATEGY
===================================================== */

function buildAttemptStrategy(){

 const r=latestResult();

 const total=r.totalQuestions;
 const answered=r.answered;
 const correct=r.correct;
 const wrong=r.wrong;
 const skipped=r.skipped;

 const accuracy=
  answered>0
   ?Math.round(correct/answered*100)
   :0;

 let diagnosis="Balanced attempt strategy";
 let priority="Maintain current attempt discipline";

 if(total>0 && skipped>total*0.25){
  diagnosis="Too many questions skipped";
  priority="Improve question selection and revisit marked questions";
 }
 else if(answered>0 && wrong>correct){
  diagnosis="Over-attempting with low accuracy";
  priority="Protect accuracy before increasing attempts";
 }
 else if(answered>0 && accuracy<70){
  diagnosis="Attempt selection needs improvement";
  priority="Attempt high-confidence questions first";
 }
 else if(
  answered>0 &&
  accuracy>=90 &&
  skipped>total*0.15
 ){
  diagnosis="Accuracy is strong but some marks are being left";
  priority="Increase attempts selectively";
 }

 const state={
  version:7,
  updatedAt:Date.now(),
  total,
  answered,
  correct,
  wrong,
  skipped,
  accuracy,
  diagnosis,
  priority,
  rules:[
   "First pass: secure high-confidence questions",
   "Skip questions causing excessive time loss",
   "Return to marked questions later",
   "Avoid weak-confidence guessing",
   "Increase attempts only when accuracy remains stable"
  ]
 };

 write("cbtAttemptStrategyV7",state);

 return state;
}

/* =====================================================
   2. 720 APPROACH
===================================================== */

function build720(){

 const r=latestResult();

 const correct=r.correct;
 const wrong=r.wrong;
 const skipped=r.skipped;

 const score=Math.max(
  0,
  correct*4-wrong
 );

 const gap=Math.max(
  0,
  720-score
 );

 let priority;

 if(score<400)
  priority="Build core accuracy and high-yield coverage";
 else if(score<550)
  priority="Close weak-topic and mistake gaps";
 else if(score<650)
  priority="Reduce negative marks and skipped opportunities";
 else if(score<700)
  priority="Improve speed and consistency";
 else
  priority="Fine-tune toward 720";

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
   "Weak-topic revision",
   "Mistake reduction",
   "Speed improvement",
   "Accuracy protection"
  ],

  note:
   "720 is a planning target, not a guaranteed outcome."
 };

 write("cbt720ApproachV7",plan);

 return plan;
}

/* =====================================================
   3. TOPIC-WISE PRACTICE
===================================================== */

function buildTopicPractice(){

 const r=latestResult();
 const evidence=arr(r.evidence);

 const map={};

 evidence.forEach(function(q){

  const subject=
   s(q.subject)||"Unknown";

  const chapter=
   s(q.chapter)||"Unknown";

  const topic=
   s(q.topic)||
   chapter||
   "Unknown";

  const key=
   subject+"::"+chapter+"::"+topic;

  if(!map[key]){
   map[key]={
    subject,
    chapter,
    topic,
    total:0,
    correct:0,
    wrong:0,
    skipped:0
   };
  }

  const x=map[key];

  x.total++;

  const status=s(q.status).toLowerCase();

  if(
   status==="correct" ||
   q.isCorrect===true
  ){
   x.correct++;
  }
  else if(
   status==="wrong" ||
   q.isCorrect===false
  ){
   x.wrong++;
  }
  else{
   x.skipped++;
  }
 });

 const topics=
  Object.values(map)
   .map(function(x){

    const attempted=
     x.correct+x.wrong;

    x.accuracy=
     attempted
      ?Math.round(x.correct/attempted*100)
      :0;

    x.priority=
     attempted===0
      ?"REVIEW"
      :x.accuracy<60
       ?"HIGH"
       :x.accuracy<75
        ?"MEDIUM"
        :"LOW";

    return x;
   })
   .sort(function(a,b){

    const p={
     HIGH:0,
     MEDIUM:1,
     REVIEW:2,
     LOW:3
    };

    return(
     p[a.priority]-p[b.priority] ||
     a.accuracy-b.accuracy
    );
   });

 const state={
  version:7,
  updatedAt:Date.now(),
  topics,
  weakTopics:
   topics.filter(
    x=>x.priority==="HIGH"||
       x.priority==="MEDIUM"
   )
 };

 write("cbtTopicPracticeV7",state);

 return state;
}

/* =====================================================
   4. POST-TEST MENTOR
===================================================== */

function buildMentor(){

 const attempt=
  buildAttemptStrategy();

 const approach=
  build720();

 const practice=
  buildTopicPractice();

 let action="START NEXT TEST";
 let reason=
  "Current performance supports continued testing";

 let target=null;

 if(practice.weakTopics.length){

  const w=practice.weakTopics[0];

  action="TARGET WEAK TOPIC";

  reason=
   w.subject+
   " → "+
   w.chapter+
   " → "+
   w.topic+
   " needs focused practice";

  target=w;
 }
 else if(attempt.skipped>0){

  action="FIX ATTEMPT STRATEGY";
  reason=
   "Skipped questions are reducing available marks";
 }
 else if(attempt.accuracy<85){

  action="REVISION FIRST";
  reason=
   "Accuracy is below the 85% improvement threshold";
 }
 else if(attempt.wrong>0){

  action="REDUCE MISTAKES";
  reason=
   "Wrong answers are reducing the score";
 }

 const mentor={
  version:7,
  updatedAt:Date.now(),

  action,
  reason,
  target,

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

 write(
  "cbtPostTestMentorV7",
  mentor
 );

 window.CBTStrategyV7State=mentor;

 return mentor;
}

/* =====================================================
   ACTION ROUTING
===================================================== */

function route(action,target){

 if(
  action==="TARGET WEAK TOPIC" &&
  target
 ){

  const params=new URLSearchParams();

  params.set(
   "mode",
   "targeted"
  );

  params.set(
   "subject",
   target.subject
  );

  params.set(
   "chapter",
   target.chapter
  );

  params.set(
   "topic",
   target.topic
  );

  location.href=
   "rankers-test-series.html?"+
   params.toString();

  return;
 }

 if(action==="FIX ATTEMPT STRATEGY"){

  location.href=
   "attempt.html";

  return;
 }

 if(action==="REVISION FIRST"){

  location.href=
   "question-bank.html?mode=weak";

  return;
 }

 if(action==="REDUCE MISTAKES"){

  location.href=
   "mistake.html";

  return;
 }

 location.href=
  "rankers-test-series.html";
}

/* =====================================================
   ADDITIVE DASHBOARD CARD
===================================================== */

function mount(){

 if(window.CBT_MAIN_DASHBOARD === true){
  return;
}



 if(
  document.getElementById(
   "cbtStrategyV7"
  )
 )
  return;

 const mentor=
  buildMentor();

 const box=
  document.createElement("section");

 box.id="cbtStrategyV7";

 box.style.cssText=
  "margin:18px 0;padding:18px;"+
  "border:1px solid #ddd;"+
  "border-radius:14px;"+
  "background:#fff;";

 const topic=
  mentor.target
   ?mentor.target.subject+
    " • "+
    mentor.target.chapter+
    " • "+
    mentor.target.topic
   :"No immediate weak topic detected";

 box.innerHTML=
  '<h2>🎯 Smart Strategy & Mentor</h2>'+
  '<div style="display:grid;gap:10px">'+

  '<div><b>720 Approach:</b> '+
  mentor.approach720.priority+
  '</div>'+

  '<div><b>Current Score:</b> '+
  mentor.approach720.score+
  ' / 720</div>'+

  '<div><b>Attempt Strategy:</b> '+
  mentor.attemptStrategy.diagnosis+
  '</div>'+

  '<div><b>Weak Topic:</b> '+
  topic+
  '</div>'+

  '<div><b>Next Best Action:</b> '+
  mentor.action+
  '</div>'+

  '<div><b>Reason:</b> '+
  mentor.reason+
  '</div>'+

  '<button id="cbtStrategyV7Action" '+
  'style="padding:12px;border:0;border-radius:10px;'+
  'cursor:pointer;font-weight:700">'+
  mentor.action+
  '</button>'+

  '</div>';

 const target=
  document.querySelector(
   "#rankerMasterLoop"
  )||
  document.querySelector(
   ".container"
  )||
  document.querySelector(
   "main"
  )||
  document.body;

 target.appendChild(box);

 const btn=
  document.getElementById(
   "cbtStrategyV7Action"
  );

 if(btn){

  btn.addEventListener(
   "click",
   function(){
    route(
     mentor.action,
     mentor.target
    );
   }
  );
 }
}

/* =====================================================
   PUBLIC API
===================================================== */

window.CBTStrategyV7={

 version:7,

 buildAttemptStrategy,
 build720,
 buildTopicPractice,
 buildMentor,

 refresh:function(){

  const mentor=
   buildMentor();

  const box=
   document.getElementById(
    "cbtStrategyV7"
   );

  if(box){
   box.remove();
  }

  mount();

  return mentor;
 },

 getState:function(){

  return{
   attempt:
    read(
     "cbtAttemptStrategyV7",
     null
    ),

   approach720:
    read(
     "cbt720ApproachV7",
     null
    ),

   topicPractice:
    read(
     "cbtTopicPracticeV7",
     null
    ),

   mentor:
    read(
     "cbtPostTestMentorV7",
     null
    )
  };
 }
};

/* =====================================================
   BOOT
===================================================== */

function boot(){

 try{

  const mentor=
   buildMentor();

  /*
   Don't render a fake empty analysis.
   The card still appears, but all values come from
   the latest real CBT evidence available.
  */

  mount();

  console.log(
   "CBT Strategy V7 repaired",
   mentor
  );

 }catch(error){

  console.warn(
   "CBT Strategy V7 error:",
   error
  );
 }
}

if(
 document.readyState==="loading"
){
 document.addEventListener(
  "DOMContentLoaded",
  boot
 );
}
else{
 boot();
}

})();
