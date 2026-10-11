(function(global){
"use strict";

const VERSION="RankForge Adaptive Feedback V2";
const HISTORY_KEY="cbtHistory";
const DECISION_KEY="rankforgeAdaptiveDecisionV2";
const FEEDBACK_KEY="rankforgeAdaptiveFeedbackV2";
const NEXT_KEY="rankforgeNextPracticeV2";

function read(key,fallback=null){
  try{
    const v=localStorage.getItem(key);
    return v===null?fallback:JSON.parse(v);
  }catch(e){return fallback;}
}

function arr(v){
  if(Array.isArray(v)) return v;
  if(v && Array.isArray(v.questions)) return v.questions;
  if(v && Array.isArray(v.results)) return v.results;
  if(v && Array.isArray(v.answers)) return v.answers;
  return [];
}

function text(q){
  return String(
    q?.text ?? q?.question ?? q?.questionText ?? ""
  ).trim();
}

function value(q,...keys){
  for(const k of keys){
    if(q && q[k]!==undefined && q[k]!==null)
      return q[k];
  }
  return "";
}

function wrong(q){
  if(q?.isCorrect===false || q?.correct===false) return true;
  if(q?.status==="wrong" || q?.result==="wrong") return true;

  const u=value(q,"userAnswer","selectedAnswer","answerGiven");
  const c=value(q,"correctAnswer","correct","correctIndex");

  if(u==="" || c==="") return false;
  return String(u)!==String(c);
}

function key(q){
  return [
    value(q,"subject","section"),
    value(q,"chapter"),
    value(q,"topic")
  ].map(x=>String(x).trim()).join("|");
}

function analyzeLatest(){
  const history=read(HISTORY_KEY,[]);
  if(!Array.isArray(history) || !history.length){
    return {
      available:false,
      reason:"No CBT history available"
    };
  }

  const record=history[history.length-1];
  const questions=arr(record?.questions || record?.results || record?.answers);

  let total=0;
  let incorrect=0;
  const buckets={};

  for(const q of questions){
    total++;
    const k=key(q)||"Unknown";
    if(!buckets[k]){
      buckets[k]={
        subject:value(q,"subject","section"),
        chapter:value(q,"chapter"),
        topic:value(q,"topic"),
        total:0,
        wrong:0
      };
    }

    buckets[k].total++;

    if(wrong(q)){
      incorrect++;
      buckets[k].wrong++;
    }
  }

  const accuracy=total ? (total-incorrect)/total : 0;

  const weak=Object.values(buckets)
    .map(x=>({
      ...x,
      errorRate:x.total ? x.wrong/x.total : 0
    }))
    .sort((a,b)=>b.errorRate-a.errorRate);

  let difficulty="medium";

  if(accuracy<0.50) difficulty="easy";
  else if(accuracy<0.70) difficulty="medium";
  else if(accuracy<0.85) difficulty="hard";
  else difficulty="very hard";

  const target=weak[0]||{};

  return {
    available:true,
    total,
    incorrect,
    accuracy,
    weakTopics:weak.slice(0,10),
    next:{
      subject:target.subject||"mixed",
      chapter:target.chapter||"",
      topic:target.topic||"",
      difficulty
    }
  };
}

function build(){
  const analysis=analyzeLatest();
  const previous=read(DECISION_KEY,{});

  const feedback={
    version:VERSION,
    timestamp:new Date().toISOString(),
    analysis,
    previousDecision:previous?.target||null,

    actions:{
      reinforceWeakTopic:!!analysis.available && analysis.weakTopics?.length>0,
      adjustDifficulty:true,
      avoidRepeatedFamilies:true,
      preferNovelQuestions:true,
      preferHighQuality:true,
      preserveMistakeEngine:true
    }
  };

  localStorage.setItem(FEEDBACK_KEY,JSON.stringify(feedback));

  if(analysis.available){
    const next={
      version:VERSION,
      timestamp:new Date().toISOString(),
      source:"RankForge Adaptive Feedback V2",
      mode:"adaptive-practice",
      count:15,
      subject:analysis.next.subject,
      chapter:analysis.next.chapter,
      topic:analysis.next.topic,
      difficulty:analysis.next.difficulty,
      adaptive:true,
      avoidRepeatedFamilies:true,
      preferNovelQuestions:true,
      preferHighQuality:true
    };

    localStorage.setItem(NEXT_KEY,JSON.stringify(next));
    feedback.nextPractice=next;
  }

  return feedback;
}

function health(){
  return {
    version:VERSION,
    historyAvailable:Array.isArray(read(HISTORY_KEY,null)),
    adaptiveAI:!!global.RankForgeAdaptiveAIV2,
    adaptiveController:!!global.RankForgeAdaptiveControllerV2,
    questionEngineV2:!!global.RankForgeQuestionEngineV2,
    metadataBridge:!!global.RankForgeResultMetadataBridgeV2,
    nextPracticeAvailable:!!read(NEXT_KEY,null),
    topperTest180Untouched:true,
    dppParserAutoImport:false
  };
}

global.RankForgeAdaptiveFeedbackV2={
  version:VERSION,
  analyzeLatest:analyzeLatest,
  build:build,
  health:health,
  getNextPractice:function(){
    return read(NEXT_KEY,null);
  },
  getFeedback:function(){
    return read(FEEDBACK_KEY,null);
  }
};

setTimeout(function(){
  try{ build(); }catch(e){
    console.warn("RankForge Adaptive Feedback V2:",e);
  }
},2000);

})(window);
