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

const STAGING_KEY="rankForgeAIQuestionStagingV2";
const APPROVAL_KEY="rankForgeAIApprovalV2";

function readArr(k){
  const v=read(k);
  return arr(v);
}

function saveStage(v){ save(STAGING_KEY,v); }
function saveApproval(v){ save(APPROVAL_KEY,v); }

function validateIncoming(input){
  const incoming=Array.isArray(input)?input:arr(input);
  const old=existing();
  const exact=new Set(old.map(fp));
  const accepted=[];
  const rejected=[];
  const staged=[];

  incoming.forEach((raw,i)=>{
    const q=normalize(raw,i);

    if(!valid(q)){
      rejected.push({
        index:i,
        reason:"INVALID_SCHEMA",
        question:q
      });
      return;
    }

    const f=fp(q);

    if(exact.has(f)){
      rejected.push({
        index:i,
        reason:"EXACT_DUPLICATE",
        question:q
      });
      return;
    }

    const dup=old.find(x=>sim(q,x)>=0.88);

    if(dup){
      rejected.push({
        index:i,
        reason:"NEAR_DUPLICATE",
        against:dup.id,
        question:q
      });
      return;
    }

    exact.add(f);
    old.push(q);

    q.status="STAGED";
    q.validationStatus="PASSED";
    q.approvalStatus="PENDING";
    q.qualityGate="passed";
    q.qualityScore=Number(q.qualityScore||0);
    q.noveltyScore=Number(q.noveltyScore||0);
    q.stagedAt=new Date().toISOString();

    staged.push(q);
    accepted.push(q);
  });

  saveStage(staged);

  return {
    accepted:accepted.length,
    rejected:rejected.length,
    rejectedItems:rejected,
    staged:staged.length,
    totalStaged:staged.length
  };
}

function approveStaged(ids){
  const wanted=new Set(
    Array.isArray(ids)?ids.map(String):[]
  );

  const staged=readArr(STAGING_KEY);
  const current=readArr(AI_KEY);

  const approved=[];
  const remaining=[];

  staged.forEach(q=>{
    if(wanted.size===0 || wanted.has(String(q.id))){
      const cleanQ={
        ...q,
        status:"APPROVED",
        validationStatus:"PASSED",
        approvalStatus:"APPROVED",
        approvedAt:new Date().toISOString(),
        source:"AI Question Bank"
      };

      approved.push(cleanQ);
    }else{
      remaining.push(q);
    }
  });

  const existingIds=new Set(
    current.map(x=>String(x?.id||""))
  );

  const fresh=approved.filter(
    q=>!existingIds.has(String(q.id))
  );

  saveStage(remaining);
  saveApproval(
    readArr(APPROVAL_KEY).concat(fresh)
  );
  save(
    AI_KEY,
    current.concat(fresh)
  );

  return {
    approved:fresh.length,
    remaining:remaining.length,
    total:current.length+fresh.length
  };
}

function approveAllStaged(){
  return approveStaged([]);
}

function getStaged(){
  return readArr(STAGING_KEY);
}

function getApproved(){
  return readArr(AI_KEY);
}

function importAndValidate(input){
  /*
   * IMPORTANT:
   * Validation NEVER directly approves questions.
   * They enter staging first.
   */
  return validateIncoming(input);
}

global.RankForgeAINewQuestionModuleV1={
  importAndValidate,
  validateIncoming,
  approveStaged,
  approveAllStaged,
  getStaged,
  getApproved,
  getBank:()=>arr(read(AI_KEY)),
  getHistory:()=>arr(read(HISTORY_KEY))
};

global.RankForgeAINewQuestionModuleV1={
 importAndValidate,
 getBank:()=>arr(read(AI_KEY)),
 getHistory:()=>arr(read(HISTORY_KEY))
};
})(window);

/* RANKFORGE_TARGETED_DPP_V1 */
(function(){
"use strict";

window.RankForgeTargetedDPP={
  version:"RANKFORGE_TARGETED_DPP_V1",

  buildRequest:function(topic,subject,count){
    return {
      type:"targeted-dpp",
      subject:subject||"",
      topic:topic||"",
      count:Number(count||15),
      source:"RankForge Student Weakness Engine",
      requirements:{
        fresh:true,
        fourOptions:true,
        oneCorrect:true,
        ncertFirst:true,
        examinerThinking:true,
        avoidRewordedDuplicates:true,
        explanations:true,
        detailedSolutions:true
      }
    };
  }
};
})();
