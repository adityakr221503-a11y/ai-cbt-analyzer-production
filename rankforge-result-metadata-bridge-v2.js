(function(global){
"use strict";

/*
 * RankForge Result Metadata Bridge V2
 *
 * Purpose:
 * Carry validated RankForge Question Engine V2 metadata
 * into the existing CBT history / mistake pipeline.
 *
 * Does NOT modify:
 * - TOPPER_TEST_180
 * - rankBoosterQuestionBankV1
 * - pdfCbtQuestions
 * - pcbNichodCorpus
 * - DPP parser output
 *
 * Only enriches cbtHistory records.
 */

const HISTORY_KEY = "cbtHistory";
const ACTIVE_KEY = "CBT_ACTIVE_TEST";
const BRIDGE_KEY = "rankforgeResultMetadataBridgeV2";

function read(key, fallback){
  try{
    const raw=localStorage.getItem(key);
    if(!raw) return fallback;
    const value=JSON.parse(raw);
    return value == null ? fallback : value;
  }catch(_){
    return fallback;
  }
}

function write(key,value){
  try{
    localStorage.setItem(key,JSON.stringify(value));
    return true;
  }catch(_){
    return false;
  }
}

function clean(v){
  return String(v ?? "")
    .replace(/<[^>]*>/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function norm(v){
  return clean(v).toLowerCase();
}

function arr(v){
  return Array.isArray(v) ? v : [];
}

function textOf(q){
  return clean(
    q?.text ??
    q?.question ??
    q?.questionText ??
    q?.question_text ??
    q?.stem ??
    ""
  );
}

function idOf(q){
  return clean(
    q?.id ??
    q?.questionId ??
    q?.question_id ??
    q?.uid ??
    q?._id ??
    ""
  );
}

function historyArray(){
  const h=read(HISTORY_KEY,[]);

  if(Array.isArray(h)) return h;
  if(Array.isArray(h?.tests)) return h.tests;
  if(Array.isArray(h?.history)) return h.history;
  if(Array.isArray(h?.records)) return h.records;

  return [];
}

function activeTest(){
  const x=read(ACTIVE_KEY,null);
  return x && typeof x==="object" ? x : null;
}

function questionList(test){
  if(!test) return [];

  return arr(
    test.questions ??
    test.questionResults ??
    test.results ??
    test.items ??
    test.responses
  );
}

function testId(test){
  return clean(
    test?.id ??
    test?.testId ??
    test?.test_id ??
    test?.sessionId ??
    test?.attemptId ??
    ""
  );
}

function questionKey(q){
  const id=idOf(q);
  const text=norm(textOf(q));

  return id
    ? "id:"+id.toLowerCase()
    : "text:"+text;
}

function buildMetadataIndex(test){
  const map=new Map();

  questionList(test).forEach(q=>{
    if(!q || typeof q!=="object") return;

    const metadata={
      family:q.family || "",
      subject:q.subject || "",
      chapter:q.chapter || "",
      topic:q.topic || "",
      difficulty:q.difficulty || "",
      trapType:q.trapType || "",
      sourceType:q.sourceType || "",
      source:q.source || "",
      qualityScore:q.qualityScore,
      noveltyScore:q.noveltyScore,
      learningDensity:q.learningDensity,
      engine:"RankForgeQuestionEngineV2"
    };

    map.set(questionKey(q),metadata);

    const text=textOf(q);
    if(text){
      map.set("text:"+norm(text),metadata);
    }
  });

  return map;
}

function enrichQuestion(q,index,map){
  if(!q || typeof q!=="object") return q;

  const key=questionKey(q);
  const meta=
    map.get(key) ||
    map.get("text:"+norm(textOf(q)));

  if(!meta) return q;

  return {
    ...q,
    ...meta,
    rankForgeEngineV2:true,
    rankForgeMetadataVersion:"V2"
  };
}

function enrichRecord(record,test,map){
  if(!record || typeof record!=="object") return record;

  const questions=
    record.questions ??
    record.questionResults ??
    record.results ??
    record.items ??
    record.responses;

  if(!Array.isArray(questions)) return record;

  const enriched=questions.map((q,i)=>
    enrichQuestion(q,i,map)
  );

  const out={...record};

  if(Array.isArray(record.questions))
    out.questions=enriched;
  else if(Array.isArray(record.questionResults))
    out.questionResults=enriched;
  else if(Array.isArray(record.results))
    out.results=enriched;
  else if(Array.isArray(record.items))
    out.items=enriched;
  else if(Array.isArray(record.responses))
    out.responses=enriched;

  out.rankForgeEngineV2=true;
  out.rankForgeMetadataVersion="V2";
  out.rankForgeSource=test?.source || "RankForgeQuestionEngineV2";

  return out;
}

function sync(){
  const test=activeTest();
  if(!test) return {changed:false,reason:"no-active-test"};

  const questions=questionList(test);
  if(!questions.length)
    return {changed:false,reason:"active-test-has-no-questions"};

  const map=buildMetadataIndex(test);
  const history=historyArray();

  if(!history.length)
    return {changed:false,reason:"no-history"};

  let changed=false;
  let enrichedQuestions=0;

  const testIdValue=testId(test);

  const next=history.map(record=>{
    if(!record || typeof record!=="object") return record;

    const rid=clean(
      record.id ??
      record.testId ??
      record.test_id ??
      record.sessionId ??
      record.attemptId ??
      ""
    );

    /*
     * Prefer exact test/session ID matching.
     * If record has no ID, allow metadata enrichment only
     * when it contains matching question IDs/text.
     */
    const hasMatchingId =
      testIdValue &&
      rid &&
      rid===testIdValue;

    const hasQuestionContainer=Array.isArray(
      record.questions ??
      record.questionResults ??
      record.results ??
      record.items ??
      record.responses
    );

    if(!hasQuestionContainer) return record;

    if(!hasMatchingId && testIdValue && rid)
      return record;

    const before=JSON.stringify(record);
    const enriched=enrichRecord(record,test,map);
    const after=JSON.stringify(enriched);

    if(before!==after){
      changed=true;

      const qs=
        enriched.questions ??
        enriched.questionResults ??
        enriched.results ??
        enriched.items ??
        enriched.responses ??
        [];

      enrichedQuestions+=qs.filter(
        q=>q && q.rankForgeEngineV2
      ).length;
    }

    return enriched;
  });

  if(changed){
    write(HISTORY_KEY,next);

    write(BRIDGE_KEY,{
      version:"V2",
      timestamp:Date.now(),
      activeTestId:testIdValue,
      enrichedQuestions
    });
  }

  return {
    changed,
    enrichedQuestions,
    historyRecords:next.length,
    activeTestId:testIdValue
  };
}

global.RankForgeResultMetadataBridgeV2={
  sync,
  health(){
    return {
      ok:true,
      historyKey:HISTORY_KEY,
      activeTestKey:ACTIVE_KEY,
      topperTest180Untouched:true,
      sourceBanksUntouched:true,
      dppParserAutoImport:false,
      engine:"RankForgeQuestionEngineV2"
    };
  }
};

/*
 * Same-tab localStorage writes do not trigger the storage event,
 * so use a lightweight polling loop.
 */
let last="";

function tick(){
  try{
    const test=localStorage.getItem(ACTIVE_KEY)||"";
    const history=localStorage.getItem(HISTORY_KEY)||"";
    const signature=test.length+"|"+history.length+"|"+
      test.slice(-80)+"|"+history.slice(-80);

    if(signature!==last){
      last=signature;
      sync();
    }
  }catch(_){}
}

setTimeout(()=>{
  sync();
  setInterval(tick,1200);
},800);

})(window);
