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

 async checkDeploymentIntegrity(){
   this.start();

   const checks=[];
   const add=(name,ok,expected,actual,critical=true)=>{
     checks.push({
       name,expected,actual,
       status:ok?"VERIFIED WORKING":"VERIFIED BROKEN",
       critical
     });
   };

   /* ---------- SCRIPT DEPENDENCIES ---------- */
   const scripts=[...document.scripts]
     .filter(x=>x.src)
     .map(x=>x.src);

   for(const src of scripts){
     try{
       const r=await fetch(src,{cache:"no-store"});
       add(
         "Script "+src.split("/").pop(),
         r.ok,
         "HTTP 200",
         r.status,
         true
       );
     }catch(e){
       add(
         "Script "+src.split("/").pop(),
         false,
         "reachable",
         String(e),
         true
       );
     }
   }

   /* ---------- CRITICAL LOCAL ASSETS ---------- */
   const assets=[
     "./cbt.html",
     "./rankers-test-series.html",
     "./mistake.html",
     "./rankforge-owner-ai.html",
     "./rankforge-owner-ai.js",
     "./rank-booster/test180-questions.json",
     "./rank-booster/biology-test-series-rankers-v2.js"
   ];

   for(const path of assets){
     try{
       const r=await fetch(path,{cache:"no-store"});
       add(
         "Asset "+path,
         r.ok,
         "HTTP 200",
         r.status,
         true
       );
     }catch(e){
       add(
         "Asset "+path,
         false,
         "reachable",
         String(e),
         true
       );
     }
   }

   /* ---------- CACHE / VERSION ---------- */
   const currentScript=document.querySelector(
     'script[src*="rankforge-owner-ai.js"]'
   );

   const biologyScript=document.querySelector(
     'script[src*="biology-test-series-rankers-v2.js"]'
   );

   checks.push({
     name:"Owner AI cache identity",
     expected:"versioned or current deployment",
     actual:currentScript?.src||"missing",
     status:currentScript
       ?"VERIFIED WORKING"
       :"VERIFIED BROKEN",
     critical:true
   });

   checks.push({
     name:"Biology importer cache identity",
     expected:"versioned deployment",
     actual:biologyScript?.src||"missing",
     status:biologyScript
       ?"VERIFIED WORKING"
       :"VERIFIED BROKEN",
     critical:true
   });

   /* ---------- RUNTIME DEPENDENCY OBJECTS ---------- */
   const globals=[
     "pdfjsLib",
     "RankBoosterQuestionBank",
     "RankerUnifiedBank",
     "RankForgeOwnerAI"
   ];

   for(const name of globals){
     const exists=
       typeof window[name]!=="undefined";

     checks.push({
       name:"Runtime dependency "+name,
       expected:"available",
       actual:exists?"available":"missing",
       status:exists
         ?"VERIFIED WORKING"
         :"NOT VERIFIED",
       critical:false
     });
   }

   /* ---------- NETWORK STATE ---------- */
   checks.push({
     name:"Network state",
     expected:"online",
     actual:navigator.onLine?"online":"offline",
     status:navigator.onLine
       ?"VERIFIED WORKING"
       :"NOT VERIFIED",
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

   this.emit("deployment.integrity",result);

   if(broken.length){
     this.incident(
       "Deployment/dependency integrity failure",
       broken,
       "VERIFIED BROKEN",
       "critical"
     );
   }

   return result;
 },

 async correlateFailures(){
   this.start();

   const evidence=this.evidence||[];
   const incidents=this.incidents||[];

   const errors=evidence.filter(e=>
     e.type==="runtime.error"||
     e.type==="runtime.unhandledrejection"||
     e.type==="console.error"||
     e.type==="source.check"||
     e.type==="bank.check"||
     e.type==="deployment.integrity"||
     e.type==="dataflow.check"||
     e.type==="e2e.contracts"
   );

   const fingerprint=(x)=>{
     const raw=JSON.stringify(x)
       .replace(/https?:\/\/[^\s"'`]+/g,"<URL>")
       .replace(/\b\d+\b/g,"<N>")
       .toLowerCase();

     let h=2166136261;
     for(let i=0;i<raw.length;i++){
       h^=raw.charCodeAt(i);
       h=Math.imul(h,16777619);
     }
     return ("00000000"+(h>>>0).toString(16)).slice(-8);
   };

   const groups=new Map();

   for(const e of errors){
     const fp=fingerprint({
       type:e.type,
       data:e.data
     });

     if(!groups.has(fp)){
       groups.set(fp,{
         fingerprint:fp,
         count:0,
         firstSeen:e.at,
         lastSeen:e.at,
         evidence:[]
       });
     }

     const g=groups.get(fp);
     g.count++;
     g.lastSeen=e.at;

     if(g.evidence.length<10)
       g.evidence.push(e.id);
   }

   const correlated=[...groups.values()]
     .sort((a,b)=>b.count-a.count);

   /* ---------- ROOT-CAUSE HYPOTHESES ---------- */
   const hypotheses=[];

   for(const g of correlated){
     if(g.count<1) continue;

     const related=evidence.filter(
       e=>g.evidence.includes(e.id)
     );

     const text=JSON.stringify(related).toLowerCase();

     let cause="Cause not established";
     let confidence="LOW";

     if(
       text.includes("404")||
       text.includes("failed to fetch")||
       text.includes("missing")
     ){
       cause="Missing/unreachable dependency or asset";
       confidence="HIGH";
     }else if(
       text.includes("2700")||
       text.includes("biology")
     ){
       cause="Biology question-bank data-flow mismatch";
       confidence="MEDIUM";
     }else if(
       text.includes("180")||
       text.includes("test 180")
     ){
       cause="Test 180 registration/data-flow mismatch";
       confidence="MEDIUM";
     }else if(
       text.includes("syntax")||
       text.includes("unexpected token")
     ){
       cause="JavaScript syntax/runtime parsing failure";
       confidence="HIGH";
     }else if(
       text.includes("storage")||
       text.includes("localstorage")
     ){
       cause="Client storage/state contract failure";
       confidence="MEDIUM";
     }

     hypotheses.push({
       fingerprint:g.fingerprint,
       occurrences:g.count,
       cause,
       confidence,
       evidence:g.evidence
     });
   }

   /* ---------- INCIDENT DEDUPLICATION ---------- */
   const uniqueIncidents=[];
   const seen=new Set();

   for(const i of incidents){
     const fp=fingerprint({
       title:i.title,
       details:i.details
     });

     if(seen.has(fp)) continue;
     seen.add(fp);

     uniqueIncidents.push({
       id:i.id,
       fingerprint:fp,
       title:i.title,
       status:i.status,
       severity:i.severity,
       at:i.at
     });
   }

   const result={
     at:now(),
     status:"NOT VERIFIED",
     evidenceCount:errors.length,
     failureGroups:correlated.length,
     uniqueIncidents:uniqueIncidents.length,
     hypotheses
   };

   this.emit("failure.correlation",result);

   return result;
 },

 async regressionScan(){
   this.start();

   const RK="rankforge.guardian.regression.v1";
   const BK="rankforge.guardian.baseline.v1";
   const previous=read(RK,[]);
   const baseline=read(BK,null);

   const nowState={
     at:now(),
     url:location.href,
     online:navigator.onLine,
     scripts:[...document.scripts]
       .filter(x=>x.src)
       .map(x=>x.src),
     storageKeys:Object.keys(localStorage).sort(),
     test180:Array.isArray(window.TEST180_QUESTIONS)
       ?window.TEST180_QUESTIONS.length
       :(Array.isArray(window.__RANKERS_TEST180_BANK)
         ?window.__RANKERS_TEST180_BANK.length:0),
     biology:(()=>{
       try{
         const x=read("RANKFORGE_BIOLOGY_2700_BANK_V2",[]);
         return Array.isArray(x)?x.length:0;
       }catch(_){return 0}
     })()
   };

   const stable=(x)=>{
     const raw=JSON.stringify(x);
     let h=2166136261;
     for(let i=0;i<raw.length;i++){
       h^=raw.charCodeAt(i);
       h=Math.imul(h,16777619);
     }
     return ("00000000"+(h>>>0).toString(16)).slice(-8);
   };

   const fingerprint=stable({
     scripts:nowState.scripts,
     test180:nowState.test180,
     biology:nowState.biology
   });

   const checks=[];

   /* ---------- GOLDEN EXPECTATIONS ---------- */
   const golden=[
     ["Test 180",180,nowState.test180],
     ["Biology",2700,nowState.biology]
   ];

   for(const [name,expected,actual] of golden){
     checks.push({
       name,
       expected,
       actual,
       status:actual===expected
         ?"VERIFIED WORKING"
         :"VERIFIED BROKEN",
       critical:true
     });
   }

   /* ---------- DUPLICATE STORAGE KEYS ---------- */
   const keys=nowState.storageKeys;
   const normalized=new Map();

   for(const key of keys){
     const n=key
       .toLowerCase()
       .replace(/[_\-]/g,"");

     if(!normalized.has(n))
       normalized.set(n,[]);

     normalized.get(n).push(key);
   }

   const duplicateGroups=
     [...normalized.values()].filter(x=>x.length>1);

   checks.push({
     name:"Potential duplicate storage namespaces",
     expected:0,
     actual:duplicateGroups.length,
     status:duplicateGroups.length
       ?"NOT VERIFIED"
       :"VERIFIED WORKING",
     critical:false,
     groups:duplicateGroups
   });

   /* ---------- BASELINE COMPARISON ---------- */
   let baselineStatus="NOT VERIFIED";

   if(baseline){
     const changed=[];

     for(const key of [
       "scripts",
       "storageKeys",
       "test180",
       "biology",
       "online"
     ]){
       if(JSON.stringify(baseline[key])!==JSON.stringify(nowState[key]))
         changed.push(key);
     }

     baselineStatus=changed.length
       ?"CHANGED"
       :"UNCHANGED";

     checks.push({
       name:"Golden baseline comparison",
       expected:"UNCHANGED",
       actual:baselineStatus,
       status:changed.length
         ?"NOT VERIFIED"
         :"VERIFIED WORKING",
       critical:false,
       changed
     });
   }else{
     write(BK,nowState);

     checks.push({
       name:"Golden baseline",
       expected:"created",
       actual:"created",
       status:"VERIFIED WORKING",
       critical:false
     });
   }

   /* ---------- REGRESSION FINGERPRINT ---------- */
   const old=previous.find(
     x=>x.fingerprint===fingerprint
   );

   const record={
     id:"REG-"+Date.now(),
     at:now(),
     fingerprint,
     state:nowState
   };

   previous.push(record);

   if(previous.length>100)
     previous.splice(0,previous.length-100);

   write(RK,previous);

   checks.push({
     name:"Regression fingerprint",
     expected:"stable",
     actual:fingerprint,
     status:"VERIFIED WORKING",
     critical:false,
     previousMatch:!!old
   });

   /* ---------- COVERAGE GAP ---------- */
   const coverage=[
     "source",
     "runtime",
     "dataflow",
     "e2e",
     "deployment",
     "regression"
   ];

   const missing=[];

   for(const type of coverage){
     if(!this.evidence.some(
       e=>e.type&&e.type.includes(type)
     )){
       missing.push(type);
     }
   }

   checks.push({
     name:"Guardian coverage",
     expected:0,
     actual:missing.length,
     status:missing.length
       ?"NOT VERIFIED"
       :"VERIFIED WORKING",
     critical:false,
     missing
   });

   /* ---------- INCIDENT TIMELINE ---------- */
   const timeline=this.incidents
     .slice(-50)
     .map(i=>({
       id:i.id,
       at:i.at,
       title:i.title,
       status:i.status,
       severity:i.severity
     }));

   const broken=checks.filter(
     x=>x.critical&&x.status==="VERIFIED BROKEN"
   );

   const result={
     at:now(),
     scanId:"SCAN-"+Date.now(),
     fingerprint,
     status:broken.length
       ?"VERIFIED BROKEN"
       :"NOT VERIFIED",
     checks,
     timeline
   };

   this.emit("regression.scan",result);

   if(broken.length){
     this.incident(
       "Regression/golden check failure",
       broken,
       "VERIFIED BROKEN",
       "critical"
     );
   }

   return result;
 },

 async qualityScan(){
   this.start();

   const checks=[];
   const add=(name,status,expected,actual,critical=false,details=null)=>{
     checks.push({
       name,status,expected,actual,critical,
       ...(details?{details}: {})
     });
   };

   /* =========================================================
      1. SECURITY / PRIVACY
      ========================================================= */

   const html=document.documentElement.outerHTML;

   const dangerousPatterns=[
     /eval\s*\(/i,
     /new\s+Function\s*\(/i,
     /document\.write\s*\(/i
   ];

   for(const pattern of dangerousPatterns){
     const found=pattern.test(html);

     add(
       "Dangerous runtime pattern "+pattern,
       found?"NOT VERIFIED":"VERIFIED WORKING",
       "not detected",
       found?"detected":"not detected",
       false
     );
   }

   const passwordLike=[];
   for(const key of Object.keys(localStorage)){
     if(/password|token|secret|api[_-]?key/i.test(key))
       passwordLike.push(key);
   }

   add(
     "Sensitive-looking localStorage keys",
     passwordLike.length
       ?"NOT VERIFIED":"VERIFIED WORKING",
     0,
     passwordLike.length,
     false,
     passwordLike
   );

   /* =========================================================
      2. STORAGE HEALTH
      ========================================================= */

   let storageBytes=0;

   try{
     storageBytes=JSON.stringify(localStorage).length;
   }catch(_){}

   add(
     "LocalStorage capacity observation",
     storageBytes<4500000
       ?"VERIFIED WORKING":"NOT VERIFIED",
     "< 4.5MB observed",
     storageBytes+" bytes",
     false
   );

   let storageReadable=true;

   try{
     const probe="__guardian_probe__";
     localStorage.setItem(probe,"1");
     storageReadable=localStorage.getItem(probe)==="1";
     localStorage.removeItem(probe);
   }catch(_){
     storageReadable=false;
   }

   add(
     "Storage read/write",
     storageReadable
       ?"VERIFIED WORKING":"VERIFIED BROKEN",
     "read/write",
     storageReadable?"working":"failed",
     true
   );

   /* =========================================================
      3. MALFORMED QUESTION DATA
      ========================================================= */

   const pools=[];

   if(Array.isArray(window.TEST180_QUESTIONS))
     pools.push(["Test 180",window.TEST180_QUESTIONS]);

   if(Array.isArray(window.__RANKERS_TEST180_BANK))
     pools.push(["Rankers Test 180",window.__RANKERS_TEST180_BANK]);

   try{
     const bio=read("RANKFORGE_BIOLOGY_2700_BANK_V2",[]);
     if(Array.isArray(bio))
       pools.push(["Biology",bio]);
   }catch(_){}

   for(const [name,pool] of pools){
     let malformed=0;

     for(const q of pool){
       if(
         !q||
         typeof q.question!=="string"||
         !q.question.trim()||
         !Array.isArray(q.options)||
         q.options.length<2
       ){
         malformed++;
       }
     }

     add(
       name+" malformed-record scan",
       malformed
         ?"VERIFIED BROKEN":"VERIFIED WORKING",
       0,
       malformed,
       true
     );
   }

   /* =========================================================
      4. ACCESSIBILITY
      ========================================================= */

   const images=[...document.querySelectorAll("img")];

   const missingAlt=images.filter(
     x=>!x.hasAttribute("alt")
   ).length;

   add(
     "Images with missing alt attribute",
     missingAlt
       ?"NOT VERIFIED":"VERIFIED WORKING",
     0,
     missingAlt,
     false
   );

   const interactive=[
     ...document.querySelectorAll("button,a,input,select,textarea")
   ];

   const hiddenInteractive=interactive.filter(x=>{
     const r=x.getBoundingClientRect();
     return r.width===0||r.height===0;
   }).length;

   add(
     "Hidden interactive elements",
     hiddenInteractive
       ?"NOT VERIFIED":"VERIFIED WORKING",
     0,
     hiddenInteractive,
     false
   );

   /* =========================================================
      5. MOBILE / WEBVIEW
      ========================================================= */

   const viewport=document.querySelector(
     'meta[name="viewport"]'
   );

   add(
     "Mobile viewport",
     viewport
       ?"VERIFIED WORKING":"VERIFIED BROKEN",
     "viewport meta",
     viewport?"present":"missing",
     true
   );

   const screenWidth=window.innerWidth;

   add(
     "Mobile viewport width",
     screenWidth>0,
     ">0",
     screenWidth,
     true
   );

   /* =========================================================
      6. OFFLINE / ONLINE CAPABILITY
      ========================================================= */

   add(
     "Network state observer",
     "onLine" in navigator
       ?"VERIFIED WORKING":"NOT VERIFIED",
     "navigator.onLine",
     "onLine" in navigator
       ?"available":"unavailable",
     false
   );

   const offlineListeners=
     this.evidence.filter(
       x=>x.type==="network.offline"
     ).length;

   const onlineListeners=
     this.evidence.filter(
       x=>x.type==="network.online"
     ).length;

   add(
     "Network event evidence",
     offlineListeners||onlineListeners
       ?"VERIFIED WORKING":"NOT VERIFIED",
     "runtime evidence",
     {offline:offlineListeners,online:onlineListeners},
     false
   );

   /* =========================================================
      7. TIMER / CBT STATE OBSERVATION
      ========================================================= */

   const timerCandidates=[
     "timer",
     "timeLeft",
     "remainingTime",
     "cbtTimer",
     "CBT_TIMER"
   ];

   let timerFound=[];

   for(const key of timerCandidates){
     try{
       if(
         localStorage.getItem(key)!==null||
         typeof window[key]!=="undefined"
       ){
         timerFound.push(key);
       }
     }catch(_){}
   }

   add(
     "Timer state observability",
     timerFound.length
       ?"VERIFIED WORKING":"NOT VERIFIED",
     "timer state observable",
     timerFound,
     false
   );

   /* =========================================================
      8. ERROR DENSITY
      ========================================================= */

   const runtimeErrors=this.consoleErrors.length;

   add(
     "Runtime console error count",
     runtimeErrors===0
       ?"VERIFIED WORKING":"VERIFIED BROKEN",
     0,
     runtimeErrors,
     true
   );

   /* =========================================================
      9. SCRIPT ORDER
      ========================================================= */

   const scriptSources=[
     ...document.scripts
   ].filter(x=>x.src)
    .map(x=>x.src);

   const duplicateScripts=
     scriptSources.filter(
       (x,i)=>scriptSources.indexOf(x)!==i
     );

   add(
     "Duplicate script references",
     duplicateScripts.length
       ?"NOT VERIFIED":"VERIFIED WORKING",
     0,
     duplicateScripts.length,
     false,
     duplicateScripts
   );

   /* =========================================================
      10. DOM ID COLLISION
      ========================================================= */

   const ids=[...document.querySelectorAll("[id]")]
     .map(x=>x.id)
     .filter(Boolean);

   const duplicateIds=[
     ...new Set(
       ids.filter(
         (x,i)=>ids.indexOf(x)!==i
       )
     )
   ];

   add(
     "Duplicate DOM IDs",
     duplicateIds.length
       ?"VERIFIED BROKEN":"VERIFIED WORKING",
     0,
     duplicateIds.length,
     true,
     duplicateIds
   );

   /* =========================================================
      FINAL QUALITY RESULT
      ========================================================= */

   const criticalBroken=checks.filter(
     x=>x.critical&&x.status==="VERIFIED BROKEN"
   );

   const result={
     at:now(),
     scanId:"QUALITY-"+Date.now(),
     status:criticalBroken.length
       ?"VERIFIED BROKEN"
       :"NOT VERIFIED",
     checks,
     criticalFailures:criticalBroken.length
   };

   this.emit("quality.scan",result);

   if(criticalBroken.length){
     this.incident(
       "Quality/security/performance scan failure",
       criticalBroken,
       "VERIFIED BROKEN",
       "critical"
     );
   }

   return result;
 },

 async buildRepairPlan(){
   this.start();

   const PLAN_KEY="rankforge.guardian.repair-plan.v1";
   const plan=[];

   const add=(id,title,risk,reason,action,requiresApproval)=>{
     plan.push({
       id,
       title,
       risk,
       reason,
       action,
       requiresApproval,
       status:"CANDIDATE"
     });
   };

   /* ---------------------------------------------------------
      SAFE DETERMINISTIC REPAIR CANDIDATES
      --------------------------------------------------------- */

   const ownerScript=document.querySelector(
     'script[src*="rankforge-owner-ai.js"]'
   );

   if(!ownerScript){
     add(
       "FIX-SCRIPT-OWNER-AI",
       "Restore Owner AI script reference",
       "SAFE",
       "Owner AI runtime script is not present in the current page.",
       "Restore the known local Owner AI script reference.",
       false
     );
   }

   const biologyScript=document.querySelector(
     'script[src*="biology-test-series-rankers-v2.js"]'
   );

   if(!biologyScript){
     add(
       "FIX-SCRIPT-BIOLOGY",
       "Restore Biology importer reference",
       "SAFE",
       "Biology importer script is not present in the current page.",
       "Restore the known Biology importer script reference.",
       false
     );
   }

   /* ---------------------------------------------------------
      QUESTION BANK SAFETY BOUNDARY
      --------------------------------------------------------- */

   add(
     "GUARD-BANK-SOURCE",
     "Protect source question banks",
     "BLOCKED",
     "Guardian must never rewrite source questions or answer keys.",
     "No automatic mutation permitted.",
     true
   );

   /* ---------------------------------------------------------
      STUDENT DATA SAFETY
      --------------------------------------------------------- */

   add(
     "GUARD-STUDENT-DATA",
     "Protect student history/mistakes/bookmarks",
     "BLOCKED",
     "Student state is user data and cannot be destructively modified automatically.",
     "No automatic deletion/reset permitted.",
     true
   );

   /* ---------------------------------------------------------
      DEPLOYMENT BOUNDARY
      --------------------------------------------------------- */

   add(
     "GUARD-DEPLOYMENT",
     "Protect production deployment",
     "REVIEW",
     "Static GitHub Pages runtime cannot safely deploy source changes.",
     "Prepare evidence and require external controlled deployment.",
     true
   );

   /* ---------------------------------------------------------
      RUNTIME STORAGE REPAIR
      --------------------------------------------------------- */

   const t180=Array.isArray(window.TEST180_QUESTIONS)
     ?window.TEST180_QUESTIONS:null;

   if(t180&&t180.length===180){
     const current=Array.isArray(window.__RANKERS_TEST180_BANK)
       ?window.__RANKERS_TEST180_BANK.length:0;

     if(current!==180){
       add(
         "FIX-TEST180-LOCAL-REG",
         "Repair local Test 180 registration",
         "SAFE",
         "Independent source contains exactly 180 questions but active local registration differs.",
         "Register a copy of the independently verified 180-question source in local runtime state.",
         false
       );
     }
   }

   /* ---------------------------------------------------------
      PLAN CHECKSUM
      --------------------------------------------------------- */

   const raw=JSON.stringify(plan);
   let hash=2166136261;

   for(let i=0;i<raw.length;i++){
     hash^=raw.charCodeAt(i);
     hash=Math.imul(hash,16777619);
   }

   const checksum=("00000000"+(hash>>>0).toString(16))
     .slice(-8);

   const result={
     at:now(),
     planId:"PLAN-"+Date.now(),
     checksum,
     candidates:plan,
     status:"NOT VERIFIED"
   };

   write(PLAN_KEY,result);
   this.emit("repair.plan",result);

   return result;
 },

 async executeSafeRepair(){
   this.start();

   const before={
     test180:Array.isArray(window.__RANKERS_TEST180_BANK)
       ?window.__RANKERS_TEST180_BANK.length:0,
     biology:(()=>{
       try{
         const x=read("RANKFORGE_BIOLOGY_2700_BANK_V2",[]);
         return Array.isArray(x)?x.length:0;
       }catch(_){return 0}
     })()
   };

   const checkpoint={
     at:now(),
     before,
     storageKeys:Object.keys(localStorage).sort()
   };

   write(
     "rankforge.guardian.repair-checkpoint.v1",
     checkpoint
   );

   const actions=[];

   /* Only the previously defined safe local registration
      repair is allowed here. */
   const q=Array.isArray(window.TEST180_QUESTIONS)
     ?window.TEST180_QUESTIONS:null;

   if(q&&q.length===180){
     const current=Array.isArray(
       window.__RANKERS_TEST180_BANK
     )?window.__RANKERS_TEST180_BANK.length:0;

     if(current!==180){
       window.__RANKERS_TEST180_BANK=q.slice();
       window.__RANKERS_TEST180_READY=true;

       actions.push({
         id:"FIX-TEST180-LOCAL-REG",
         status:
           Array.isArray(window.__RANKERS_TEST180_BANK)&&
           window.__RANKERS_TEST180_BANK.length===180
             ?"VERIFIED WORKING"
             :"VERIFIED BROKEN"
       });
     }
   }

   const after={
     test180:Array.isArray(window.__RANKERS_TEST180_BANK)
       ?window.__RANKERS_TEST180_BANK.length:0,
     biology:(()=>{
       try{
         const x=read("RANKFORGE_BIOLOGY_2700_BANK_V2",[]);
         return Array.isArray(x)?x.length:0;
       }catch(_){return 0}
     })()
   };

   const verified=
     actions.length>0 &&
     actions.every(
       x=>x.status==="VERIFIED WORKING"
     );

   const result={
     at:now(),
     checkpoint,
     before,
     actions,
     after,
     status:
       verified
         ?"VERIFIED WORKING"
         :"NOT VERIFIED"
   };

   this.emit("repair.execution",result);

   if(!verified){
     this.incident(
       "Safe repair not verified",
       result,
       "NOT VERIFIED",
       "warning"
     );
   }

   return result;
 },

 async repairVerification(){
   this.start();

   const scan=await this.ultimateScan();

   const checkpoint=read(
     "rankforge.guardian.repair-checkpoint.v1",
     null
   );

   const result={
     at:now(),
     status:
       scan.status==="VERIFIED BROKEN"
         ?"VERIFIED BROKEN"
         :"NOT VERIFIED",
     scan,
     checkpoint
   };

   this.emit("repair.verification",result);

   return result;
 },

 async repairCycle(){
   this.start();

   const plan=await this.buildRepairPlan();

   const safe=plan.candidates.filter(
     x=>x.risk==="SAFE"&&!x.requiresApproval
   );

   let execution={
     status:"NOT VERIFIED",
     actions:[]
   };

   if(safe.length)
     execution=await this.executeSafeRepair();

   const verification=await this.repairVerification();

   const result={
     guardian:this.version,
     at:now(),
     plan,
     execution,
     verification,
     status:
       execution.status==="VERIFIED WORKING"&&
       verification.status!=="VERIFIED BROKEN"
         ?"VERIFIED WORKING"
         :"NOT VERIFIED"
   };

   this.emit("repair.cycle",result);

   return result;
 },

 async ultimateScan(){
   this.start();

   const mega=await this.megaScan();
   const quality=await this.qualityScan();

   const broken=[
     mega,
     quality
   ].some(
     x=>x.status==="VERIFIED BROKEN"
   );

   const result={
     guardian:this.version,
     at:now(),
     scanId:"ULTIMATE-"+Date.now(),
     status:broken
       ?"VERIFIED BROKEN"
       :"NOT VERIFIED",
     mega,
     quality
   };

   this.emit("ultimate.scan",result);

   return result;
 },

 async megaScan(){
   this.start();

   const investigation=await this.investigationScan();
   const regression=await this.regressionScan();

   const criticalBroken=[
     investigation,
     regression
   ].some(x=>x.status==="VERIFIED BROKEN");

   const result={
     guardian:this.version,
     at:now(),
     scanId:"MEGA-"+Date.now(),
     status:criticalBroken
       ?"VERIFIED BROKEN"
       :"NOT VERIFIED",
     investigation,
     regression
   };

   this.emit("mega.scan",result);

   return result;
 },

 async investigationScan(){
   this.start();

   const release=await this.checkDeploymentIntegrity();
   const e2e=await this.e2eScan();
   const correlation=await this.correlateFailures();

   const result={
     guardian:this.version,
     at:now(),
     status:
       release.status==="VERIFIED BROKEN"||
       e2e.status==="VERIFIED BROKEN"
       ?"VERIFIED BROKEN"
       :"NOT VERIFIED",
     release,
     e2e,
     correlation
   };

   this.emit("investigation.scan",result);
   return result;
 },

 async releaseScan(){
   this.start();

   const deployment=await this.checkDeploymentIntegrity();
   const e2e=await this.e2eScan();

   const broken=[
     deployment,
     e2e
   ].some(x=>x.status==="VERIFIED BROKEN");

   const result={
     guardian:this.version,
     at:now(),
     status:broken
       ?"VERIFIED BROKEN"
       :"NOT VERIFIED",
     deployment,
     e2e
   };

   this.emit("release.integrity.scan",result);
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
