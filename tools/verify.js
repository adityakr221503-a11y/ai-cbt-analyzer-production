#!/usr/bin/env node
/* RankForge verification: one command, clear PASS/FAIL. Run: npm test */
"use strict";
const fs=require("fs"),path=require("path"),cp=require("child_process"),crypto=require("crypto");
const root=path.resolve(__dirname,"..");process.chdir(root);
const SKIP=/^(\.git|node_modules|android|\.cloudflare-dist|\.rankforge-web|vendor|tools)(\/|$)/;
const results=[];let failed=0;
function check(name,fn){let r;try{r=fn()}catch(e){r=[String(e.message||e)]}
  const errs=Array.isArray(r)?r:[];if(errs.length)failed++;
  results.push([errs.length?"FAIL":"PASS",name,errs]);}
function walk(d,out=[]){for(const f of fs.readdirSync(d)){const p=path.join(d,f).replace(/\\/g,"/");
  if(SKIP.test(p))continue;fs.statSync(p).isDirectory()?walk(p,out):out.push(p)}return out}
const files=walk(".");
const js=files.filter(f=>f.endsWith(".js")),html=files.filter(f=>f.endsWith(".html"));

check("Protected Biology bank unchanged (7,196 questions)",()=>{
  const e=[];for(const l of fs.readFileSync("tools/bank.sha256","utf8").trim().split("\n")){
    const[h,f]=l.split(/\s+/);const got=crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
    if(got!==h)e.push(f+" checksum changed");}
  const n=JSON.parse(fs.readFileSync("biology-7196-bank-readonly.json","utf8")).questions.length;
  if(n!==7196)e.push("question count is "+n);return e});

check("No backup/duplicate clutter in repo",()=>files.filter(f=>/(\.bak$|\.before-|\.broken|before-\d|backup|rollback|CONFLICT)/i.test(path.basename(f))&&f!=="pdf-to-cbt.v317.html"&&!/^tools\//.test(f)).slice(0,10));

check("JavaScript syntax ("+js.length+" files)",()=>{const e=[];
  for(const f of js){const r=cp.spawnSync(process.execPath,["--check",f],{encoding:"utf8"});
    if(r.status)e.push(f+": "+r.stderr.split("\n")[0])}return e});

check("Inline <script> syntax ("+html.length+" pages)",()=>{const e=[];const tmp=path.join(require("os").tmpdir(),"rf-inline.js");
  for(const f of html){const t=fs.readFileSync(f,"utf8");
    for(const m of t.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)){
      if(/json|module/i.test(m[1])||!m[2].trim())continue;fs.writeFileSync(tmp,m[2]);
      const r=cp.spawnSync(process.execPath,["--check",tmp],{encoding:"utf8"});if(r.status)e.push(f+": "+r.stderr.split("\n")[4])}}return e});

check("No missing script/link/image references",()=>{const e=[];
  for(const f of html){const t=fs.readFileSync(f,"utf8");
    for(const m of t.matchAll(/(?:src|href)=["']([^"'#?]+)(?:\?[^"']*)?["']/g)){const u=m[1];
      if(/^(https?:|data:|mailto:|tel:|\/\/|javascript:)/.test(u))continue;
      if(!fs.existsSync(path.normalize(path.join(path.dirname(f),u))))e.push(f+" -> "+u)}}return e});

check("Home screen destinations all exist",()=>{const e=[];const t=fs.readFileSync("index.html","utf8");
  for(const m of t.matchAll(/\["[^"]*","[^"]*","[^"]*","([^"]+)","c-\w+"\]/g)){
    const p=m[1].split("#")[0];if(!fs.existsSync(p))e.push(p)}return e});

check("ES-module graph in src/ resolves",()=>{const e=[];
  for(const f of walk("src").filter(x=>x.endsWith(".js"))){const t=fs.readFileSync(f,"utf8");
    for(const m of t.matchAll(/(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g)){
      if(!fs.existsSync(path.normalize(path.join(path.dirname(f),m[1]))))e.push(f+" -> "+m[1])}}return e});

check("PDF handoff outranks stale Biology cache",()=>{
  const api=require("../rf-fixpack-v1.js");
  const q=(text)=>({text,options:["Option A","Option B"]});
  const pdf=[q("NEW PDF QUESTION")];
  const stale=[q("STALE BIOLOGY CACHE"),q("STALE BIOLOGY CACHE 2"),q("STALE BIOLOGY CACHE 3")];
  const picked=api.chooseSource({
    search:"?source=pdf&rf-final=1",
    session:k=>k==="CBT_ACTIVE_QUESTIONS"?pdf:
      k==="CBT_ACTIVE_TEST"?{sourceType:"BIOLOGY",questions:stale}:null,
    local:k=>k==="pdfCbtQuestions"?stale:
      k==="CBT_ACTIVE_TEST"?{sourceType:"BIOLOGY",questions:stale}:null,
    sessionRaw:k=>k==="CBT_ACTIVE_SOURCE"?"PDF":null
  });
  if(picked.mode!=="handoff")return ["mode was "+picked.mode];
  if(!picked.questions.length)return ["no questions selected"];
  if(picked.questions[0].question!=="NEW PDF QUESTION")
    return ["selected stale question: "+picked.questions[0].question];
  if(picked.reason!=="session.CBT_ACTIVE_QUESTIONS")
    return ["unexpected source: "+picked.reason];
  return [];
});
(async()=>{
  /* core learning loop, run for real with an in-memory localStorage */
  const store={};global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear(){for(const k in store)delete store[k]},key:i=>Object.keys(store)[i],get length(){return Object.keys(store).length}};
  let core;try{core=await import("file://"+path.join(root,"src/core/index.js"))}catch(e){failed++;results.push(["FAIL","Core module loads",[e.message]])}
  if(core){
    check("Pages' core imports all exist (retry.html, src/cbt.html)",()=>{const e=[];
      for(const f of ["retry.html","src/cbt.html"]){const t=fs.readFileSync(f,"utf8");
        for(const m of t.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']\.{1,2}\/(?:src\/)?core\/index\.js["']/g))
          for(const n of m[1].split(",").map(s=>s.trim().split(/\s+as\s+/)[0]).filter(Boolean))
            if(!(n in core))e.push(f+" imports missing "+n)}return e});
    check("Learning loop: mistake -> familiar -> novel -> transfer advances",()=>{const e=[];
      const m=core.createMistake({id:"t1",attemptId:"a1",questionId:"q1",subject:"Biology",chapter:"Heart",topic:"SAN",reason:"concept_gap"});
      core.addItem("mistakes",m);
      let stage=core.getNextPracticeType(core.getItem("mistakes","t1"));
      if(stage!=="familiar")e.push("start stage is "+stage);
      const seen=new Set([stage]);
      for(let i=0;i<40&&stage!=="mastered";i++){
        core.recordPractice({mistakeId:"t1",successful:true,practiceType:stage});
        stage=core.getNextPracticeType(core.getItem("mistakes","t1"));seen.add(stage)}
      if(!seen.has("novel")||!seen.has("transfer"))e.push("stages seen: "+[...seen].join(">"));
      if(stage!=="mastered")e.push("never reached mastered (stuck at "+stage+")");return e});
  }
  console.log("\nRankForge verification\n"+"=".repeat(22));
  for(const[s,n,e]of results){console.log((s==="PASS"?"✅ ":"❌ ")+n);e.slice(0,8).forEach(x=>console.log("     "+x))}
  console.log("\n"+(failed?"RESULT: FAIL ("+failed+" check(s) failed)":"RESULT: ALL "+results.length+" CHECKS PASSED"));
  process.exit(failed?1:0);
})();
