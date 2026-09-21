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
