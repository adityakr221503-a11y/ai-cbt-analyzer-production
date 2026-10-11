/* RANKFORGE_LEARNING_LOOP_V2 */
(function(){
"use strict";

const K={
 history:["cbtHistory","rankBoosterAttemptHistory"],
 mistakes:"rankforgeMistakes",
 mastery:"cbtMasteryV2",
 queue:"cbtAnalyzer.retryQueue",
 retry:"cbtRetryQuestion",
 progress:"rankforgeProgress",
 actions:"rankforgeNextActions",
 events:"rankforgeLearningEvents"
};

const REASONS=[
 "Concept Gap",
 "Calculation Error",
 "Misread",
 "Guessing",
 "Time Pressure",
 "Wrong Click",
 "Unattempted"
];

function get(k,f){
 try{
   const v=JSON.parse(localStorage.getItem(k));
   return v==null?f:v;
 }catch(e){return f}
}

function set(k,v){
 try{localStorage.setItem(k,JSON.stringify(v));return true}
 catch(e){return false}
}

function A(v){return Array.isArray(v)?v:[]}

function id(q,i){
 return String(q?.id||q?.questionId||q?.qid||q?.question_id||"Q-"+i)
}

function text(q){
 return String(q?.text||q?.question||q?.questionText||q?.prompt||"")
}

function selected(q){
 return q?.selectedAnswer ??
        q?.selected ??
        q?.userAnswer ??
        q?.chosenAnswer ??
        q?.userOption
}

function correct(q){
 return q?.correctAnswer ??
        q?.correctIndex ??
        q?.answerKey ??
        q?.correctOption
}

function wrong(q){
 if(q?.isWrong===true || q?.correct===false)return true;
 const a=selected(q),b=correct(q);
 if(a==null || b==null)return false;
 return String(a)!==String(b);
}

function reason(q){
 return q?.mistakeReason||
        q?.mistakeType||
        q?.reason||
        (selected(q)==null?"Unattempted":"Concept Gap")
}

function topic(q){
 return String(q?.topic||q?.chapter||q?.unit||q?.subject||"Unclassified")
}

function event(type,data){
 const e=A(get(K.events,[]));
 e.unshift({type,...data,at:Date.now()});
 set(K.events,e.slice(0,500));
}

function addMistake(q,i,attempt){
 if(!wrong(q))return;

 const idv=id(q,i);
 const all=A(get(K.mistakes,[]));
 let m=all.find(x=>String(x.id)===idv);

 if(!m){
   m={
    id:idv,
    questionId:idv,
    text:text(q),
    topic:topic(q),
    subject:q?.subject||"",
    chapter:q?.chapter||"",
    selectedAnswer:selected(q),
    correctAnswer:correct(q),
    mistakeReason:reason(q),
    mistakeType:reason(q),
    status:"active",
    retryCount:0,
    attempts:0,
    firstSeen:Date.now(),
    lastSeen:Date.now(),
    testId:attempt?.id||attempt?.testId||""
   };
   all.push(m);
 }else{
   m.selectedAnswer=selected(q);
   m.correctAnswer=correct(q);
   m.lastSeen=Date.now();
   m.attempts=Number(m.attempts||0)+1;
   m.status="active";
 }

 m.retryCount=Number(m.retryCount||0);

 set(K.mistakes,all.slice(-1500));

 const queue=A(get(K.queue,[]));
 if(!queue.some(x=>String(x.id||x.questionId)===idv)){
   queue.push({
    ...q,
    id:idv,
    questionId:idv,
    retryStatus:"pending",
    mistakeReason:m.mistakeReason
   });
 }
 set(K.queue,queue.slice(-1000));

 set(K.retry,queue.slice(-1000));
}

function ingest(a){
 if(!a||typeof a!=="object")return;

 const qs=A(
   a.questions||
   a.questionResults||
   a.results||
   a.items||
   a.wrongQuestions
 );

 if(!qs.length)return;

 qs.forEach((q,i)=>addMistake(q,i,a));

 const mistakes=A(get(K.mistakes,[]));

 const weak={};
 mistakes.filter(x=>x.status!=="mastered").forEach(x=>{
   weak[x.topic]=(weak[x.topic]||0)+1;
 });

 const progress=get(K.progress,{});
 progress.tests=Number(progress.tests||0);
 progress.questions=Number(progress.questions||0);
 progress.mistakes=mistakes.filter(x=>x.status!=="mastered").length;
 progress.mastered=mistakes.filter(x=>x.status==="mastered").length;
 progress.weakTopics=Object.entries(weak)
   .sort((a,b)=>b[1]-a[1])
   .slice(0,10)
   .map(x=>({topic:x[0],mistakes:x[1]}));
 progress.updatedAt=Date.now();

 set(K.progress,progress);

 const actions=[];
 const queue=A(get(K.queue,[]));

 if(queue.length){
   actions.push({
     type:"retry",
     title:"Retry Mistakes",
     count:queue.length
   });
 }

 if(progress.weakTopics?.length){
   actions.push({
     type:"weak-topic",
     title:"Practice Weak Topic",
     topic:progress.weakTopics[0].topic
   });
 }

 actions.push({
   type:"mistake-book",
   title:"Review Mistake Book"
 });

 set(K.actions,actions);

 event("cbt-synced",{questions:qs.length,mistakes:mistakes.length});
}

function sync(){
 const seen=get("rankforgeLearningProcessed",{});
 let changed=false;

 K.history.forEach(key=>{
   A(get(key,[])).forEach((a,i)=>{
     const aid=String(
       a.id||a.testId||a.completedAt||a.createdAt||key+"-"+i
     );

     if(!seen[aid]){
       ingest(a);
       seen[aid]=Date.now();
       changed=true;
     }
   });
 });

 if(changed){
   const keys=Object.keys(seen);
   if(keys.length>2000){
     const keep={};
     keys.slice(-1500).forEach(k=>keep[k]=seen[k]);
     set("rankforgeLearningProcessed",keep);
   }else set("rankforgeLearningProcessed",seen);
 }
}

function setReason(idv,r){
 if(!REASONS.includes(r))return false;

 const all=A(get(K.mistakes,[]));
 const m=all.find(x=>String(x.id)===String(idv));
 if(!m)return false;

 m.mistakeReason=r;
 m.mistakeType=r;
 m.lastSeen=Date.now();

 set(K.mistakes,all);
 return true;
}

function mastery(idv,passed){
 const all=A(get(K.mistakes,[]));
 const m=all.find(x=>String(x.id)===String(idv));

 const master=get(K.mastery,{});
 const old=master[idv]||{};

 master[idv]={
   ...old,
   attempts:Number(old.attempts||0)+1,
   lastAttempt:Date.now(),
   mastered:!!passed,
   status:passed?"mastered":"active"
 };

 set(K.mastery,master);

 if(m){
   m.status=passed?"mastered":"active";
   m.lastSeen=Date.now();
   m.retryCount=Number(m.retryCount||0)+1;
   set(K.mistakes,all);
 }

 if(passed){
   const q=A(get(K.queue,[]))
     .filter(x=>String(x.id||x.questionId)!==String(idv));
   set(K.queue,q);
   set(K.retry,q);
 }

 event(passed?"question-mastered":"retry-failed",{id:idv});
 sync();
}

function retry(idv){
 const all=A(get(K.mistakes,[]));
 const m=all.find(x=>String(x.id)===String(idv));
 if(!m)return;

 const q={
   ...m,
   id:m.id,
   questionId:m.id,
   retryMode:true
 };

 set(K.retry,[q]);
 set(K.queue,[q]);
 location.href="./retry.html";
}

function buildBook(){
 if(document.querySelector("[data-rf-v2-book]"))return;

 const all=A(get(K.mistakes,[]));
 const active=all.filter(x=>x.status!=="mastered");
 const mastered=all.filter(x=>x.status==="mastered");

 const box=document.createElement("section");
 box.dataset.rfV2Book="1";
 box.style.cssText=
 "margin:16px;padding:16px;border-radius:18px;border:1px solid rgba(127,127,127,.25)";

 box.innerHTML=`
 <div style="font-size:18px;font-weight:700">RankForge Mistake Intelligence</div>
 <div style="margin-top:8px">
 Active <b>${active.length}</b>
 &nbsp;•&nbsp;
 Mastered <b>${mastered.length}</b>
 &nbsp;•&nbsp;
 Retry Queue <b>${A(get(K.queue,[])).length}</b>
 </div>
 <div data-rf-reasons style="margin-top:14px"></div>
 <div data-rf-list style="margin-top:14px"></div>
 `;

 const reasons=box.querySelector("[data-rf-reasons]");
 REASONS.forEach(r=>{
   const n=active.filter(x=>x.mistakeReason===r).length;
   if(!n)return;

   const b=document.createElement("button");
   b.type="button";
   b.textContent=r+" ("+n+")";
   b.style.margin="3px";
   b.onclick=()=>{
     renderList(active.filter(x=>x.mistakeReason===r));
   };
   reasons.appendChild(b);
 });

 function renderList(list){
   const out=box.querySelector("[data-rf-list]");
   out.innerHTML="";

   list.slice(0,50).forEach(m=>{
     const row=document.createElement("div");
     row.style.cssText=
       "padding:12px;margin:7px 0;border-radius:12px;background:rgba(127,127,127,.08)";

     row.innerHTML=`
       <div style="font-weight:600">${escapeHtml(m.topic)}</div>
       <div style="margin:5px 0">${escapeHtml(m.text).slice(0,240)}</div>
       <select data-reason>
         ${REASONS.map(r=>
           `<option ${r===m.mistakeReason?"selected":""}>${r}</option>`
         ).join("")}
       </select>
       <button type="button" data-retry>Retry</button>
       <span style="margin-left:8px">${m.status}</span>
     `;

     row.querySelector("[data-reason]").onchange=e=>{
       setReason(m.id,e.target.value);
     };

     row.querySelector("[data-retry]").onclick=()=>{
       retry(m.id);
     };

     out.appendChild(row);
   });
 }

 renderList(active);

 const target=document.querySelector("main")||
              document.querySelector(".container")||
              document.body;

 target.prepend(box);
}

function escapeHtml(x){
 return String(x||"").replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",
  '"':"&quot;","'":"&#39;"
 }[c]));
}

function retryBridge(){
 document.addEventListener("click",e=>{
   const b=e.target.closest("button");
   if(!b)return;

   const t=(b.innerText||"").toLowerCase();
   if(!/(submit|check|answer|next|finish|complete|correct|wrong)/.test(t))
     return;

   setTimeout(()=>{
     sync();

     const q=
       window.CBT_CURRENT_QUESTION||
       window.currentQuestion||
       window.activeQuestion;

     if(!q)return;

     const a=selected(q),c=correct(q);
     if(a==null||c==null)return;

     mastery(id(q,0),String(a)===String(c));
   },100);
 });
}

function start(){
 sync();

 if(location.pathname.endsWith("/mistake.html")||
    location.pathname.endsWith("mistake.html")){
   setTimeout(buildBook,250);
 }

 retryBridge();

 setInterval(sync,1200);

 window.addEventListener("storage",sync);

 window.RankForgeLearningLoopV2={
   sync,
   ingest,
   setReason,
   mastery,
   retry,
   reasons:REASONS,
   keys:K
 };
}

if(document.readyState==="loading")
 document.addEventListener("DOMContentLoaded",start,{once:true});
else start();

})();
 /* /RANKFORGE_LEARNING_LOOP_V2 */
