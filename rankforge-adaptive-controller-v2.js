(function(global){
"use strict";

const VERSION="RankForge Adaptive Controller V2";
const ACTIVE_KEY="CBT_ACTIVE_TEST";
const ACTIVE_ID="CBT_ACTIVE_TEST_ID";
const ACTIVE_SOURCE="CBT_ACTIVE_TEST_SOURCE";
const DECISION_KEY="rankforgeAdaptiveDecisionV2";
const SESSION_KEY="rankforgeAdaptiveSessionV2";

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

function clean(v){
  return String(v??"").trim();
}

function makeConfig(options){
  const decision=
    options?.decision ||
    read(DECISION_KEY,{}) ||
    {};

  const target=decision.target||{};

  return {
    count:Number(options?.count || decision.requestedCount || 15),

    subject:
      options?.subject ??
      target.subject ??
      "mixed",

    chapter:
      options?.chapter ??
      target.chapter ??
      "",

    topic:
      options?.topic ??
      target.topic ??
      "",

    difficulty:
      options?.difficulty ??
      target.difficulty ??
      "medium",

    source:
      options?.source ??
      "rankforge-adaptive-ai-v2",

    mode:
      options?.mode ??
      decision.mode ??
      "adaptive-practice",

    adaptive:true,
    avoidRepeatedFamilies:true,
    preferNovelQuestions:true,
    preferHighQuality:true
  };
}

function normalizeQuestion(q,i){
  return {
    ...q,
    id:clean(q.id || q.questionId || ("RF-AI-"+Date.now()+"-"+i)),
    text:clean(q.text || q.question || q.questionText),
    options:Array.isArray(q.options)?q.options:[],
    correctIndex:
      Number.isInteger(q.correctIndex)
        ? q.correctIndex
        : (
          Number.isInteger(q.correctAnswer)
            ? q.correctAnswer
            : q.correctIndex
        )
  };
}

function launch(options={}){
  const engine=global.RankForgeQuestionEngineV2;

  if(!engine){
    throw new Error("RankForgeQuestionEngineV2 is not loaded");
  }

  const config=makeConfig(options);
  const result=engine.practice
    ? engine.practice(config)
    : engine.select(config);

  const questions=arr(result).map(normalizeQuestion);

  if(!questions.length){
    return {
      ok:false,
      insufficient:true,
      reason:"No eligible validated questions found",
      config
    };
  }

  const id=
    "RF-ADAPTIVE-"+Date.now();

  const active={
    id,
    title:"RankForge Adaptive Practice",
    source:"rankforge-adaptive-ai-v2",
    mode:config.mode,
    questionCount:questions.length,
    requestedCount:config.count,
    questions,
    subject:config.subject,
    chapter:config.chapter,
    topic:config.topic,
    difficulty:config.difficulty,
    createdAt:new Date().toISOString(),
    engineVersion:"V2",
    adaptiveControllerVersion:VERSION,
    validated:true
  };

  localStorage.setItem(ACTIVE_KEY,JSON.stringify(active));
  localStorage.setItem(ACTIVE_ID,id);
  localStorage.setItem(ACTIVE_SOURCE,"rankforge-adaptive-ai-v2");

  const session={
    version:VERSION,
    timestamp:new Date().toISOString(),
    decision:read(DECISION_KEY,null),
    config,
    selectedCount:questions.length,
    activeTestId:id
  };

  localStorage.setItem(SESSION_KEY,JSON.stringify(session));

  return {
    ok:true,
    insufficient:false,
    activeTestId:id,
    selectedCount:questions.length,
    config,
    questions
  };
}

function health(){
  const active=read(ACTIVE_KEY,null);
  const decision=read(DECISION_KEY,null);

  return {
    version:VERSION,
    adaptiveAI:!!global.RankForgeAdaptiveAIV2,
    questionEngineV2:!!global.RankForgeQuestionEngineV2,
    cbtBridgeV2:!!global.RankForgeQuestionEngineCBTBridgeV2,
    activeTest:!!active,
    activeQuestionCount:arr(active).length,
    adaptiveDecision:!!decision,
    topperTest180Untouched:true,
    dppParserAutoImport:false
  };
}

global.RankForgeAdaptiveControllerV2={
  version:VERSION,
  launch:launch,
  health:health,
  config:makeConfig
};

})(window);
