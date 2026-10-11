(function(){
"use strict";

const V3={
  historyKey:"cbtHistory",
  sessionKey:"cbtTestSessions",
  masteryKey:"cbtMasteryV2",
  retryKey:"cbtRetryQuestion",
  queueKey:"cbtAnalyzer.retryQueue",
  resultKey:"cbtCoreResultV3"
};

function read(key,fallback){
  try{
    const v=JSON.parse(localStorage.getItem(key)||"null");
    return v==null?fallback:v;
  }catch(e){return fallback;}
}

function write(key,value){
  try{
    localStorage.setItem(key,JSON.stringify(value));
    return true;
  }catch(e){return false;}
}

function arr(v){
  return Array.isArray(v)?v:[];
}

function text(v){
  return v==null?"":String(v);
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

  return [];
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

function normalizeAnswer(v){
  if(v==null)return "";
  if(typeof v==="object"){
    return text(
      v.value ??
      v.answer ??
      v.selectedAnswer ??
      v.option ??
      ""
    ).trim();
  }
  return text(v).trim();
}

function correctAnswer(q){
  if(!q)return "";

  return normalizeAnswer(
    q.correctAnswer ??
    q.answer ??
    q.correct ??
    q.correct_option ??
    q.correctOption ??
    ""
  );
}

function selectedAnswer(q,i,ans){
  if(ans[i]!==undefined)
    return normalizeAnswer(ans[i]);

  const selectors=[
    `input[name="question-${i}"]:checked`,
    `input[name="q${i}"]:checked`,
    `[data-question-index="${i}"].selected`,
    `[data-index="${i}"].selected`,
    `[data-question="${i}"].selected`
  ];

  for(const selector of selectors){
    const el=document.querySelector(selector);
    if(el){
      return normalizeAnswer(
        el.value ||
        el.dataset.value ||
        el.dataset.answer ||
        el.textContent
      );
    }
  }

  return "";
}

function sameAnswer(a,b){
  a=normalizeAnswer(a);
  b=normalizeAnswer(b);

  if(!a||!b)return false;

  const clean=x=>x
    .replace(/\s+/g," ")
    .replace(/^\s+|\s+$/g,"")
    .toLowerCase();

  return clean(a)===clean(b);
}

function buildEvidence(){
  const qs=questions();
  const ans=answers();

  return qs.map((q,i)=>{
    const selected=selectedAnswer(q,i,ans);
    const correct=correctAnswer(q);
    const answered=selected!=="";
    const right=answered && sameAnswer(selected,correct);

    return {
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
          q.questionText ||
          q.text
        )
      ),
      subject:text(q&&q.subject),
      chapter:text(q&&q.chapter),
      topic:text(q&&q.topic),
      concept:text(q&&q.concept),
      selectedAnswer:selected||null,
      correctAnswer:correct||null,
      status:!answered
        ?"skipped"
        :(right?"correct":"wrong"),
      isCorrect:right
    };
  });
}

function calculate(){
  const evidence=buildEvidence();

  const correct=evidence.filter(x=>x.status==="correct").length;
  const wrong=evidence.filter(x=>x.status==="wrong").length;
  const skipped=evidence.filter(x=>x.status==="skipped").length;
  const answered=correct+wrong;
  const total=evidence.length;

  const score=Math.max(0,correct*4-wrong);

  return {
    version:3,
    calculatedAt:Date.now(),
    totalQuestions:total,
    answered,
    correct,
    wrong,
    skipped,
    score,
    maximumScore:total*4,
    percentage:total
      ?Number(((score/(total*4))*100).toFixed(2))
      :0,
    accuracy:answered
      ?Number(((correct/answered)*100).toFixed(2))
      :0,
    evidence
  };
}

function getSource(){
  return text(
    window.CBT_ACTIVE_SOURCE ||
    sessionStorage.getItem("CBT_ACTIVE_SOURCE") ||
    localStorage.getItem("CBT_ACTIVE_SOURCE") ||
    "CBT"
  );
}

function syncResult(){
  const result=calculate();
  const now=Date.now();

  result.source=getSource();

  /* --------------------------------------------------
     Preserve existing history.
     V3 only adds/updates a clearly identified record.
  -------------------------------------------------- */

  let history=arr(read(V3.historyKey,[]));

  const existingIndex=history.findIndex(x=>
    x &&
    x.cbtCoreV3===true &&
    x.sessionId===result.sessionId
  );

  result.sessionId=
    text(
      window.CBT_SESSION_ID ||
      sessionStorage.getItem("CBT_SESSION_ID") ||
      ""
    ) ||
    "cbt-v3-"+now;

  const historyRecord={
    cbtCoreV3:true,
    sessionId:result.sessionId,
    testId:text(
      window.CBT_TEST_ID ||
      sessionStorage.getItem("CBT_TEST_ID") ||
      ""
    ),
    title:text(
      window.CBT_TEST_TITLE ||
      document.title ||
      "CBT Test"
    ),
    source:result.source,
    submittedAt:now,
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

  if(existingIndex>=0)
    history[existingIndex]={
      ...history[existingIndex],
      ...historyRecord
    };
  else
    history.push(historyRecord);

  write(V3.historyKey,history.slice(-2000));

  /* --------------------------------------------------
     Test-session consistency
  -------------------------------------------------- */

  let sessions=arr(read(V3.sessionKey,[]));

  const session={
    cbtCoreV3:true,
    id:result.sessionId,
    testId:historyRecord.testId,
    title:historyRecord.title,
    source:result.source,
    submittedAt:now,
    totalQuestions:result.totalQuestions,
    answered:result.answered,
    correct:result.correct,
    wrong:result.wrong,
    skipped:result.skipped,
    score:result.score,
    maximumScore:result.maximumScore,
    percentage:result.percentage,
    accuracy:result.accuracy,
    questionIds:result.evidence.map(x=>x.questionId).filter(Boolean)
  };

  const si=sessions.findIndex(x=>
    x && x.id===session.id
  );

  if(si>=0)
    sessions[si]={...sessions[si],...session};
  else
    sessions.push(session);

  write(V3.sessionKey,sessions.slice(-1000));

  /* --------------------------------------------------
     Mistake evidence.
     Existing mistake system is NOT replaced.
  -------------------------------------------------- */

  try{
    const mistakes=arr(read("cbtMistakesV1",[]));

    result.evidence
      .filter(x=>x.status==="wrong")
      .forEach(x=>{
        const key=[
          x.questionId,
          x.selectedAnswer,
          x.correctAnswer
        ].join("|");

        const duplicate=mistakes.some(m=>
          m &&
          m.cbtCoreV3===true &&
          m.fingerprint===key
        );

        if(!duplicate){
          mistakes.push({
            cbtCoreV3:true,
            fingerprint:key,
            question:x.question,
            questionId:x.questionId,
            subject:x.subject,
            chapter:x.chapter,
            topic:x.topic,
            concept:x.concept,
            selectedAnswer:x.selectedAnswer,
            correctAnswer:x.correctAnswer,
            mistakeType:"Needs review",
            mistakeReason:"Needs review",
            createdAt:now,
            retryRequired:true,
            masteryRequired:true
          });
        }
      });

    write("cbtMistakesV1",mistakes.slice(-2000));
  }catch(e){}

  /* --------------------------------------------------
     Retry queue — only wrong questions.
  -------------------------------------------------- */

  try{
    let queue=arr(read(V3.queueKey,[]));

    result.evidence
      .filter(x=>x.status==="wrong")
      .forEach(x=>{
        const id=text(x.questionId);

        if(!id)return;

        const exists=queue.some(q=>
          q &&
          text(q.questionId)===id &&
          q.masteryRequired===true
        );

        if(!exists){
          queue.push({
            questionId:id,
            question:x.question,
            subject:x.subject,
            chapter:x.chapter,
            topic:x.topic,
            concept:x.concept,
            selectedAnswer:x.selectedAnswer,
            correctAnswer:x.correctAnswer,
            source:result.source,
            queuedAt:now,
            masteryRequired:true
          });
        }
      });

    write(V3.queueKey,queue.slice(-2000));
  }catch(e){}

  /* --------------------------------------------------
     Result snapshot for Orbit / Mentor layers.
  -------------------------------------------------- */

  write(V3.resultKey,result);

  try{
    sessionStorage.setItem(
      "cbtCoreResultV3",
      JSON.stringify(result)
    );
  }catch(e){}

  window.CBTCoreResultV3=result;

  return result;
}

/* ------------------------------------------------------
   Submit hook
   Original submitTest remains the primary engine.
------------------------------------------------------ */

function install(){
  if(
    typeof window.submitTest!=="function" ||
    window.submitTest.__CBTCoreV3Wrapped
  ){
    return;
  }

  const original=window.submitTest;

  function wrapped(){
    const result=original.apply(this,arguments);

    setTimeout(()=>{
      try{
        syncResult();
        console.log(
          "CBT Core V3 synced:",
          window.CBTCoreResultV3
        );
      }catch(e){
        console.warn("CBT Core V3 sync failed",e);
      }
    },0);

    return result;
  }

  wrapped.__CBTCoreV3Wrapped=true;
  wrapped.__CBTCoreV3Original=original;

  window.submitTest=wrapped;
}

window.CBTCoreV3={
  version:3,
  calculate,
  buildEvidence,
  syncResult,
  getLastResult:function(){
    return read(V3.resultKey,null);
  }
};

if(document.readyState==="loading"){
  document.addEventListener(
    "DOMContentLoaded",
    ()=>setTimeout(install,100)
  );
}else{
  setTimeout(install,100);
}

setTimeout(install,500);
setTimeout(install,1500);

console.log("CBT Core V3 loaded — preservation mode");
})();
