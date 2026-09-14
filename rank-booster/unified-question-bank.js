/* Ranker Pro — Unified Question Bank v1
 * Master/core questions remain the primary source.
 * AI-generated questions are stored separately and only joined at test time.
 */
(function(){
  'use strict';
  const AI_KEY='rankerAiApprovedQuestionsV1';
  const PDF_KEYS=['pdfCbtQuestions','pdfQuestions','cbtQuestions','importedQuestions','pdfQuestionBank','questionBank'];

  function read(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(v)?v:fallback}catch(e){return fallback}}
  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
  function norm(v){return text(v).toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
  function fingerprint(q){
    return [q&&q.subject,q&&q.chapter,q&&q.topic,q&&q.concept,q&&q.question,...(Array.isArray(q&&q.options)?q.options:[])]
      .map(norm).join('|');
  }
  function valid(q){
    if(!q||typeof q!=='object'||!text(q.question))return false;
    const o=Array.isArray(q.options)?q.options:[];
    const answer=Number.isInteger(q.correctIndex)?q.correctIndex:(/^[A-D]$/i.test(String(q.correctAnswer||''))?String(q.correctAnswer).toUpperCase().charCodeAt(0)-65:-1);
    return o.length===4&&o.every(x=>text(x))&&answer>=0&&answer<4;
  }
  function normalize(q,source){
    if(!q||typeof q!=='object')return null;
    const options=Array.isArray(q.options)?q.options.map(text):[];
    let correctIndex=Number.isInteger(q.correctIndex)?q.correctIndex:-1;
    if(correctIndex<0&&/^[A-D]$/i.test(String(q.correctAnswer||'')))correctIndex=String(q.correctAnswer).toUpperCase().charCodeAt(0)-65;
    return Object.assign({},q,{id:text(q.id)||source+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),question:text(q.question),options,correctIndex,correctAnswer:'ABCD'[correctIndex]||q.correctAnswer||'',source:text(q.source)||source,bankSource:source});
  }
  function core(){
    const out=[];
    if(Array.isArray(window.TEST180_QUESTIONS))out.push(...window.TEST180_QUESTIONS.map(q=>normalize(q,'master-test180')).filter(valid));
    PDF_KEYS.forEach(k=>out.push(...read(k,[]).map(q=>normalize(q,'master-import')).filter(valid)));
    return dedupe(out);
  }
  function ai(){return dedupe(read(AI_KEY,[]).map(q=>normalize(q,'ai-generated')).filter(valid));}
  function dedupe(list){const seen=new Set(),out=[];list.forEach(q=>{const k=fingerprint(q);if(k&&!seen.has(k)){seen.add(k);out.push(q)}});return out}
  function getCore(){return core()}
  function getAI(){return ai()}
  function getAll(){return dedupe(core().concat(ai()))}
  function stats(){return {core:getCore().length,ai:getAI().length,total:getAll().length}}
  function saveAI(questions){
    const merged=ai().concat(Array.isArray(questions)?questions:[]).map(q=>normalize(q,'ai-generated')).filter(valid);
    const unique=dedupe(merged); localStorage.setItem(AI_KEY,JSON.stringify(unique)); return unique;
  }
  window.RankerUnifiedBank={getCore,getAI,getAll,stats,saveAI,fingerprint,valid,normalize};
})();
