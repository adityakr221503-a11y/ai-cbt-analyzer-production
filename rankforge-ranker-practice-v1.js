(function(){
"use strict";

const ACTIVE="rankforgePracticeActiveV1";

function start(){
  const subject=document.querySelector("#rfPracticeSubject")?.value||"Mixed";
  const difficulty=document.querySelector("#rfPracticeDifficulty")?.value||"All";
  const topic=document.querySelector("#rfPracticeTopic")?.value||"";
  const count=Number(document.querySelector("#rfPracticeCount")?.value||15);

  if(!window.RankForgeMasterPoolV1){
    alert("RankForge Master Pool engine is not loaded.");
    return;
  }

  try{
    const questions=window.RankForgeMasterPoolV1.select({
      subject,difficulty,topic,count
    });

    const test={
      id:"RF-PRACTICE-"+Date.now(),
      title:"RankForge Practice",
      source:"rankforge-practice",
      mode:"practice",
      questionCount:questions.length,
      questions,
      createdAt:new Date().toISOString()
    };

    localStorage.setItem(ACTIVE,JSON.stringify(test));
    localStorage.setItem("CBT_ACTIVE_TEST",JSON.stringify(test));
    localStorage.setItem("CBT_ACTIVE_TEST_ID",test.id);
    localStorage.setItem("CBT_ACTIVE_TEST_SOURCE","rankforge-practice");

    location.href="./cbt.html";
  }catch(e){
    alert(e.message);
  }
}

window.RankForgePracticeV1={start};
})();
