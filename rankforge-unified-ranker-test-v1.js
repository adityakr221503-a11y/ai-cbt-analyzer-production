(function(){
"use strict";

const ACTIVE="rankforgeUnifiedRankerActiveV1";

async function start(){
  const subjectRaw=document.querySelector("#rfTestSubject")?.value||"Mixed";
  const difficultyRaw=document.querySelector("#rfTestDifficulty")?.value||"All";
  const topic=document.querySelector("#rfTestTopic")?.value||"";
  const count=Number(document.querySelector("#rfTestCount")?.value||45);

  const bridge=window.RankForgeQuestionEngineCBTBridgeV2;

  if(!bridge || typeof bridge.test!=="function"){
    alert("RankForge V2 CBT bridge is not loaded.");
    return;
  }

  try{
    const test=await bridge.test({
      subject:subjectRaw==="Mixed"?"":subjectRaw,
      difficulty:difficultyRaw==="All"?"":difficultyRaw,
      topic,
      count,
      title:"RankForge AI + Question Bank Test"
    });

    if(!test || !Array.isArray(test.questions) || !test.questions.length){
      alert("No validated RankForge V2 questions available for this selection.");
      return;
    }

    localStorage.setItem(ACTIVE,JSON.stringify(test));
    location.href="./cbt.html";

  }catch(e){
    console.error("RankForge V2 unified test:",e);
    alert(e?.message||String(e));
  }
}

window.RankForgeUnifiedRankerV1={start};
})();
