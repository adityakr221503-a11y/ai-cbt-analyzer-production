(function(global){
"use strict";

const VERSION="RankForge Adaptive AI V2";
const HISTORY_KEY="cbtHistory";
const MASTER_META_KEY="rankForgeMasterQuestionPoolV2Meta";
const ACTIVE_KEY="CBT_ACTIVE_TEST";
const OUT_KEY="rankforgeAdaptiveDecisionV2";

function read(key,fallback=null){
  try{
    const v=localStorage.getItem(key);
    return v===null?fallback:JSON.parse(v);
  }catch(e){return fallback;}
}

function arr(v){
  if(Array.isArray(v)) return v;
  if(v && Array.isArray(v.questions)) return v.questions;
  if(v && Array.isArray(v.items)) return v.items;
  return [];
}

function text(q){
  return String(
    q?.text ?? q?.question ?? q?.questionText ?? q?.stem ?? ""
  ).trim();
}

function subject(q){
  return String(q?.subject ?? q?.section ?? "").trim();
}

function chapter(q){
  return String(q?.chapter ?? "").trim();
}

function topic(q){
  return String(q?.topic ?? "").trim();
}

function difficulty(q){
  return String(q?.difficulty ?? "unknown").toLowerCase();
}

function key(q){
  return [
    subject(q),
    chapter(q),
    topic(q)
  ].join("|").toLowerCase();
}

function getHistory(){
  const h=read(HISTORY_KEY,[]);
  return Array.isArray(h)?h:[];
}

function questionAttempts(record){
  return arr(record?.questions ?? record?.results ?? record?.answers);
}

function isWrong(q){
  if(q?.isCorrect===false || q?.correct===false) return true;

  if(
    q?.status==="wrong" ||
    q?.result==="wrong" ||
    q?.state==="wrong"
  ) return true;

  const ua=q?.userAnswer ?? q?.selectedAnswer ?? q?.answerGiven;
  const ca=q?.correctAnswer ?? q?.correct ?? q?.correctIndex;

  if(ua==null || ca==null) return false;
  return String(ua)!==String(ca);
}

function analyze(){
  const history=getHistory();

  const stats={};
  let attempts=0;
  let wrong=0;

  for(const record of history){
    for(const q of questionAttempts(record)){
      attempts++;

      const k=
        q?.metadataKey ||
        key(q) ||
        String(q?.questionId ?? q?.id ?? text(q)).toLowerCase();

      if(!stats[k]){
        stats[k]={
          key:k,
          subject:subject(q),
          chapter:chapter(q),
          topic:topic(q),
          attempts:0,
          wrong:0,
          correct:0,
          recentWrong:0,
          difficulty:difficulty(q)
        };
      }

      stats[k].attempts++;

      if(isWrong(q)){
        stats[k].wrong++;
        wrong++;
      }else{
        stats[k].correct++;
      }
    }
  }

  const weak=Object.values(stats)
    .map(x=>{
      const errorRate=x.attempts?x.wrong/x.attempts:0;
      const pressure=
        Math.min(1,x.attempts/5);

      return {
        ...x,
        errorRate,
        weaknessScore:
          errorRate*.65 +
          pressure*.15 +
          Math.min(1,x.wrong/3)*.20
      };
    })
    .sort((a,b)=>b.weaknessScore-a.weaknessScore);

  return {
    attempts,
    wrong,
    accuracy:attempts?1-wrong/attempts:0,
    weak
  };
}

function chooseDifficulty(weak){
  if(!weak) return "medium";

  if(weak.weaknessScore>=.70) return "medium";
  if(weak.weaknessScore>=.40) return "hard";
  return "very hard";
}

function buildDecision(config={}){
  const a=analyze();
  const weak=a.weak[0]||null;

  const decision={
    version:VERSION,
    timestamp:new Date().toISOString(),
    mode:config.mode||"adaptive-practice",
    requestedCount:Number(config.count)||15,

    target:{
      subject:config.subject||weak?.subject||"mixed",
      chapter:config.chapter||weak?.chapter||"",
      topic:config.topic||weak?.topic||"",
      difficulty:config.difficulty||chooseDifficulty(weak)
    },

    reason:weak
      ? "weak-topic + mistake-history driven"
      : "insufficient-history fallback to balanced practice",

    weakTopics:a.weak.slice(0,10).map(x=>({
      subject:x.subject,
      chapter:x.chapter,
      topic:x.topic,
      attempts:x.attempts,
      wrong:x.wrong,
      errorRate:x.errorRate,
      weaknessScore:x.weaknessScore
    })),

    policy:{
      avoidRepeatedFamilies:true,
      preferNovelQuestions:true,
      preferHighQuality:true,
      useMistakeHistory:true,
      useDifficultyAdjustment:true,
      noQuestionGenerationWithoutExplicitAIAction:true,
      preserveExistingCBT:true
    },

    source:"RankForge Adaptive Intelligence V2"
  };

  return decision;
}

function save(decision){
  localStorage.setItem(OUT_KEY,JSON.stringify(decision));
  return decision;
}

function decide(config){
  return save(buildDecision(config));
}

function health(){
  return {
    version:VERSION,
    historyAvailable:Array.isArray(read(HISTORY_KEY,null)),
    activeCBTAvailable:!!read(ACTIVE_KEY,null),
    masterMetaAvailable:!!read(MASTER_META_KEY,null),
    existingQuestionEngine:!!global.RankForgeQuestionEngineV2,
    existingCBTBridge:!!global.RankForgeQuestionEngineCBTBridgeV2,
    resultMetadataBridge:!!global.RankForgeResultMetadataBridgeV2,
    safe:true
  };
}

global.RankForgeAdaptiveAIV2={
  version:VERSION,
  analyze:analyze,
  decide:decide,
  health:health,
  getLastDecision:function(){
    return read(OUT_KEY,null);
  }
};

setTimeout(function(){
  try{
    if(!read(OUT_KEY,null)) decide({});
  }catch(e){}
},1500);

})(window);
