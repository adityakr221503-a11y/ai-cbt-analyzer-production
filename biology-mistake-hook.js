(function(){

"use strict";

function tryCapture(){

  try{

    let q =
      (typeof questions!=="undefined" && Array.isArray(questions))
        ? questions
        : null;

    let a =
      (typeof answers!=="undefined" && Array.isArray(answers))
        ? answers
        : null;

    if(!q || !a || !window.RFBiologyMistakeEngine)
      return;

    const source =
      location.pathname.includes("7196")
        ? "Biology 7196 Gemini CBT"
        : "Biology Test Series";

    const result=
      window.RFBiologyMistakeEngine.addWrongQuestions(source,q,a);

    if(result.added>0){
      console.log(
        "Biology Mistake Book:",
        result.added,
        "new wrong questions;",
        result.total,
        "total"
      );
    }

  }catch(e){
    console.warn("Biology Mistake Book capture:",e);
  }
}

document.addEventListener("click",function(e){

 const t=e.target;
 if(!t) return;

 const label=(t.innerText||t.textContent||"").trim().toLowerCase();

 if(
   label.includes("submit") ||
   label.includes("finish") ||
   label.includes("test submit")
 ){
   setTimeout(tryCapture,300);
 }

},true);

window.addEventListener("biology:test:submitted",function(){
 setTimeout(tryCapture,100);
});

})();
