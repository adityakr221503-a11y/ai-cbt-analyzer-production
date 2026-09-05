/* =========================================================
   CBT ANALYZER PRO — RANKER MASTER ENGINE V3
   Canonical question-level evidence layer
   ========================================================= */
(function(){
"use strict";

const K={
  bank:"rankBoosterQuestionBankV1",
  attempts:"rankBoosterAttemptHistory",
  history:"cbtHistory",
  mastery:"cbtMasteryV2",
  retry:"cbtRetryQuestion",
  retryQueue:"cbtAnalyzer.retryQueue",
  revisions:"rankerRevisionHistoryV1",
  sessions:"cbtTestSessions"
};

function read(k,f){
  try{
    const v=JSON.parse(localStorage.getItem(k)||"null");
    return v==null?f:v;
  }catch(e){return f;}
}
function arr(v){return Array.isArray(v)?v:[]}
function s(v){return String(v==null?"":v).trim()}
function n(v){
  return s(v).toLowerCase()
    .replace(/\s+/g," ")
    .replace(/[“”‘’]/g,"'")
    .trim();
}
function esc(v){
  return String(v==null?"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function qid(q,i){
  q=q||{};
  return s(
    q.questionId||
    q.id||
    q._id||
    q.uid||
    ""
  ) || ("generated-"+i);
}

function qtext(q){
  q=q||{};
  return s(
    q.question||
    q.text||
    q.questionText||
    q.question_text||
    ""
  );
}

function opts(q){
  q=q||{};
  return arr(q.options||q.choices||q.answers||[])
    .map(x=>{
      if(typeof x==="object")
        return s(x.text||x.label||x.value||x.option||"");
      return s(x);
    });
}

function fp(q){
  return n(qtext(q))+"||"+opts(q).map(n).join("|");
}

function bank(){
  return arr(read(K.bank,[]));
}

function indexes(){
  const byId={},byFp={};
  bank().forEach((q,i)=>{
    const id=qid(q,i), f=fp(q);
    if(id && !byId[id]) byId[id]=q;
    if(f && !byFp[f]) byFp[f]=q;
  });
  return {byId,byFp};
}

function resolve(q,ix){
  q=q||{};
  const id=s(q.questionId||q.id||q._id||q.uid||"");
  if(id && ix.byId[id]) return ix.byId[id];

  const f=fp(q);
  if(f && ix.byFp[f]) return ix.byFp[f];

  return q;
}

function meta(q,ix){
  const r=q||{}, b=resolve(r,ix);

  return {
    id:qid(b,0)!=="generated-0"?qid(b,0):qid(r,0),
    question:qtext(b)||qtext(r)||"Question",
    subject:s(r.subject||b.subject)||"Unknown",
    chapter:s(r.chapter||b.chapter)||"Unknown",
    topic:s(r.topic||b.topic)||"General",
    concept:s(r.concept||b.concept)
  };
}

/* ---------------------------------------------------------
   ANSWER NORMALIZATION
--------------------------------------------------------- */

function answerValue(v){
  if(v==null) return null;
  if(typeof v==="object")
    return v.value??v.index??v.answer??v.selected??v.option??null;
  return v;
}

function getSelected(q){
  q=q||{};
  return answerValue(
    q.selectedAnswer ??
    q.userAnswer ??
    q.answerSelected ??
    q.selected ??
    q.user_answer ??
    q.userResponse ??
    q.response ??
    null
  );
}

function getCorrect(q){
  q=q||{};
  return answerValue(
    q.correctAnswer ??
    q.correctOption ??
    q.correct_answer ??
    q.correct ??
    q.answer ??
    q.answerKey ??
    null
  );
}

function boolCorrect(q){
  q=q||{};

  if(typeof q.isCorrect==="boolean") return q.isCorrect;
  if(typeof q.correct==="boolean") return q.correct;

  const a=getSelected(q),b=getCorrect(q);
  if(a==null || b==null) return null;

  if(typeof a==="number" && typeof b==="number")
    return a===b;

  const A=n(a),B=n(b);

  if(A===B) return true;

  const map={
    "0":"a","1":"b","2":"c","3":"d",
    "option 1":"a","option 2":"b",
    "option 3":"c","option 4":"d"
  };

  if(map[A] && map[A]===B) return true;
  if(map[B] && map[B]===A) return true;

  return false;
}

/* ---------------------------------------------------------
   QUESTION-LEVEL EVIDENCE EXTRACTION
--------------------------------------------------------- */

function questionArray(record){
  if(!record || typeof record!=="object") return [];

  const candidates=[
    record.questions,
    record.questionResults,
    record.results,
    record.answersData,
    record.attemptedQuestions,
    record.items
  ];

  for(const x of candidates){
    if(Array.isArray(x) && x.length) return x;
  }

  return [];
}

function answersObject(record){
  const a=
    record &&
    (
      record.answers||
      record.userAnswers||
      record.responses||
      record.answerMap
    );

  return a && typeof a==="object" && !Array.isArray(a)
    ? a
    : {};
}

function hydrateQuestion(q,record,index,sessionIds){
  q=q&&typeof q==="object"?Object.assign({},q):{};

  if(!q.questionId && !q.id && !q._id && !q.uid){
    const sid=sessionIds[index];
    if(sid) q.questionId=sid;
  }

  const amap=answersObject(record);
  const id=q.questionId||q.id||q._id||q.uid;

  if(getSelected(q)==null){
    const v=
      (id!=null?amap[id]:undefined) ??
      amap[index] ??
      amap[String(index)];

    if(v!=null) q.selectedAnswer=answerValue(v);
  }

  return q;
}

function expandRecord(record){
  const out=[];
  const qs=questionArray(record);
  const sessionIds=arr(record.questionIds);

  if(qs.length){
    qs.forEach((q,i)=>{
      const x=hydrateQuestion(q,record,i,sessionIds);
      x.__sourceRecord=record;
      out.push(x);
    });
    return out;
  }

  /* Some history formats store one question per record. */
  if(
    qtext(record) ||
    record.questionId ||
    record.id
  ){
    const x=Object.assign({},record);
    x.__sourceRecord=record;
    out.push(x);
  }

  return out;
}

function evidence(){
  const source=[
    ...arr(read(K.attempts,[])),
    ...arr(read(K.history,[])),
    ...arr(read(K.sessions,[]))
  ];

  const out=[];

  source.forEach(r=>{
    expandRecord(r).forEach(q=>{
      const c=boolCorrect(q);
      if(c===null) return;

      const ix=indexes();
      const m=meta(q,ix);

      out.push({
        id:m.id,
        question:m.question,
        subject:m.subject,
        chapter:m.chapter,
        topic:m.topic,
        concept:m.concept,
        correct:c,
        selected:getSelected(q),
        correctAnswer:getCorrect(q),
        mistakeType:s(
          q.mistakeType||
          q.mistakeReason||
          q.reason||
          ""
        ),
        timestamp:Number(
          q.timestamp||
          q.testTime||
          q.createdAt||
          q.submittedAt||
          q.__sourceRecord?.timestamp||
          q.__sourceRecord?.submittedAt||
          0
        )||0,
        source:s(
          q.source||
          q.__sourceRecord?.source||
          q.__sourceRecord?.testType||
          "CBT"
        )
      });
    });
  });

  return out;
}

/* ---------------------------------------------------------
   UNIQUE MISTAKES
--------------------------------------------------------- */

function mistakes(){
  const map={};

  evidence().forEach(e=>{
    if(e.correct) return;

    const key=e.id && !e.id.startsWith("generated-")
      ?"id:"+e.id
      :"fp:"+n(e.question);

    if(!map[key]){
      map[key]={
        id:e.id,
        question:e.question,
        subject:e.subject,
        chapter:e.chapter,
        topic:e.topic,
        concept:e.concept,
        count:0,
        lastAttempt:0,
        types:{},
        source:e.source
      };
    }

    map[key].count++;

    if(e.timestamp>map[key].lastAttempt)
      map[key].lastAttempt=e.timestamp;

    if(e.mistakeType){
      map[key].types[e.mistakeType]=
        (map[key].types[e.mistakeType]||0)+1;
    }
  });

  return Object.values(map).sort((a,b)=>
    b.count-a.count ||
    b.lastAttempt-a.lastAttempt
  );
}

/* ---------------------------------------------------------
   CHAPTER / TOPIC ANALYTICS
--------------------------------------------------------- */

function chapterStats(){
  const map={};

  evidence().forEach(e=>{
    if(e.chapter==="Unknown") return;

    const key=e.subject+"||"+e.chapter;

    if(!map[key]){
      map[key]={
        subject:e.subject,
        chapter:e.chapter,
        total:0,
        correct:0,
        wrong:0
      };
    }

    map[key].total++;

    if(e.correct) map[key].correct++;
    else map[key].wrong++;
  });

  return Object.values(map)
    .map(x=>{
      x.accuracy=x.total
        ?Math.round(x.correct/x.total*100)
        :0;

      x.priority=
        x.wrong*3+
        Math.max(0,75-x.accuracy);

      return x;
    })
    .sort((a,b)=>b.priority-a.priority);
}

function topicStats(){
  const map={};

  evidence().forEach(e=>{
    if(e.chapter==="Unknown") return;

    const key=[
      e.subject,e.chapter,e.topic
    ].join("||");

    if(!map[key]){
      map[key]={
        subject:e.subject,
        chapter:e.chapter,
        topic:e.topic,
        total:0,
        correct:0,
        wrong:0
      };
    }

    map[key].total++;
    e.correct
      ?map[key].correct++
      :map[key].wrong++;
  });

  return Object.values(map)
    .map(x=>{
      x.accuracy=x.total
        ?Math.round(x.correct/x.total*100)
        :0;
      x.priority=
        x.wrong*3+
        Math.max(0,75-x.accuracy);
      return x;
    })
    .sort((a,b)=>b.priority-a.priority);
}

/* ---------------------------------------------------------
   REVISION / DUE
--------------------------------------------------------- */

function revisions(){
  return arr(read(K.revisions,[]));
}

function lastRevision(subject,chapter){
  let latest=0;

  revisions().forEach(r=>{
    if(
      s(r.subject)===subject &&
      s(r.chapter)===chapter
    ){
      latest=Math.max(
        latest,
        Number(r.timestamp||r.createdAt||0)
      );
    }
  });

  return latest;
}

function weakDue(){
  const DAY=86400000;
  const now=Date.now();

  return chapterStats()
    .map(x=>{
      const last=lastRevision(
        x.subject,x.chapter
      );

      x.lastRevision=last;
      x.revised=!!last;

      x.due=
        x.accuracy<75 &&
        (!last || now-last>=3*DAY);

      return x;
    })
    .filter(x=>x.accuracy<75 || x.due);
}

/* ---------------------------------------------------------
   MASTERY
--------------------------------------------------------- */

function masteryCount(){
  const m=arr(read(K.mastery,[]));

  return m.filter(x=>{
    const state=n(
      x.masteryState||
      x.state||
      x.status||
      ""
    );

    return state==="mastered";
  }).length;
}

/* ---------------------------------------------------------
   GLOBAL ACCURACY
--------------------------------------------------------- */

function globalStats(){
  const ev=evidence();

  const total=ev.length;
  const correct=ev.filter(x=>x.correct).length;
  const wrong=total-correct;

  return {
    total,
    correct,
    wrong,
    accuracy:total
      ?Math.round(correct/total*100)
      :0
  };
}

/* ---------------------------------------------------------
   DECISION ENGINE
--------------------------------------------------------- */

function decision(){
  const weak=weakDue();
  const ms=mistakes();
  const ts=topicStats();

  if(weak.length){
    const w=weak[0];

    return {
      title:"Fix weakest chapter first",
      reason:
        w.subject+" • "+w.chapter+
        " has "+w.accuracy+
        "% accuracy with "+
        w.wrong+" wrong responses.",
      action:"Revise → Targeted Practice → Retry",
      target:w
    };
  }

  if(ms.length){
    const m=ms[0];

    return {
      title:"Clear recurring mistake",
      reason:
        m.question+
        " has been missed "+
        m.count+" time(s).",
      action:"Revision → Retry → Mastery Check",
      target:m
    };
  }

  if(ts.length){
    const t=ts[0];

    return {
      title:"Strengthen the next topic",
      reason:
        t.subject+" • "+t.chapter+
        " • "+t.topic+
        " is the highest-priority topic.",
      action:"Topic Practice → New Pattern",
      target:t
    };
  }

  return {
    title:"Build evidence",
    reason:
      "More real question-level attempts are needed.",
    action:"Start a Ranker Test",
    target:null
  };
}

/* ---------------------------------------------------------
   RENDER
--------------------------------------------------------- */

function render(){
  const box=document.getElementById(
    "rankerMasterLoop"
  );

  if(!box) return;

  const g=globalStats();
  const ms=mistakes();
  const ch=chapterStats();
  const weak=weakDue();
  const mastered=masteryCount();
  const d=decision();

  const weakHtml=weak.slice(0,6).map((x,i)=>`
    <div class="test">
      <h3>${i+1}. ${esc(x.chapter)}</h3>
      <div class="muted">
        ${esc(x.subject)}
        • ${x.accuracy}% accuracy
        • ${x.wrong} mistakes
        ${x.due?"• 🔔 Due":""}
      </div>
      <button type="button"
        data-rmv3-revise-subject="${esc(x.subject)}"
        data-rmv3-revise-chapter="${esc(x.chapter)}">
        📖 Revise
      </button>
    </div>
  `).join("");

  const mistakeHtml=ms.slice(0,8).map((x,i)=>`
    <div class="test">
      <h3>${i+1}. ${esc(x.question)}</h3>
      <div class="muted">
        ${esc(x.subject)}
        • ${esc(x.chapter)}
        • ${esc(x.topic)}
        • ${x.count} mistake${x.count===1?"":"s"}
      </div>
      <div style="
        display:grid;
        grid-template-columns:
        repeat(auto-fit,minmax(145px,1fr));
        gap:8px;margin-top:9px">
        <button type="button"
          data-rmv3-revise-question="${esc(x.id)}">
          📖 Revise
        </button>
        <button type="button"
          data-rmv3-retry-question="${esc(x.id)}">
          🎯 Retry
        </button>
      </div>
    </div>
  `).join("");

  const chapterHtml=ch.slice(0,6).map(x=>`
    <div class="test">
      <h3>${esc(x.subject)} • ${esc(x.chapter)}</h3>
      <div class="muted">
        ${x.accuracy}% accuracy
        • ${x.correct} correct
        • ${x.wrong} wrong
      </div>
    </div>
  `).join("");

  box.innerHTML=`
    <div style="
      display:grid;
      grid-template-columns:
      repeat(auto-fit,minmax(140px,1fr));
      gap:10px;margin-bottom:15px">

      <div class="stat">
        <div class="num">${g.total}</div>
        <div class="muted">Real Questions</div>
      </div>

      <div class="stat">
        <div class="num">${g.accuracy}%</div>
        <div class="muted">True Accuracy</div>
      </div>

      <div class="stat">
        <div class="num">${ms.length}</div>
        <div class="muted">Unique Mistakes</div>
      </div>

      <div class="stat">
        <div class="num">${mastered}</div>
        <div class="muted">Mastered</div>
      </div>
    </div>

    <div class="test" style="
      border:2px solid rgba(79,70,229,.22);
      background:rgba(79,70,229,.04)">
      <div class="muted">🧠 NEXT BEST ACTION</div>
      <h3>${esc(d.title)}</h3>
      <p>${esc(d.reason)}</p>
      <strong>${esc(d.action)}</strong>
    </div>

    <h2 style="margin-top:20px">
      🎯 Weak & Due Chapters
    </h2>

    ${
      weakHtml ||
      `<div class="test">
        No evidence-based weak chapter detected.
      </div>`
    }

    <h2 style="margin-top:20px">
      🔁 Active Mistakes
    </h2>

    ${
      mistakeHtml ||
      `<div class="test">
        No unresolved mistake evidence yet.
      </div>`
    }

    <h2 style="margin-top:20px">
      📊 Chapter Performance
    </h2>

    ${
      chapterHtml ||
      `<div class="test">
        Take real CBT/Ranker attempts to build chapter analytics.
      </div>`
    }
  `;
}

/* ---------------------------------------------------------
   ACTION BRIDGE
--------------------------------------------------------- */

document.addEventListener("click",function(e){
  const r=e.target.closest("[data-rmv3-revise-subject]");
  if(r){
    const subject=r.dataset.rmv3ReviseSubject;
    const chapter=r.dataset.rmv3ReviseChapter;

    try{
      const list=revisions();
      list.push({
        id:"REV3-"+Date.now(),
        subject,
        chapter,
        type:"chapter-revision",
        timestamp:Date.now()
      });
      localStorage.setItem(
        K.revisions,
        JSON.stringify(list.slice(-1000))
      );
    }catch(_){}

    if(
      window.rankerMasterLoop &&
      typeof window.rankerMasterLoop.revise==="function"
    ){
      window.rankerMasterLoop.revise(
        subject,chapter
      );
    }else{
      window.location.href=
        "question-bank.html?subject="+
        encodeURIComponent(subject)+
        "&chapter="+
        encodeURIComponent(chapter);
    }
    return;
  }

  const qrev=e.target.closest(
    "[data-rmv3-revise-question]"
  );

  if(qrev){
    const id=qrev.dataset.rmv3ReviseQuestion;
    const m=mistakes().find(x=>String(x.id)===String(id));

    if(m){
      localStorage.setItem(
        K.retry,
        JSON.stringify({
          questionId:m.id,
          question:m.question,
          subject:m.subject,
          chapter:m.chapter,
          topic:m.topic,
          concept:m.concept,
          mode:"revision"
        })
      );
    }

    window.location.href="retry.html";
    return;
  }

  const retry=e.target.closest(
    "[data-rmv3-retry-question]"
  );

  if(retry){
    const id=retry.dataset.rmv3RetryQuestion;
    const m=mistakes().find(x=>String(x.id)===String(id));

    if(m){
      localStorage.setItem(
        K.retry,
        JSON.stringify({
          questionId:m.id,
          question:m.question,
          subject:m.subject,
          chapter:m.chapter,
          topic:m.topic,
          concept:m.concept,
          mode:"retry"
        })
      );
    }

    window.location.href="retry.html";
  }
});

/* ---------------------------------------------------------
   PUBLIC API
--------------------------------------------------------- */

window.RankerMasterEngineV3={
  evidence,
  mistakes,
  chapterStats,
  topicStats,
  weakDue,
  globalStats,
  masteryCount,
  decision,
  render
};

function boot(){
  render();
}

if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded",boot);
else
  boot();

setTimeout(render,500);
setTimeout(render,1500);

})();
