(function(global){
"use strict";

/*
 * RankForge Question Engine V2
 * - Reads only validated Master Pool V2
 * - Exact/reworded/near-duplicate safe by relying on Master Pool V2
 * - Family diversity
 * - Quality + novelty + learning-density ranking
 * - Coverage-balanced mixed tests
 * - Separate Practice/Test selection policies
 * - NEVER modifies TOPPER_TEST_180
 * - NEVER auto-imports unvalidated DPP parser output
 */

const API = {};
const MASTER_KEY = "rankForgeMasterQuestionPoolV2";

const norm = v =>
  String(v ?? "")
    .toLowerCase()
    .replace(/<[^>]*>/g," ")
    .replace(/[^\p{L}\p{N}\s]/gu," ")
    .replace(/\s+/g," ")
    .trim();

function readLS(key){
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch(_){
    return null;
  }
}

async function getPool(){
  if(global.RankForgeMasterPoolV2?.getAll){
    try {
      const p = await global.RankForgeMasterPoolV2.getAll();
      if(Array.isArray(p)) return p;
    } catch(_){}
  }

  const x = readLS(MASTER_KEY);
  if(Array.isArray(x)) return x;
  if(Array.isArray(x?.questions)) return x.questions;
  return [];
}

function number(v, fallback=0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function field(q,k){
  return norm(q?.[k]);
}

function familyKey(q){
  return field(q,"family") ||
    [
      field(q,"subject"),
      field(q,"chapter"),
      field(q,"topic"),
      field(q,"trapType")
    ].filter(Boolean).join("|") ||
    "unknown";
}

function difficultyWeight(q,target){
  const d = field(q,"difficulty");
  const t = norm(target || "mixed");

  if(!t || t === "mixed") return 0;

  if(d === t) return 12;
  if(d.includes(t) || t.includes(d)) return 8;

  if(t === "very hard"){
    if(d.includes("hard")) return 4;
  }

  return -3;
}

function baseScore(q,target){
  return (
    number(q.qualityScore) * 0.38 +
    number(q.noveltyScore) * 0.27 +
    number(q.learningDensity) * 0.20 +
    difficultyWeight(q,target) +
    (q.trapType ? 3 : 0) +
    (q.topic ? 2 : 0)
  );
}

function matches(q,c={}){
  if(c.subject && norm(c.subject)!=="mixed" &&
     field(q,"subject") !== norm(c.subject)) return false;

  if(c.chapter && field(q,"chapter") !== norm(c.chapter)) return false;

  if(c.topic && field(q,"topic") !== norm(c.topic)) return false;

  if(c.difficulty && norm(c.difficulty)!=="mixed"){
    const d = field(q,"difficulty");
    const want = norm(c.difficulty);
    if(!d.includes(want) && !want.includes(d)) return false;
  }

  if(c.sourceType && q.sourceType !== c.sourceType) return false;

  return true;
}

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function selectPractice(pool,c){
  const count = Math.max(1, number(c.count,10));
  const candidates = pool.filter(q=>matches(q,c));

  const ranked = candidates
    .map(q=>({
      q,
      score:
        baseScore(q,c.difficulty) +
        (q.topic ? 5 : 0) +
        (q.trapType ? 4 : 0)
    }))
    .sort((a,b)=>b.score-a.score);

  const out=[];
  const families=new Set();

  for(const item of ranked){
    if(out.length>=count) break;

    const q=item.q;
    const f=familyKey(q);

    if(families.has(f) && out.length < Math.ceil(count*0.75))
      continue;

    out.push(q);
    families.add(f);
  }

  if(out.length<count){
    for(const item of ranked){
      if(out.length>=count) break;
      if(!out.includes(item.q)) out.push(item.q);
    }
  }

  return {
    questions:out,
    eligible:candidates.length,
    requested:count,
    insufficient:candidates.length<count
  };
}

function selectBalancedTest(pool,c){
  const count=Math.max(1,number(c.count,10));
  const candidates=pool.filter(q=>matches(q,c));

  if(!candidates.length){
    return {
      questions:[],
      eligible:0,
      requested:count,
      insufficient:true
    };
  }

  const groups={};

  for(const q of candidates){
    const s=field(q,"subject") || "unknown";
    (groups[s] ||= []).push(q);
  }

  const subjects=Object.keys(groups);

  /*
   * Mixed test:
   * distribute questions across available subjects.
   * If subject is explicitly selected, normal ranking applies.
   */
  if(subjects.length<=1){
    return selectPractice(candidates,c);
  }

  const targetPerSubject=Math.floor(count/subjects.length);
  let remainder=count%subjects.length;

  const selected=[];
  const usedFamilies=new Set();

  for(const subject of subjects){
    let quota=targetPerSubject+(remainder>0?1:0);
    if(remainder>0) remainder--;

    const ranked=groups[subject]
      .map(q=>({
        q,
        score:baseScore(q,c.difficulty)
      }))
      .sort((a,b)=>b.score-a.score);

    for(const item of ranked){
      if(quota<=0 || selected.length>=count) break;

      const f=familyKey(item.q);

      if(usedFamilies.has(f)) continue;

      selected.push(item.q);
      usedFamilies.add(f);
      quota--;
    }
  }

  /*
   * Fill remaining slots without repeating questions.
   */
  if(selected.length<count){
    const remaining=shuffle(candidates)
      .sort((a,b)=>baseScore(b,c.difficulty)-baseScore(a,c.difficulty));

    for(const q of remaining){
      if(selected.length>=count) break;
      if(!selected.includes(q)) selected.push(q);
    }
  }

  return {
    questions:selected.slice(0,count),
    eligible:candidates.length,
    requested:count,
    insufficient:candidates.length<count
  };
}

API.select=async function(config={}){
  const pool=await getPool();

  const mode=norm(config.mode||"practice");

  const result =
    mode==="test"
      ? selectBalancedTest(pool,config)
      : selectPractice(pool,config);

  return {
    ...result,
    engine:"RankForgeQuestionEngineV2",
    mode:mode,
    topperTest180Untouched:true,
    dppParserAutoImport:false
  };
};

API.practice=async function(config={}){
  return API.select({...config,mode:"practice"});
};

API.test=async function(config={}){
  return API.select({...config,mode:"test"});
};

API.rank=async function(config={}){
  const pool=await getPool();

  return pool
    .filter(q=>matches(q,config))
    .map(q=>({
      ...q,
      engineScore:baseScore(q,config.difficulty),
      family:familyKey(q)
    }))
    .sort((a,b)=>b.engineScore-a.engineScore);
};

API.coverage=async function(config={}){
  const pool=await getPool();
  const eligible=pool.filter(q=>matches(q,config));

  const coverage={
    subject:{},
    chapter:{},
    topic:{},
    difficulty:{},
    sourceType:{},
    family:{}
  };

  for(const q of eligible){
    const keys={
      subject:field(q,"subject")||"unknown",
      chapter:field(q,"chapter")||"unknown",
      topic:field(q,"topic")||"unknown",
      difficulty:field(q,"difficulty")||"unknown",
      sourceType:q.sourceType||"unknown",
      family:familyKey(q)
    };

    for(const k of Object.keys(keys)){
      coverage[k][keys[k]]=(coverage[k][keys[k]]||0)+1;
    }
  }

  return {
    total:eligible.length,
    coverage,
    engine:"RankForgeQuestionEngineV2"
  };
};

API.stats=async function(){
  const pool=await getPool();

  const subjects={};
  const chapters={};
  const topics={};
  const families={};

  let quality=0;
  let novelty=0;
  let density=0;

  for(const q of pool){
    const s=field(q,"subject")||"unknown";
    const ch=field(q,"chapter")||"unknown";
    const t=field(q,"topic")||"unknown";
    const f=familyKey(q);

    subjects[s]=(subjects[s]||0)+1;
    chapters[ch]=(chapters[ch]||0)+1;
    topics[t]=(topics[t]||0)+1;
    families[f]=(families[f]||0)+1;

    quality+=number(q.qualityScore);
    novelty+=number(q.noveltyScore);
    density+=number(q.learningDensity);
  }

  const n=pool.length||1;

  return {
    total:pool.length,
    subjects,
    chapters,
    topics,
    familyCount:Object.keys(families).length,
    averageQuality:quality/n,
    averageNovelty:novelty/n,
    averageLearningDensity:density/n,
    engine:"RankForgeQuestionEngineV2"
  };
};

API.health=async function(){
  const pool=await getPool();

  return {
    ok:true,
    poolSize:pool.length,
    masterPoolAvailable:pool.length>0,
    topperTest180Untouched:true,
    dppParserAutoImport:false,
    duplicateQC:"Master Pool V2",
    familyClustering:true,
    qualityRanking:true,
    noveltyRanking:true,
    learningDensityRanking:true,
    coverageBalancing:true,
    validatedPracticeSelection:true,
    validatedTestSelection:true,
    engine:"RankForgeQuestionEngineV2"
  };
};

global.RankForgeQuestionEngineV2=API;
global.RF_QUESTION_ENGINE_V2=API;

})(window);
