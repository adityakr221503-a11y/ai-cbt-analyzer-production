(function(global){
"use strict";

const VERSION="RankForge Adaptive UI V2";

function el(tag,attrs,text){
  const x=document.createElement(tag);
  Object.keys(attrs||{}).forEach(k=>x.setAttribute(k,attrs[k]));
  if(text!=null)x.textContent=text;
  return x;
}

function start(){
  if(!global.RankForgeAdaptiveControllerV2){
    alert("RankForge Adaptive Controller V2 is not loaded.");
    return;
  }

  if(global.RankForgeAdaptiveAIV2){
    try{ global.RankForgeAdaptiveAIV2.decide({}); }catch(e){}
  }

  let result;
  try{
    result=global.RankForgeAdaptiveControllerV2.launch({});
  }catch(e){
    console.error(e);
    alert("Adaptive Practice could not start: "+e.message);
    return;
  }

  if(!result || !result.ok){
    /* Fallback: use the Adaptive DPP engine, which works from your own mistakes and the question bank. */
    try{
      const d=global.RankForgeAdaptiveDPPV1 && global.RankForgeAdaptiveDPPV1.start(15);
      if(d && d.ok && d.dpp && d.dpp.questions && d.dpp.questions.length && window.RankForgeFix && window.RankForgeFix.handoff){
        window.RankForgeFix.handoff({title:"Adaptive Practice",source:"rankforge-adaptive",questions:d.dpp.questions},"rankforge-adaptive");
        return;
      }
    }catch(_){}
    alert("Adaptive Practice needs a few more questions to personalise. Take one test first, then try again.");
    return;
  }

  if(window.RankForgeFix&&window.RankForgeFix.handoff){window.RankForgeFix.handoff({title:"RankForge Adaptive Practice",source:"rankforge-adaptive",questions:result.questions},"rankforge-adaptive");}else{window.location.href="./cbt.html";}
}

function install(){
  if(document.getElementById("rankforge-adaptive-practice-v2")) return;

  const host=
    document.querySelector("#rankforge-unified-tools") ||
    document.querySelector("main") ||
    document.querySelector(".container") ||
    document.body;

  const wrap=el("div",{
    id:"rankforge-adaptive-practice-v2",
    style:
      "margin:18px 0;padding:16px;border:1px solid #ddd;"+
      "border-radius:14px;background:rgba(127,127,127,.06)"
  });

  const title=el("div",{
    style:"font-size:18px;font-weight:700;margin-bottom:6px"
  },"AI Adaptive Practice");

  const desc=el("div",{
    style:"font-size:13px;opacity:.8;margin-bottom:12px"
  },
  "Uses your CBT history, weak-topic patterns, difficulty and question diversity.");

  const button=el("button",{
    type:"button",
    id:"rankforge-start-adaptive-v2",
    style:
      "padding:11px 16px;border:0;border-radius:10px;"+
      "cursor:pointer;font-weight:700"
  },"Start AI Adaptive Practice");

  button.addEventListener("click",start);

  wrap.append(title,desc,button);
  host.appendChild(wrap);
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",install);
}else{
  install();
}

global.RankForgeAdaptiveUIV2={
  version:VERSION,
  start:start
};

})(window);
