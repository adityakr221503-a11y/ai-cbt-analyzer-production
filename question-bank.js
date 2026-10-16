/* Ranker Pro — Question Bank compatibility layer.
 * No manual question-creation UI. Questions enter through approved/imported banks.
 */
(function(){
  'use strict';
  function T(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
  function N(v){return T(v).toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
  /* Small built-in checker, used only when the unified helper is not loaded on this page. */
  const LOCAL={
    fingerprint:function(q){return [q&&q.subject,q&&q.chapter,q&&q.topic,q&&q.concept,q&&q.question].concat(Array.isArray(q&&q.options)?q.options:[]).map(N).join('|')},
    valid:function(q){
      if(!q||typeof q!=='object'||!T(q.question))return false;
      const o=Array.isArray(q.options)?q.options:[];
      const a=Number.isInteger(q.correctIndex)?q.correctIndex:(/^[A-D]$/i.test(String(q.correctAnswer||''))?String(q.correctAnswer).toUpperCase().charCodeAt(0)-65:-1);
      return o.length===4&&o.every(function(x){return T(x)})&&a>=0&&a<4;
    },
    normalize:function(q,source){
      if(!q||typeof q!=='object')return null;
      const options=Array.isArray(q.options)?q.options.map(T):[];
      let ci=Number.isInteger(q.correctIndex)?q.correctIndex:-1;
      if(ci<0&&/^[A-D]$/i.test(String(q.correctAnswer||'')))ci=String(q.correctAnswer).toUpperCase().charCodeAt(0)-65;
      return Object.assign({},q,{id:T(q.id)||source+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),question:T(q.question),options:options,correctIndex:ci,correctAnswer:'ABCD'[ci]||q.correctAnswer||'',source:T(q.source)||source});
    }
  };
  const KEY='rankBoosterQuestionBankV2';
  function read(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function getAll(){const A=window.RankerUnifiedBank;return A?A.getAll():read()}
  function count(){return getAll().length}
  function addImported(questions){
    const API=window.RankerUnifiedBank||LOCAL;
    const existing=read(); const incoming=(Array.isArray(questions)?questions:[]).map(q=>API.normalize(q,'approved-import')).filter(API.valid);
    const all=existing.concat(incoming); const seen=new Set(); const unique=[];
    all.forEach(q=>{const k=API.fingerprint(q);if(k&&!seen.has(k)){seen.add(k);unique.push(q)}});
    write(unique); return incoming.length;
  }
  window.RankBoosterQuestionBank={version:'2.0.0',getAll,count,addImported};
})();
