/* Ranker Pro — Question Bank compatibility layer.
 * No manual question-creation UI. Questions enter through approved/imported banks.
 */
(function(){
  'use strict';
  const API=window.RankerUnifiedBank;
  const KEY='rankBoosterQuestionBankV2';
  function read(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  /* identical questions must count once, whichever module they came from */
  function keyOf(q){
    return String((q&&(q.text||q.question||q.questionText))||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().slice(0,220);
  }
  /* merge the unified bank (Test180 + imports + approved AI) with anything restored/imported here */
  function getAll(){
    if(!API) return read();
    const seen=new Set(), out=[];
    API.getAll().concat(read()).forEach(function(q){
      const k=keyOf(q);
      if(k && !seen.has(k)){ seen.add(k); out.push(q); }
    });
    return out;
  }
  /* Used by import-test180.js. It was referenced but never defined, so every restore rejected all 180. */
  window.addRankBoosterQuestion=function(q){
    if(!API) return false;
    const n=API.normalize(q,'approved-import');
    if(!n || !API.valid(n)) return false;
    const k=keyOf(n);
    if(API.getAll().concat(read()).some(function(x){return keyOf(x)===k;})) return false;
    const ex=read(); ex.push(n); write(ex); return true;
  };
  function count(){return getAll().length}
  function addImported(questions){
    if(!API)return 0;
    const existing=read(); const incoming=(Array.isArray(questions)?questions:[]).map(q=>API.normalize(q,'approved-import')).filter(API.valid);
    const all=existing.concat(incoming); const seen=new Set(); const unique=[];
    all.forEach(q=>{const k=API.fingerprint(q);if(k&&!seen.has(k)){seen.add(k);unique.push(q)}});
    write(unique); return incoming.length;
  }
  window.RankBoosterQuestionBank={version:'2.0.0',getAll,count,addImported};
})();
