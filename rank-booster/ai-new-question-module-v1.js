(function(global){
"use strict";

const AI_KEY="rankForgeAIQuestionBankV1";
const HISTORY_KEY="rankForgeAINewQuestionHistoryV1";
const MASTER_KEY="rankForgeMasterQuestionPoolV1";

function read(k){
 try{return JSON.parse(localStorage.getItem(k)||"null")}
 catch(e){return null}
}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function arr(v){
 return Array.isArray(v)?v:(v&&Array.isArray(v.questions)?v.questions:[]);
}
function clean(v){return String(v??"").replace(/\s+/g," ").trim()}

function normalize(q,i){
 const text=clean(q?.text||q?.question||q?.questionText);
 const options=Array.isArray(q?.options)
  ?q.options.map(x=>clean(typeof x==="object"?(x.text??x.label??x.value):x)).filter(Boolean)
  :[];

 let correct=q?.correctIndex ?? q?.correctAnswer ?? q?.correct ?? q?.answer;

 if(typeof correct==="object" && correct!==null){
   correct=correct.index ?? correct.indexValue ?? correct.value ?? correct.answer ?? correct.text ?? null;
 }

 if(typeof correct==="string"){
   const raw=correct.trim();
   if(/^[A-Da-d]$/.test(raw)){
     correct=raw.toUpperCase().charCodeAt(0)-65;
   }else if(/^\d+$/.test(raw)){
     correct=Number(raw);
   }
 }

 if(typeof correct==="number" && Number.isFinite(correct)){
   correct=Math.trunc(correct);
 }

 return {
  ...q,
  id:String(q?.id||`AI-${Date.now()}-${i}`),
  text,question:text,options,
  correctIndex:correct,
  source:"AI Question Bank"
 };
}

function valid(q){
 return q.text.length>=20 &&
   q.options.length===4 &&
   Number.isInteger(q.correctIndex) &&
   q.correctIndex>=0 &&
   q.correctIndex<4;
}

function fp(q){
 return `${q.text}|${q.options.join("|")}`
  .toLowerCase().replace(/[^a-z0-9]+/g,"");
}

function words(s){
 return new Set(clean(s).toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>3));
}

function sim(a,b){
 const A=words(a.text),B=words(b.text);
 let common=0;A.forEach(x=>B.has(x)&&(common++));
 return common/(new Set([...A,...B]).size||1);
}

function existing(){
 let out=[];
 const ai=arr(read(AI_KEY));
 const master=arr(read(MASTER_KEY));
 ai.forEach(x=>out.push(normalize(x,0)));
 master.forEach(x=>out.push(normalize(x,0)));
 return out.filter(valid);
}

function importAndValidate(input){
 const incoming=Array.isArray(input)?input:arr(input);
 const old=existing();
 const exact=new Set(old.map(fp));
 const accepted=[],history=[];
 let rejected=0;

 incoming.forEach((raw,i)=>{
   const q=normalize(raw,i);

   if(!valid(q)){rejected++;return}

   const f=fp(q);
   if(exact.has(f)){rejected++;return}

   if(old.some(x=>sim(q,x)>=0.88)){
     rejected++;
     return;
   }

   exact.add(f);
   old.push(q);
   accepted.push(q);
   history.push({
     id:q.id,
     timestamp:new Date().toISOString(),
     status:"approved",
     qualityGate:"passed"
   });
 });

 const bank=arr(read(AI_KEY));
 const merged=bank.concat(accepted);
 save(AI_KEY,merged);

 const h=arr(read(HISTORY_KEY));
 save(HISTORY_KEY,h.concat(history));

 return {
   accepted:accepted.length,
   rejected,
   total:merged.length
 };
}

global.RankForgeAINewQuestionModuleV1={
 importAndValidate,
 getBank:()=>arr(read(AI_KEY)),
 getHistory:()=>arr(read(HISTORY_KEY))
};
})(window);
