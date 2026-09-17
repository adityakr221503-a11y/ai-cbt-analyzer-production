(function(global){
"use strict";

/*
 * RankForge Approved AI → CBT → Result → Mistake/Retry bridge
 *
 * IMPORTANT:
 * - Only APPROVED AI questions are eligible.
 * - AI staging is never used.
 * - TOPPER_TEST_180 is untouched.
 * - Existing PDF / Ranker / DPP source banks are untouched.
 * - Practice and Test remain separate by active session mode.
 */

const AI_KEY = "rankForgeAIQuestionBankV1";
const ACTIVE_KEY = "CBT_ACTIVE_TEST";
const ACTIVE_ID = "CBT_ACTIVE_TEST_ID";
const ACTIVE_SOURCE = "CBT_ACTIVE_TEST_SOURCE";

const RETRY_KEY = "cbtRetryQuestion";

function read(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  }catch(_){
    return fallback;
  }
}

function write(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
  }catch(_){}
}

function array(v){
  if(Array.isArray(v)) return v;
  if(v && Array.isArray(v.questions)) return v.questions;
  return [];
}

function clean(v){
  return String(v ?? "")
    .replace(/\s+/g," ")
    .trim();
}

function normalize(q, i){
  const text = clean(
    q?.text ||
    q?.question ||
    q?.questionText ||
    q?.prompt
  );

  const options = Array.isArray(q?.options)
    ? q.options.map(x =>
        clean(
          typeof x === "object"
            ? (x.text ?? x.label ?? x.value ?? "")
            : x
        )
      ).filter(Boolean)
    : [];

  let correct =
    q?.correctIndex ??
    q?.correctAnswer ??
    q?.correct ??
    q?.answer;

  if(typeof correct === "string"){
    const s = correct.trim();

    if(/^[A-Da-d]$/.test(s)){
      correct =
        s.toUpperCase().charCodeAt(0) - 65;
    }else if(/^\d+$/.test(s)){
      correct = Number(s);
    }else{
      const found = options.findIndex(
        x => x.toLowerCase() === s.toLowerCase()
      );
      if(found >= 0) correct = found;
    }
  }

  correct = Number(correct);

  if(!text || options.length !== 4 ||
     !Number.isInteger(correct) ||
     correct < 0 || correct > 3){
    return null;
  }

  return {
    ...q,
    id: clean(q.id) ||
      ("AI-CBT-" + Date.now() + "-" + i),
    text,
    question:text,
    options,
    correctIndex:correct,
    correctAnswer:correct,
    subject:clean(q.subject),
    chapter:clean(q.chapter),
    topic:clean(q.topic),
    difficulty:clean(q.difficulty),
    trapType:clean(q.trapType),
    sourceType:"AI_GENERATED",
    source:"RankForge Approved AI Bank",
    approvalStatus:"APPROVED",
    validated:true
  };
}

function approvedAI(){
  return array(read(AI_KEY,[]))
    .filter(q =>
      String(q?.approvalStatus || "")
        .toUpperCase() === "APPROVED" ||
      String(q?.status || "")
        .toUpperCase() === "APPROVED"
    )
    .map(normalize)
    .filter(Boolean);
}

function uniqueQuestions(items){
  const seen = new Set();
  return items.filter(q=>{
    const key =
      clean(q.id) ||
      (
        clean(q.text).toLowerCase() +
        "|" +
        q.options.join("|").toLowerCase()
      );

    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/*
 * Explicit AI-only launcher.
 */
async function launchApprovedAI(config={}){
  let pool = approvedAI();

  const subject = clean(config.subject).toLowerCase();
  const chapter = clean(config.chapter).toLowerCase();
  const topic = clean(config.topic).toLowerCase();
  const difficulty = clean(config.difficulty).toLowerCase();

  if(subject && subject !== "mixed"){
    pool = pool.filter(q =>
      clean(q.subject).toLowerCase() === subject
    );
  }

  if(chapter){
    pool = pool.filter(q =>
      clean(q.chapter).toLowerCase() === chapter
    );
  }

  if(topic){
    pool = pool.filter(q =>
      clean(q.topic).toLowerCase() === topic
    );
  }

  if(difficulty && difficulty !== "mixed"){
    pool = pool.filter(q =>
      clean(q.difficulty).toLowerCase().includes(difficulty) ||
      difficulty.includes(
        clean(q.difficulty).toLowerCase()
      )
    );
  }

  pool = uniqueQuestions(pool);

  const requested =
    Math.max(
      1,
      Number(config.count || 10)
    );

  if(!pool.length){
    throw new Error(
      "No approved AI questions available for this selection."
    );
  }

  /*
   * Randomized selection prevents the same approved
   * questions from appearing in the same order.
   */
  pool.sort(()=>Math.random()-0.5);

  const questions =
    pool.slice(0, requested);

  const mode =
    config.mode === "test"
      ? "test"
      : "practice";

  const id =
    "AI-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2,7);

  const active = {
    id,
    title:
      config.title ||
      (
        mode === "test"
          ? "RankForge AI Test"
          : "RankForge AI Practice"
      ),
    source:"RankForge Approved AI Bank",
    sourceType:"AI_GENERATED",
    mode,
    questionCount:questions.length,
    requestedCount:requested,
    questions,
    subject:config.subject || "mixed",
    chapter:config.chapter || "",
    topic:config.topic || "",
    difficulty:config.difficulty || "mixed",
    createdAt:new Date().toISOString(),
    engineVersion:"AI-CBT-V1",
    validated:true,
    approvedOnly:true
  };

  write(ACTIVE_KEY, active);
  write(ACTIVE_ID, id);
  write(ACTIVE_SOURCE, "RankForge Approved AI Bank");

  /*
   * Legacy CBT compatibility.
   */
  try{
    sessionStorage.setItem(
      "CBT_ACTIVE_TEST",
      JSON.stringify(active)
    );

    sessionStorage.setItem(
      "CBT_ACTIVE_TEST_ID",
      id
    );

    sessionStorage.setItem(
      "CBT_ACTIVE_SOURCE",
      "AI"
    );

    sessionStorage.setItem(
      "CBT_ACTIVE_QUESTIONS",
      JSON.stringify(questions)
    );
  }catch(_){}

  return active;
}

/*
 * Launch selected AI Practice/Test directly into CBT.
 */
function startAIPractice(config={}){
  return launchApprovedAI({
    ...config,
    mode:"practice"
  }).then(active=>{
    global.location.href="./cbt.html";
    return active;
  });
}

function startAITest(config={}){
  return launchApprovedAI({
    ...config,
    mode:"test"
  }).then(active=>{
    global.location.href="./cbt.html";
    return active;
  });
}

/*
 * Result bridge.
 *
 * Accepts common CBT result shapes and creates a stable
 * RankForge attempt record.
 */
function recordResult(result){
  /*
   * SINGLE-SOURCE-OF-TRUTH:
   *
   * CBT itself owns:
   *   scoring
   *   cbtHistory
   *   rankBoosterAttemptHistory
   *   mistake creation
   *   mastery
   *   retry queue
   *
   * The AI integration must NEVER create a second
   * scoring/mistake pipeline.
   *
   * This function only stores a lightweight AI result
   * marker for diagnostics/metadata consumers.
   */
  try{
    const active=read(ACTIVE_KEY,null);

    if(!active || active.sourceType!=="AI_GENERATED"){
      return {
        ok:false,
        ignored:true,
        reason:"Not an approved AI CBT session"
      };
    }

    const marker={
      version:"AI-CBT-V1",
      timestamp:Date.now(),
      testId:active.id || active.testId || "",
      sourceType:"AI_GENERATED",
      source:"RankForge Approved AI Bank",
      questionCount:Array.isArray(active.questions)
        ? active.questions.length
        : 0,
      delegatedToExistingCBT:true
    };

    write("rankforgeAICBTResultMarkerV1",marker);

    return {
      ok:true,
      delegated:true,
      marker
    };
  }catch(error){
    console.error("AI CBT result marker error:",error);
    return {
      ok:false,
      error:String(error && error.message || error)
    };
  }
}

function getLastAIResult(){
  const history =
    array(read("cbtHistory",[]));

  return history.find(
    x =>
      x?.sourceType === "AI_GENERATED" ||
      x?.source === "RankForge Approved AI Bank"
  ) || null;
}

function getAIMistakes(){
  return array(read("rankBoosterAttemptHistory",[]))
    .filter(
      x =>
        x?.sourceType === "AI_GENERATED" ||
        x?.source === "RankForge Approved AI Bank"
    );
}

function getAIRetry(){
  const mistakes =
    getAIMistakes();

  if(!mistakes.length) return null;

  const m =
    mistakes[mistakes.length-1];

  write(
    RETRY_KEY,
    m
  );

  return m;
}

global.RankForgeApprovedAICBTIntegrationV1={
  launchApprovedAI,
  startAIPractice,
  startAITest,
  recordResult,
  getLastAIResult,
  getAIMistakes,
  getAIRetry,

  health(){
    return {
      ok:true,
      approvedOnly:true,
      stagingExcluded:true,
      sourceType:"AI_GENERATED",
      practiceSupported:true,
      testSupported:true,
      resultBridge:true,
      mistakeBridge:true,
      retryBridge:true,
      masteryBridge:true,
      topperTest180Untouched:true
    };
  }
};

})(window);
