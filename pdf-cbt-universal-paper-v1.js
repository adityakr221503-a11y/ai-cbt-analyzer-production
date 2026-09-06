(function(){
"use strict";

const clean=s=>String(s??"")
  .replace(/[\u200b-\u200f\ufeff]/g,"")
  .replace(/\u00a0/g," ")
  .replace(/\s+/g," ")
  .trim();

const norm=s=>clean(s)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g," ")
  .trim();

function answer(v){
  const s=clean(v).toUpperCase().replace(/[()[\].:]/g,"");
  if(/^[ABCD]$/.test(s)) return s;
  if(/^[1-4]$/.test(s)) return "ABCD"[Number(s)-1];
  return "";
}

function validateQuestion(q,testId,index){
  if(!q || typeof q!=="object") return null;

  const text=clean(
    q.question ||
    q.text ||
    q.questionText ||
    q.question_text
  );

  const rawOptions=
    Array.isArray(q.options) ? q.options :
    Array.isArray(q.choices) ? q.choices :
    Array.isArray(q.answers) ? q.answers : [];

  const options=rawOptions.map(clean).filter(Boolean);

  if(text.length<5 || options.length!==4) return null;

  if(new Set(options.map(norm)).size!==4) return null;

  const correct=answer(
    q.correctAnswer ??
    q.correct_answer ??
    q.answer ??
    ""
  );

  return {
    ...q,
    id:
      testId +
      "-q-" +
      (Number(q.number)||index+1) +
      "-" +
      (index+1),

    number:Number(q.number)||index+1,

    question:text,
    text:text,

    options,

    correctAnswer:correct,

    correctIndex:
      correct ? "ABCD".indexOf(correct) : -1,

    needsReview:!correct,

    language:"English"
  };
}

function build(questions,meta){
  const testId=String(
    meta?.testId ||
    ("pdf-test-"+Date.now())
  );

  const fileName=String(
    meta?.fileName ||
    "Imported PDF"
  );

  const valid=[];
  const rejected=[];
  const seen=new Set();

  for(let i=0;i<(Array.isArray(questions)?questions:[]).length;i++){
    const original=questions[i];
    const q=validateQuestion(
      original,
      testId,
      i
    );

    if(!q){
      rejected.push({
        index:i,
        reason:"invalid",
        question:original
      });
      continue;
    }

    const key=norm(q.question);

    if(seen.has(key)){
      rejected.push({
        index:i,
        reason:"duplicate",
        question:original
      });
      continue;
    }

    seen.add(key);
    valid.push(q);
  }

  return {
    schema:"UniversalPaper",
    schemaVersion:"1.0",

    meta:{
      testId,
      title:fileName,
      fileName,
      source:"PDF",
      language:"English",
      questionCount:valid.length,
      reviewCount:
        valid.filter(q=>q.needsReview).length,
      importedAt:
        meta?.importedAt ||
        new Date().toISOString()
    },

    sections:[{
      id:"main",
      title:"Imported PDF",
      questions:valid
    }],

    questions:valid,
    rejected
  };
}

window.PDFCBTUniversalPaper={
  build,
  validateQuestion
};

})();
