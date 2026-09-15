(function(){
"use strict";

const AI_KEY="rankForgeAIQuestionBankV1";
const MASTER_KEY="rankForgeMasterQuestionPoolV1";
const DPP_KEYS=[
  "dppQuestionBank","rankforgeDPPQuestionBank",
  "rankForgeDPPBankV1","dppBank","dppQuestions"
];
const QB_KEYS=[
  "rankerQuestionBank","rankForgeQuestionBank",
  "questionBank","rankforgeQuestionBankV1"
];

const read=k=>{
  try{return JSON.parse(localStorage.getItem(k)||"null")}
  catch(e){return null}
};

const flatten=v=>{
  if(Array.isArray(v))return v;
  if(v&&Array.isArray(v.questions))return v.questions;
  if(v&&Array.isArray(v.items))return v.items;
  return [];
};

const clean=v=>String(v??"").replace(/\s+/g," ").trim();

function normalize(q,i,source){
  if(!q||typeof q!=="object")return null;

  const text=clean(q.text||q.question||q.questionText||q.prompt);
  const options=flatten(q.options||q.choices||q.answers)
    .map(x=>clean(typeof x==="object"?(x.text??x.label??x.value):x))
    .filter(Boolean);

  let correct=q.correctIndex??q.correctAnswer??q.correct??q.answer;
  if(typeof correct==="string"){
    const letter=correct.trim().toUpperCase();
    if(/^[A-D]$/.test(letter))correct=letter.charCodeAt(0)-65;
    else if(/^\d+$/.test(letter))correct=Number(letter);
    else{
      const idx=options.findIndex(x=>x.toLowerCase()===correct.toLowerCase());
      if(idx>=0)correct=idx;
    }
  }

  if(typeof correct!=="number" || correct<0 || correct>=options.length)return null;
  if(text.length<10 || options.length<2)return null;

  return {
    ...q,
    id:String(q.id||q.questionId||`${source||"q"}-${i}`),
    text,
    question:text,
    options,
    correctIndex:correct,
    subject:clean(q.subject||q.section||"Mixed")||"Mixed",
    chapter:clean(q.chapter||q.unit||""),
    topic:clean(q.topic||q.subtopic||""),
    difficulty:clean(q.difficulty||q.level||"NEET+"),
    trapType:clean(q.trapType||q.trap||""),
    source:source||clean(q.source)||"Unknown"
  };
}

function fingerprint(q){
  return [
    clean(q.text).toLowerCase(),
    q.options.map(clean).join("|").toLowerCase()
  ].join("||").replace(/[^a-z0-9|]+/g,"");
}

function wordSet(s){
  return new Set(
    clean(s).toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w=>w.length>=4)
  );
}

function similarity(a,b){
  const A=wordSet(a.text),B=wordSet(b.text);
  if(!A.size||!B.size)return 0;
  let common=0;
  A.forEach(w=>{if(B.has(w))common++});
  return common/(new Set([...A,...B]).size||1);
}

function quality(q){
  let s=0;
  const t=q.text.toLowerCase();

  if(q.options.length===4)s+=10;
  if(q.correctIndex>=0)s+=15;
  if(q.subject!=="Mixed")s+=5;
  if(q.chapter)s+=5;
  if(q.topic)s+=5;
  if(q.text.length>=120)s+=8;
  if(q.text.length>=220)s+=5;

  if(/assertion|statement|incorrect|correct|except|match|consider/.test(t))s+=10;
  if(/calculate|find|ratio|maximum|minimum|graph|application/.test(t))s+=10;
  if(/ncert|according to|given|following/.test(t))s+=5;

  const d=q.difficulty.toLowerCase();
  if(d.includes("rank"))s+=10;
  else if(d.includes("very"))s+=8;
  else if(d.includes("hard"))s+=6;
  else if(d.includes("neet+"))s+=5;

  return Math.min(100,s);
}

function collect(){
  const sources=[];

  QB_KEYS.forEach(k=>flatten(read(k)).forEach((q,i)=>{
    const n=normalize(q,i,"Ranker Question Bank");
    if(n)sources.push(n);
  }));

  DPP_KEYS.forEach(k=>flatten(read(k)).forEach((q,i)=>{
    const n=normalize(q,i,"DPP");
    if(n)sources.push(n);
  }));

  flatten(read(AI_KEY)).forEach((q,i)=>{
    const n=normalize(q,i,"AI Question Bank");
    if(n)sources.push(n);
  });

  return sources;
}

function build(){
  const all=collect();
  const seen=new Map();
  const rejected=[];
  const accepted=[];

  all.forEach(q=>{
    const fp=fingerprint(q);

    if(seen.has(fp)){
      rejected.push({...q,rejection:"exact-duplicate"});
      return;
    }

    let near=false;
    for(const old of accepted){
      if(q.subject!=="Mixed" && old.subject!=="Mixed" &&
         q.subject!==old.subject)continue;

      if(similarity(q,old)>=0.88){
        near=true;
        rejected.push({...q,rejection:"near-duplicate"});
        break;
      }
    }

    if(near)return;

    q.qualityScore=quality(q);
    seen.set(fp,q);
    accepted.push(q);
  });

  accepted.sort((a,b)=>b.qualityScore-a.qualityScore);

  const pool={
    version:"1.0.0",
    createdAt:new Date().toISOString(),
    total:accepted.length,
    target:"60000-70000+",
    questions:accepted,
    stats:{
      ranker:accepted.filter(q=>q.source==="Ranker Question Bank").length,
      dpp:accepted.filter(q=>q.source==="DPP").length,
      ai:accepted.filter(q=>q.source==="AI Question Bank").length,
      rejectedDuplicates:rejected.length
    }
  };

  localStorage.setItem(MASTER_KEY,JSON.stringify(pool));
  return pool;
}

function getPool(){
  const saved=read(MASTER_KEY);
  return saved&&Array.isArray(saved.questions)?saved:build();
}

function select(config={}){
  const pool=getPool().questions;
  const count=Math.max(1,Number(config.count)||15);

  let eligible=pool.filter(q=>{
    if(config.subject&&config.subject!=="Mixed"&&q.subject!==config.subject)return false;
    if(config.difficulty&&config.difficulty!=="All"&&
       q.difficulty.toLowerCase()!==config.difficulty.toLowerCase())return false;

    const search=clean(config.topic||"").toLowerCase();
    if(search){
      const hay=`${q.chapter} ${q.topic} ${q.text}`.toLowerCase();
      if(!hay.includes(search))return false;
    }
    return true;
  });

  if(eligible.length<count){
    throw new Error(
      `Only ${eligible.length} unique quality questions available; ${count} required. Repeats are disabled.`
    );
  }

  /*
   * Diversity-aware selection:
   * quality remains important, but repeated chapter/topic/source
   * patterns are penalized so the test does not become monotonous.
   */
  eligible=eligible
    .map(q=>({...q,_score:q.qualityScore}))
    .sort((a,b)=>b._score-a._score);

  const selected=[];
  const usedFP=new Set();
  const chapterCount=new Map();
  const topicCount=new Map();

  while(selected.length<count && eligible.length){
    let bestIndex=0,best=-Infinity;

    eligible.forEach((q,i)=>{
      const fp=fingerprint(q);
      if(usedFP.has(fp))return;

      const ch=chapterCount.get(q.chapter)||0;
      const tp=topicCount.get(q.topic)||0;

      const diversityPenalty=(ch*7)+(tp*4);
      const score=q._score-diversityPenalty+(Math.random()*3);

      if(score>best){
        best=score;
        bestIndex=i;
      }
    });

    const q=eligible.splice(bestIndex,1)[0];
    const fp=fingerprint(q);

    if(usedFP.has(fp))continue;

    usedFP.add(fp);
    selected.push(q);
    chapterCount.set(q.chapter,(chapterCount.get(q.chapter)||0)+1);
    topicCount.set(q.topic,(topicCount.get(q.topic)||0)+1);
  }

  return selected.map(({_score,...q})=>q);
}

window.RankForgeMasterPoolV1={
  version:"1.0.0",
  build,
  getPool,
  collect,
  select,
  fingerprint,
  similarity
};
})();
