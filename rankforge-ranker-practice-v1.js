(function(){
"use strict";

const ACTIVE="rankforgePracticeActiveV1";

async function start(){
  const subjectRaw=document.querySelector("#rfPracticeSubject")?.value||"Mixed";
  const difficultyRaw=document.querySelector("#rfPracticeDifficulty")?.value||"All";
  const topic=document.querySelector("#rfPracticeTopic")?.value||"";
  const count=Number(document.querySelector("#rfPracticeCount")?.value||15);

  const bridge=window.RankForgeQuestionEngineCBTBridgeV2;

  if(!bridge || typeof bridge.practice!=="function"){
    alert("RankForge V2 CBT bridge is not loaded.");
    return;
  }

  try{
    const test=await bridge.practice({
      subject:subjectRaw==="Mixed"?"":subjectRaw,
      difficulty:difficultyRaw==="All"?"":difficultyRaw,
      topic,
      count,
      title:"RankForge Practice"
    });

    if(!test || !Array.isArray(test.questions) || !test.questions.length){
      alert("No validated RankForge V2 questions available for this selection.");
      return;
    }

    localStorage.setItem(ACTIVE,JSON.stringify(test));
    location.href="./cbt.html";

  }catch(e){
    console.error("RankForge V2 practice:",e);
    alert(e?.message||String(e));
  }
}

window.RankForgePracticeV1={start};
})();
