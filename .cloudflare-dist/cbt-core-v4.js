(function(){
"use strict";

const K={
 history:"cbtHistory",
 sessions:"cbtTestSessions",
 result:"cbtCoreResultV3",
 evidence:"cbtCoreEvidenceV4",
 retry:"cbtRetryQuestion",
 queue:"cbtAnalyzer.retryQueue",
 mastery:"cbtMasteryV2"
};

const arr=v=>Array.isArray(v)?v:[];
const str=v=>v==null?"":String(v).trim();

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

function qs(){
 const names=["questions","testQuestions","currentQuestions","CBT_QUESTIONS","selectedQuestions"];
 for(const n of names)
  if(Array.isArray(window[n])&&window[n].length)return window[n];
 return [];
}

function ans(){
 const names=["answers","userAnswers","selectedAnswers","CBT_ANSWERS"];
 for(const n of names)
  if(Array.isArray(window[n]))return window[n];
 return [];
}

function answer(v){
 if(v==null)return "";
 if(typeof v==="object")
  return str(v.value??v.answer??v.selectedAnswer??v.option??v.text);
 return str(v);
}

function correct(q){
 return answer(
  q&&(q.correctAnswer??q.answer??q.correct??q.correctOption??q.correct_option)
 );
}

function selected(q,i,a){
 if(a[i]!==undefined)return answer(a[i]);

 const selectors=[
  `input[name="question-${i}"]:checked`,
  `input[name="q${i}"]:checked`,
  `[data-question-index="${i}"].selected`,
  `[data-index="${i}"].selected`,
  `[data-question="${i}"].selected`
 ];

 for(const s of selectors){
  try{
   const e=document.querySelector(s);
   if(e)return answer(e.value||e.dataset.value||e.dataset.answer||e.textContent);
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
  "CBT"
 );
}

function build(){
 const questions=qs(), answers=ans();

 return questions.map((q,i)=>{
  const s=selected(q,i,answers);
  const c=correct(q);
  const status=!s?"skipped":equal(s,c)?"correct":"wrong";

  return {
   index:i,
   questionId:str(q&&(
    q.id||q.questionId||q.questionID
   )),
   question:str(q&&(
    q.question||q.questionText||q.text
   )),
   subject:str(q&&q.subject),
   chapter:str(q&&q.chapter),
   topic:str(q&&q.topic),
   concept:str(q&&q.concept),
   selectedAnswer:s||null,
   correctAnswer:c||null,
   status:status,
   isCorrect:status==="correct"
  };
 });
}

function calculate(){
 const e=build();
 const correct=e.filter(x=>x.status==="correct").length;
 const wrong=e.filter(x=>x.status==="wrong").length;
 const skipped=e.filter(x=>x.status==="skipped").length;
 const answered=correct+wrong;
 const total=e.length;
 const score=Math.max(0,correct*4-wrong);

 return {
  version:4,
  sessionId:
   str(window.CBT_SESSION_ID)||
   str(sessionStorage.getItem("CBT_SESSION_ID"))||
   "cbt-v4-"+Date.now(),
  testId:
   str(window.CBT_TEST_ID)||
   str(sessionStorage.getItem("CBT_TEST_ID")),
  title:
   str(window.CBT_TEST_TITLE)||
   document.title||
   "CBT Test",
  source:source(),
  submittedAt:Date.now(),
  totalQuestions:total,
  answered:answered,
  correct:correct,
  wrong:wrong,
  skipped:skipped,
  score:score,
  maximumScore:total*4,
  percentage:total?Number((score/(total*4)*100).toFixed(2)):0,
  accuracy:answered?Number((correct/answered*100).toFixed(2)):0,
  evidence:e
 };
}

function sync(){
 const r=calculate();

 save(K.result,r);
 save(K.evidence,r);

 /* Existing history is preserved.
    V4 only updates its own tagged record. */
 let h=arr(read(K.history,[]));
 const hi=h.findIndex(x=>
  x&&x.cbtCoreV4===true&&x.sessionId===r.sessionId
 );

 const record={
  cbtCoreV4:true,
  sessionId:r.sessionId,
  testId:r.testId,
  title:r.title,
  source:r.source,
  submittedAt:r.submittedAt,
  totalQuestions:r.totalQuestions,
  answered:r.answered,
  correct:r.correct,
  wrong:r.wrong,
  skipped:r.skipped,
  score:r.score,
  maximumScore:r.maximumScore,
  percentage:r.percentage,
  accuracy:r.accuracy,
  questionEvidence:r.evidence
 };

 if(hi>=0)h[hi]={...h[hi],...record};
 else h.push(record);

 save(K.history,h.slice(-2000));

 /* Existing sessions are preserved. */
 let ss=arr(read(K.sessions,[]));
 const si=ss.findIndex(x=>x&&x.id===r.sessionId);

 const session={
  cbtCoreV4:true,
  id:r.sessionId,
  testId:r.testId,
  title:r.title,
  source:r.source,
  submittedAt:r.submittedAt,
  totalQuestions:r.totalQuestions,
  answered:r.answered,
  correct:r.correct,
  wrong:r.wrong,
  skipped:r.skipped,
  score:r.score,
  maximumScore:r.maximumScore,
  percentage:r.percentage,
  accuracy:r.accuracy,
  questionIds:r.evidence.map(x=>x.questionId).filter(Boolean)
 };

 if(si>=0)ss[si]={...ss[si],...session};
 else ss.push(session);

 save(K.sessions,ss.slice(-1000));

 /* Retry queue: only wrong questions, deduplicated. */
 let queue=arr(read(K.queue,[]));

 r.evidence.filter(x=>x.status==="wrong").forEach(x=>{
  if(!x.questionId)return;

  const exists=queue.some(q=>
   q&&str(q.questionId)===str(x.questionId)
  );

  if(!exists){
   queue.push({
    questionId:x.questionId,
    question:x.question,
    subject:x.subject,
    chapter:x.chapter,
    topic:x.topic,
    concept:x.concept,
    selectedAnswer:x.selectedAnswer,
    correctAnswer:x.correctAnswer,
    source:r.source,
    queuedAt:r.submittedAt,
    masteryRequired:true
   });
  }
 });

 save(K.queue,queue.slice(-2000));

 window.CBTCoreV4Result=r;

 try{
  sessionStorage.setItem(
   "cbtCoreResultV4",
   JSON.stringify(r)
  );
 }catch(e){}

 console.log(
  "CBT Core V4 synced:",
  r.correct,
  "correct /",
  r.wrong,
  "wrong /",
  r.skipped,
  "skipped"
 );

 return r;
}

/* Do NOT replace original submit logic. */
function hook(){
 if(
  typeof window.submitTest!=="function"||
  window.submitTest.__CBTCoreV4
 )return;

 const original=window.submitTest;

 function wrapped(){
  const result=original.apply(this,arguments);

  setTimeout(()=>{
   try{sync();}
   catch(e){console.warn("CBT V4 sync:",e);}
  },100);

  return result;
 }

 wrapped.__CBTCoreV4=true;
 wrapped.__CBTCoreV4Original=original;
 window.submitTest=wrapped;
}

window.CBTCoreV4={
 version:4,
 buildEvidence:build,
 calculate:calculate,
 sync:sync,
 getLastResult:()=>read(K.result,null),
 getEvidence:()=>read(K.evidence,null)
};

if(document.readyState==="loading")
 document.addEventListener("DOMContentLoaded",()=>setTimeout(hook,200));
else
 setTimeout(hook,200);

setTimeout(hook,800);
setTimeout(hook,2000);

console.log("CBT Core V4 loaded — preserve mode");
})();
