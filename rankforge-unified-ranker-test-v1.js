(function(){
"use strict";

const ACTIVE="rankforgeUnifiedRankerActiveTestV1";

function start(){
  const subject=document.querySelector("#rfTestSubject")?.value||"Mixed";
  const difficulty=document.querySelector("#rfTestDifficulty")?.value||"All";
  const topic=document.querySelector("#rfTestTopic")?.value||"";
  const count=Number(document.querySelector("#rfTestCount")?.value||45);

  try{
    const questions=window.RankForgeMasterPoolV1.select({
      subject,difficulty,topic,count
    });

    const test={
      id:"RF-UNIFIED-"+Date.now(),
      title:"RankForge AI + Question Bank Test",
      source:"rankforge-unified",
      mode:"test",
      questionCount:questions.length,
      questions,
      marking:{correct:4,wrong:-1,unanswered:0},
      createdAt:new Date().toISOString()
    };

    localStorage.setItem(ACTIVE,JSON.stringify(test));
    localStorage.setItem("CBT_ACTIVE_TEST",JSON.stringify(test));
    localStorage.setItem("CBT_ACTIVE_TEST_ID",test.id);
    localStorage.setItem("CBT_ACTIVE_TEST_SOURCE","rankforge-unified");

    location.href="./cbt.html";
  }catch(e){
    alert(e.message);
  }
}

window.RankForgeUnifiedRankerV1={start};
})();
