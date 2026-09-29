(function(){
  "use strict";

  window.RankForgeBiologyFinalHook = {
    record: function(test, answers, mode){
      try{
        const questions=Array.isArray(test)?test:[];
        const a=answers||{};
        const now=new Date().toISOString();
        const mistakes=[];
        const attempt=[];

        questions.forEach(function(q,i){
          const id=String(
            q.id||q.questionId||("BIO-NC-"+String(i+1).padStart(6,"0"))
          );

          const selected =
            a[id]!==undefined ? a[id] :
            a[i]!==undefined ? a[i] : null;

          const correct =
            q.correctIndex!==undefined ? q.correctIndex :
            q.answer!==undefined ? q.answer :
            q.correctAnswer!==undefined ? q.correctAnswer :
            q.correct!==undefined ? q.correct : null;

          const row={
            id:id,
            questionId:id,
            question:q.question||q.questionText||q.text||"",
            options:q.options||[],
            selectedAnswer:selected,
            correctAnswer:correct,
            solution:q.solution||q.explanation||"",
            explanation:q.explanation||q.solution||"",
            subject:"Biology",
            source:"BIOLOGY_7196",
            sourceType:"BIOLOGY",
            topic:q.topic||q.chapter||"",
            timestamp:now
          };

          attempt.push(row);

          if(
            selected!==null &&
            selected!==undefined &&
            String(selected)!==String(correct)
          ){
            mistakes.push(row);
          }
        });

        function read(key){
          try{
            const x=JSON.parse(localStorage.getItem(key)||"[]");
            return Array.isArray(x)?x:[];
          }catch(e){return [];}
        }

        function write(key,value){
          localStorage.setItem(key,JSON.stringify(value));
        }

        write("cbtHistory",[
          ...read("cbtHistory"),
          {
            timestamp:now,
            source:"BIOLOGY_7196",
            subject:"Biology",
            mode:mode||"normal",
            total:questions.length,
            mistakes:mistakes.length,
            questions:attempt
          }
        ]);

        write("rankBoosterAttemptHistory",[
          ...read("rankBoosterAttemptHistory"),
          {
            timestamp:now,
            source:"BIOLOGY_7196",
            subject:"Biology",
            total:questions.length,
            mistakes:mistakes.length
          }
        ]);

        write("rankforgeMistakesV1",[
          ...read("rankforgeMistakesV1"),
          ...mistakes
        ]);

        write("cbtMistakes",[
          ...read("cbtMistakes"),
          ...mistakes
        ]);

        if(localStorage.getItem("cbtMasteryV2")===null){
          localStorage.setItem("cbtMasteryV2","[]");
        }

        localStorage.setItem(
          "rankforgeBiologyLastAttempt",
          JSON.stringify({
            timestamp:now,
            source:"BIOLOGY_7196",
            total:questions.length,
            mistakes:mistakes.length
          })
        );

        console.log(
          "[RankForge Biology 7196]",
          questions.length,
          "questions;",
          mistakes.length,
          "mistakes saved"
        );

        return true;
      }catch(e){
        console.error("[RankForge Biology] persistence failed",e);
        return false;
      }
    }
  };
})();
