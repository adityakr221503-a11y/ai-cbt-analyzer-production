(function(){
"use strict";

/*
=========================================================
 CBT CORE V6
 PERSISTENCE + RECOVERY + CROSS-FEATURE SYNC
 PRESERVE-FIRST / ADDITIVE ONLY

 Existing CBT structure, UI, navigation and logic
 are not replaced.
=========================================================
*/

const K={
 live:"cbtLiveAnswerSnapshotV1",
 liveV6:"cbtLiveStateV6",
 result:"cbtCoreResultV3",
 resultV4:"cbtCoreResultV4",
 stateV5:"cbtCoreV5State",
 history:"cbtHistory",
 sessions:"cbtTestSessions",
 retry:"cbtAnalyzer.retryQueue",
 mastery:"cbtMasteryV2",
 active:"rbSelectedQuestions"
};

function arr(v){
 return Array.isArray(v)?v:[];
}

function str(v){
 return v==null?"":String(v).trim();
}

function read(storage,key,fallback){
 try{
  const raw=storage.getItem(key);
  if(!raw)return fallback;
  const v=JSON.parse(raw);
  return v==null?fallback:v;
 }catch(e){
  return fallback;
 }
}

function write(storage,key,value){
 try{
  storage.setItem(key,JSON.stringify(value));
  return true;
 }catch(e){
  return false;
 }
}

function questions(){
 const names=[
  "questions",
  "testQuestions",
  "currentQuestions",
  "CBT_QUESTIONS",
  "selectedQuestions"
 ];

 for(const n of names){
  if(Array.isArray(window[n])&&window[n].length)
   return window[n];
 }

 const active=read(localStorage,K.active,[]);
 return arr(active);
}

function answers(){
 const names=[
  "answers",
  "userAnswers",
  "selectedAnswers",
  "CBT_ANSWERS"
 ];

 for(const n of names){
  if(Array.isArray(window[n]))
   return window[n];
 }

 return [];
}

function normalize(v){
 if(v==null)return "";

 if(typeof v==="object"){
  return str(
   v.value??
   v.answer??
   v.selectedAnswer??
   v.option??
   v.text??
   ""
  );
 }

 return str(v);
}

function correct(q){
 return normalize(
  q&&(
   q.correctAnswer??
   q.answer??
   q.correct??
   q.correctOption??
   q.correct_option
  )
 );
}

function selected(q,i,a){
 if(a[i]!==undefined&&a[i]!==null)
  return normalize(a[i]);

 const selectors=[
  `input[name="question-${i}"]:checked`,
  `input[name="q${i}"]:checked`,
  `[data-question-index="${i}"].selected`,
  `[data-index="${i}"].selected`,
  `[data-question="${i}"].selected`
 ];

 for(const selector of selectors){
  try{
   const e=document.querySelector(selector);
   if(e){
    return normalize(
     e.value||
     e.dataset.value||
     e.dataset.answer||
     e.textContent
    );
   }
  }catch(x){}
 }

 return "";
}

function equal(a,b){
 return !!a&&!!b&&
  String(a).replace(/\s+/g," ").trim().toLowerCase()===
  String(b).replace(/\s+/g," ").trim().toLowerCase();
}

function source(){
 return str(
  window.CBT_ACTIVE_SOURCE||
  sessionStorage.getItem("CBT_ACTIVE_SOURCE")||
  localStorage.getItem("CBT_ACTIVE_SOURCE")||
  "CBT"
 );
}

function testId(){
 return str(
  window.CBT_TEST_ID||
  sessionStorage.getItem("CBT_TEST_ID")||
  ""
 );
}

function title(){
 return str(
  window.CBT_TEST_TITLE||
  document.title||
  "CBT Test"
 );
}

function sessionId(){
 return str(
  window.CBT_SESSION_ID||
  sessionStorage.getItem("CBT_SESSION_ID")||
  ""
 );
}

function evidence(){
 const q=questions();
 const a=answers();

 return q.map((item,i)=>{
  const s=selected(item,i,a);
  const c=correct(item);

  return {
   index:i,
   questionId:str(
    item&&(
     item.id||
     item.questionId||
     item.questionID
    )
   ),
   question:str(
    item&&(
     item.question||
     item.questionText||
     item.text
    )
   ),
   subject:str(item&&item.subject),
   chapter:str(item&&item.chapter),
   topic:str(item&&item.topic),
   concept:str(item&&item.concept),
   selectedAnswer:s||null,
   correctAnswer:c||null,
   status:!s?"skipped":equal(s,c)?"correct":"wrong"
  };
 });
}

function buildLiveState(){
 const e=evidence();

 return {
  version:6,
  sessionId:sessionId(),
  testId:testId(),
  title:title(),
  source:source(),
  savedAt:Date.now(),
  totalQuestions:e.length,
  answered:e.filter(x=>x.status!=="skipped").length,
  currentIndex:
   Number.isInteger(window.currentQuestion)
    ?window.currentQuestion
    :null,
  evidence:e
 };
}

/*
---------------------------------------------------------
 SAVE CURRENT STATE
---------------------------------------------------------
*/

function saveLive(){
 const state=buildLiveState();

 if(!state.totalQuestions)return state;

 write(sessionStorage,K.liveV6,state);

 /*
  Preserve V1 live snapshot too.
  Never delete or overwrite it with a different format.
 */
 try{
  const old=read(
   sessionStorage,
   K.live,
   null
  );

  if(!old){
   write(
    sessionStorage,
    K.live,
    {
     version:1,
     savedAt:Date.now(),
     totalQuestions:state.totalQuestions,
     answers:state.evidence
    }
   );
  }
 }catch(e){}

 window.CBTCoreV6Live=state;

 return state;
}

/*
---------------------------------------------------------
 RECOVERY INFORMATION
---------------------------------------------------------
*/

function getRecovery(){
 const v6=read(sessionStorage,K.liveV6,null);

 if(v6&&Array.isArray(v6.evidence))
  return v6;

 const v1=read(sessionStorage,K.live,null);

 if(v1&&Array.isArray(v1.answers)){
  return {
   version:6,
   migratedFrom:1,
   savedAt:v1.savedAt||Date.now(),
   totalQuestions:v1.totalQuestions||v1.answers.length,
   evidence:v1.answers
  };
 }

 return null;
}

/*
---------------------------------------------------------
 SESSION FINGERPRINT
---------------------------------------------------------
*/

function fingerprint(r){
 const ids=arr(r.evidence)
  .map(x=>str(x.questionId))
  .join(",");

 return [
  str(r.sessionId),
  str(r.testId),
  str(r.source),
  r.totalQuestions||0,
  r.correct||0,
  r.wrong||0,
  r.skipped||0,
  ids
 ].join("|");
}

/*
---------------------------------------------------------
 DUPLICATE RESULT GUARD
---------------------------------------------------------
*/

function syncResult(){
 const r=
  read(localStorage,K.result,null)||
  read(localStorage,K.resultV4,null)||
  read(localStorage,K.stateV5,null);

 if(!r||!Array.isArray(r.evidence)||!r.evidence.length)
  return null;

 const result={
  version:6,
  sessionId:
   str(r.sessionId)||
   "cbt-v6-"+Date.now(),
  testId:str(r.testId),
  title:str(r.title)||title(),
  source:str(r.source)||source(),
  submittedAt:
   Number(r.submittedAt)||Date.now(),
  totalQuestions:
   Number(r.totalQuestions)||r.evidence.length,
  answered:
   Number(r.answered)||0,
  correct:
   Number(r.correct)||0,
  wrong:
   Number(r.wrong)||0,
  skipped:
   Number(r.skipped)||0,
  score:Number(r.score)||0,
  maximumScore:
   Number(r.maximumScore)||
   Number(r.totalQuestions||r.evidence.length)*4,
  percentage:Number(r.percentage)||0,
  accuracy:Number(r.accuracy)||0,
  evidence:r.evidence
 };

 result.fingerprint=fingerprint(result);

 write(
  localStorage,
  "cbtCoreResultV6",
  result
 );

 /*
 --------------------------------------------------------
 HISTORY
 Existing records remain untouched.
 V6 only maintains its own tagged record.
 --------------------------------------------------------
 */

 let history=arr(
  read(localStorage,K.history,[])
 );

 const hi=history.findIndex(x=>
  x&&
  x.cbtCoreV6===true&&
  x.fingerprint===result.fingerprint
 );

 const hRecord={
  cbtCoreV6:true,
  fingerprint:result.fingerprint,
  sessionId:result.sessionId,
  testId:result.testId,
  title:result.title,
  source:result.source,
  submittedAt:result.submittedAt,
  totalQuestions:result.totalQuestions,
  answered:result.answered,
  correct:result.correct,
  wrong:result.wrong,
  skipped:result.skipped,
  score:result.score,
  maximumScore:result.maximumScore,
  percentage:result.percentage,
  accuracy:result.accuracy,
  questionEvidence:result.evidence
 };

 if(hi<0)
  history.push(hRecord);

 /*
 If same V6 result already exists, don't create another copy.
 */
 write(
  localStorage,
  K.history,
  history.slice(-2000)
 );

 /*
 --------------------------------------------------------
 TEST SESSIONS
 --------------------------------------------------------
 */

 let sessions=arr(
  read(localStorage,K.sessions,[])
 );

 const si=sessions.findIndex(x=>
  x&&
  (
   str(x.id)===result.sessionId||
   (
    x.cbtCoreV6===true&&
    x.fingerprint===result.fingerprint
   )
  )
 );

 const sRecord={
  cbtCoreV6:true,
  id:result.sessionId,
  fingerprint:result.fingerprint,
  testId:result.testId,
  title:result.title,
  source:result.source,
  submittedAt:result.submittedAt,
  totalQuestions:result.totalQuestions,
  answered:result.answered,
  correct:result.correct,
  wrong:result.wrong,
  skipped:result.skipped,
  score:result.score,
  maximumScore:result.maximumScore,
  percentage:result.percentage,
  accuracy:result.accuracy,
  questionIds:
   result.evidence
    .map(x=>str(x.questionId))
    .filter(Boolean)
 };

 if(si<0)
  sessions.push(sRecord);
 else
  sessions[si]={
   ...sessions[si],
   ...sRecord
  };

 write(
  localStorage,
  K.sessions,
  sessions.slice(-1000)
 );

 /*
 --------------------------------------------------------
 CROSS-FEATURE SYNC SNAPSHOT
 --------------------------------------------------------
 */

 const mistakes=result.evidence.filter(
  x=>x.status==="wrong"
 );

 const retry=arr(
  read(localStorage,K.retry,[])
 );

 const mastery=arr(
  read(localStorage,K.mastery,[])
 );

 const mastered=new Set();

 mastery.forEach(x=>{
  if(!x)return;

  const id=str(
   x.questionId||
   x.id||
   x.questionID
  );

  if(
   id&&(
    x.mastered===true||
    x.isMastered===true||
    x.retryCorrect===true||
    x.correctOnRetry===true
   )
  ){
   mastered.add(id);
  }
 });

 const activeRetry=retry.filter(x=>
  x&&
  !mastered.has(str(x.questionId))
 );

 const cross={
  version:6,
  sessionId:result.sessionId,
  source:result.source,
  updatedAt:Date.now(),
  result:{
   total:result.totalQuestions,
   answered:result.answered,
   correct:result.correct,
   wrong:result.wrong,
   skipped:result.skipped,
   score:result.score,
   percentage:result.percentage,
   accuracy:result.accuracy
  },
  mistakeCount:mistakes.length,
  retryCount:activeRetry.length,
  masteryVerifiedCount:mastered.size,
  next:{
   action:
    activeRetry.length
     ?"RETRY"
     :result.accuracy<85
      ?"REVISION"
      :"NEXT_TEST",
   target:
    activeRetry.length
     ?"retry.html"
     :result.accuracy<85
      ?"question-bank.html"
      :"rankers-test-series.html"
  }
 };

 write(
  localStorage,
  "cbtCoreCrossFeatureStateV6",
  cross
 );

 window.CBTCoreV6Result=result;
 window.CBTCoreV6CrossFeature=cross;

 try{
  sessionStorage.setItem(
   "cbtCoreResultV6",
   JSON.stringify(result)
  );
  sessionStorage.setItem(
   "cbtCoreCrossFeatureStateV6",
   JSON.stringify(cross)
  );
 }catch(e){}

 return result;
}

/*
---------------------------------------------------------
 AUTOMATIC PERSISTENCE
---------------------------------------------------------
*/

let timer=null;

function schedule(){
 clearTimeout(timer);
 timer=setTimeout(()=>{
  try{saveLive();}
  catch(e){}
 },100);
}

document.addEventListener(
 "click",
 function(e){
  const target=e.target.closest(
   ".option,"+
   ".palette button,"+
   ".question-palette button,"+
   ".next-button,"+
   ".prev-button,"+
   ".review-button,"+
   ".clear-button,"+
   "[data-question-index],"+
   "[data-index]"
  );

  if(target)schedule();
 },
 true
);

document.addEventListener(
 "change",
 schedule,
 true
);

document.addEventListener(
 "input",
 schedule,
 true
);

document.addEventListener(
 "visibilitychange",
 function(){
  if(document.hidden)saveLive();
 },
 true
);

window.addEventListener(
 "beforeunload",
 function(){
  try{saveLive();}
  catch(e){}
 },
 true
);

/*
---------------------------------------------------------
 SUBMIT OBSERVER

 Original submitTest remains responsible for the actual
 CBT result. V6 observes it afterward.
---------------------------------------------------------
*/

function hook(){
 if(
  typeof window.submitTest!=="function"||
  window.submitTest.__CBTCoreV6
 )return;

 const original=window.submitTest;

 function wrapped(){
  const value=original.apply(this,arguments);

  setTimeout(()=>{
   try{
    syncResult();
   }catch(e){
    console.warn("CBT Core V6 sync:",e);
   }
  },400);

  return value;
 }

 wrapped.__CBTCoreV6=true;
 wrapped.__CBTCoreV6Original=original;

 window.submitTest=wrapped;
}

/*
---------------------------------------------------------
 PUBLIC API
---------------------------------------------------------
*/

window.CBTCoreV6={
 version:6,

 saveLive:saveLive,

 getRecovery:getRecovery,

 syncResult:syncResult,

 getState:function(){
  return {
   live:read(sessionStorage,K.liveV6,null),
   result:read(localStorage,"cbtCoreResultV6",null),
   crossFeature:
    read(
     localStorage,
     "cbtCoreCrossFeatureStateV6",
     null
    )
  };
 }
};

if(document.readyState==="loading"){
 document.addEventListener(
  "DOMContentLoaded",
  function(){
   setTimeout(hook,300);
   setTimeout(saveLive,500);
  }
 );
}else{
 setTimeout(hook,300);
 setTimeout(saveLive,500);
}

setTimeout(hook,1000);
setTimeout(hook,2500);

/*
 Re-check periodically so V6 can attach after any existing
 script creates/wraps submitTest later.
*/
setInterval(function(){
 try{hook();}
 catch(e){}
},3000);

console.log(
 "CBT Core V6 loaded — persistence/recovery mode"
);

})();
