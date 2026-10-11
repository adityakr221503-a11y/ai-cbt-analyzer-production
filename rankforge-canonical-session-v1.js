(function(){
"use strict";

const KEY="RANKFORGE_CANONICAL_SESSION_V1";

function parse(store,key){
  try{
    const raw=store.getItem(key);
    if(!raw)return null;
    const value=JSON.parse(raw);
    return value;
  }catch(e){
    return null;
  }
}

function validQuestions(q){
  return Array.isArray(q) &&
    q.length>0 &&
    q.every(x =>
      x &&
      typeof x==="object" &&
      typeof (x.question||x.text)==="string" &&
      Array.isArray(x.options) &&
      x.options.length>=2
    );
}

function normalise(q){
  if(!Array.isArray(q))return [];
  return q.map((x,i)=>({
    ...x,
    id:String(x.id || ("RF-Q-"+(i+1))),
    question:String(x.question || x.text || ""),
    options:Array.isArray(x.options)?x.options:[],
    correctAnswer:
      x.correctAnswer ??
      x.correctIndex ??
      x.answer ??
      null
  })).filter(x=>x.question && x.options.length>=2);
}

function detect(){

  // PDF session has highest priority.
  const pdf=normalise(parse(sessionStorage,"CBT_ACTIVE_QUESTIONS"));
  const source=String(
    sessionStorage.getItem("CBT_ACTIVE_SOURCE") || ""
  ).toUpperCase();

  if(validQuestions(pdf) && (
      source==="PDF" ||
      source==="PDF_MODULE" ||
      source==="PDF_CBT" ||
      source===""
  )){
    return {
      source:"PDF",
      questions:pdf,
      test:parse(sessionStorage,"CBT_ACTIVE_TEST")
    };
  }

  // Explicit active test.
  const active=parse(sessionStorage,"CBT_ACTIVE_TEST");
  if(active && validQuestions(normalise(active.questions))){
    return {
      source:String(active.source||"MODULE").toUpperCase(),
      questions:normalise(active.questions),
      test:active
    };
  }

  // Test 180 canonical fallback.
  const t180=normalise(
    Array.isArray(window.TEST180_QUESTIONS)
      ? window.TEST180_QUESTIONS.slice(0,180)
      : []
  );

  if(validQuestions(t180)){
    return {
      source:"TEST180",
      questions:t180,
      test:null
    };
  }

  return {
    source:"NONE",
    questions:[],
    test:null
  };
}

function publish(){
  const state=detect();

  window.RANKFORGE_CANONICAL_STATE=state;
  window.RANKFORGE_ACTIVE_SOURCE=state.source;
  window.RANKFORGE_ACTIVE_QUESTIONS=state.questions;
  window.RANKFORGE_ACTIVE_TEST=state.test;

  try{
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        source:state.source,
        count:state.questions.length,
        timestamp:Date.now()
      })
    );
  }catch(e){}

  return state;
}

window.RankForgeCanonicalSession={
  detect,
  publish,
  validQuestions,
  normalise
};

window.addEventListener("pageshow",publish);
window.addEventListener("visibilitychange",function(){
  if(document.visibilityState==="visible")publish();
});

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",publish,{once:true});
}else{
  publish();
}

})();
