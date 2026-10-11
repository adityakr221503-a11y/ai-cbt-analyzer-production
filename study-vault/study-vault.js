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

let items=[];
let collections=[];

let activeFilter="all";
let vaultReady=false;

const VAULT_DB="RankForgeStudyVaultDB";
const VAULT_DB_VERSION=1;

function openVaultDB(){
return new Promise((resolve,reject)=>{
try{
const req=indexedDB.open(VAULT_DB,VAULT_DB_VERSION);

req.onupgradeneeded=()=>{
const db=req.result;
if(!db.objectStoreNames.contains("items"))
db.createObjectStore("items",{keyPath:"id"});
if(!db.objectStoreNames.contains("collections"))
db.createObjectStore("collections",{keyPath:"id"});
};

req.onsuccess=()=>resolve(req.result);
req.onerror=()=>reject(req.error);
}catch(e){reject(e)}
});
}

async function readDurable(){
try{
const db=await openVaultDB();

const result=await new Promise((resolve,reject)=>{
const tx=db.transaction(["items","collections"],"readonly");
const a=tx.objectStore("items").getAll();
const b=tx.objectStore("collections").getAll();

tx.oncomplete=()=>resolve({
items:Array.isArray(a.result)?a.result:[],
collections:Array.isArray(b.result)?b.result:[]
});
tx.onerror=()=>reject(tx.error);
});

db.close();

const localItems=readItems();
const localCollections=readCollections();

if(result.items.length){
items=result.items;
}else{
items=localItems;
}

if(result.collections.length){
collections=result.collections;
}else{
collections=localCollections;
}

localStorage.setItem(ITEM_KEY,JSON.stringify(items));
localStorage.setItem(COLLECTION_KEY,JSON.stringify(collections));

return true;
}catch(e){
items=readItems();
collections=readCollections();
return false;
}
}

async function writeDurable(){
try{
const db=await openVaultDB();

await new Promise((resolve,reject)=>{
const tx=db.transaction(["items","collections"],"readwrite");
const itemStore=tx.objectStore("items");
const collectionStore=tx.objectStore("collections");

itemStore.clear();
collectionStore.clear();

items.forEach(x=>itemStore.put(x));
collections.forEach(x=>collectionStore.put(x));

tx.oncomplete=resolve;
tx.onerror=()=>reject(tx.error);
});

db.close();
}catch(e){
console.warn("Study Vault IndexedDB save failed:",e);
}
}


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
writeDurable();
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


const NCERT_CHAPTERS = {
  Physics: {
    "Class 11": ["Units and Measurements","Motion in a Straight Line","Motion in a Plane","Laws of Motion","Work, Energy and Power","System of Particles and Rotational Motion","Gravitation","Mechanical Properties of Solids","Mechanical Properties of Fluids","Thermal Properties of Matter","Thermodynamics","Kinetic Theory","Oscillations","Waves"],
    "Class 12": ["Electric Charges and Fields","Electrostatic Potential and Capacitance","Current Electricity","Moving Charges and Magnetism","Magnetism and Matter","Electromagnetic Induction","Alternating Current","Electromagnetic Waves","Ray Optics and Optical Instruments","Wave Optics","Dual Nature of Radiation and Matter","Atoms","Nuclei","Semiconductor Electronics"]
  },
  Chemistry: {
    "Class 11": ["Some Basic Concepts of Chemistry","Structure of Atom","Classification of Elements and Periodicity in Properties","Chemical Bonding and Molecular Structure","Thermodynamics","Equilibrium","Redox Reactions","Organic Chemistry – Some Basic Principles and Techniques","Hydrocarbons","s-Block Elements","p-Block Elements","Environmental Chemistry"],
    "Class 12": ["Solutions","Electrochemistry","Chemical Kinetics","Surface Chemistry","General Principles and Processes of Isolation of Elements","p-Block Elements","d- and f-Block Elements","Coordination Compounds","Haloalkanes and Haloarenes","Alcohols, Phenols and Ethers","Aldehydes, Ketones and Carboxylic Acids","Amines","Biomolecules","Polymers","Chemistry in Everyday Life"]
  },
  Biology: {
    "Class 11": ["The Living World","Biological Classification","Plant Kingdom","Animal Kingdom","Morphology of Flowering Plants","Anatomy of Flowering Plants","Structural Organisation in Animals","Cell: The Unit of Life","Biomolecules","Cell Cycle and Cell Division","Transport in Plants","Mineral Nutrition","Photosynthesis in Plants","Respiration in Plants","Plant Growth and Development","Digestion and Absorption","Breathing and Exchange of Gases","Body Fluids and Circulation","Excretory Products and Elimination","Locomotion and Movement","Neural Control and Coordination","Chemical Coordination and Integration"],
    "Class 12": ["Sexual Reproduction in Flowering Plants","Human Reproduction","Reproductive Health","Principles of Inheritance and Variation","Molecular Basis of Inheritance","Evolution","Human Health and Disease","Strategies for Enhancement in Food Production","Microbes in Human Welfare","Biotechnology: Principles and Processes","Biotechnology and its Applications","Organisms and Populations","Ecosystem","Biodiversity and Conservation"]
  }
};

let chapterBrowserState = {subject:"",className:"",chapter:""};

function saveNavigation(){
try{
const parts=[
chapterBrowserState.subject,
chapterBrowserState.className,
chapterBrowserState.chapter
].filter(Boolean);

location.hash=parts.map(encodeURIComponent).join("/");
}catch(e){}
}

function restoreNavigation(){
try{
const raw=location.hash.replace(/^#/,"");
if(!raw)return;

const parts=raw.split("/").map(decodeURIComponent);

chapterBrowserState={
subject:parts[0]||"",
className:parts[1]||"",
chapter:parts[2]||""
};

if(chapterBrowserState.subject &&
!NCERT_CHAPTERS[chapterBrowserState.subject]){
chapterBrowserState={subject:"",className:"",chapter:""};
}

if(
chapterBrowserState.subject &&
chapterBrowserState.className &&
!NCERT_CHAPTERS[chapterBrowserState.subject]?.[chapterBrowserState.className]
){
chapterBrowserState.className="";
chapterBrowserState.chapter="";
}

if(
chapterBrowserState.subject &&
chapterBrowserState.className &&
chapterBrowserState.chapter &&
!NCERT_CHAPTERS[chapterBrowserState.subject][chapterBrowserState.className]
.includes(chapterBrowserState.chapter)
){
chapterBrowserState.chapter="";
}
}catch(e){
chapterBrowserState={subject:"",className:"",chapter:""};
}
}

window.addEventListener("hashchange",()=>{
restoreNavigation();
renderChapterBrowser();
});

function renderChapterBrowser(){
  const box=document.getElementById("chapterBrowserContent");
  const title=document.getElementById("chapterBrowserTitle");
  const back=document.getElementById("chapterBack");
  if(!box) return;

  const sub=chapterBrowserState.subject;
  const cls=chapterBrowserState.className;
  const ch=chapterBrowserState.chapter;

  if(!sub){
    title.textContent="📚 NCERT Chapter Library";
    back.hidden=true;
    box.innerHTML="";
    ["Physics","Chemistry","Biology"].forEach(x=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="chapterTile";
      b.innerHTML="<strong>"+x+"</strong><small>Class 11 + Class 12</small>";
      b.addEventListener("click",()=>{
        chapterBrowserState.subject=x;
        chapterBrowserState.className="";
        chapterBrowserState.chapter="";
        saveNavigation();
        renderChapterBrowser();
      });
      box.appendChild(b);
    });
    return;
  }

  if(!cls){
    title.textContent="📚 "+sub;
    back.hidden=false;
    box.innerHTML="";
    ["Class 11","Class 12"].forEach(x=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="chapterTile";
      b.innerHTML="<strong>"+x+"</strong><small>"+NCERT_CHAPTERS[sub][x].length+" chapters</small>";
      b.addEventListener("click",()=>{
        chapterBrowserState.className=x;
        chapterBrowserState.chapter="";
        saveNavigation();
        renderChapterBrowser();
      });
      box.appendChild(b);
    });
    return;
  }

  if(!ch){
    title.textContent="📚 "+sub+" • "+cls;
    back.hidden=false;
    box.innerHTML="";
    NCERT_CHAPTERS[sub][cls].forEach((x,i)=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="chapterTile chapterName";
      b.innerHTML="<strong>"+(i+1)+". "+x+"</strong><small>Open chapter →</small>";
      b.addEventListener("click",()=>{
        chapterBrowserState.chapter=x;
        saveNavigation();
        renderChapterBrowser();
      });
      box.appendChild(b);
    });
    return;
  }

  title.textContent="📖 "+ch;
  back.hidden=false;
  box.innerHTML="";

  const all=(window.RankForgeStudyVault && typeof window.RankForgeStudyVault.getAll==="function")
    ? window.RankForgeStudyVault.getAll() : [];

  const matches=all.filter(x=>
    String(x.subject||"").trim().toLowerCase()===sub.toLowerCase() &&
    normalize(x.chapter)===normalize(ch)
  );

  const info=document.createElement("div");
  info.className="chapterMaterialHead";
  info.innerHTML="<strong>"+sub+" • "+cls+"</strong><span>"+matches.length+" saved material"+(matches.length===1?"":"s")+"</span>";
  box.appendChild(info);

  if(!matches.length){
    const empty=document.createElement("div");
    empty.className="chapterEmpty";
    empty.innerHTML="<strong>No saved material in this chapter yet.</strong><p>Use Quick Save and select this subject + chapter to add material here.</p>";
    box.appendChild(empty);
    return;
  }

  matches.forEach(x=>{
    const card=document.createElement("div");
    card.className="chapterMaterial";
    const text=x.remember||x.note||x.description||"";
    card.innerHTML="<strong>"+escapeHtml(String(x.title||"Untitled"))+"</strong><small>"+escapeHtml(String(x.type||"Material"))+"</small><p>"+escapeHtml(String(text))+"</p>";
    box.appendChild(card);
  });
}

function escapeHtml(v){
  return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
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
if(activeFilter==="pinned")
list=list.filter(x=>x.pinned);

if(activeFilter==="gallery")
list=list.filter(x=>x.attachment?.type?.startsWith("image/"));

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

function renderRevisionDashboard(){
const el=document.getElementById("vaultDashboard");
if(!el)return;
const active=items.filter(x=>!x.archived);
const due=active.filter(x=>x.revisionDue&&x.revisionDue<=Date.now()).length;
const pinned=active.filter(x=>x.pinned).length;
const images=active.filter(x=>x.attachment?.type?.startsWith("image/")).length;
const linked=active.filter(x=>(x.relatedIds||[]).length).length;
el.innerHTML=
'<div class="vaultDashItem"><b>'+due+'</b><small>Due Revision</small></div>'+
'<div class="vaultDashItem"><b>'+pinned+'</b><small>Pinned</small></div>'+
'<div class="vaultDashItem"><b>'+images+'</b><small>Images</small></div>'+
'<div class="vaultDashItem"><b>'+linked+'</b><small>Linked</small></div>';
}

function renderGallery(){
const el=document.getElementById("vaultGallery");
if(!el)return;
const imgs=items.filter(x=>!x.archived&&x.attachment?.stored&&x.attachment?.type?.startsWith("image/"));
if(!imgs.length){
el.innerHTML='<div class="empty">No screenshots/photos saved yet.</div>';
return;
}
el.innerHTML=imgs.map(x=>
'<button class="galleryItem" data-gallery-id="'+escapeHTML(x.id)+'">'+
'<img src="'+x.attachment.data+'" alt="'+escapeHTML(x.title)+'">'+
'<span>'+escapeHTML(x.title)+'</span></button>'
).join("");
}

function render(){
stats();
renderMaterials();
renderCollections();
renderRevisionDashboard();
renderGallery();
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
activeFilter==="pinned"?
"📌 Pinned / Top Picks":
activeFilter==="gallery"?
"🖼️ Screenshot Gallery":
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
${x.attachment?.stored && x.attachment?.type?.startsWith("image/")
?'<span class="chip">🖼️ Stored inside material</span>':""}
${x.attachment?.type==="application/pdf"
?'<span class="chip">📄 Stored inside material</span>':""}
</div>

<div class="materialActions">
<button data-action="chapter" data-id="${x.id}">📚 Chapter</button>
<button data-action="practice" data-id="${x.id}">🎯 Practice</button>
<button data-action="revision" data-id="${x.id}">🔄 Revision</button>
<button data-action="collection" data-id="${x.id}">🗂️ Collection</button>
<button data-action="pin" data-id="${x.id}">${x.pinned?"📌 Pinned":"📌 Pin"}</button>
${x.attachment?'<button data-action="attachment" data-id="'+x.id+'">👁️ Open File</button>':""}
${x.attachment?.type==="application/pdf"?'<button data-action="bookmarkPage" data-id="'+x.id+'">🔖 PDF Page</button>':""}
<button data-action="related" data-id="${x.id}">🔗 Link Material</button>
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

const quickScreenshot=document.createElement("input");
quickScreenshot.type="file";
quickScreenshot.accept="image/*";
quickScreenshot.style.display="none";
quickScreenshot.id="quickScreenshotInput";
document.body.appendChild(quickScreenshot);

function quickScreenshotSave(){
quickScreenshot.value="";
quickScreenshot.onchange=async()=>{
const file=quickScreenshot.files[0];
if(!file)return;

const title=prompt("Screenshot title:");
if(!title?.trim())return;

let subject=chapterBrowserState.subject;
let className=chapterBrowserState.className;
let chapter=chapterBrowserState.chapter;

if(!subject){
subject=prompt("Subject: Physics / Chemistry / Biology");
}
if(!["Physics","Chemistry","Biology"].includes(subject))return;

if(!className){
className=prompt("Class: Class 11 / Class 12");
}
if(!["Class 11","Class 12"].includes(className))return;

if(!chapter){
const list=NCERT_CHAPTERS[subject]?.[className]||[];
const names=list.map((x,i)=>(i+1)+". "+x).join("\n");
const n=Number(prompt("Select chapter number:\n\n"+names))-1;
chapter=list[n];
}
if(!chapter)return;

const candidate={
id:uid(),
version:VERSION,
title:title.trim(),
subject,
className,
chapter,
topic:"",
type:"screenshot",
tags:["screenshot"],
priority:"high",
revisionState:"new",
revisionStep:0,
body:"",
why:"Quick screenshot capture",
attachment:await attachment(file),
createdAt:Date.now(),
updatedAt:Date.now(),
archived:false,
collectionIds:[],
pinned:true,
pdfBookmarks:[],
relatedIds:[]
};

const dup=duplicate(candidate);
if(dup){
alert("This screenshot/material already exists.");
return;
}

items.unshift(candidate);
persist();

chapterBrowserState={subject,className,chapter};
saveNavigation();

render();
renderChapterBrowser();

alert("Screenshot saved inside Study Vault → "+subject+" → "+className+" → "+chapter);
};
quickScreenshot.click();
}

if(!document.getElementById("quickScreenshotSaveBtn")){
const b=document.createElement("button");
b.id="quickScreenshotSaveBtn";
b.className="secondary";
b.textContent="📸 Quick Screenshot";
b.onclick=quickScreenshotSave;
document.querySelector(".top")?.appendChild(b);
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
  btn.addEventListener("click",()=>{
    activeSubject=btn.dataset.subject||"";
    chapterBrowserState={
      subject:activeSubject,
      className:"",
      chapter:""
    };
    saveNavigation();
    renderChapterBrowser();

    const browser=document.getElementById("chapterBrowser");
    if(browser) browser.scrollIntoView({behavior:"smooth",block:"start"});
  });
});

const chapterBackButton=document.getElementById("chapterBack");
if(chapterBackButton){
  chapterBackButton.addEventListener("click",()=>{
    if(chapterBrowserState.chapter){
      chapterBrowserState.chapter="";
    }else if(chapterBrowserState.className){
      chapterBrowserState.className="";
    }else{
      chapterBrowserState.subject="";
      activeSubject="";
    }
    renderChapterBrowser();
  });
}

$("materialForm").onsubmit=async e=>{

e.preventDefault();

const file=$("attachment").files[0];

const candidate={
id:uid(),
version:VERSION,
title:$("title").value.trim(),
subject:$("subject").value,
chapter:$("chapter").value,
className:(function(){
  const sub=$("subject").value;
  const ch=$("chapter").value;
  if(sub && NCERT_CHAPTERS[sub]){
    for(const c of Object.keys(NCERT_CHAPTERS[sub])){
      if((NCERT_CHAPTERS[sub][c]||[]).includes(ch)) return c;
    }
  }
  return "";
})(),
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
collectionIds:[],
pinned:false,
pdfBookmarks:[],
relatedIds:[]
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

document.getElementById("vaultGallery")?.addEventListener("click",e=>{
const b=e.target.closest("[data-gallery-id]");
if(!b)return;
const x=items.find(i=>i.id===b.dataset.galleryId);
if(!x?.attachment?.data)return;
const w=window.open("");
if(!w)return;
w.document.write("<body style='margin:0;background:#111;text-align:center'><img src='"+x.attachment.data+"' style='max-width:100%;max-height:100vh'></body>");
w.document.close();
});

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

if(action==="pin"){
item.pinned=!item.pinned;
item.updatedAt=Date.now();
}

if(action==="attachment"){
if(item.attachment?.stored && item.attachment.data){
const w=window.open("");
if(w){
w.document.write("<title>"+escapeHTML(item.title||"Study Vault")+"</title>");
if((item.attachment.type||"").startsWith("image/")){
w.document.write("<body style='margin:0;background:#111;text-align:center'><img src='"+item.attachment.data+"' style='max-width:100%;max-height:100vh'></body>");
}else if(item.attachment.type==="application/pdf"){
w.document.write("<body style='margin:0'><iframe src='"+item.attachment.data+"' style='width:100vw;height:100vh;border:0'></iframe></body>");
}else{
w.document.write("<body style='background:#111;color:white'><p>Attachment: "+escapeHTML(item.attachment.name||"file")+"</p></body>");
}
w.document.close();
}
}else{
alert("This attachment is metadata-only because it is larger than 8 MB.");
}
}

if(action==="bookmarkPage"){
const page=Number(prompt("PDF page number:"));
if(Number.isInteger(page)&&page>0){
item.pdfBookmarks=item.pdfBookmarks||[];
if(!item.pdfBookmarks.includes(page)) item.pdfBookmarks.push(page);
item.pdfBookmarks.sort((a,b)=>a-b);
item.updatedAt=Date.now();
alert("PDF page "+page+" bookmarked.");
}
}

if(action==="related"){
const candidates=items.filter(x=>x.id!==item.id&&!x.archived);
if(!candidates.length){
alert("No other material available.");
}else{
const names=candidates.slice(0,30).map((x,i)=>(i+1)+". "+x.title).join("\n");
const n=Number(prompt("Link with which material?\n\n"+names+"\n\nEnter number:"))-1;
const target=candidates[n];
if(target){
item.relatedIds=item.relatedIds||[];
target.relatedIds=target.relatedIds||[];
if(!item.relatedIds.includes(target.id)) item.relatedIds.push(target.id);
if(!target.relatedIds.includes(item.id)) target.relatedIds.push(item.id);
item.updatedAt=Date.now();
target.updatedAt=Date.now();
alert("Materials linked.");
}
}
}

if(action==="link"){

const text=
"Study Vault: "+
item.title+
(item.chapter?" → "+item.chapter:"")+
(item.topic?" → "+item.topic:"");

navigator.clipboard?.writeText(text);

alert("Reference copied.");
}

if(action==="chapter"){
  chapterBrowserState={
    subject:item.subject||"",
    className:item.className||"",
    chapter:item.chapter||""
  };
  saveNavigation();
  renderChapterBrowser();
  const browser=document.getElementById("chapterBrowser");
  if(browser) browser.scrollIntoView({behavior:"smooth",block:"start"});
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

async function bootStudyVault(){
restoreNavigation();
await readDurable();
vaultReady=true;
render();
renderChapterBrowser();
}

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
pinned:false,
pdfBookmarks:[],
relatedIds:[],
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

bootStudyVault();

})();
