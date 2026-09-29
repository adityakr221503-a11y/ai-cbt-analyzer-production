(function(){

"use strict";

window.RankForgeBiologyFinalHook = {

  normalize:function(q,index,selected){

    if(!q) return null;

    let options =
      Array.isArray(q.options) ? q.options :
      Array.isArray(q.choices) ? q.choices :
      [q.option_a,q.option_b,q.option_c,q.option_d]
        .filter(x=>x!=null);

    let correct =
      Number.isInteger(q.correctIndex)
        ? q.correctIndex
        : Number.isInteger(q.answerIndex)
          ? q.answerIndex
          : -1;

    if(correct<0 && q.correctAnswer!=null){

      let target=String(q.correctAnswer)
        .trim()
        .toLowerCase();

      correct=options.findIndex(x=>
        String(x).trim().toLowerCase()===target
      );
    }

    if(correct<0 || correct>=options.length)
      return null;

    return {
      id:String(q.id||q.questionId||("BIO-"+index)),
      question:String(
        q.question||q.questionText||q.text||""
      ),
      options:options.map(String),
      selectedIndex:Number.isInteger(selected)?selected:-1,
      correctIndex:correct,
      correctAnswer:String(
        q.correctAnswer??options[correct]??""
      ),
      subject:"Biology",
      source:"BIOLOGY_7196",
      mistakeType:q.mistakeType||"🧠 Conceptual",
      mistakeReason:q.mistakeReason||
        "Review the NCERT concept and identify the reason for the incorrect answer."
    };
  }

};

})();
