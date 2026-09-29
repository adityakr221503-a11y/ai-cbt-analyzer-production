(function(){

"use strict";

/*
 * Biology → existing RankForge bridge.
 *
 * IMPORTANT:
 * This does NOT create another Mistake Book.
 * It does NOT store Biology mistakes separately.
 * It does NOT modify BIOLOGY_ACTIVE_BANK.json.
 *
 * It exposes a normalized submission event so the
 * existing RankForge CBT/Mistake/Retry pipeline can
 * consume Biology submissions.
 */

window.RankForgeBiologyBridge = {

  version: "1.0",

  submit: function(payload){

    if(!payload || !Array.isArray(payload.questions))
      return false;

    const event = new CustomEvent(
      "rankforge:biology:cbt-submitted",
      {
        detail:{
          source:payload.source || "biology",
          questions:payload.questions,
          answers:Array.isArray(payload.answers)
            ? payload.answers
            : [],
          testId:payload.testId || null,
          bankId:payload.bankId || null,
          bankCount:payload.bankCount || null,
          timestamp:Date.now()
        }
      }
    );

    window.dispatchEvent(event);

    console.log(
      "[RankForge Biology Bridge] submission emitted",
      event.detail.source
    );

    return true;
  }

};

})();
