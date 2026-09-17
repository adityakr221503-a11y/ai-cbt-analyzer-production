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

const HISTORY_KEY = "cbtHistory";
const ATTEMPT_KEY = "cbtTestSessions";
const MISTAKE_KEY = "rankBoosterAttemptHistory";
const RETRY_KEY = "cbtRetryQuestion";
const MASTERY_KEY = "cbtMasteryV2";

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
function recordResult(result={}){
  const active =
    read(ACTIVE_KEY,null);

  if(!active ||
     active.sourceType !== "AI_GENERATED"){
    return {
      ok:false,
      reason:"Not an approved AI CBT session"
    };
  }

  const questions =
    array(active.questions);

  const answers =
    result.answers ||
    result.userAnswers ||
    result.responses ||
    {};

  const mistakes=[];
  let correct=0;
  let wrong=0;
  let skipped=0;

  questions.forEach((q,i)=>{
    let user =
      Array.isArray(answers)
        ? answers[i]
        : answers[q.id];

    if(user === undefined)
      user = result[i];

    const hasAnswer =
      user !== undefined &&
      user !== null &&
      String(user) !== "";

    if(!hasAnswer){
      skipped++;
      return;
    }

    const ui = Number(user);

    if(Number.isInteger(ui) &&
       ui === Number(q.correctIndex)){
      correct++;
    }else{
      wrong++;

      mistakes.push({
        id:
          "AI-MISTAKE-" +
          Date.now() +
          "-" +
          i,
        questionId:q.id,
        question:q.text,
        options:q.options,
        correctIndex:q.correctIndex,
        userAnswer:
          Number.isInteger(ui) ? ui : user,
        subject:q.subject,
        chapter:q.chapter,
        topic:q.topic,
        difficulty:q.difficulty,
        trapType:q.trapType ||
          "AI_GENERATED",
        sourceType:"AI_GENERATED",
        source:"RankForge Approved AI Bank",
        reason:"Not classified yet",
        status:"ACTIVE",
        firstSeenAt:new Date().toISOString()
      });
    }
  });

  const score =
    correct * 4 -
    wrong;

  const total =
    questions.length;

  const percentage =
    total
      ? (correct / total) * 100
      : 0;

  const attempt = {
    id:
      "AI-ATTEMPT-" +
      Date.now().toString(36),
    testId:active.id,
    title:active.title,
    sourceType:"AI_GENERATED",
    source:"RankForge Approved AI Bank",
    mode:active.mode,
    total,
    correct,
    wrong,
    skipped,
    score,
    percentage,
    questions:questions.map((q,i)=>({
      id:q.id,
      text:q.text,
      options:q.options,
      correctIndex:q.correctIndex,
      userAnswer:
        Array.isArray(answers)
          ? answers[i]
          : answers[q.id],
      subject:q.subject,
      chapter:q.chapter,
      topic:q.topic,
      difficulty:q.difficulty,
      trapType:q.trapType,
      sourceType:"AI_GENERATED"
    })),
    mistakes,
    completedAt:new Date().toISOString()
  };

  const history =
    array(read(HISTORY_KEY,[]));

  history.unshift(attempt);
  write(HISTORY_KEY,history.slice(0,200));

  const sessions =
    array(read(ATTEMPT_KEY,[]));

  sessions.unshift(attempt);
  write(ATTEMPT_KEY,sessions.slice(0,200));

  const oldMistakes =
    array(read(MISTAKE_KEY,[]));

  write(
    MISTAKE_KEY,
    oldMistakes
      .concat(mistakes)
      .slice(-1000)
  );

  mistakes.forEach(m=>{
    write(
      RETRY_KEY,
      m
    );
  });

  /*
   * Mastery bookkeeping.
   */
  const mastery =
    read(MASTERY_KEY,{});

  mistakes.forEach(m=>{
    const key =
      m.topic ||
      m.chapter ||
      m.subject ||
      m.questionId;

    mastery[key] =
      mastery[key] || {
        attempts:0,
        mistakes:0,
        mastered:false,
        lastSeenAt:null
      };

    mastery[key].mistakes++;
    mastery[key].lastSeenAt =
      new Date().toISOString();
  });

  questions.forEach(q=>{
    const key =
      q.topic ||
      q.chapter ||
      q.subject ||
      q.id;

    mastery[key] =
      mastery[key] || {
        attempts:0,
        mistakes:0,
        mastered:false,
        lastSeenAt:null
      };

    mastery[key].attempts++;

    if(
      mastery[key].attempts >= 2 &&
      mastery[key].mistakes === 0
    ){
      mastery[key].mastered=true;
    }
  });

  write(MASTERY_KEY,mastery);

  return {
    ok:true,
    attempt,
    correct,
    wrong,
    skipped,
    score,
    percentage,
    mistakes:mistakes.length
  };
}

function getLastAIResult(){
  const history =
    array(read(HISTORY_KEY,[]));

  return history.find(
    x => x?.sourceType === "AI_GENERATED"
  ) || null;
}

function getAIMistakes(){
  return array(read(MISTAKE_KEY,[]))
    .filter(
      x => x?.sourceType === "AI_GENERATED"
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
