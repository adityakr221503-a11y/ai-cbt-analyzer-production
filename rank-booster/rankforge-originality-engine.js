(function(global){
'use strict';

const VERSION='RF-ORIGINALITY-1.0';

function clean(v){
  return String(v==null?'':v).replace(/\s+/g,' ').trim();
}

function textOf(q){
  return clean(q && (q.question||q.text||q.questionText||q.prompt));
}

function optionsOf(q){
  return Array.isArray(q&&q.options)
    ? q.options.map(clean).filter(Boolean)
    : [];
}

function hash(s){
  let h=2166136261;
  s=String(s||'');
  for(let i=0;i<s.length;i++){
    h^=s.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return ('00000000'+(h>>>0).toString(16)).slice(-8);
}

function normalizeStem(s){
  return clean(s)
    .toLowerCase()
    .replace(/\b(a|an|the|is|are|was|were|which|what|following|correct|incorrect)\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function tokens(s){
  return new Set(
    normalizeStem(s)
      .split(/\s+/)
      .filter(x=>x.length>=4)
  );
}

function similarity(a,b){
  const A=tokens(a),B=tokens(b);
  if(!A.size||!B.size)return 0;

  let common=0;
  A.forEach(x=>{if(B.has(x))common++;});

  return common/new Set([...A,...B]).size;
}

function fingerprint(q){
  return hash(
    normalizeStem(textOf(q))+
    '||'+
    optionsOf(q)
      .map(x=>normalizeStem(x))
      .sort()
      .join('|')
  );
}

function stemFingerprint(q){
  return hash(normalizeStem(textOf(q)));
}

function valid(q){
  const o=optionsOf(q);
  return !!(
    textOf(q).length>=20 &&
    o.length===4 &&
    o.every(Boolean)
  );
}

/*
 * RankForge originality gate.
 *
 * Threshold:
 * < 0.50 = strongly different
 * 0.50–0.61 = acceptable
 * >= 0.62 = reject as near duplicate
 */
function check(q,pool,threshold){
  threshold=Number.isFinite(Number(threshold))
    ? Number(threshold)
    : 0.62;

  if(!valid(q)){
    return {
      accepted:false,
      reason:'INVALID_STRUCTURE',
      noveltyScore:0,
      similarity:1
    };
  }

  const fp=fingerprint(q);
  const sfp=stemFingerprint(q);

  let highest=0;
  let matched=null;

  for(const raw of Array.isArray(pool)?pool:[]){
    if(!raw)continue;

    if(fingerprint(raw)===fp){
      return {
        accepted:false,
        reason:'EXACT_OR_OPTION_DUPLICATE',
        noveltyScore:0,
        similarity:1,
        matchedId:raw.id||null
      };
    }

    if(stemFingerprint(raw)===sfp){
      return {
        accepted:false,
        reason:'SAME_STEM_PATTERN',
        noveltyScore:0,
        similarity:1,
        matchedId:raw.id||null
      };
    }

    const sim=similarity(textOf(q),textOf(raw));

    if(sim>highest){
      highest=sim;
      matched=raw.id||null;
    }
  }

  const novelty=Math.max(0,Math.round((1-highest)*100));

  return {
    accepted:highest<threshold,
    reason:highest<threshold
      ? 'ORIGINAL_ENOUGH'
      : 'NEAR_DUPLICATE',
    noveltyScore:novelty,
    similarity:Number(highest.toFixed(3)),
    matchedId:matched
  };
}

function filter(candidates,pool,threshold){
  const accepted=[];
  const rejected=[];

  for(const q of Array.isArray(candidates)?candidates:[]){
    const result=check(
      q,
      [...(Array.isArray(pool)?pool:[]),...accepted],
      threshold
    );

    if(result.accepted){
      accepted.push({
        ...q,
        originality:{
          ...result,
          engine:VERSION
        }
      });
    }else{
      rejected.push({
        ...q,
        originality:{
          ...result,
          engine:VERSION
        }
      });
    }
  }

  return {
    accepted,
    rejected,
    acceptedCount:accepted.length,
    rejectedCount:rejected.length
  };
}

/*
 * Examiner-style blueprint.
 * This tells the LLM HOW to construct a new question.
 */
function examinerBlueprint(subject){
  const common=[
    'new scenario built from known curriculum concepts',
    'concept combination without copying any source question',
    'condition-change or what-if reasoning',
    'comparison requiring elimination',
    'statement/inference based reasoning',
    'application of a familiar principle in an unfamiliar context',
    'plausible distractors based on common conceptual mistakes'
  ];

  if(subject==='Biology'){
    return [
      'NCERT line/statement precision',
      'NCERT diagram interpretation',
      'two NCERT facts combined into one inference',
      'exception/condition based reasoning',
      'experimental or biological observation interpretation',
      ...common
    ];
  }

  if(subject==='Chemistry'){
    return [
      'reaction-condition change',
      'trend plus exception reasoning',
      'molecular/structural inference',
      'numerical data interpretation',
      'multiple concepts with controlled difficulty',
      ...common
    ];
  }

  return [
    'new physical situation',
    'graph/data interpretation',
    'condition-change reasoning',
    'dimensional/unit consistency',
    'multi-step but NEET-appropriate calculation',
    ...common
  ];
}

global.RankForgeOriginality={
  version:VERSION,
  fingerprint,
  stemFingerprint,
  similarity,
  check,
  filter,
  examinerBlueprint
};

})(window);
