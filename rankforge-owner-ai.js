"use strict";
(function(){
const VERSION="OWNER_AI_GUARDIAN_V1";
const IK="rankforge.guardian.incidents.v1";
const EK="rankforge.guardian.evidence.v1";
const SK="rankforge.guardian.snapshot.v1";

const now=()=>new Date().toISOString();
const read=(k,d)=>{try{const x=localStorage.getItem(k);return x==null?d:JSON.parse(x)}catch(_){return d}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}};

const G={
 version:VERSION,
 incidents:read(IK,[]),
 evidence:read(EK,[]),
 consoleErrors:[],
 started:false,

 emit(type,data){
   const e={
     id:"EV-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
     at:now(),type,data
   };
   this.evidence.push(e);
   if(this.evidence.length>500)this.evidence.shift();
   write(EK,this.evidence);
   return e;
 },

 incident(title,details,status="NOT VERIFIED",severity="info"){
   const i={
     id:"INC-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
     at:now(),title,details,status,severity
   };
   this.incidents.push(i);
   if(this.incidents.length>200)this.incidents.shift();
   write(IK,this.incidents);
   this.emit("incident",i);
   return i;
 },

 start(){
   if(this.started)return;
   this.started=true;

   const oldError=console.error.bind(console);
   console.error=(...a)=>{
     this.consoleErrors.push({at:now(),args:a.map(String)});
     this.emit("console.error",a.map(String));
     oldError(...a);
   };

   window.addEventListener("error",e=>{
     this.emit("runtime.error",{
       message:e.message,
       source:e.filename,
       line:e.lineno,
       column:e.colno
     });
   });

   window.addEventListener("unhandledrejection",e=>{
     this.emit("runtime.unhandledrejection",{reason:String(e.reason)});
   });

   window.addEventListener("online",()=>this.emit("network.online",{}));
   window.addEventListener("offline",()=>this.emit("network.offline",{}));

   this.emit("guardian.started",{
     version:VERSION,
     url:location.href
   });
 },

 snapshot(){
   const scripts=[...document.scripts]
     .filter(s=>s.src)
     .map(s=>({src:s.src}));

   const buttons=[...document.querySelectorAll("button")]
     .map(b=>({
       text:(b.innerText||"").trim().slice(0,100),
       disabled:b.disabled,
       onclick:!!b.onclick
     }));

   const snap={
     at:now(),
     url:location.href,
     title:document.title,
     scripts,
     buttons,
     storageBytes:JSON.stringify(localStorage).length,
     online:navigator.onLine
   };

   write(SK,snap);
   this.emit("snapshot",snap);
   return snap;
 },

 async checkSource(path){
   try{
     const r=await fetch(path,{cache:"no-store"});
     const result={
       path,
       status:r.status,
       ok:r.ok
     };
     this.emit("source.check",result);
     return result;
   }catch(e){
     const result={path,ok:false,error:String(e)};
     this.emit("source.check",result);
     return result;
   }
 },

 async checkBank(){
   const out={
     test180:{expected:180,actual:0,status:"NOT VERIFIED"},
     biology:{expected:2700,actual:0,status:"NOT VERIFIED"},
     master:0,
     unified:0
   };

   try{
     if(Array.isArray(window.TEST180_QUESTIONS))
       out.test180.actual=window.TEST180_QUESTIONS.length;
     else if(Array.isArray(window.__RANKERS_TEST180_BANK))
       out.test180.actual=window.__RANKERS_TEST180_BANK.length;
   }catch(_){}

   try{
     out.master=
       window.RankBoosterQuestionBank?.getAll?.()?.length||0;
   }catch(_){}

   try{
     out.unified=
       window.RankerUnifiedBank?.getAll?.()?.length||0;
   }catch(_){}

   try{
     const bio=read("RANKFORGE_BIOLOGY_2700_BANK_V2",[]);
     out.biology.actual=Array.isArray(bio)?bio.length:0;
   }catch(_){}

   out.test180.status=
     out.test180.actual===180
     ?"VERIFIED WORKING"
     :"VERIFIED BROKEN";

   out.biology.status=
     out.biology.actual===2700
     ?"VERIFIED WORKING"
     :"VERIFIED BROKEN";

   if(out.test180.status==="VERIFIED BROKEN")
     this.incident(
       "Test 180 bank mismatch",
       {expected:180,actual:out.test180.actual},
       "VERIFIED BROKEN",
       "critical"
     );

   if(out.biology.status==="VERIFIED BROKEN")
     this.incident(
       "Biology bank mismatch",
       {expected:2700,actual:out.biology.actual},
       "VERIFIED BROKEN",
       "critical"
     );

   this.emit("bank.check",out);
   return out;
 },

 async verifyWorkflow(){
   const checks=[];
   const add=(name,expected,actual,critical=true)=>{
     const ok=expected===actual;
     checks.push({
       name,expected,actual,
       status:ok?"VERIFIED WORKING":"VERIFIED BROKEN",
       critical
     });
     return ok;
   };

   let t180=0;
   try{
     if(Array.isArray(window.TEST180_QUESTIONS))
       t180=window.TEST180_QUESTIONS.length;
     else if(Array.isArray(window.__RANKERS_TEST180_BANK))
       t180=window.__RANKERS_TEST180_BANK.length;
   }catch(_){}

   let bio=0;
   try{
     const x=read("RANKFORGE_BIOLOGY_2700_BANK_V2",[]);
     bio=Array.isArray(x)?x.length:0;
   }catch(_){}

   add("Test 180 source",180,t180,true);
   add("Biology source",2700,bio,true);

   const required=[
     ["CBT page","./cbt.html"],
     ["Mistake page","./mistake.html"],
     ["Rankers page","./rankers-test-series.html"]
   ];

   for(const [name,path] of required){
     try{
       const r=await fetch(path,{cache:"no-store"});
       checks.push({
         name,
         expected:"HTTP 200",
         actual:r.status,
         status:r.ok?"VERIFIED WORKING":"VERIFIED BROKEN",
         critical:true
       });
     }catch(e){
       checks.push({
         name,
         expected:"reachable",
         actual:String(e),
         status:"VERIFIED BROKEN",
         critical:true
       });
     }
   }

   const criticalBroken=checks.filter(
     x=>x.critical&&x.status==="VERIFIED BROKEN"
   );

   const result={
     at:now(),
     checks,
     status:criticalBroken.length
       ?"VERIFIED BROKEN"
       :"VERIFIED WORKING"
   };

   this.emit("workflow.verification",result);

   if(criticalBroken.length){
     this.incident(
       "RankForge workflow verification failed",
       criticalBroken,
       "VERIFIED BROKEN",
       "critical"
     );
   }

   return result;
 },

 async checkDataFlow(){
   this.start();

   const checks=[];
   const test=(name,expected,actual,critical=true)=>{
     const ok=expected===actual;
     checks.push({
       name,expected,actual,
       status:ok?"VERIFIED WORKING":"VERIFIED BROKEN",
       critical
     });
     return ok;
   };

   /* ---------- TEST 180 DATA CONTRACT ---------- */
   let t180=Array.isArray(window.TEST180_QUESTIONS)
     ?window.TEST180_QUESTIONS
     :(Array.isArray(window.__RANKERS_TEST180_BANK)
       ?window.__RANKERS_TEST180_BANK:[]);

   test("Test 180 record count",180,t180.length,true);

   if(t180.length){
     let valid=0;
     let answers=0;
     let subjects=0;
     let duplicateIds=0;
     const ids=new Set();

     for(const q of t180){
       if(
         q &&
         typeof q.question==="string" &&
         q.question.trim() &&
         Array.isArray(q.options) &&
         q.options.length===4
       ) valid++;

       if(q && (q.correctAnswer||q.answer)) answers++;
       if(q && q.subject) subjects++;

       if(q && q.id){
         if(ids.has(q.id)) duplicateIds++;
         ids.add(q.id);
       }
     }

     test("Test 180 valid question records",180,valid,true);
     test("Test 180 answer records",180,answers,true);
     test("Test 180 subject records",180,subjects,false);
     test("Test 180 duplicate IDs",0,duplicateIds,true);
   }

   /* ---------- BIOLOGY DATA CONTRACT ---------- */
   let bio=[];
   try{
     const x=read("RANKFORGE_BIOLOGY_2700_BANK_V2",[]);
     bio=Array.isArray(x)?x:[];
   }catch(_){}

   test("Biology record count",2700,bio.length,true);

   if(bio.length){
     const ids=new Set();
     let valid=0;
     let answers=0;
     let duplicates=0;
     let testScoped=0;

     for(const q of bio){
       if(
         q &&
         typeof q.question==="string" &&
         q.question.trim() &&
         Array.isArray(q.options) &&
         q.options.length>=2
       ) valid++;

       if(q && (q.correctAnswer||q.answer)) answers++;

       if(q && q.id){
         if(ids.has(q.id)) duplicates++;
         ids.add(q.id);
       }

       if(q && q.testNumber) testScoped++;
     }

     test("Biology valid records",2700,valid,true);
     test("Biology answer records",2700,answers,true);
     test("Biology duplicate IDs",0,duplicates,true);
     test("Biology test-scoped records",2700,testScoped,true);
   }

   /* ---------- STORAGE CONTRACT ---------- */
   const storageKeys=[
     "CBT_ACTIVE_QUESTIONS",
     "CBT_ACTIVE_TEST_TITLE",
     "CBT_ACTIVE_SOURCE",
     "pdfCbtQuestions",
     "pdfQuestions"
   ];

   for(const key of storageKeys){
     let exists=false;
     try{
       exists=localStorage.getItem(key)!==null;
     }catch(_){}

     checks.push({
       name:"Storage key "+key,
       expected:"available when workflow active",
       actual:exists?"present":"not present",
       status:"NOT VERIFIED",
       critical:false
     });
   }

   /* ---------- BUTTON REALITY ---------- */
   const buttons=[...document.querySelectorAll("button")];
   let visibleButtons=0;
   let disabledButtons=0;

   for(const b of buttons){
     const r=b.getBoundingClientRect();
     if(r.width>0&&r.height>0) visibleButtons++;
     if(b.disabled) disabledButtons++;
   }

   checks.push({
     name:"Visible buttons",
     expected:">0",
     actual:visibleButtons,
     status:visibleButtons>0
       ?"VERIFIED WORKING"
       :"VERIFIED BROKEN",
     critical:true
   });

   /* ---------- PAGE CONTRACT ---------- */
   const pages=[
     "cbt.html",
     "rankers-test-series.html",
     "mistake.html"
   ];

   for(const page of pages){
     try{
       const r=await fetch(page,{cache:"no-store"});
       checks.push({
         name:"Page "+page,
         expected:200,
         actual:r.status,
         status:r.ok
           ?"VERIFIED WORKING"
           :"VERIFIED BROKEN",
         critical:true
       });
     }catch(e){
       checks.push({
         name:"Page "+page,
         expected:"reachable",
         actual:String(e),
         status:"VERIFIED BROKEN",
         critical:true
       });
     }
   }

   const broken=checks.filter(
     x=>x.critical&&x.status==="VERIFIED BROKEN"
   );

   const result={
     at:now(),
     status:broken.length
       ?"VERIFIED BROKEN"
       :"VERIFIED WORKING",
     checks
   };

   this.emit("dataflow.check",result);

   if(broken.length){
     this.incident(
       "Data-flow integrity failure",
       broken,
       "VERIFIED BROKEN",
       "critical"
     );
   }

   return result;
 },

 async checkE2EContracts(){
   this.start();

   const checks=[];
   const check=(name,condition,expected,actual,critical=true)=>{
     const ok=!!condition;
     checks.push({
       name,expected,actual,
       status:ok?"VERIFIED WORKING":"VERIFIED BROKEN",
       critical
     });
     return ok;
   };

   /* ---------- CBT ENGINE CONTRACT ---------- */
   const cbtFunctions=[
     "startCBT",
     "submitTest",
     "calculateResult",
     "finishTest"
   ];

   for(const name of cbtFunctions){
     const exists=typeof window[name]==="function";
     check(
       "CBT API "+name,
       exists,
       "function",
       typeof window[name],
       false
     );
   }

   /* ---------- ACTIVE TEST CONTRACT ---------- */
   let active=null;
   try{
     active=JSON.parse(
       localStorage.getItem("CBT_ACTIVE_QUESTIONS")||"null"
     );
   }catch(_){}

   const activeCount=
     Array.isArray(active)?active.length:0;

   check(
     "Active CBT question payload",
     activeCount>0,
     ">0 questions",
     activeCount,
     true
   );

   if(Array.isArray(active)&&active.length){
     let usable=0;
     let answerable=0;

     for(const q of active){
       if(
         q &&
         typeof q.question==="string" &&
         q.question.trim() &&
         Array.isArray(q.options) &&
         q.options.length>=2
       ) usable++;

       if(q&&(q.correctAnswer||q.answer)) answerable++;
     }

     check(
       "Active CBT usable questions",
       usable===active.length,
       active.length,
       usable,
       true
     );

     check(
       "Active CBT answer mapping",
       answerable===active.length,
       active.length,
       answerable,
       true
     );
   }

   /* ---------- RESULT CONTRACT ---------- */
   const resultKeys=[
     "cbtResult",
     "CBT_RESULT",
     "lastCBTResult",
     "cbtLastResult"
   ];

   let resultFound=false;
   let resultKey=null;

   for(const key of resultKeys){
     try{
       const value=localStorage.getItem(key);
       if(value!==null){
         resultFound=true;
         resultKey=key;
         break;
       }
     }catch(_){}
   }

   checks.push({
     name:"Result persistence contract",
     expected:"result after completed test",
     actual:resultFound
       ?("present:"+resultKey)
       :"not present in current session",
     status:"NOT VERIFIED",
     critical:false
   });

   /* ---------- HISTORY CONTRACT ---------- */
   let history=null;
   const historyKeys=[
     "cbtHistory",
     "CBT_HISTORY",
     "testHistory"
   ];

   for(const key of historyKeys){
     try{
       const x=JSON.parse(
         localStorage.getItem(key)||"null"
       );
       if(Array.isArray(x)){
         history=x;
         break;
       }
     }catch(_){}
   }

   checks.push({
     name:"History persistence contract",
     expected:"array after completed test",
     actual:Array.isArray(history)
       ?history.length+" records"
       :"not available in current session",
     status:"NOT VERIFIED",
     critical:false
   });

   /* ---------- MISTAKE CONTRACT ---------- */
   const mistakeKeys=[
     "cbtMistakes",
     "mistakes",
     "mistakeBook",
     "cbtMasteryV2"
   ];

   let mistakeFound=false;
   let mistakeKey=null;

   for(const key of mistakeKeys){
     try{
       if(localStorage.getItem(key)!==null){
         mistakeFound=true;
         mistakeKey=key;
         break;
       }
     }catch(_){}
   }

   checks.push({
     name:"Mistake system contract",
     expected:"mistake data after wrong answer",
     actual:mistakeFound
       ?("present:"+mistakeKey)
       :"not available in current session",
     status:"NOT VERIFIED",
     critical:false
   });

   /* ---------- BOOKMARK CONTRACT ---------- */
   const bookmarkKeys=[
     "bookmarks",
     "cbtBookmarks",
     "questionBookmarks",
     "rankforgeBookmarks"
   ];

   let bookmarkFound=false;
   let bookmarkKey=null;

   for(const key of bookmarkKeys){
     try{
       if(localStorage.getItem(key)!==null){
         bookmarkFound=true;
         bookmarkKey=key;
         break;
       }
     }catch(_){}
   }

   checks.push({
     name:"Bookmark contract",
     expected:"bookmark data when used",
     actual:bookmarkFound
       ?("present:"+bookmarkKey)
       :"not available in current session",
     status:"NOT VERIFIED",
     critical:false
   });

   /* ---------- RETRY CONTRACT ---------- */
   const retryKeys=[
     "retryQuestions",
     "CBT_RETRY_QUESTIONS",
     "mistakeRetry",
     "retryQueue"
   ];

   let retryFound=false;
   let retryKey=null;

   for(const key of retryKeys){
     try{
       if(localStorage.getItem(key)!==null){
         retryFound=true;
         retryKey=key;
         break;
       }
     }catch(_){}
   }

   checks.push({
     name:"Retry contract",
     expected:"retry data when retry is created",
     actual:retryFound
       ?("present:"+retryKey)
       :"not available in current session",
     status:"NOT VERIFIED",
     critical:false
   });

   const broken=checks.filter(
     x=>x.critical&&x.status==="VERIFIED BROKEN"
   );

   const result={
     at:now(),
     status:broken.length
       ?"VERIFIED BROKEN"
       :"NOT VERIFIED",
     checks
   };

   this.emit("e2e.contracts",result);

   if(broken.length){
     this.incident(
       "E2E CBT contract failure",
       broken,
       "VERIFIED BROKEN",
       "critical"
     );
   }

   return result;
 },

 async e2eScan(){
   this.start();

   const page=await this.checkPage();
   const data=await this.checkDataFlow();
   const flow=await this.checkE2EContracts();

   const criticalBroken=[
     page,data,flow
   ].some(x=>x.status==="VERIFIED BROKEN");

   const result={
     guardian:this.version,
     at:now(),
     status:criticalBroken
       ?"VERIFIED BROKEN"
       :"NOT VERIFIED",
     page,
     dataflow:data,
     e2e:flow
   };

   this.emit("e2e.full.scan",result);
   return result;
 },

 async deepScan(){
   this.start();

   const full=await this.checkPage();
   const workflow=await this.verifyWorkflow();
   const dataflow=await this.checkDataFlow();

   const critical=[
     full,
     workflow,
     dataflow
   ].some(x=>x.status==="VERIFIED BROKEN");

   const result={
     guardian:this.version,
     at:now(),
     status:critical
       ?"VERIFIED BROKEN"
       :"VERIFIED WORKING",
     full,
     workflow,
     dataflow
   };

   this.emit("deep.scan",result);
   return result;
 },

 async continuousScan(){
   this.start();

   const full=await this.checkPage();
   const workflow=await this.verifyWorkflow();

   const result={
     guardian:this.version,
     at:now(),
     status:
       full.status==="VERIFIED BROKEN"||
       workflow.status==="VERIFIED BROKEN"
       ?"VERIFIED BROKEN"
       :"VERIFIED WORKING",
     full,
     workflow
   };

   this.emit("continuous.scan",result);
   return result;
 },

 async checkPage(){
   this.start();

   const snap=this.snapshot();
   const results=[];

   for(const s of snap.scripts)
     results.push(await this.checkSource(s.src));

   const banks=await this.checkBank();

   const broken=results.filter(x=>!x.ok);

   const result={
     version:VERSION,
     at:now(),
     status:
       broken.length
       ?"VERIFIED BROKEN"
       :"NOT VERIFIED",
     scripts:results,
     banks,
     runtimeErrors:this.consoleErrors.length,
     snapshot:snap
   };

   this.emit("full.scan",result);
   return result;
 },

 safeRepairLocalRegistration(){
   const q=Array.isArray(window.TEST180_QUESTIONS)
     ?window.TEST180_QUESTIONS:null;

   if(!q||q.length!==180){
     return this.incident(
       "Safe repair blocked",
       "Independent Test 180 source verification failed.",
       "NOT VERIFIED",
       "warning"
     );
   }

   try{
     window.__RANKERS_TEST180_BANK=q.slice();
     window.__RANKERS_TEST180_READY=true;

     const verified=
       window.__RANKERS_TEST180_BANK.length===180;

     return this.incident(
       "Test 180 local registration repair",
       {
         before:q.length,
         after:window.__RANKERS_TEST180_BANK.length,
         verified
       },
       verified?"VERIFIED WORKING":"VERIFIED BROKEN",
       verified?"info":"critical"
     );
   }catch(e){
     return this.incident(
       "Test 180 repair failed",
       String(e),
       "VERIFIED BROKEN",
       "critical"
     );
   }
 },

 exportEvidence(){
   const payload={
     version:VERSION,
     exportedAt:now(),
     incidents:this.incidents,
     evidence:this.evidence,
     snapshot:read(SK,null)
   };

   const blob=new Blob(
     [JSON.stringify(payload,null,2)],
     {type:"application/json"}
   );

   const a=document.createElement("a");
   a.href=URL.createObjectURL(blob);
   a.download=
     "rankforge-guardian-evidence-"+Date.now()+".json";
   a.click();

   setTimeout(
     ()=>URL.revokeObjectURL(a.href),
     1000
   );
 }
};

window.RankForgeOwnerAI=G;
G.start();
})();
