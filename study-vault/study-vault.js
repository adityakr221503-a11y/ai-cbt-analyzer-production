(()=>{

"use strict";

const ITEM_KEY="rankforgeStudyVaultItemsV1";
const COLLECTION_KEY="rankforgeStudyVaultCollectionsV1";
const VERSION=2;

const CHAPTERS={

Physics:[
"Units and Measurements",
"Kinematics",
"Laws of Motion",
"Work, Energy and Power",
"System of Particles and Rotational Motion",
"Gravitation",
"Properties of Bulk Matter",
"Thermodynamics",
"Kinetic Theory",
"Oscillations",
"Waves",
"Electrostatics",
"Current Electricity",
"Magnetic Effects of Current and Magnetism",
"Electromagnetic Induction and Alternating Currents",
"Electromagnetic Waves",
"Optics",
"Dual Nature of Matter and Radiation",
"Atoms and Nuclei",
"Electronic Devices"
],

Chemistry:[
"Some Basic Concepts of Chemistry",
"Structure of Atom",
"Classification of Elements and Periodicity",
"Chemical Bonding and Molecular Structure",
"Thermodynamics",
"Equilibrium",
"Redox Reactions",
"Solutions",
"Electrochemistry",
"Chemical Kinetics",
"Surface Chemistry",
"Some Basic Principles of Organic Chemistry",
"Hydrocarbons",
"Haloalkanes and Haloarenes",
"Alcohols Phenols and Ethers",
"Aldehydes Ketones and Carboxylic Acids",
"Amines",
"Biomolecules",
"Coordination Compounds",
"d- and f-Block Elements",
"p-Block Elements"
],

Biology:[
"The Living World",
"Biological Classification",
"Plant Kingdom",
"Animal Kingdom",
"Morphology of Flowering Plants",
"Anatomy of Flowering Plants",
"Structural Organisation in Animals",
"Cell: The Unit of Life",
"Biomolecules",
"Cell Cycle and Cell Division",
"Transport in Plants",
"Mineral Nutrition",
"Photosynthesis in Plants",
"Respiration in Plants",
"Plant Growth and Development",
"Digestion and Absorption",
"Breathing and Exchange of Gases",
"Body Fluids and Circulation",
"Excretory Products and Elimination",
"Locomotion and Movement",
"Neural Control and Coordination",
"Chemical Coordination and Integration",
"Sexual Reproduction in Flowering Plants",
"Human Reproduction",
"Reproductive Health",
"Principles of Inheritance and Variation",
"Molecular Basis of Inheritance",
"Evolution",
"Human Health and Disease",
"Strategies for Enhancement in Food Production",
"Microbes in Human Welfare",
"Biotechnology: Principles and Processes",
"Biotechnology and its Applications",
"Organisms and Populations",
"Ecosystem",
"Biodiversity and Conservation"
]

};

let items=readItems();
let collections=readCollections();

let activeFilter="all";
let activeSubject="";
let searchText="";

const $=id=>document.getElementById(id);

function readItems(){
try{
const x=JSON.parse(localStorage.getItem(ITEM_KEY)||"[]");
return Array.isArray(x)?x:[];
}catch(e){return[]}
}

function readCollections(){
try{
const x=JSON.parse(localStorage.getItem(COLLECTION_KEY)||"[]");
return Array.isArray(x)?x:[];
}catch(e){return[]}
}

function persist(){
localStorage.setItem(ITEM_KEY,JSON.stringify(items));
localStorage.setItem(COLLECTION_KEY,JSON.stringify(collections));
}

function uid(prefix="sv"){
if(window.crypto?.randomUUID)
return prefix+"-"+crypto.randomUUID();
return prefix+"-"+Date.now()+"-"+Math.random().toString(36).slice(2);
}

function normalize(v){
return String(v||"")
.toLowerCase()
.replace(/[^a-z0-9\s]/g," ")
.replace(/\s+/g," ")
.trim();
}

function fingerprint(x){
return [
normalize(x.title),
normalize(x.subject),
normalize(x.chapter),
normalize(x.topic),
normalize(x.body)
].join("|");
}

function icon(type){
return {
question:"⭐",
screenshot:"📸",
ncert:"📖",
pdf:"📄",
note:"📝",
trap:"⚠️",
formula:"📐",
mistake:"❌",
reference:"🔗"
}[type]||"📌";
}

function escapeHTML(v){
return String(v??"")
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#39;");
}

function populateChapters(){
const subject=$("subject").value;
const select=$("chapter");

if(!CHAPTERS[subject]){
select.innerHTML='<option value="">Quick Inbox — chapter can be added later</option>';
return;
}

select.innerHTML=
'<option value="">Select chapter</option>'+
CHAPTERS[subject]
.map(x=>'<option>'+escapeHTML(x)+'</option>')
.join("");
}

function stats(){
const active=items.filter(x=>!x.archived);

const due=active.filter(x=>
x.revisionDue &&
x.revisionDue<=Date.now()
).length;

$("stats").innerHTML=[
["Total",active.length],
["⭐ Important",active.filter(x=>x.priority==="high").length],
["🔄 Due",due],
["📎 Files",active.filter(x=>x.attachment).length]
].map(x=>
'<div class="stat"><b>'+x[1]+'</b><small>'+x[0]+"</small></div>"
).join("");
}

function filtered(){
let list=items.slice();

if(activeFilter==="archive")
list=list.filter(x=>x.archived);
else
list=list.filter(x=>!x.archived);

if(activeFilter==="important")
list=list.filter(x=>x.priority==="high");

if(activeFilter==="revision")
list=list.filter(x=>
x.revisionState==="revising" ||
(x.revisionDue&&x.revisionDue<=Date.now())
);

if(activeFilter==="inbox")
list=list.filter(x=>!x.chapter||x.subject==="Inbox");

if(activeSubject)
list=list.filter(x=>x.subject===activeSubject);

if(searchText){
const q=normalize(searchText);
list=list.filter(x=>
normalize([
x.title,
x.subject,
x.chapter,
x.topic,
x.body,
x.why,
...(x.tags||[])
].join(" ")).includes(q)
);
}

return list.sort((a,b)=>
Number(b.createdAt||0)-Number(a.createdAt||0)
);
}

function render(){
stats();
renderMaterials();
renderCollections();
}

function renderMaterials(){

const list=filtered();

$("listTitle").textContent=
activeSubject?
activeSubject+" Materials":
activeFilter==="all"?
"Recently Added":
activeFilter==="archive"?
"Archive":
activeFilter==="important"?
"Important":
activeFilter==="revision"?
"Revision Queue":
"Quick Inbox";

if(!list.length){
$("materials").innerHTML=
'<div class="empty">'+
"No materials here yet.<br><br>"+
"Use <b>Quick Save</b> to add something important."+
"</div>";
return;
}

$("materials").innerHTML=list.map(card).join("");
}

function card(x){

const tags=(x.tags||[])
.map(t=>'<span class="chip">#'+escapeHTML(t)+"</span>")
.join("");

const attachment=x.attachment?
'<span class="chip">📎 '+escapeHTML(x.attachment.name)+'</span>':
"";

return `
<article class="material">

<div class="materialTop">

<div>
<h3>${icon(x.type)} ${escapeHTML(x.title)}</h3>

<div class="meta">
${escapeHTML(x.subject)}
${x.chapter?" → "+escapeHTML(x.chapter):""}
${x.topic?" → "+escapeHTML(x.topic):""}
• ${escapeHTML(x.revisionState||"new")}
</div>
</div>

<button data-action="archive" data-id="${x.id}">
${x.archived?"Restore":"Archive"}
</button>

</div>

${x.body?
'<div class="body">'+escapeHTML(x.body)+"</div>":
""}

<div class="chips">
${tags}
${x.priority==="high"?'<span class="chip">⭐ High</span>':""}
${attachment}
</div>

<div class="materialActions">
<button data-action="practice" data-id="${x.id}">🎯 Practice</button>
<button data-action="revision" data-id="${x.id}">🔄 Revision</button>
<button data-action="collection" data-id="${x.id}">🗂️ Collection</button>
<button data-action="link" data-id="${x.id}">🔗 Copy Link</button>
<button data-action="delete" data-id="${x.id}">Delete</button>
</div>

</article>`;
}

function duplicate(candidate){

const fp=fingerprint(candidate);

return items.find(x=>
!x.archived &&
fingerprint(x)===fp
);
}

async function attachment(file){

if(!file)return null;

if(file.size>8*1024*1024){
return {
name:file.name,
type:file.type,
size:file.size,
stored:false,
note:"Large attachment metadata only"
};
}

const data=await new Promise((resolve,reject)=>{

const reader=new FileReader();

reader.onload=()=>resolve(reader.result);
reader.onerror=reject;

reader.readAsDataURL(file);

});

return {
name:file.name,
type:file.type,
size:file.size,
stored:true,
data
};
}

function scheduleRevision(item){

const now=Date.now();

item.revisionState="revising";

item.revisionDue=
now+
(
item.revisionStep===1?
3:
item.revisionStep===2?
7:
item.revisionStep===3?
21:
3
)*86400000;

item.revisionStep=Math.min(
3,
Number(item.revisionStep||0)+1
);

}

$("quickSave").onclick=()=>{
$("dialog").showModal();
$("subject").value="Inbox";
populateChapters();
};

$("closeDialog").onclick=()=>$("dialog").close();
$("cancel").onclick=()=>$("dialog").close();

$("subject").onchange=populateChapters;

$("search").oninput=e=>{
searchText=e.target.value;
activeSubject="";
renderMaterials();
};

$("clearSearch").onclick=()=>{
$("search").value="";
searchText="";
renderMaterials();
};

document.querySelectorAll("[data-filter]").forEach(btn=>{
btn.onclick=()=>{
activeFilter=btn.dataset.filter;
activeSubject="";
render();
};
});

document.querySelectorAll("[data-subject]").forEach(btn=>{
btn.onclick=()=>{
activeSubject=btn.dataset.subject;
activeFilter="all";
render();
};
});

$("materialForm").onsubmit=async e=>{

e.preventDefault();

const file=$("attachment").files[0];

const candidate={
id:uid(),
version:VERSION,
title:$("title").value.trim(),
subject:$("subject").value,
chapter:$("chapter").value,
topic:$("topic").value.trim(),
type:$("type").value,
tags:$("tags").value
.split(",")
.map(x=>x.trim())
.filter(Boolean),
priority:$("priority").value,
revisionState:$("revision").value,
revisionStep:0,
body:$("body").value.trim(),
why:$("why").value.trim(),
attachment:await attachment(file),
createdAt:Date.now(),
updatedAt:Date.now(),
archived:false,
collectionIds:[]
};

const dup=duplicate(candidate);

if(dup){

const choice=confirm(
"Already saved:\\n\\n"+
dup.title+
(dup.chapter?"\\n"+dup.chapter:"")+
"\\n\\nOK = save as a reference anyway\\nCancel = stop"
);

if(!choice)return;

candidate.referenceOf=dup.id;
}

items.unshift(candidate);

persist();

e.target.reset();

$("dialog").close();

render();

};

$("materials").onclick=e=>{

const btn=e.target.closest("[data-action]");

if(!btn)return;

const item=items.find(x=>x.id===btn.dataset.id);

if(!item)return;

const action=btn.dataset.action;

if(action==="archive"){
item.archived=!item.archived;
item.updatedAt=Date.now();
}

if(action==="revision"){
scheduleRevision(item);
}

if(action==="practice"){

localStorage.setItem(
"rankforgeStudyVaultPracticeV1",
JSON.stringify({
source:"study-vault",
questionId:item.id,
title:item.title,
createdAt:Date.now()
})
);

alert(
"Practice item prepared.\\n\\n"+
"Original Study Vault material remains unchanged."
);
}

if(action==="collection"){

if(!collections.length){
alert("Create a collection first.");
return;
}

const names=collections.map(
(c,i)=>(i+1)+". "+c.name
).join("\\n");

const answer=prompt(
"Add to which collection?\\n\\n"+names+
"\\n\\nEnter number:"
);

const n=Number(answer)-1;

if(collections[n]){

item.collectionIds=item.collectionIds||[];

if(!item.collectionIds.includes(collections[n].id))
item.collectionIds.push(collections[n].id);

}
}

if(action==="link"){

const text=
"Study Vault: "+
item.title+
(item.chapter?" → "+item.chapter:"");

navigator.clipboard?.writeText(text);

alert("Reference copied.");
}

if(action==="delete"){

const ok=confirm(
"Archive this material instead of deleting it?\\n\\n"+
"Archive keeps your study record safe."
);

if(ok)item.archived=true;

}

persist();
render();

};

$("newCollection").onclick=()=>{

const name=prompt("Collection name:");

if(!name?.trim())return;

collections.push({
id:uid("collection"),
name:name.trim(),
createdAt:Date.now()
});

persist();
renderCollections();

};

function renderCollections(){

if(!collections.length){

$("collections").innerHTML=
'<span class="meta">No collections yet.</span>';

return;
}

$("collections").innerHTML=
collections.map(c=>
'<span class="collection">🗂️ '+
escapeHTML(c.name)+
"</span>"
).join("");
}

$("backup").onclick=()=>{

const payload={
app:"RankForge Study Vault",
version:VERSION,
exportedAt:new Date().toISOString(),
items,
collections
};

const blob=new Blob(
[JSON.stringify(payload,null,2)],
{type:"application/json"}
);

const url=URL.createObjectURL(blob);

const a=document.createElement("a");

a.href=url;
a.download="rankforge-study-vault-backup.json";
a.click();

setTimeout(
()=>URL.revokeObjectURL(url),
1000
);

};

$("restore").onchange=async e=>{

const file=e.target.files[0];

if(!file)return;

try{

const data=JSON.parse(await file.text());

const incoming=
Array.isArray(data)?
data:
data.items;

if(!Array.isArray(incoming))
throw new Error("Invalid Study Vault backup");

let added=0;

for(const x of incoming){

if(!duplicate(x)){

items.push({
...x,
id:x.id||uid()
});

added++;

}

}

if(Array.isArray(data.collections)){

for(const c of data.collections){

if(!collections.some(x=>x.name===c.name)){

collections.push({
...c,
id:c.id||uid("collection")
});

}

}

}

persist();

render();

alert(
"Restore complete.\\n\\n"+
added+
" new material(s) added.\\n"+
"Duplicates were skipped."
);

}catch(err){

alert("Restore failed: "+err.message);

}

e.target.value="";

};

render();

window.RankForgeStudyVault={

version:VERSION,

add:function(data){

const candidate={
id:uid(),
version:VERSION,
createdAt:Date.now(),
updatedAt:Date.now(),
archived:false,
revisionState:"new",
revisionStep:0,
...data
};

const dup=duplicate(candidate);

if(dup)return{
saved:false,
duplicate:true,
existingId:dup.id
};

items.unshift(candidate);

persist();
render();

return{
saved:true,
id:candidate.id
};

},

search:function(q){

return items.filter(x=>
normalize([
x.title,
x.subject,
x.chapter,
x.topic,
x.body,
x.why,
...(x.tags||[])
].join(" ")).includes(normalize(q))
);

},

getAll:()=>items.slice(),

revision:function(id){

const item=items.find(x=>x.id===id);

if(!item)return false;

scheduleRevision(item);
persist();
render();

return true;

}

};

})();
