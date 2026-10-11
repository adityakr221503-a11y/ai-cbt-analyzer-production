/* RANKFORGE_LEARNING_LOOP_V1 */
(function(){
"use strict";

const KEY={
  history:"cbtHistory",
  ranker:"rankBoosterAttemptHistory",
  mastery:"cbtMasteryV2",
  retry:"cbtRetryQuestion",
  queue:"cbtAnalyzer.retryQueue",
  mistakes:"rankforgeMistakes",
  progress:"rankforgeProgress",
  events:"rankforgeLearningEvents"
};

function read(k,f){
  try{
    const x=JSON.parse(localStorage.getItem(k)||"null");
    return x==null?f:x;
  }catch(e){return f}
}

function write(k,v){
  try{
    localStorage.setItem(k,JSON.stringify(v));
    return true;
  }catch(e){return false}
}

function arr(v){return Array.isArray(v)?v:[]}

function event(type,data){
  const a=arr(read(KEY.events,[]));
  a.unshift({
    type,
    ...data,
    at:new Date().toISOString()
  });
  write(KEY.events,a.slice(0,500));
}

function normalizeMistake(q,index,attempt){
  if(!q || typeof q!=="object") return null;

  const id=String(
    q.id ||
    q.questionId ||
    q.qid ||
    ("Q-"+index)
  );

  const topic=String(
    q.topic ||
    q.chapter ||
    q.subject ||
    q.unit ||
    "Unclassified"
  );

  const selected=
    q.selectedAnswer ??
    q.selected ??
    q.userAnswer ??
    q.answer;

  const correct=
    q.correctAnswer ??
    q.correctIndex ??
    q.answerKey;

  let reason=q.mistakeReason || q.mistakeType || "";

  if(!reason){
    if(selected===undefined || selected===null || selected==="")
      reason="Unattempted";
    else if(String(selected)!==String(correct))
      reason="Conceptual";
  }

  return{
    id,
    questionId:id,
    text:String(q.text||q.question||q.questionText||""),
    topic,
    subject:q.subject||"",
    chapter:q.chapter||"",
    selectedAnswer:selected,
    correctAnswer:correct,
    mistakeReason:reason,
    mistakeType:reason,
    source:q.source||attempt?.source||"CBT",
    testId:attempt?.id||attempt?.testId||"",
    status:"active",
    retryCount:Number(q.retryCount||0),
    firstSeen:new Date().toISOString(),
    lastSeen:new Date().toISOString()
  };
}

function ingestAttempt(attempt){
  if(!attempt || typeof attempt!=="object")return;

  const questions=arr(
    attempt.questions ||
    attempt.questionResults ||
    attempt.results ||
    attempt.wrongQuestions
  );

  if(!questions.length)return;

  const mistakes=arr(read(KEY.mistakes,[]));

  questions.forEach((q,i)=>{
    const selected=
      q.selectedAnswer ??
      q.selected ??
      q.userAnswer;

    const correct=
      q.correctAnswer ??
      q.correctIndex ??
      q.answerKey;

    const wrong=
      q.isWrong===true ||
      q.correct===false ||
      (
        selected!==undefined &&
        selected!==null &&
        correct!==undefined &&
        String(selected)!==String(correct)
      );

    if(!wrong)return;

    const m=normalizeMistake(q,i,attempt);
    if(!m)return;

    const old=mistakes.find(x=>String(x.id)===String(m.id));

    if(old){
      Object.assign(old,m,{
        retryCount:Number(old.retryCount||0)+1,
        lastSeen:new Date().toISOString()
      });
    }else{
      mistakes.push(m);
    }
  });

  write(KEY.mistakes,mistakes.slice(-1000));

  const queue=arr(read(KEY.queue,[]));
  const retry=arr(read(KEY.retry,[]));

  questions.forEach((q,i)=>{
    const selected=q.selectedAnswer ?? q.selected ?? q.userAnswer;
    const correct=q.correctAnswer ?? q.correctIndex ?? q.answerKey;

    const wrong=
      q.isWrong===true ||
      q.correct===false ||
      (
        selected!==undefined &&
        correct!==undefined &&
        String(selected)!==String(correct)
      );

    if(!wrong)return;

    const id=String(q.id||q.questionId||q.qid||("Q-"+i));

    if(!queue.some(x=>String(x.id||x.questionId)===id))
      queue.push({...q,id,retryStatus:"pending"});

    if(!retry.some(x=>String(x.id||x.questionId)===id))
      retry.push({...q,id,retryStatus:"pending"});
  });

  write(KEY.queue,queue.slice(-500));
  write(KEY.retry,retry.slice(-500));

  event("attempt-ingested",{
    testId:attempt.id||attempt.testId||"",
    mistakeCount:mistakes.length
  });
}

function syncHistory(){
  const seen=new Set();
  const histories=[
    ...arr(read(KEY.history,[])),
    ...arr(read(KEY.ranker,[]))
  ];

  histories.forEach(a=>{
    const id=String(
      a.id||
      a.testId||
      a.completedAt||
      a.createdAt||
      ""
    );

    if(seen.has(id))return;
    seen.add(id);
    ingestAttempt(a);
  });
}

function markMastery(id,passed){
  const mastery=read(KEY.mastery,{});
  if(!mastery[id] || typeof mastery[id]!=="object")
    mastery[id]={};

  mastery[id].lastAttempt=new Date().toISOString();
  mastery[id].status=passed?"mastered":"active";
  mastery[id].mastered=!!passed;
  mastery[id].attempts=
    Number(mastery[id].attempts||0)+1;

  write(KEY.mastery,mastery);

  const mistakes=arr(read(KEY.mistakes,[]));
  const m=mistakes.find(x=>String(x.id)===String(id));

  if(m){
    m.status=passed?"mastered":"active";
    m.lastSeen=new Date().toISOString();
  }

  write(KEY.mistakes,mistakes);
  event(passed?"mastered":"retry-failed",{id});
}

function completeRetry(id,passed){
  markMastery(id,passed);

  const filter=x=>String(x.id||x.questionId)!==String(id);

  write(KEY.queue,arr(read(KEY.queue,[])).filter(filter));

  write(KEY.retry,arr(read(KEY.retry,[])).filter(filter));
}

window.RankForgeLearningLoop={
  syncHistory,
  ingestAttempt,
  markMastery,
  completeRetry,
  read,
  write,
  keys:KEY
};

try{
  syncHistory();
}catch(e){
  console.warn("RankForge Learning Loop:",e);
}

})();
/* /RANKFORGE_LEARNING_LOOP_V1 */
