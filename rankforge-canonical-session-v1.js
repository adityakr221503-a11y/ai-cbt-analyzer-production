/* RankForge Canonical Session Coordinator V1 */
(function(){
  "use strict";

  const KEY = "RANKFORGE_CANONICAL_SESSION_V1";

  function parse(store,key){
    try{
      const raw=store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(_){ return null; }
  }

  function validQuestions(q){
    return Array.isArray(q) &&
      q.length > 0 &&
      q.every(x => {
        const text=String(x?.question || x?.text || "").trim();
        const opts=Array.isArray(x?.options) ? x.options : [];
        return !!text && opts.length >= 2;
      });
  }

  function detect(){
    let pdfQ = parse(sessionStorage,"CBT_ACTIVE_QUESTIONS");
    const source = String(
      sessionStorage.getItem("CBT_ACTIVE_SOURCE") || ""
    ).toUpperCase();

    if(validQuestions(pdfQ) && (source === "PDF" || source === ""))
      return {
        source:"PDF",
        questions:pdfQ,
        test:parse(sessionStorage,"CBT_ACTIVE_TEST")
      };

    let active = parse(sessionStorage,"CBT_ACTIVE_TEST");

    if(active && validQuestions(active.questions))
      return {
        source:String(active.source || "MODULE").toUpperCase(),
        questions:active.questions,
        test:active
      };

    const test180 = Array.isArray(window.TEST180_QUESTIONS)
      ? window.TEST180_QUESTIONS.slice(0,180)
      : [];

    if(validQuestions(test180))
      return {
        source:"TEST180",
        questions:test180,
        test:null
      };

    return {
      source:"NONE",
      questions:[],
      test:null
    };
  }

  function publish(){
    const state=detect();

    window.RANKFORGE_CANONICAL_SESSION = state;

    try{
      sessionStorage.setItem(
        "RANKFORGE_ACTIVE_SOURCE",
        state.source
      );

      sessionStorage.setItem(
        "RANKFORGE_ACTIVE_QUESTION_COUNT",
        String(state.questions.length)
      );
    }catch(_){}

    console.log(
      "RankForge Canonical Session:",
      state.source,
      state.questions.length
    );

    return state;
  }

  window.RankForgeCanonicalSession = {
    detect,
    publish,
    validQuestions
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",publish,{once:true});
  }else{
    publish();
  }
})();
