#!/data/data/com.termux/files/usr/bin/bash

echo "🧬 Building NCERT Biology 360°..."

mkdir -p data js css

cat > data/biology.js <<'DATA'
const BIOLOGY360_DATA = [
{
keyword:"ATP / Chemiosmosis",
class:"XI",
priority:5,
trap:5,
chapters:["Photosynthesis in Higher Plants","Respiration in Plants","Excretory Products and their Elimination","Neural Control and Coordination"],
what:"ATP is the immediate energy currency used by cells.",
why:"Energy-requiring cellular processes depend on ATP.",
where:"Chemiosmotic ATP formation occurs across membranes containing ATP synthase.",
when:"During photophosphorylation and oxidative phosphorylation.",
who:"ATP synthase uses a proton gradient to form ATP.",
how:"H+ moves down its electrochemical gradient through ATP synthase.",
which:"Primary active transport, secondary active transport and facilitated diffusion are different.",
exception:"Facilitated diffusion does not directly require ATP.",
connections:["Photosynthesis → photophosphorylation","Respiration → oxidative phosphorylation","Kidney → Na+ linked secondary active transport","Neuron → Na+/K+ pump directly uses ATP"],
attack:"Do not assume every transport process directly hydrolyses ATP.",
confusion:"Primary active transport ≠ secondary active transport ≠ facilitated diffusion",
recall:"What drives ATP formation through ATP synthase?",
answer:"Proton movement down the electrochemical gradient."
},

{
keyword:"DNA Replication",
class:"XI/XII",
priority:5,
trap:5,
chapters:["Cell Cycle and Cell Division","Molecular Basis of Inheritance","Biotechnology: Principles and Processes"],
what:"DNA replication produces new DNA using an existing DNA template.",
why:"It allows genetic information to be transmitted.",
where:"DNA replication occurs during S phase.",
when:"During the S phase before cell division.",
who:"DNA polymerase synthesises the new DNA strand.",
how:"DNA synthesis proceeds in the 5′ → 3′ direction.",
which:"Leading and lagging strands differ in their synthesis pattern.",
exception:"DNA polymerase requires a primer to begin synthesis.",
connections:["S phase → DNA duplication","Molecular Basis → semiconservative replication","Biotechnology → PCR amplification","DNA fingerprinting → DNA fragment analysis"],
attack:"A common trap is reversing the direction of DNA synthesis.",
confusion:"Template strand ≠ coding strand; leading ≠ lagging",
recall:"In which direction does DNA polymerase synthesise DNA?",
answer:"5′ → 3′."
},

{
keyword:"ADH",
class:"XI",
priority:5,
trap:5,
chapters:["Chemical Coordination and Integration","Excretory Products and their Elimination"],
what:"ADH promotes water conservation.",
why:"It helps maintain water and osmotic balance.",
where:"It acts mainly on the distal tubule and collecting duct.",
when:"Its action increases when water conservation is required.",
who:"ADH is synthesised in the hypothalamus and released from the posterior pituitary.",
how:"It increases water reabsorption.",
which:"Posterior pituitary stores and releases ADH.",
exception:"Posterior pituitary does not synthesise ADH.",
connections:["Hypothalamus → synthesis","Posterior pituitary → storage/release","Kidney → increased water reabsorption"],
attack:"Synthesis and release are different events.",
confusion:"Hypothalamus synthesises ≠ posterior pituitary releases",
recall:"Where is ADH synthesised?",
answer:"Hypothalamus."
},

{
keyword:"Homologous vs Analogous",
class:"XI/XII",
priority:5,
trap:5,
chapters:["Animal Kingdom","Morphology of Flowering Plants","Evolution"],
what:"Homologous structures have common origin; analogous structures have similar function but different origin.",
why:"This distinction helps identify evolutionary relationships.",
where:"Examples occur in plants and animals.",
when:"Used when comparing structural similarities.",
who:"Different organisms may show homologous or analogous structures.",
how:"Homologous structures can become modified for different functions.",
which:"Homologous → divergent evolution; analogous → convergent evolution.",
exception:"Similar function alone does not prove homology.",
connections:["Bougainvillea thorn ↔ Cucurbita tendril","Vertebrate forelimbs","Convergent evolution"],
attack:"Function alone is not the test for homology.",
confusion:"Homologous = common origin; Analogous = similar function.",
recall:"Which structures indicate divergent evolution?",
answer:"Homologous structures."
},

{
keyword:"Bile",
class:"XI",
priority:4,
trap:5,
chapters:["Digestion and Absorption"],
what:"Bile is an alkaline secretion that assists digestion of fats.",
why:"Bile salts emulsify fats and support lipase action.",
where:"Produced by liver; stored and concentrated in gall bladder.",
when:"Released into the small intestine during digestion.",
who:"Liver produces bile.",
how:"Bile salts emulsify fats into smaller droplets.",
which:"Bile contains no digestive enzymes.",
exception:"Gall bladder stores bile; it does not produce bile.",
connections:["Liver → production","Gall bladder → storage","Small intestine → action"],
attack:"Production and storage are different functions.",
confusion:"Bile salts ≠ digestive enzymes.",
recall:"Does bile contain digestive enzymes?",
answer:"No."
},

{
keyword:"Proton Gradient",
class:"XI",
priority:5,
trap:5,
chapters:["Photosynthesis in Higher Plants","Respiration in Plants"],
what:"A proton gradient stores electrochemical potential energy.",
why:"Proton movement can drive ATP synthesis.",
where:"Chloroplast → thylakoid lumen; mitochondria → intermembrane space.",
when:"During photophosphorylation and oxidative phosphorylation.",
who:"Electron transport systems establish the gradient.",
how:"H+ moves down its gradient through ATP synthase.",
which:"The H+ accumulation compartment differs between chloroplasts and mitochondria.",
exception:"Do not reverse the proton accumulation compartment.",
connections:["Chloroplast → thylakoid lumen","Mitochondria → intermembrane space","ATP synthase → ATP formation"],
attack:"Same principle, different membrane compartments.",
confusion:"Thylakoid lumen ≠ mitochondrial matrix.",
recall:"Where do H+ ions accumulate during chloroplast photophosphorylation?",
answer:"Thylakoid lumen."
}
];
DATA

cat > js/app.js <<'APP'
const STORAGE_KEY="cbtAnalyzer.biology360.mastery.v1";
let mastery=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
let mode="all";

const $=id=>document.getElementById(id);

function setMastery(i,value){
  mastery[i]=value;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(mastery));
  render();
}

function toggleAnswer(i){
  const e=$("answer-"+i);
  e.style.display=e.style.display==="block"?"none":"block";
}

function field(title,text){
  return `<div class="section"><b>${title}</b>${text}</div>`;
}

function render(){
  const q=$("search").value.toLowerCase().trim();

  const list=BIOLOGY360_DATA.filter((x)=>{
    const text=JSON.stringify(x).toLowerCase();
    if(q&&!text.includes(q)) return false;
    if(mode==="rapid"&&x.priority<4) return false;
    if(mode==="trap"&&x.trap<4) return false;
    if(mode==="boss"&&(x.priority!==5||x.trap!==5)) return false;
    return true;
  });

  $("total").textContent=BIOLOGY360_DATA.length;
  $("revise").textContent=Object.values(mastery).filter(x=>x==="revise").length;
  $("mastered").textContent=Object.values(mastery).filter(x=>x==="mastered").length;

  $("cards").innerHTML=list.length?list.map(x=>{
    const i=BIOLOGY360_DATA.indexOf(x);
    const s=mastery[i]||"new";

    return `
    <article class="card">
      <div class="keyword">${x.keyword}</div>
      <div class="meta">Class ${x.class} · ${x.chapters.length} NCERT connections</div>
      <span class="tag">Priority ${x.priority}/5</span>
      <span class="tag">Trap ${x.trap}/5</span>

      ${field("WHAT",x.what)}
      ${field("WHY",x.why)}
      ${field("WHERE",x.where)}
      ${field("WHEN",x.when)}
      ${field("WHO",x.who)}
      ${field("HOW",x.how)}
      ${field("WHICH",x.which)}
      ${field("⚠️ EXCEPTION",x.exception)}

      <div class="section">
        <b>🔗 360° Connections</b>
        ${x.connections.map(c=>`<div>→ ${c}</div>`).join("")}
      </div>

      <div class="section">
        <b>🎯 Examiner Attack</b>
        ${x.attack}
      </div>

      <div class="section">
        <b>↔️ Confusion</b>
        ${x.confusion}
      </div>

      <div class="section">
        <b>🧠 Active Recall</b>
        ${x.recall}
        <br><button onclick="toggleAnswer(${i})">Reveal Answer</button>
        <div id="answer-${i}" class="answer">${x.answer}</div>
      </div>

      <div class="actions">
        <button onclick="setMastery(${i},'known')">🟢 Know</button>
        <button onclick="setMastery(${i},'revise')">🔴 Revise</button>
        <button onclick="setMastery(${i},'mastered')">👑 Mastered</button>
      </div>
    </article>`;
  }).join(""):'<div class="empty">No concept found.</div>';
}

function setMode(m,button){
  mode=m;
  document.querySelectorAll(".chips button").forEach(b=>b.classList.remove("active"));
  button.classList.add("active");
  render();
}

$("search").addEventListener("input",render);
render();
APP

cat > index.html <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NCERT Biology 360°</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#0b1020;color:#eef2ff;font-family:Arial,sans-serif}
header{padding:16px;background:#11182d;position:sticky;top:0;z-index:10}
h1{margin:0;font-size:23px}.sub{color:#9ca8c7;font-size:13px;margin-top:5px}
.container{max-width:900px;margin:auto;padding:15px}
.search{width:100%;padding:13px;margin-top:13px;border-radius:10px;border:1px solid #35405f;background:#0b1020;color:white}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
.stat{background:#151d34;border:1px solid #293552;border-radius:12px;padding:12px;text-align:center}
.stat b{display:block;font-size:21px}.stat span{font-size:11px;color:#9ca8c7}
.chips{display:flex;gap:7px;overflow-x:auto;margin-bottom:10px}
button{padding:9px 12px;border:1px solid #35405f;border-radius:9px;background:#151d34;color:#fff}
button.active{background:#304064}
.card{background:#11182d;border:1px solid #293552;border-radius:15px;padding:15px;margin:12px 0}
.keyword{font-size:20px;font-weight:bold}.meta{font-size:12px;color:#9ca8c7;margin:6px 0 10px}
.tag{display:inline-block;padding:4px 7px;margin:2px;border-radius:6px;background:#252e48;font-size:11px}
.section{background:#0b1020;padding:10px;margin-top:9px;border-radius:9px;font-size:13px;line-height:1.45}
.section b{display:block;color:#aebcff;margin-bottom:4px}
.actions{display:flex;gap:6px;margin-top:12px}.actions button{flex:1;font-size:11px}
.answer{display:none;margin-top:8px;padding:9px;background:#151d34;border-radius:7px}
.empty{text-align:center;padding:35px;color:#9ca8c7}
</style>
</head>
<body>
<header>
<h1>🧬 NCERT Biology 360°</h1>
<div class="sub">NCERT → Connection → Examiner Trap → Recall</div>
<input id="search" class="search" placeholder="Search keyword, chapter or trap...">
</header>
<main class="container">
<div class="stats">
<div class="stat"><b id="total">0</b><span>Concepts</span></div>
<div class="stat"><b id="revise">0</b><span>Revise</span></div>
<div class="stat"><b id="mastered">0</b><span>Mastered</span></div>
</div>
<div class="chips">
<button class="active" onclick="setMode('all',this)">All</button>
<button onclick="setMode('rapid',this)">⚡ Rapid</button>
<button onclick="setMode('trap',this)">🪤 Traps</button>
<button onclick="setMode('boss',this)">👑 Final Boss</button>
</div>
<div id="cards"></div>
</main>
<script src="data/biology.js"></script>
<script src="js/app.js"></script>
</body>
</html>
HTML

echo "✅ Biology 360° build complete"
