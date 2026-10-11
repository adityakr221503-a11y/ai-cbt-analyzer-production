(function(){
"use strict";

/*
=========================================================
 CBT CORE V5 — MASTER INTEGRATION
 PRESERVE-FIRST / ADDITIVE ONLY

 CBT
  ↓
Result
  ↓
Evidence
  ↓
Mistake Classification
  ↓
Retry Queue
  ↓
Mastery Verification
  ↓
Orbit
  ↓
Mentor
  ↓
Next Best Action

 Existing UI / structure / navigation / CBT engine
 are NOT replaced.
=========================================================
*/

const K={
 result:"cbtCoreResultV4",
 evidence:"cbtCoreEvidenceV4",
 history:"cbtHistory",
 sessions:"cbtTestSessions",
 mistakes:"cbtMistakeEvidenceV5",
 retry:"cbtAnalyzer.retryQueue",
 mastery:"cbtMasteryV2",
 mentor:"cbtMentorStateV5",
 orbit:"cbtOrbitStateV5",
 next:"cbtNextBestActionV5"
};

function read(k,d){
 try{
  const v=JSON.parse(localStorage.getItem(k)||"null");
  return v==null?d:v;
 }catch(e){return d;}
}

function save(k,v){
 try{
  localStorage.setItem(k,JSON.stringify(v));
  return true;
 }catch(e){return false;}
}

function arr(v){
 return Array.isArray(v)?v:[];
}

function str(v){
 return v==null?"":String(v).trim();
}

function result(){
 return read(K.result,null) ||
        read(K.evidence,null) ||
        null;
}

function classify(x){
 const q=str(x.question).toLowerCase();
 const topic=str(x.topic).toLowerCase();
 const concept=str(x.concept).toLowerCase();

 /*
  Existing explicit mistake information wins.
 */
 if(x.mistakeType)return str(x.mistakeType);

 /*
  Do not invent a detailed diagnosis.
  These are broad evidence categories only.
 */
 if(
  /calculation|calculate|numerical|value|ratio|percentage|velocity|force|mass|energy|mole|concentration/.test(q)
 ){
  return "Calculation Error";
 }

 if(
  /except|incorrect|not true|false|least|most|best|which of the following/.test(q)
 ){
  return "Question Reading";
 }

 if(topic||concept)
  return "Concept / Pattern Gap";

 return "Concept / Pattern Gap";
}

function buildMistakes(r){
 const old=arr(read(K.mistakes,[]));

 const fresh=r.evidence
  .filter(x=>x.status==="wrong")
  .map(x=>({
   evidenceVersion:5,
   sessionId:r.sessionId,
   questionId:str(x.questionId),
   question:str(x.question),
   subject:str(x.subject),
   chapter:str(x.chapter),
   topic:str(x.topic),
   concept:str(x.concept),
   selectedAnswer:x.selectedAnswer,
   correctAnswer:x.correctAnswer,
   mistakeType:classify(x),
   status:"active",
   retryRequired:true,
   masteryRequired:true,
   createdAt:r.submittedAt
  }));

 const map=new Map();

 old.forEach(x=>{
  if(x&&x.questionId)
   map.set(
    String(x.sessionId||"")+"|"+String(x.questionId),
    x
   );
 });

 fresh.forEach(x=>{
  const key=String(x.sessionId)+"|"+String(x.questionId);

  if(!map.has(key))
   map.set(key,x);
 });

 return Array.from(map.values()).slice(-2000);
}

function buildRetryQueue(r,mistakes){
 let q=arr(read(K.retry,[]));

 r.evidence
  .filter(x=>x.status==="wrong")
  .forEach(x=>{
   const id=str(x.questionId);
   if(!id)return;

   const existing=q.find(y=>
    y&&str(y.questionId)===id
   );

   if(existing){
    existing.lastSeenAt=r.submittedAt;
    existing.retryRequired=true;
    existing.masteryRequired=true;
   }else{
    const m=mistakes.find(y=>
     y&&str(y.questionId)===id
    );

    q.push({
     questionId:id,
     question:str(x.question),
     subject:str(x.subject),
     chapter:str(x.chapter),
     topic:str(x.topic),
     concept:str(x.concept),
     selectedAnswer:x.selectedAnswer,
     correctAnswer:x.correctAnswer,
     mistakeType:m?m.mistakeType:"Concept / Pattern Gap",
     source:r.source,
     firstQueuedAt:r.submittedAt,
     lastSeenAt:r.submittedAt,
     retryRequired:true,
     masteryRequired:true
    });
   }
  });

 return q.slice(-2000);
}

function masterySet(){
 const raw=arr(read(K.mastery,[]));
 const set=new Set();

 raw.forEach(x=>{
  if(!x)return;

  const id=str(
   x.questionId||
   x.id||
   x.questionID
  );

  /*
   Only explicitly successful retry/mastery
   records count here.
  */
  const ok=
   x.mastered===true ||
   x.isMastered===true ||
   x.retryCorrect===true ||
   x.correctOnRetry===true;

  if(id&&ok)set.add(id);
 });

 return set;
}

function applyMastery(queue){
 const mastered=masterySet();

 return queue.filter(x=>
  !mastered.has(str(x.questionId))
 );
}

function buildTopicStats(r){
 const map={};

 r.evidence.forEach(x=>{
  const key=[
   str(x.subject)||"Unknown",
   str(x.chapter)||"Unknown",
   str(x.topic)||"Unknown"
  ].join(" | ");

  if(!map[key]){
   map[key]={
    subject:str(x.subject)||"Unknown",
    chapter:str(x.chapter)||"Unknown",
    topic:str(x.topic)||"Unknown",
    total:0,
    correct:0,
    wrong:0,
    skipped:0
   };
  }

  map[key].total++;

  if(x.status==="correct")map[key].correct++;
  if(x.status==="wrong")map[key].wrong++;
  if(x.status==="skipped")map[key].skipped++;
 });

 Object.values(map).forEach(x=>{
  x.accuracy=
   x.correct+x.wrong
    ?Number(
      (x.correct/(x.correct+x.wrong)*100).toFixed(2)
     )
    :0;
 });

 return Object.values(map);
}

function nextAction(r,queue,topics){
 if(queue.length){
  return {
   action:"RETRY",
   priority:"HIGH",
   title:"Retry active mistakes",
   reason:
    queue.length+
    " question(s) still need real retry verification.",
   target:"retry.html"
  };
 }

 const weak=topics
  .filter(x=>x.total>=2)
  .sort((a,b)=>a.accuracy-b.accuracy)[0];

 if(weak&&weak.accuracy<75){
  return {
   action:"TARGETED_PRACTICE",
   priority:"HIGH",
   title:"Target weak topic",
   reason:
    weak.subject+
    " • "+
    weak.chapter+
    " • "+
    weak.topic+
    " has "+
    weak.accuracy+
    "% accuracy.",
   target:"rankers-test-series.html"
  };
 }

 if(r.skipped>0){
  return {
   action:"ATTEMPT_STRATEGY",
   priority:"MEDIUM",
   title:"Review skipped-question strategy",
   reason:
    r.skipped+
    " question(s) were skipped in the latest attempt.",
   target:"rankers-test-series.html"
  };
 }

 if(r.accuracy<85){
  return {
   action:"REVISION",
   priority:"MEDIUM",
   title:"Revise before the next test",
   reason:
    "Latest accuracy is "+
    r.accuracy+
    "%.",
   target:"question-bank.html"
  };
 }

 return {
  action:"NEXT_TEST",
  priority:"NORMAL",
  title:"Continue testing",
  reason:
   "Current evidence does not show an urgent retry or weak-topic action.",
  target:"rankers-test-series.html"
 };
}

function sync(){
 const r=result();

 if(!r||!Array.isArray(r.evidence)||!r.evidence.length){
  console.log("CBT V5: no result evidence available yet");
  return null;
 }

 const mistakes=buildMistakes(r);
 const queue=buildRetryQueue(r,mistakes);
 const activeQueue=applyMastery(queue);
 const topics=buildTopicStats(r);
 const next=nextAction(r,activeQueue,topics);

 const state={
  version:5,
  sessionId:str(r.sessionId),
  testId:str(r.testId),
  title:str(r.title),
  source:str(r.source),
  updatedAt:Date.now(),

  result:{
   totalQuestions:r.totalQuestions,
   answered:r.answered,
   correct:r.correct,
   wrong:r.wrong,
   skipped:r.skipped,
   score:r.score,
   maximumScore:r.maximumScore,
   percentage:r.percentage,
   accuracy:r.accuracy
  },

  evidenceCount:r.evidence.length,
  mistakes:mistakes,
  activeRetryQueue:activeQueue,
  topicStats:topics,
  nextBestAction:next
 };

 save(K.mistakes,mistakes);
 save(K.retry,activeQueue);
 save(K.mentor,{
  version:5,
  sessionId:r.sessionId,
  accuracy:r.accuracy,
  wrong:r.wrong,
  skipped:r.skipped,
  activeMistakes:mistakes.filter(x=>x.status==="active").length,
  topMistakeType:
   mistakes.length
    ?mistakes[mistakes.length-1].mistakeType
    :"",
  nextAction:next.action,
  updatedAt:Date.now()
 });

 save(K.orbit,{
  version:5,
  sessionId:r.sessionId,
  score:r.score,
  maximumScore:r.maximumScore,
  percentage:r.percentage,
  accuracy:r.accuracy,
  correct:r.correct,
  wrong:r.wrong,
  skipped:r.skipped,
  topicStats:topics,
  activeRetryCount:activeQueue.length,
  updatedAt:Date.now()
 });

 save(K.next,next);

 /*
  Keep a single globally readable snapshot.
 */
 window.CBTCoreV5State=state;

 try{
  sessionStorage.setItem(
   "cbtCoreV5State",
   JSON.stringify(state)
  );
 }catch(e){}

 console.log(
  "CBT Core V5:",
  r.correct+" correct,",
  r.wrong+" wrong,",
  r.skipped+" skipped,",
  "retry="+activeQueue.length
 );

 return state;
}

window.CBTCoreV5={
 version:5,
 sync:sync,
 getState:()=>({
  result:result(),
  mistakes:read(K.mistakes,[]),
  retryQueue:read(K.retry,[]),
  mentor:read(K.mentor,null),
  orbit:read(K.orbit,null),
  nextBestAction:read(K.next,null)
 })
};

/*
=========================================================
 DO NOT replace submitTest().
 V5 observes the already-existing result pipeline.
=========================================================
*/

function install(){
 if(
  typeof window.submitTest!=="function"||
  window.submitTest.__CBTCoreV5
 )return;

 const original=window.submitTest;

 function wrapped(){
  const value=original.apply(this,arguments);

  setTimeout(()=>{
   try{sync();}
   catch(e){console.warn("CBT V5:",e);}
  },250);

  return value;
 }

 wrapped.__CBTCoreV5=true;
 wrapped.__CBTCoreV5Original=original;

 window.submitTest=wrapped;
}

if(document.readyState==="loading"){
 document.addEventListener(
  "DOMContentLoaded",
  ()=>setTimeout(install,300)
 );
}else{
 setTimeout(install,300);
}

setTimeout(install,1000);
setTimeout(install,2500);

/*
 If another existing wrapper installs later,
 V5 retries the hook without changing the UI.
*/
setInterval(()=>{
 try{
  install();
 }catch(e){}
},3000);

console.log(
 "CBT Core V5 loaded — existing structure preserved"
);

})();
