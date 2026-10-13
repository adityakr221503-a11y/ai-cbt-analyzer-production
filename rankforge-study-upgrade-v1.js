/* rankforge-study-upgrade-v1: local source-based study tools; no app-level quotas. */
(function(){
'use strict';
if(window.RankForgeStudyUpgradeV1) return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function current(){
  const NB=window.RankForgeNotebook, books=NB&&NB.load?NB.load():[];
  const select=$('nbSelect'); const book=books.find(b=>select&&b.id===select.value)||books[0];
  const sources=(book&&book.sources)||[];
  return {book,sources,text:sources.map(s=>'SOURCE: '+s.title+'\n'+s.text).join('\n\n')};
}
function sentences(t){return (t.match(/[^.!?\n]+(?:[.!?]+|$)/g)||[]).map(s=>s.trim()).filter(s=>s.length>30);}
function keyTerms(t){
 const stop=new Set('this that with from have were they their there then than into about which when what where while also been being your you are was for the and but not all can may will should would could these those such each other more most very only some any has had its our out use used using based between through because therefore however'.split(' '));
 const m=new Map();(t.toLowerCase().match(/[a-z][a-z-]{3,}/g)||[]).forEach(w=>{if(!stop.has(w))m.set(w,(m.get(w)||0)+1)});
 return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,25).map(x=>x[0]);
}
function download(name,text,type){const blob=new Blob([text],{type:type||'text/plain;charset=utf-8'});const a=document.createElement('a');const u=URL.createObjectURL(blob);a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);}
function init(){
 const nav=document.querySelector('nav.tabs'), guide=$('tab-guide');if(!nav||!guide)return false;
 const b=document.createElement('button');b.type='button';b.dataset.tab='studytools';b.textContent='Study Tools';nav.appendChild(b);
 const section=document.createElement('section');section.className='tab';section.id='tab-studytools';
 section.innerHTML=`<div class="card" style="padding:16px;margin:12px 0"><h2>Notebook Study Tools</h2>
 <p><b>No artificial app usage quotas.</b> Run tools as often as needed. Large sources may still be limited by your device memory, browser storage, or file-processing capacity; split large material into batches if needed. All outputs are drafts—verify against the source.</p>
 <label for="stuFocus">Optional topic focus</label><input id="stuFocus" placeholder="e.g. cell cycle, mole concept" style="width:100%;padding:10px;margin:6px 0 12px">
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><button type="button" id="stuNotes">Revision notes</button><button type="button" id="stuCards">Flashcards</button><button type="button" id="stuQuiz">Source quiz</button><button type="button" id="stuExport">Export source pack</button></div>
 <div id="stuStatus" role="status" aria-live="polite" style="margin:8px 0"></div><div id="stuOutput"></div></div>`;
 guide.parentNode.appendChild(section);
 b.onclick=()=>{nav.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('section.tab').forEach(x=>x.classList.toggle('on',x===section));window.scrollTo(0,0);};
 function get(){const s=current();let t=s.text;const f=$('stuFocus').value.trim();if(f){const hits=sentences(t).filter(x=>x.toLowerCase().includes(f.toLowerCase()));if(hits.length)t=hits.join('\n');}if(t.replace(/\s/g,'').length<80)throw Error('Add a readable PDF/text source in the Sources tab first (minimum 80 characters).');return {text:t,focus:f};}
 function show(msg,html=''){ $('stuStatus').textContent=msg;$('stuOutput').innerHTML=html; }
 $('stuNotes').onclick=()=>{try{const {text,focus}=get(),ss=sentences(text),terms=keyTerms(text);const out='# Revision notes'+(focus?' — '+focus:'')+'\n\n## Key terms (automatically extracted; verify context)\n'+terms.map(x=>'- '+x).join('\n')+'\n\n## Source statements to revise\n'+ss.map((x,i)=>(i+1)+'. '+x).join('\n')+'\n\n## Accuracy note\nThese are extracted source statements, not a guaranteed complete or independently verified summary. Check the original source.';show('Notes extracted locally; no AI provider or daily quota used.','<pre style="white-space:pre-wrap">'+esc(out)+'</pre><button id="stuNotesDl">Download Markdown</button>');$('stuNotesDl').onclick=()=>download('rankforge-revision-notes.md',out);}catch(e){show(e.message);}};
 $('stuCards').onclick=()=>{try{const {text}=get(),ss=sentences(text);if(!ss.length)throw Error('No suitable source statements found.');const cards=ss.map((s,i)=>({front:'Recall the key idea from source statement '+(i+1),back:s,sourceQuote:s}));let i=0;function draw(){const c=cards[i];$('stuOutput').innerHTML='<div class="card" style="padding:14px"><small>Card '+(i+1)+' / '+cards.length+'</small><h3>'+esc(c.front)+'</h3><details><summary>Reveal source answer</summary><p>'+esc(c.back)+'</p></details><button id="stuPrev" '+(!i?'disabled':'')+'>Previous</button> <button id="stuNext" '+(i===cards.length-1?'disabled':'')+'>Next</button> <button id="stuCardsDl">Export all cards</button></div>';$('stuPrev').onclick=()=>{i--;draw();};$('stuNext').onclick=()=>{i++;draw();};$('stuCardsDl').onclick=()=>download('rankforge-flashcards.json',JSON.stringify(cards,null,2),'application/json');}show('Flashcards created from source statements. These are recall prompts, not independently generated exam questions.');draw();}catch(e){show(e.message);}};
 $('stuQuiz').onclick=()=>{try{const {text,focus}=get();const ss=sentences(text).filter(x=>x.length>=45&&x.length<=280);if(ss.length<3)throw Error('Need at least three clear source sentences.');const qs=ss.map((s,i)=>({question:'Which statement matches the selected source?',answer:s,sourceQuote:s,options:[s,...ss.filter(x=>x!==s).slice(0,3)].sort(()=>Math.random()-.5)}));const out='# Source-recognition quiz'+(focus?' — '+focus:'')+'\n\n'+qs.map((q,i)=>'Q'+(i+1)+'. Which statement matches the source?\n'+q.options.map((o,j)=>String.fromCharCode(65+j)+') '+o).join('\n')+'\nAnswer: '+String.fromCharCode(65+q.options.indexOf(q.answer))+'\nEvidence: '+q.sourceQuote).join('\n\n')+'\n\nNote: This checks source recognition, not deep conceptual mastery.';show('Quiz created locally. Review every item before using it for assessment.','<pre style="white-space:pre-wrap">'+esc(out)+'</pre><button id="stuQuizDl">Download quiz</button>');$('stuQuizDl').onclick=()=>download('rankforge-source-quiz.txt',out);}catch(e){show(e.message);}};
 $('stuExport').onclick=()=>{try{const s=current();if(s.text.replace(/\s/g,'').length<80)throw Error('Add a source first.');download('rankforge-notebook-source-pack.txt',s.text);show('Exported source text from the selected notebook.');}catch(e){show(e.message);}};
 return true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.RankForgeStudyUpgradeV1={init};
})();
