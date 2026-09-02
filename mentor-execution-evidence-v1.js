(function(){
'use strict';
const KEY='rankerProMentorExecutionEvidenceV1';
const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??d}catch{return d}};
const arr=v=>Array.isArray(v)?v:[];
function command(){return read('rankerProMentorCommandCenterV1',{});}
function state(){return read(KEY,{status:'PENDING',updatedAt:null,note:'',verifiedAt:null,baselineAccuracy:null,latestAccuracy:null});}
function accuracy(t){const a=Number(t&&(t.accuracy??t.percentage));return Number.isFinite(a)?Math.max(0,Math.min(100,a)):null;}
function build(){
 const s=state(), c=command(), h=arr(read('cbtHistory',[]));
 const acc=h.map(accuracy).filter(x=>x!==null);
 const latest=acc.length?acc[acc.length-1]:null;
 const baseline=s.baselineAccuracy===null&&acc.length>1?acc[Math.max(0,acc.length-2)]:s.baselineAccuracy;
 let status=s.status||'PENDING';
 if(status==='IN_PROGRESS' && latest!==null && baseline!==null){
   const delta=Math.round((latest-baseline)*10)/10;
   if(delta>=5) status='VERIFIED';
   else if(delta<=-5) status='REPLAN';
 }
 return {action:c.action||'Take a baseline test',status,baselineAccuracy:baseline,latestAccuracy:latest,delta:(baseline!==null&&latest!==null?Math.round((latest-baseline)*10)/10:null),note:s.note||'',updatedAt:s.updatedAt||null,verifiedAt:s.verifiedAt||null};
}
function save(patch){const s=Object.assign(state(),patch,{updatedAt:new Date().toISOString()});try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}return build();}
function render(){
 const x=build();
 const status=document.getElementById('mentorEvidenceStatus'), detail=document.getElementById('mentorEvidenceDetail'), note=document.getElementById('mentorEvidenceNote');
 const start=document.getElementById('mentorEvidenceStart'), verify=document.getElementById('mentorEvidenceVerify');
 if(status)status.textContent=x.status.replace('_',' ');
 if(detail){let t='Action: '+x.action+'.';if(x.baselineAccuracy!==null&&x.latestAccuracy!==null)t+=' Accuracy change: '+x.delta+' points.';else if(x.latestAccuracy!==null)t+=' Latest accuracy: '+x.latestAccuracy+'%.';detail.textContent=t;}
 if(note&&document.activeElement!==note)note.value=x.note||'';
 if(start)start.disabled=x.status==='IN_PROGRESS'||x.status==='VERIFIED';
 if(verify)verify.disabled=x.status!=='IN_PROGRESS';
}
function bind(){
 const start=document.getElementById('mentorEvidenceStart'), verify=document.getElementById('mentorEvidenceVerify'), note=document.getElementById('mentorEvidenceNote');
 if(start&&!start.dataset.bound){start.dataset.bound='1';start.addEventListener('click',function(){const h=arr(read('cbtHistory',[]));const a=h.map(accuracy).filter(x=>x!==null);save({status:'IN_PROGRESS',baselineAccuracy:a.length?a[a.length-1]:null,verifiedAt:null});render();});}
 if(verify&&!verify.dataset.bound){verify.dataset.bound='1';verify.addEventListener('click',function(){save({status:'IN_PROGRESS'});render();});}
 if(note&&!note.dataset.bound){note.dataset.bound='1';note.addEventListener('change',function(){save({note:note.value});});}
}
function init(){bind();render();}
window.RankerMentorExecutionEvidence={version:'1.0',KEY,build,save,refresh:render};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
