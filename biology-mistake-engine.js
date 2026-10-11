(function(){

"use strict";

const KEY="RF_BIOLOGY_MISTAKE_BOOK_V1";
const VERSION=1;

function load(){
  try{
    const x=JSON.parse(localStorage.getItem(KEY)||"[]");
    return Array.isArray(x)?x:[];
  }catch(e){return [];}
}

function save(x){
  localStorage.setItem(KEY,JSON.stringify(x));
}

function normalizeCorrect(q){
  let x=q?.correctAnswer ??
        q?.correct_answer ??
        q?.answer ??
        q?.correct;

  if(typeof x==="number" && x>=0 && x<=3) return x;

  if(typeof x==="string"){
    const s=x.trim().toUpperCase();

    if("ABCD".includes(s) && s.length===1)
      return "ABCD".indexOf(s);

    if(/^[0-3]$/.test(s))
      return Number(s);
  }

  return -1;
}

function options(q){
  if(Array.isArray(q?.options)) return q.options;
  if(Array.isArray(q?.choices)) return q.choices;

  return [
    q?.option_a ?? q?.optionA ?? "",
    q?.option_b ?? q?.optionB ?? "",
    q?.option_c ?? q?.optionC ?? "",
    q?.option_d ?? q?.optionD ?? ""
  ];
}

function text(q){
  return q?.question ??
         q?.questionText ??
         q?.text ??
         q?.prompt ??
         "";
}

function id(q,i){
  return String(
    q?.id ??
    q?.questionId ??
    q?.qid ??
    ("BIO-ATTEMPT-"+Date.now()+"-"+i)
  );
}

window.RFBiologyMistakeEngine={

  version:VERSION,

  addWrongQuestions:function(source,questions,answers){

    if(!Array.isArray(questions) || !Array.isArray(answers))
      return {added:0,total:load().length};

    const book=load();
    const map=new Map(book.map(x=>[String(x.id),x]));
    let added=0;

    questions.forEach((q,i)=>{

      const selected=answers[i];

      if(selected===undefined || selected===null || selected===-1)
        return;

      const correct=normalizeCorrect(q);

      if(correct<0 || selected===correct)
        return;

      const record={
        id:id(q,i),
        source:source,
        question:text(q),
        options:options(q),
        correctAnswer:correct,
        userAnswer:selected,
        originalQuestion:q,
        firstWrongAt:new Date().toISOString(),
        retryCount:0,
        mastered:false
      };

      if(!map.has(record.id)){
        map.set(record.id,record);
        added++;
      }else{
        const old=map.get(record.id);
        old.userAnswer=selected;
        old.lastWrongAt=new Date().toISOString();
        old.retryCount=(old.retryCount||0);
        map.set(record.id,old);
      }
    });

    const result=Array.from(map.values());
    save(result);

    return {added,total:result.length};
  },

  all:function(){
    return load();
  },

  clear:function(){
    save([]);
  }
};

})();
