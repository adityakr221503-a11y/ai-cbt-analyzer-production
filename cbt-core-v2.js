(function(){
"use strict";

const KEY={
  live:"cbtLiveAnswerSnapshotV1",
  history:"cbtHistory",
  sessions:"cbtTestSessions",
  retry:"cbtRetryQuestion",
  mastery:"cbtMasteryV2",
  queue:"cbtAnalyzer.retryQueue"
};

function arr(v){return Array.isArray(v)?v:[]}
function txt(v){return v==null?"":String(v)}
function read(k,f){
  try{
    const v=JSON.parse(localStorage.getItem(k)||"null");
    return v==null?f:v;
  }catch(e){return f}
}
function safeSession(k,f){
  try{
    const v=JSON.parse(sessionStorage.getItem(k)||"null");
    return v==null?f:v;
  }catch(e){return f}
}

function questionPool(){
  const names=[
    "questions",
    "testQuestions",
    "currentQuestions",
    "CBT_QUESTIONS",
    "selectedQuestions"
  ];

  for(const n of names){
    if(Array.isArray(window[n]) && window[n].length)
      return window[n];
  }

  return [];
}

function answerPool(){
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

function selectedFromDOM(index){
  const selectors=[
    `[data-question-index="${index}"].selected`,
    `[data-index="${index}"].selected`,
    `[data-question="${index}"].selected`,
    `.option.selected`,
    `input[name="question-${index}"]:checked`,
    `input[name="q${index}"]:checked`
  ];

  for(const selector of selectors){
    const node=document.querySelector(selector);
    if(node){
      return txt(
        node.value ||
        node.dataset.value ||
        node.dataset.answer ||
        node.textContent
      ).trim() || null;
    }
  }

  return null;
}

function snapshot(){
  const qs=questionPool();
  const ans=answerPool();

  return qs.map(function(q,i){
    let selected=
      ans[i]!==undefined ? ans[i] : null;

    if(selected===null || selected===undefined || selected==="")
      selected=selectedFromDOM(i);

    return {
      index:i,
      questionId:txt(
        q && (
          q.id ||
          q.questionId ||
          q.questionID
        )
      ),
      question:txt(
        q && (
          q.question ||
          q.text ||
          q.questionText
        )
      ),
      subject:txt(q && q.subject),
      chapter:txt(q && q.chapter),
      topic:txt(q && q.topic),
      selectedAnswer:
        selected===undefined ? null : selected
    };
  });
}

function saveLive(){
  const data=snapshot();

  if(!data.length)return;

  try{
    sessionStorage.setItem(
      KEY.live,
      JSON.stringify({
        version:2,
        savedAt:Date.now(),
        totalQuestions:data.length,
        answered:data.filter(x =>
          x.selectedAnswer!==null &&
          txt(x.selectedAnswer).trim()!==""
        ).length,
        answers:data
      })
    );
  }catch(e){}
}

function paletteState(){
  const buttons=Array.from(
    document.querySelectorAll(
      ".palette button, .question-palette button, [data-question-index]"
    )
  );

  return buttons.map(function(b,i){
    const cls=txt(b.className);

    let state="notvisited";

    if(cls.includes("answered-review"))
      state="answered-review";
    else if(cls.includes("review"))
      state="review";
    else if(cls.includes("answered"))
      state="answered";
    else if(cls.includes("notanswered"))
      state="notanswered";
    else if(cls.includes("current"))
      state="current";

    return {
      index:i,
      text:txt(b.textContent).trim(),
      state:state
    };
  });
}

/* -------------------------------------------------------
   AUTO SAVE
------------------------------------------------------- */

let saveTimer=null;

function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(saveLive,80);
}

document.addEventListener(
  "click",
  function(e){
    const target=e.target.closest(
      ".option,"+
      ".palette button,"+
      ".question-palette button,"+
      "[data-question-index],"+
      "[data-index],"+
      "[data-question]"
    );

    if(target)scheduleSave();
  },
  true
);

document.addEventListener(
  "change",
  function(){
    scheduleSave();
  },
  true
);

document.addEventListener(
  "input",
  function(){
    scheduleSave();
  },
  true
);

/* -------------------------------------------------------
   BEFORE LEAVE / VISIBILITY
------------------------------------------------------- */

window.addEventListener("beforeunload",saveLive);

document.addEventListener(
  "visibilitychange",
  function(){
    if(document.hidden)saveLive();
  }
);

/* -------------------------------------------------------
   SUBMIT SNAPSHOT
   Does not replace existing submit handler.
------------------------------------------------------- */

document.addEventListener(
  "click",
  function(e){
    const button=e.target.closest(
      ".submit-button,"+
      "#submitTest,"+
      "#submitBtn,"+
      "[data-action='submit-test']"
    );

    if(!button)return;

    saveLive();

    try{
      sessionStorage.setItem(
        "cbtCoreSubmitRequestedV2",
        String(Date.now())
      );
    }catch(e){}
  },
  true
);

/* -------------------------------------------------------
   PUBLIC API
------------------------------------------------------- */

window.CBTCoreV2={
  version:2,

  getQuestions:function(){
    return questionPool();
  },

  getAnswers:function(){
    return answerPool();
  },

  getSnapshot:function(){
    return snapshot();
  },

  getPaletteState:function(){
    return paletteState();
  },

  save:function(){
    saveLive();
    return true;
  },

  getState:function(){
    const s=snapshot();

    return {
      total:s.length,
      answered:s.filter(x =>
        x.selectedAnswer!==null &&
        txt(x.selectedAnswer).trim()!==""
      ).length,
      unanswered:s.filter(x =>
        x.selectedAnswer===null ||
        txt(x.selectedAnswer).trim()===""
      ).length,
      history:arr(read(KEY.history,[])).length,
      sessions:arr(read(KEY.sessions,[])).length,
      retryQueue:arr(read(KEY.queue,[])).length,
      mastery:arr(read(KEY.mastery,[])).length,
      palette:paletteState()
    };
  }
};

/* -------------------------------------------------------
   LIGHTWEIGHT STATE MONITOR
------------------------------------------------------- */

let lastSignature="";

function monitor(){
  try{
    const s=snapshot();
    const signature=JSON.stringify(
      s.map(x=>[
        x.index,
        x.questionId,
        x.selectedAnswer
      ])
    );

    if(signature!==lastSignature){
      lastSignature=signature;
      saveLive();
    }
  }catch(e){}
}

setInterval(monitor,1000);

document.addEventListener(
  "DOMContentLoaded",
  function(){
    setTimeout(saveLive,500);
    setTimeout(saveLive,1500);
    setTimeout(saveLive,3000);
    console.log("CBT Core V2 active");
  }
);

console.log("CBT Core V2 loaded — existing engine preserved");

})();
