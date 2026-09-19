(function(){
"use strict";

/*
 RANKFORGE SOURCE INTELLIGENCE ENGINE V4
 ---------------------------------------
 Owner-side ingestion + quality intelligence.

 IMPORTANT:
 - Does NOT modify PDF/CBT/NICHOD engines.
 - Module and AI pools remain separate.
 - Student-facing pages receive only approved question data.
 - Browser localStorage is NOT production security.
*/

const VERSION="RANKFORGE_SOURCE_ENGINE_V4";

const OWNER_KEY="rankforgeOwnerSourceVaultV1";
const APPROVED_KEY="rankforgeCanonicalQuestionPoolV1";
const AI_KEY="rankforgeAIQuestionPoolV1";

const AUDIT_KEY="rankforgeQuestionQualityAuditV4";
const INDEX_KEY="rankforgeQuestionIndexV4";
const JOB_KEY="rankforgeImportJobsV4";
const VERSION_KEY="rankforgeQuestionVersionsV4";

const BATCH_SIZE=500;
const NEAR_DUP_THRESHOLD=.82;
const FAMILY_THRESHOLD=.78;

const MAX_AUDIT=10000;
const MAX_VERSIONS=10000;

function now(){
  return new Date().toISOString();
}

function arr(v){
  return Array.isArray(v)?v:[];
}

function text(v){
  return String(v==null?"":v).trim();
}

function normalizeText(v){
  return text(v)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g," ")
    .replace(/[“”„‟]/g,'"')
    .replace(/[‘’‚‛]/g,"'")
    .trim();
}

function tokenize(v){
  return normalizeText(v)
    .replace(/[^\p{L}\p{N}%+\-./ ]/gu," ")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccard(a,b){
  const A=new Set(a);
  const B=new Set(b);

  if(!A.size&&!B.size)return 1;
  if(!A.size||!B.size)return 0;

  let common=0;
  for(const x of A)if(B.has(x))common++;

  return common/(A.size+B.size-common);
}

function hash32(str){
  let h=2166136261>>>0;

  for(let i=0;i<str.length;i++){
    h^=str.charCodeAt(i);
    h=Math.imul(h,16777619);
  }

  return ("00000000"+(h>>>0).toString(16)).slice(-8);
}

function fingerprint(q){
  const base=[
    normalizeText(q.question||q.text),
    ...arr(q.options).map(normalizeText)
  ].join("|");

  return "rfq_"+hash32(base);
}

function textFingerprint(q){
  return "rft_"+hash32(normalizeText(q.question||q.text));
}

function tokenSignature(q){
  const t=tokenize(q.question||q.text);
  if(!t.length)return "empty";

  const first=t.slice(0,4).join("_");
  const last=t.slice(-4).join("_");

  return hash32(
    [
      q.subject||"",
      q.chapter||"",
      first,
      last,
      t.length
    ].join("|")
  );
}

function optionFingerprint(q){
  return arr(q.options)
    .map(normalizeText)
    .sort()
    .join("|");
}

function getStore(key){
  try{
    const raw=localStorage.getItem(key);
    const x=raw?JSON.parse(raw):[];
    return Array.isArray(x)?x:[];
  }catch(_){
    return [];
  }
}

function setStore(key,value){
  localStorage.setItem(key,JSON.stringify(value));
}

function getObject(key){
  try{
    return JSON.parse(localStorage.getItem(key)||"null");
  }catch(_){
    return null;
  }
}

function setObject(key,value){
  localStorage.setItem(key,JSON.stringify(value));
}

/* ---------- INDEX ---------- */

function getIndex(){
  const x=getObject(INDEX_KEY);

  if(!x || typeof x!=="object"){
    return {
      version:VERSION,
      exact:{},
      text:{},
      buckets:{},
      updatedAt:now()
    };
  }

  x.exact=x.exact||{};
  x.text=x.text||{};
  x.buckets=x.buckets||{};

  return x;
}

function setIndex(index){
  index.updatedAt=now();
  setObject(INDEX_KEY,index);
}

function indexQuestion(q){
  const index=getIndex();

  const fp=fingerprint(q);
  const tf=textFingerprint(q);
  const bucket=tokenSignature(q);

  index.exact[fp]=q.id;
  index.text[tf]=q.id;

  if(!index.buckets[bucket])
    index.buckets[bucket]=[];

  if(!index.buckets[bucket].includes(q.id))
    index.buckets[bucket].push(q.id);

  setIndex(index);
}

function rebuildIndex(){
  const index={
    version:VERSION,
    exact:{},
    text:{},
    buckets:{},
    updatedAt:now()
  };

  const all=[
    ...getStore(OWNER_KEY),
    ...getStore(AI_KEY),
    ...getStore(APPROVED_KEY)
  ];

  const seen=new Set();

  for(const q of all){
    if(!q||!q.id||seen.has(q.id))continue;

    seen.add(q.id);

    const fp=fingerprint(q);
    const tf=textFingerprint(q);
    const bucket=tokenSignature(q);

    index.exact[fp]=q.id;
    index.text[tf]=q.id;

    if(!index.buckets[bucket])
      index.buckets[bucket]=[];

    if(!index.buckets[bucket].includes(q.id))
      index.buckets[bucket].push(q.id);
  }

  setIndex(index);

  return {
    ok:true,
    indexed:seen.size,
    exact:Object.keys(index.exact).length,
    buckets:Object.keys(index.buckets).length
  };
}

function findById(id){
  const all=[
    ...getStore(OWNER_KEY),
    ...getStore(AI_KEY),
    ...getStore(APPROVED_KEY)
  ];

  return all.find(q=>q&&q.id===id)||null;
}

/* ---------- QUALITY ---------- */

function optionQuality(q){
  const errors=[];
  const warnings=[];
  const options=arr(q.options);

  if(options.length!==4)
    errors.push("Exactly 4 options required");

  if(options.some(x=>!text(x)))
    errors.push("Empty option detected");

  const norm=options.map(normalizeText);

  if(new Set(norm).size!==norm.length)
    errors.push("Duplicate options detected");

  if(options.some(x=>/^[A-D][.)]\s*/i.test(text(x))))
    warnings.push("Options contain embedded labels");

  const lengths=options.map(x=>text(x).length).filter(Boolean);

  if(lengths.length===4){
    const max=Math.max(...lengths);
    const min=Math.min(...lengths);

    if(min>0 && max/min>5)
      warnings.push("Large option-length imbalance");
  }

  return {errors,warnings};
}

function answerQuality(q){
  const errors=[];
  const warnings=[];

  if(!Number.isInteger(q.correctAnswer) ||
     q.correctAnswer<0 ||
     q.correctAnswer>3){
    errors.push("correctAnswer must be integer 0-3");
  }else if(!text(arr(q.options)[q.correctAnswer])){
    errors.push("Correct answer option is empty");
  }

  const question=normalizeText(q.question||q.text);

  if(/\b(except|incorrect|not true|false)\b/i.test(question))
    warnings.push("Negative/EXCEPT wording requires review");

  if(/\b(all of the above|none of the above)\b/i.test(question))
    warnings.push("Meta-option detected");

  return {errors,warnings};
}

function languageQuality(q){
  const errors=[];
  const warnings=[];
  const s=text(q.question||q.text);

  if(!s)
    errors.push("Question text missing");

  if(/�|□|\ufffd/.test(s))
    errors.push("Possible OCR/unicode corruption");

  if(/\b(lorem ipsum|placeholder|test question)\b/i.test(s))
    warnings.push("Placeholder/test text detected");

  if(/\.{4,}|_{4,}/.test(s))
    warnings.push("Possible truncated/blank question");

  if(s.length<20)
    warnings.push("Very short question");

  if(!/[?।:]/.test(s))
    warnings.push("Question form unclear");

  return {errors,warnings};
}

function metadataQuality(q){
  const errors=[];
  const warnings=[];

  if(!text(q.id))
    errors.push("Question ID missing");

  if(!text(q.subject))
    errors.push("Subject missing");

  if(!text(q.chapter))
    errors.push("Chapter missing");

  if(!text(q.sourceId))
    warnings.push("Source ID missing");

  if(!text(q.topic))
    warnings.push("Topic not tagged");

  return {errors,warnings};
}

function numericQuality(q){
  const errors=[];
  const warnings=[];
  const s=text(q.question||q.text);

  const numeric=
    /\b(calculate|find|determine|velocity|acceleration|force|mass|energy|work|power|molar|mole|concentration|percentage|ratio|current|resistance|charge|pressure|volume|temperature)\b/i.test(s) ||
    /\d/.test(s);

  if(numeric){
    if(!arr(q.options).some(x=>/\d/.test(text(x))))
      warnings.push("Numerical/application question may need answer verification");

    if(!q.solution && !q.explanation)
      warnings.push("Numerical/application question has no stored explanation");
  }

  return {errors,warnings};
}

function conceptQuality(q){
  const errors=[];
  const warnings=[];

  if(!text(q.concept))
    warnings.push("Concept tag missing");

  if(!text(q.topic))
    warnings.push("Subtopic/topic tag missing");

  if(!text(q.difficulty))
    warnings.push("Difficulty not calibrated");

  if(!text(q.questionType))
    warnings.push("Question type not tagged");

  return {errors,warnings};
}

function validate(q){
  const errors=[];
  const warnings=[];

  const gates=[
    optionQuality(q),
    answerQuality(q),
    languageQuality(q),
    metadataQuality(q),
    numericQuality(q),
    conceptQuality(q)
  ];

  for(const g of gates){
    errors.push(...g.errors);
    warnings.push(...g.warnings);
  }

  return {
    valid:errors.length===0,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)]
  };
}

/* ---------- DUPLICATE / FAMILY ---------- */

function getAllKnown(){
  const all=[
    ...getStore(OWNER_KEY),
    ...getStore(AI_KEY),
    ...getStore(APPROVED_KEY)
  ];

  const map=new Map();

  for(const q of all){
    if(q&&q.id)map.set(q.id,q);
  }

  return [...map.values()];
}

function duplicateCheck(q){
  const index=getIndex();

  const fp=fingerprint(q);
  const tf=textFingerprint(q);

  if(index.exact[fp] && index.exact[fp]!==q.id){
    return {
      duplicate:true,
      type:"exact",
      matchedId:index.exact[fp]
    };
  }

  if(index.text[tf] && index.text[tf]!==q.id){
    return {
      duplicate:true,
      type:"same-question-text",
      matchedId:index.text[tf]
    };
  }

  /*
   Only compare candidates from the same signature bucket.
   This avoids O(N²) scanning for large pools.
  */
  const bucket=tokenSignature(q);
  const ids=arr(index.buckets[bucket]);

  let familyMatch=null;

  for(const id of ids){
    if(id===q.id)continue;

    const old=findById(id);
    if(!old)continue;

    const sim=jaccard(
      tokenize(q.question||q.text),
      tokenize(old.question||old.text)
    );

    if(sim>=NEAR_DUP_THRESHOLD){
      return {
        duplicate:true,
        type:"near-duplicate",
        matchedId:id,
        similarity:Number(sim.toFixed(4))
      };
    }

    if(sim>=FAMILY_THRESHOLD){
      familyMatch={
        type:"question-family",
        matchedId:id,
        similarity:Number(sim.toFixed(4))
      };
    }
  }

  return {
    duplicate:false,
    familyConflict:!!familyMatch,
    familyMatch
  };
}

/* ---------- NORMALIZATION ---------- */

function normalize(q,origin){
  const options=arr(q.options).map(text);

  return {
    ...q,
    id:text(q.id)||("Q_"+Date.now()+"_"+Math.random().toString(36).slice(2,8)),
    question:text(q.question||q.text),
    text:text(q.question||q.text),
    options,
    correctAnswer:Number(q.correctAnswer),
    subject:text(q.subject),
    chapter:text(q.chapter),
    topic:text(q.topic),
    concept:text(q.concept),
    difficulty:text(q.difficulty),
    questionType:text(q.questionType),
    sourceId:text(q.sourceId),
    origin:origin==="ai"?"ai":"module",
    importedAt:q.importedAt||now(),
    updatedAt:now(),
    version:Number(q.version||1)
  };
}

/* ---------- PROCESSING ---------- */

function processQuestion(q,origin){
  const n=normalize(q,origin);
  const validation=validate(n);
  const duplicate=duplicateCheck(n);

  const blocked=
    !validation.valid ||
    duplicate.duplicate;

  const reviewRequired=
    !blocked &&
    (
      validation.warnings.length>0 ||
      duplicate.familyConflict
    );

  n.validationErrors=validation.errors;
  n.validationWarnings=validation.warnings;
  n.duplicateInfo=duplicate;
  n.reviewRequired=reviewRequired;
  n.qualityVersion=VERSION;
  n.processedAt=now();

  if(blocked){
    n.status="quarantine";
    n.quarantineReason=
      validation.errors.join("; ") ||
      ("Duplicate: "+duplicate.type);
  }else{
    n.status="pending_owner_approval";
  }

  return n;
}

/* ---------- AUDIT ---------- */

function audit(event){
  const logs=getStore(AUDIT_KEY);

  logs.push({
    id:"AUD_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),
    at:now(),
    ...event
  });

  setStore(
    AUDIT_KEY,
    logs.slice(-MAX_AUDIT)
  );
}

/* ---------- JOBS / CHECKPOINT ---------- */

function createJob(type,total){
  const job={
    id:"JOB_"+Date.now()+"_"+Math.random().toString(36).slice(2,8),
    type,
    total,
    processed:0,
    imported:0,
    quarantined:0,
    review:0,
    approved:0,
    status:"running",
    startedAt:now(),
    updatedAt:now()
  };

  const jobs=getStore(JOB_KEY);
  jobs.push(job);

  setStore(JOB_KEY,jobs.slice(-100));

  return job;
}

function updateJob(job,patch){
  Object.assign(job,patch,{updatedAt:now()});

  const jobs=getStore(JOB_KEY);
  const i=jobs.findIndex(x=>x.id===job.id);

  if(i>=0)jobs[i]=job;

  setStore(JOB_KEY,jobs.slice(-100));

  return job;
}

/* ---------- IMPORT ---------- */

function storeImported(list,origin,sourceMeta){
  const questions=arr(list);

  const job=createJob(
    origin==="ai"?"ai-import":"module-import",
    questions.length
  );

  const key=origin==="ai"?AI_KEY:OWNER_KEY;
  const store=getStore(key);

  const existingIds=new Set(store.map(q=>q.id));

  let imported=0;
  let quarantined=0;
  let review=0;

  for(let start=0;start<questions.length;start+=BATCH_SIZE){
    const batch=questions.slice(start,start+BATCH_SIZE);

    for(const raw of batch){
      const n=normalize(
        {
          ...raw,
          ...(origin==="module"?{
            sourceId:raw.sourceId||sourceMeta?.sourceId,
            sourceName:raw.sourceName||sourceMeta?.sourceName,
            sourceType:raw.sourceType||sourceMeta?.type,
            sourceYear:raw.sourceYear||sourceMeta?.year,
            privateNote:raw.privateNote||sourceMeta?.privateNote
          }: {})
        },
        origin
      );

      if(existingIds.has(n.id)){
        n.status="quarantine";
        n.quarantineReason="Duplicate question ID";
        store.push(n);
        quarantined++;
        job.processed++;
        continue;
      }

      const processed=processQuestion(n,origin);

      store.push(processed);
      existingIds.add(processed.id);

      indexQuestion(processed);

      imported++;

      if(processed.status==="quarantine")
        quarantined++;

      if(processed.reviewRequired)
        review++;

      job.processed++;

      updateJob(job,{
        imported,
        quarantined,
        review
      });
    }
  }

  setStore(key,store);

  updateJob(job,{
    status:"completed",
    imported,
    quarantined,
    review
  });

  audit({
    action:"import",
    origin,
    sourceId:sourceMeta?.sourceId||null,
    count:questions.length,
    imported,
    quarantined,
    review,
    jobId:job.id
  });

  return {
    ok:true,
    imported,
    quarantined,
    review,
    batchSize:BATCH_SIZE,
    jobId:job.id
  };
}

function submitModuleQuestions(list,sourceMeta){
  return storeImported(list,"module",sourceMeta||{});
}

function submitAIQuestions(list){
  return storeImported(list,"ai",{});
}

/* ---------- APPROVAL ---------- */

function saveVersion(q,action){
  const versions=getStore(VERSION_KEY);

  versions.push({
    id:"VER_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),
    questionId:q.id,
    action,
    version:q.version||1,
    at:now(),
    snapshot:q
  });

  setStore(
    VERSION_KEY,
    versions.slice(-MAX_VERSIONS)
  );
}

function approve(id,poolType){
  const sourceKey=poolType==="ai"?AI_KEY:OWNER_KEY;
  const source=getStore(sourceKey);
  const index=source.findIndex(q=>q.id===id);

  if(index<0)
    return {ok:false,error:"Question not found"};

  const q=normalize(
    source[index],
    poolType==="ai"?"ai":"module"
  );

  const validation=validate(q);
  const duplicate=duplicateCheck(q);

  if(!validation.valid){
    q.status="quarantine";
    q.quarantineReason=validation.errors.join("; ");
    source[index]=q;
    setStore(sourceKey,source);

    audit({
      action:"approval_blocked",
      id,
      reason:"validation",
      errors:validation.errors
    });

    return {
      ok:false,
      error:"Quality gate failed",
      errors:validation.errors
    };
  }

  if(duplicate.duplicate){
    q.status="quarantine";
    q.quarantineReason="Duplicate: "+duplicate.type;
    q.duplicateInfo=duplicate;

    source[index]=q;
    setStore(sourceKey,source);

    audit({
      action:"approval_blocked",
      id,
      reason:"duplicate",
      duplicate
    });

    return {
      ok:false,
      error:"Duplicate detected",
      duplicate
    };
  }

  saveVersion(q,"approve");

  q.status="approved";
  q.approvedAt=now();
  q.version=Number(q.version||1)+1;

  source[index]=q;
  setStore(sourceKey,source);

  const approved=getStore(APPROVED_KEY);

  const existing=approved.findIndex(x=>x.id===q.id);

  if(existing>=0)
    approved[existing]=q;
  else
    approved.push(q);

  setStore(APPROVED_KEY,approved);

  indexQuestion(q);

  audit({
    action:"approved",
    id:q.id,
    origin:q.origin,
    version:q.version
  });

  return {
    ok:true,
    question:q
  };
}

function bulkApproveClean(poolType,limit){
  const sourceKey=poolType==="ai"?AI_KEY:OWNER_KEY;
  const source=getStore(sourceKey);

  let approved=0;
  let blocked=0;
  let skipped=0;

  const max=Number.isFinite(limit)?limit:source.length;

  for(const q of source){
    if(approved>=max)break;

    if(q.status!=="pending_owner_approval"){
      skipped++;
      continue;
    }

    if(q.reviewRequired){
      skipped++;
      continue;
    }

    const r=approve(
      q.id,
      poolType==="ai"?"ai":"module"
    );

    if(r.ok)approved++;
    else blocked++;
  }

  audit({
    action:"bulk_approve",
    poolType,
    approved,
    blocked,
    skipped
  });

  return {
    ok:true,
    approved,
    blocked,
    skipped
  };
}

function reject(id,reason,poolType){
  const key=poolType==="ai"?AI_KEY:OWNER_KEY;
  const store=getStore(key);
  const i=store.findIndex(q=>q.id===id);

  if(i<0)
    return {ok:false,error:"Question not found"};

  saveVersion(store[i],"reject");

  store[i].status="rejected";
  store[i].rejectReason=text(reason)||"Owner rejected";
  store[i].rejectedAt=now();

  setStore(key,store);

  audit({
    action:"rejected",
    id,
    poolType,
    reason:store[i].rejectReason
  });

  return {ok:true};
}

/* ---------- RECHECK ---------- */

function recheckAll(poolType){
  const key=poolType==="ai"?AI_KEY:OWNER_KEY;
  const store=getStore(key);

  let checked=0;
  let quarantine=0;
  let review=0;
  let clean=0;

  for(let i=0;i<store.length;i++){
    const old=store[i];

    if(old.status==="approved" || old.status==="rejected")
      continue;

    const q=processQuestion(
      old,
      poolType==="ai"?"ai":"module"
    );

    store[i]={
      ...old,
      ...q,
      version:Number(old.version||1)+1,
      updatedAt:now()
    };

    checked++;

    if(q.status==="quarantine")
      quarantine++;
    else if(q.reviewRequired)
      review++;
    else
      clean++;
  }

  setStore(key,store);

  rebuildIndex();

  audit({
    action:"recheck",
    poolType,
    checked,
    quarantine,
    review,
    clean
  });

  return {
    ok:true,
    checked,
    quarantine,
    review,
    clean
  };
}

/* ---------- GETTERS ---------- */

function getOwnerInbox(){
  return getStore(OWNER_KEY);
}

function getApproved(){
  return getStore(APPROVED_KEY);
}

function getAIQuestions(){
  return getStore(AI_KEY);
}

function getReviewQueue(){
  return [
    ...getStore(OWNER_KEY),
    ...getStore(AI_KEY)
  ].filter(q=>
    q.status==="pending_owner_approval" &&
    q.reviewRequired
  );
}

function getQuarantine(){
  return [
    ...getStore(OWNER_KEY),
    ...getStore(AI_KEY)
  ].filter(q=>q.status==="quarantine");
}

function getJobs(){
  return getStore(JOB_KEY);
}

function getAudit(){
  return getStore(AUDIT_KEY);
}

function getVersions(){
  return getStore(VERSION_KEY);
}

/* ---------- STATS ---------- */

function stats(){
  const module=getStore(OWNER_KEY);
  const ai=getStore(AI_KEY);
  const approved=getStore(APPROVED_KEY);

  const all=[
    ...module,
    ...ai
  ];

  return {
    version:VERSION,
    batchSize:BATCH_SIZE,

    moduleTotal:module.length,
    aiTotal:ai.length,

    review:all.filter(q=>
      q.status==="pending_owner_approval"
    ).length,

    quarantine:all.filter(q=>
      q.status==="quarantine"
    ).length,

    rejected:all.filter(q=>
      q.status==="rejected"
    ).length,

    approved:approved.length,

    indexed:Object.keys(getIndex().exact||{}).length,

    jobs:getJobs().length,
    auditEntries:getAudit().length,
    versions:getVersions().length,

    nearDuplicateThreshold:NEAR_DUP_THRESHOLD,
    familyThreshold:FAMILY_THRESHOLD
  };
}

/* ---------- FORMAT DETECTION ---------- */

function detectFormat(filename){
  const name=text(filename).toLowerCase();

  if(!name.includes("."))return "unknown";

  const ext=name.split(".").pop();

  const supported=[
    "json","jsonl","ndjson",
    "csv","tsv",
    "txt","md","markdown",
    "xml",
    "html","htm",
    "pdf",
    "zip",
    "docx",
    "xlsx",
    "xls",
    "png","jpg","jpeg","webp",
    "tex","latex",
    "qti"
  ];

  return supported.includes(ext)?ext:"unknown";
}

function supportedFormats(){
  return [
    "pdf",
    "zip",
    "json",
    "jsonl",
    "ndjson",
    "csv",
    "tsv",
    "xlsx",
    "xls",
    "docx",
    "txt",
    "md",
    "xml",
    "html",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "tex",
    "latex",
    "qti"
  ];
}

/* ---------- HEALTH ---------- */

function health(){
  const s=stats();

  return {
    ok:true,
    engine:VERSION,
    indexed:s.indexed,
    module:s.moduleTotal,
    ai:s.aiTotal,
    approved:s.approved,
    review:s.review,
    quarantine:s.quarantine,
    jobs:s.jobs,
    supportedFormats:supportedFormats()
  };
}

/* ---------- EXPORT ---------- */

window.RankForgeSourceEngine={
  version:VERSION,
  BATCH_SIZE,

  validate,
  normalize,
  fingerprint,
  duplicateCheck,

  submitModuleQuestions,
  submitAIQuestions,

  approve,
  bulkApproveClean,
  reject,

  getOwnerInbox,
  getApproved,
  getAIQuestions,
  getReviewQueue,
  getQuarantine,

  recheckAll,

  rebuildIndex,
  detectFormat,
  supportedFormats,

  getJobs,
  getAudit,
  getVersions,

  stats,
  health
};

/* Build index automatically once. */
try{
  const index=getObject(INDEX_KEY);

  if(!index || !index.version)
    rebuildIndex();
}catch(_){}

})();
