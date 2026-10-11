/* RankForge System Health V1 */
(function(){
  "use strict";

  function report(){
    const out={
      cbt:!!document.querySelector("#startButton"),
      test180:Array.isArray(window.TEST180_QUESTIONS)
        ? window.TEST180_QUESTIONS.length : 0,
      canonical:window.RankForgeCanonicalSession
        ? window.RankForgeCanonicalSession.detect().source : "NOT_LOADED",
      canonicalQuestions:window.RankForgeCanonicalSession
        ? window.RankForgeCanonicalSession.detect().questions.length : 0,
      lectureAI:!!window.RankForgeLectureAI,
      timestamp:new Date().toISOString()
    };

    window.RANKFORGE_SYSTEM_HEALTH=out;
    console.log("========== RANKFORGE HEALTH ==========");
    console.table(out);
    return out;
  }

  window.RankForgeSystemHealth={report};

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",report,{once:true});
  }else{
    report();
  }
})();
