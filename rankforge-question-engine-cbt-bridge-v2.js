(function(global){
"use strict";

/*
 * RankForge Question Engine → CBT Bridge V2
 * Read-only source access.
 * Writes only active-session keys.
 * TOPPER_TEST_180 and source banks are never modified.
 */

const ENGINE = global.RankForgeQuestionEngineV2;

function normalize(q,i){
  return {
    id: q.id || ("RFV2-" + Date.now() + "-" + i),
    text: q.text || q.question || "",
    question: q.question || q.text || "",
    options: Array.isArray(q.options) ? q.options : [],
    correctIndex: Number.isFinite(Number(q.correctIndex))
      ? Number(q.correctIndex)
      : Number(q.correctAnswer),
    correctAnswer: Number.isFinite(Number(q.correctIndex))
      ? Number(q.correctIndex)
      : Number(q.correctAnswer),
    subject: q.subject || "",
    chapter: q.chapter || "",
    topic: q.topic || "",
    difficulty: q.difficulty || "",
    trapType: q.trapType || "",
    family: q.family || "",
    sourceType: q.sourceType || "master-v2",
    source: q.source || "RankForge Master Pool V2"
  };
}

async function launch(config={}){
  if(!ENGINE || typeof ENGINE.select!=="function"){
    throw new Error("RankForge Question Engine V2 is not loaded.");
  }

  const mode = config.mode || "practice";

  const result = await ENGINE.select({
    ...config,
    mode
  });

  if(!Array.isArray(result.questions) || !result.questions.length){
    throw new Error(
      "No validated questions available. Eligible: " +
      (result.eligible || 0)
    );
  }

  const questions = result.questions.map(normalize);

  const id =
    "RFV2-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2,7);

  const active = {
    id,
    title: config.title ||
      (mode === "test"
        ? "RankForge AI Test"
        : "RankForge AI Practice"),
    source: "RankForgeQuestionEngineV2",
    mode,
    questionCount: questions.length,
    requestedCount: Number(config.count || questions.length),
    questions,
    subject: config.subject || "mixed",
    chapter: config.chapter || "",
    topic: config.topic || "",
    difficulty: config.difficulty || "mixed",
    createdAt: new Date().toISOString(),
    engineVersion: "V2",
    validated: true
  };

  /*
   * Active-session writes only.
   * No source-bank mutation.
   */
  localStorage.setItem(
    "CBT_ACTIVE_TEST",
    JSON.stringify(active)
  );

  localStorage.setItem(
    "CBT_ACTIVE_TEST_ID",
    id
  );

  localStorage.setItem(
    "CBT_ACTIVE_TEST_SOURCE",
    "RankForgeQuestionEngineV2"
  );

  localStorage.setItem(
    "rankforgeActiveEngineTestV2",
    JSON.stringify(active)
  );

  return active;
}

global.RankForgeQuestionEngineCBTBridgeV2 = {
  launch,
  practice: c => launch({...c,mode:"practice"}),
  test: c => launch({...c,mode:"test"}),

  health(){
    return {
      ok:true,
      engineLoaded:!!ENGINE,
      activeBridge:true,
      topperTest180Untouched:true,
      dppParserAutoImport:false
    };
  }
};

})(window);
