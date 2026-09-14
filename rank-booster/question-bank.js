/* Ranker Pro — Question Bank compatibility layer.
 * No manual question-creation UI. Questions enter through approved/imported banks.
 */
(function(){
  'use strict';
  const API=window.RankerUnifiedBank;
  const KEY='rankBoosterQuestionBankV2';
  function read(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function getAll(){return API?API.getAll():read()}
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
