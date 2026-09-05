(function(){
"use strict";

/*
 CBT CORE PRESERVATION V1
 Additive compatibility layer.
 Does NOT replace the existing CBT engine.
 */

const STORAGE = {
  history:"cbtHistory",
  sessions:"cbtTestSessions",
  retry:"cbtRetryQuestion",
  mastery:"cbtMasteryV2",
  queue:"cbtAnalyzer.retryQueue"
};

function read(key,fallback){
  try{
    const v=JSON.parse(localStorage.getItem(key)||"null");
    return v==null?fallback:v;
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

function arr(v){
  return Array.isArray(v)?v:[];
}

function text(v){
  return v==null?"":String(v);
}

/* -------------------------------------------------------
   QUESTION ANSWER COMPATIBILITY
   Reads existing CBT state without taking control of it.
------------------------------------------------------- */

function findQuestionArray(){
  const candidates=[
    window.questions,
    window.testQuestions,
    window.currentQuestions,
    window.CBT_QUESTIONS,
    window.selectedQuestions
  ];

  for(const x of candidates){
    if(Array.isArray(x) && x.length)return x;
  }

  return [];
}

function findAnswerArray(){
  const candidates=[
    window.answers,
    window.userAnswers,
    window.selectedAnswers,
    window.CBT_ANSWERS
  ];

  for(const x of candidates){
    if(Array.isArray(x))return x;
  }

  return [];
}

function buildAnswerSnapshot(){
  const qs=findQuestionArray();
  const ans=findAnswerArray();

  return qs.map((q,i)=>({
    index:i,
    questionId:text(
      q && (
        q.id ||
        q.questionId ||
        q.questionID
      )
    ),
    question:text(
      q && (
        q.question ||
        q.text ||
        q.questionText
      )
    ),
    selectedAnswer:
      ans[i]!==undefined ? ans[i] : null
  }));
}

/* -------------------------------------------------------
   SESSION SAFETY
   Do not overwrite the existing session pipeline.
------------------------------------------------------- */

function ensureHistoryShape(){
  const h=arr(read(STORAGE.history,[]));

  return h.map(x=>{
    if(!x || typeof x!=="object")return x;

    if(x.timestamp==null && x.submittedAt!=null)
      x.timestamp=x.submittedAt;

    if(x.totalQuestions==null && x.total!=null)
      x.totalQuestions=x.total;

    return x;
  });
}

function ensureSessionShape(){
  const s=arr(read(STORAGE.sessions,[]));

  return s.map(x=>{
    if(!x || typeof x!=="object")return x;

    if(x.totalQuestions==null && x.questionIds)
      x.totalQuestions=x.questionIds.length;

    return x;
  });
}

/* -------------------------------------------------------
   NON-DESTRUCTIVE CBT STATE API
------------------------------------------------------- */

window.CBTCorePreservationV1={
  getQuestions:findQuestionArray,
  getAnswers:findAnswerArray,
  getAnswerSnapshot:buildAnswerSnapshot,
  getHistory:ensureHistoryShape,
  getSessions:ensureSessionShape,

  getState:function(){
    return {
      questions:findQuestionArray().length,
      answers:findAnswerArray().length,
      history:arr(read(STORAGE.history,[])).length,
      sessions:arr(read(STORAGE.sessions,[])).length,
      retry:read(STORAGE.retry,null),
      retryQueue:arr(read(STORAGE.queue,[])).length,
      mastery:arr(read(STORAGE.mastery,[])).length
    };
  }
};

/* -------------------------------------------------------
   SAFETY CHECKS
------------------------------------------------------- */

window.addEventListener("beforeunload",function(){
  try{
    const snapshot=buildAnswerSnapshot();

    if(snapshot.length){
      sessionStorage.setItem(
        "cbtLiveAnswerSnapshotV1",
        JSON.stringify({
          savedAt:Date.now(),
          answers:snapshot
        })
      );
    }
  }catch(e){}
});

/* -------------------------------------------------------
   SUBMIT PROTECTION
   Only prevents accidental duplicate clicks.
   Existing submit handler remains authoritative.
------------------------------------------------------- */

document.addEventListener("click",function(e){
  const button=e.target.closest(
    'button[type="submit"],button.submit-button,#submitTest,#submitBtn'
  );

  if(!button)return;

  if(button.dataset.cbtCoreSubmitting==="1"){
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  button.dataset.cbtCoreSubmitting="1";

  setTimeout(function(){
    button.dataset.cbtCoreSubmitting="0";
  },1500);
},true);

console.log("CBT Core Preservation V1 loaded");

})();
