/* =========================================================
   CBT ANALYZER PRO — RANKER MASTER ENGINE V4
   Action + Revision + Retry + Mastery bridge
   ========================================================= */
(function(){
"use strict";

const K = {
  revision: "rankerRevisionHistoryV1",
  retry: "cbtRetryQuestion",
  retryQueue: "cbtAnalyzer.retryQueue",
  mastery: "cbtMasteryV2"
};

function read(key, fallback){
  try{
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value == null ? fallback : value;
  }catch(e){
    return fallback;
  }
}

function arr(value){
  return Array.isArray(value) ? value : [];
}

function text(value){
  return String(value == null ? "" : value).trim();
}

function now(){
  return Date.now();
}

function save(key,value){
  localStorage.setItem(key,JSON.stringify(value));
}

/* ---------------------------------------------------------
   REVISION
--------------------------------------------------------- */

function recordRevision(target, type){
  target = target || {};

  const list = arr(read(K.revision,[]));

  const item = {
    id: "REV4-" + now() + "-" + Math.random().toString(36).slice(2,8),
    subject: text(target.subject) || "Unknown",
    chapter: text(target.chapter) || "Unknown",
    topic: text(target.topic) || "General",
    concept: text(target.concept),
    questionId: text(target.id),
    type: type || "targeted-revision",
    timestamp: now()
  };

  list.push(item);
  save(K.revision,list.slice(-1000));

  return item;
}

/* ---------------------------------------------------------
   RETRY QUEUE
--------------------------------------------------------- */

function queueRetry(target, mode){
  target = target || {};

  const item = {
    id: text(target.id) || ("retry-" + now()),
    questionId: text(target.id),
    question: text(target.question),
    subject: text(target.subject) || "Unknown",
    chapter: text(target.chapter) || "Unknown",
    topic: text(target.topic) || "General",
    concept: text(target.concept),
    selectedAnswer: target.selectedAnswer,
    correctAnswer: target.correctAnswer,
    mode: mode || "retry",
    createdAt: now(),
    masteryRequired: true
  };

  save(K.retry,item);

  const queue = arr(read(K.retryQueue,[]));

  const duplicate = queue.some(x =>
    text(x.questionId || x.id) === text(item.questionId)
  );

  if(!duplicate){
    queue.push(item);
    save(K.retryQueue,queue.slice(-500));
  }

  return item;
}

/* ---------------------------------------------------------
   MASTERY STATUS
--------------------------------------------------------- */

function masteryFor(id){
  if(!id) return null;

  const list = arr(read(K.mastery,[]));

  return list.find(x =>
    text(
      x.questionId ||
      x.id ||
      x.questionID
    ) === text(id)
  ) || null;
}

function isMastered(id){
  const item = masteryFor(id);
  if(!item) return false;

  const state = text(
    item.masteryState ||
    item.state ||
    item.status
  ).toLowerCase();

  return (
    state === "mastered" ||
    item.mastered === true ||
    item.isMastered === true
  );
}

/* ---------------------------------------------------------
   ROUTING
--------------------------------------------------------- */

function revise(target){
  target = target || {};

  recordRevision(target,"chapter-revision");

  const subject = text(target.subject);
  const chapter = text(target.chapter);
  const topic = text(target.topic);

  if(
    window.rankerMasterLoop &&
    window.rankerMasterLoop !== api &&
    typeof window.rankerMasterLoop.revise === "function"
  ){
    try{
      return window.rankerMasterLoop.revise(
        subject,
        chapter,
        topic
      );
    }catch(e){}
  }

  let url = "question-bank.html";

  const params = [];

  if(subject)
    params.push("subject=" + encodeURIComponent(subject));

  if(chapter)
    params.push("chapter=" + encodeURIComponent(chapter));

  if(topic)
    params.push("topic=" + encodeURIComponent(topic));

  if(params.length)
    url += "?" + params.join("&");

  window.location.href = url;
}

function retry(target){
  target = target || {};

  const item = queueRetry(target,"retry");

  window.location.href =
    "retry.html?source=ranker-master&question=" +
    encodeURIComponent(item.questionId || "");
}

function targetedPractice(target){
  target = target || {};

  const params = [
    "mode=targeted"
  ];

  if(text(target.subject))
    params.push(
      "subject=" +
      encodeURIComponent(target.subject)
    );

  if(text(target.chapter))
    params.push(
      "chapter=" +
      encodeURIComponent(target.chapter)
    );

  if(text(target.topic))
    params.push(
      "topic=" +
      encodeURIComponent(target.topic)
    );

  window.location.href =
    "rankers-test-series.html?" +
    params.join("&");
}

function masteryCheck(target){
  target = target || {};

  if(isMastered(target.id)){
    return {
      mastered:true,
      message:"Already mastered after verified retry."
    };
  }

  queueRetry(target,"mastery-check");

  window.location.href =
    "retry.html?source=mastery-check&question=" +
    encodeURIComponent(text(target.id));

  return {
    mastered:false,
    message:"Mastery retry started."
  };
}

/* ---------------------------------------------------------
   NEXT ACTION
--------------------------------------------------------- */

function nextAction(target){
  target = target || {};

  if(text(target.id)){
    if(!isMastered(target.id)){
      return {
        type:"retry",
        label:"🎯 Retry",
        run:function(){
          retry(target);
        }
      };
    }
  }

  if(
    text(target.subject) &&
    text(target.chapter) &&
    target.accuracy != null &&
    Number(target.accuracy) < 75
  ){
    return {
      type:"targeted-practice",
      label:"🎯 Targeted Practice",
      run:function(){
        targetedPractice(target);
      }
    };
  }

  return {
    type:"revise",
    label:"📖 Revise",
    run:function(){
      revise(target);
    }
  };
}

/* ---------------------------------------------------------
   PUBLIC API
--------------------------------------------------------- */

const api = {
  revise,
  retry,
  targetedPractice,
  masteryCheck,
  nextAction,
  recordRevision,
  queueRetry,
  masteryFor,
  isMastered
};

window.RankerMasterEngineV4 = api;

/*
  Existing V3 action bridge already checks
  window.rankerMasterLoop.revise().
  Provide that bridge without replacing existing methods
  when another implementation already exists.
*/
if(!window.rankerMasterLoop){
  window.rankerMasterLoop = {
    revise:function(subject,chapter,topic){
      revise({
        subject,
        chapter,
        topic
      });
    },
    retry:function(target){
      retry(target || {});
    }
  };
}else{
  if(typeof window.rankerMasterLoop.revise !== "function"){
    window.rankerMasterLoop.revise =
      function(subject,chapter,topic){
        revise({
          subject,
          chapter,
          topic
        });
      };
  }

  if(typeof window.rankerMasterLoop.retry !== "function"){
    window.rankerMasterLoop.retry =
      function(target){
        retry(target || {});
      };
  }
}

/* ---------------------------------------------------------
   V3 BUTTON COMPATIBILITY
--------------------------------------------------------- */

document.addEventListener("click",function(event){

  const reviseQuestion =
    event.target.closest(
      "[data-rmv3-revise-question]"
    );

  if(reviseQuestion){
    const id =
      reviseQuestion.dataset.rmv3ReviseQuestion;

    const engine =
      window.RankerMasterEngineV3;

    const list =
      engine &&
      typeof engine.mistakes === "function"
        ? engine.mistakes()
        : [];

    const target =
      list.find(x =>
        text(x.id) === text(id)
      );

    if(target){
      revise(target);
    }

    return;
  }

  const retryQuestion =
    event.target.closest(
      "[data-rmv3-retry-question]"
    );

  if(retryQuestion){
    const id =
      retryQuestion.dataset.rmv3RetryQuestion;

    const engine =
      window.RankerMasterEngineV3;

    const list =
      engine &&
      typeof engine.mistakes === "function"
        ? engine.mistakes()
        : [];

    const target =
      list.find(x =>
        text(x.id) === text(id)
      );

    if(target){
      retry(target);
    }

    return;
  }

  const reviseChapter =
    event.target.closest(
      "[data-rmv3-revise-subject]"
    );

  if(reviseChapter){

    const subject =
      reviseChapter.dataset.rmv3ReviseSubject;

    const chapter =
      reviseChapter.dataset.rmv3ReviseChapter;

    revise({
      subject,
      chapter
    });

    return;
  }

});

console.log(
  "Ranker Master Engine V4 loaded"
);

})();
