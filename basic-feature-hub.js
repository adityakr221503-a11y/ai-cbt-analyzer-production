(function(){
"use strict";

const FEATURES = [
  {
    icon:"👑",
    title:"Rankers Test Series",
    desc:"Pre → Actual CBT → Post-test analysis",
    url:"rankers-test-series.html",
    cls:"primary"
  },
  {
    icon:"🏆",
    title:"Ranker Question Bank",
    desc:"Chapter, topic, new, weak and adaptive practice",
    url:"question-bank.html"
  },
  {
    icon:"📄",
    title:"PDF → CBT",
    desc:"Upload a new PDF and convert it into CBT",
    url:"pdf-to-cbt.html"
  },
  {
    icon:"🧬",
    title:"Biology 360°",
    desc:"NCERT concepts, traps and revision",
    url:"biology360/index.html"
  },
  {
    icon:"📚",
    title:"Topic-wise Practice",
    desc:"Practice by subject → chapter → topic",
    url:"question-bank.html?mode=topic"
  },
  {
    icon:"🔁",
    title:"Mistake Bank",
    desc:"Mistake → Revision → Retry → Mastery",
    url:"mistake.html"
  },
  {
    icon:"🎯",
    title:"Retry / Mastery",
    desc:"Retry previously missed questions",
    url:"retry.html"
  },
  {
    icon:"📊",
    title:"Test History",
    desc:"Previous tests and performance records",
    url:"history.html"
  },
  {
    icon:"🌐",
    title:"Orbit Analysis",
    desc:"Detailed post-test performance analysis",
    url:"orbit-test-analysis.html"
  },
  {
    icon:"🧠",
    title:"Mentor",
    desc:"Current next-best action from your evidence",
    url:"#rankerMentorV5"
  },
  {
    icon:"🎯",
    title:"720 Approach",
    desc:"Target planning and score-gap strategy",
    url:"ranker-command-center.html#720"
  },
  {
    icon:"⏱️",
    title:"Skip / Attempt Strategy",
    desc:"Attempt order, skipping and time control",
    url:"ranker-command-center.html#skip"
  },
  {
    icon:"📖",
    title:"Revision",
    desc:"Subject → chapter quick revision",
    url:"#revisionSheet"
  }
];

function esc(v){
  return String(v==null?"":v)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function render(){
  if(document.getElementById("basicFeatureHubV1")) return;

  const section=document.createElement("section");
  section.id="basicFeatureHubV1";
  section.className="basic-feature-hub";

  section.innerHTML =
    '<div class="basic-feature-head">'+
      '<div>'+
        '<div class="basic-feature-title">🚀 CBT Analyzer Pro</div>'+
        '<div class="basic-feature-sub">'+
          'All core features in one place'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="basic-feature-grid">'+
      FEATURES.map(function(f){
        return (
          '<a class="basic-feature-card '+
          esc(f.cls||"")+
          '" href="'+esc(f.url)+'">'+
            '<div class="basic-feature-icon">'+
              esc(f.icon)+
            '</div>'+
            '<div class="basic-feature-name">'+
              esc(f.title)+
            '</div>'+
            '<div class="basic-feature-desc">'+
              esc(f.desc)+
            '</div>'+
            '<div class="basic-feature-open">Open →</div>'+
          '</a>'
        );
      }).join("")+
    '</div>';

  const revision=document.getElementById("revisionSheet");

  if(revision && revision.parentNode){
    revision.parentNode.insertBefore(section,revision);
  }else{
    const container=
      document.querySelector(".container") ||
      document.body;

    container.appendChild(section);
  }
}

const style=document.createElement("style");
style.id="BASIC_FEATURE_HUB_V1_CSS";
style.textContent=`
.basic-feature-hub{
  margin:18px 0;
  padding:18px;
  border-radius:18px;
  background:#fff;
  border:1px solid #e2e8f0;
  box-shadow:0 3px 14px rgba(0,0,0,.06);
}

.basic-feature-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:14px;
}

.basic-feature-title{
  font-size:21px;
  font-weight:800;
}

.basic-feature-sub{
  margin-top:4px;
  color:#64748b;
  font-size:13px;
}

.basic-feature-grid{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:11px;
}

.basic-feature-card{
  display:block;
  text-decoration:none;
  color:#0f172a;
  background:#f8fafc;
  border:1px solid #e2e8f0;
  border-radius:14px;
  padding:15px;
  min-height:145px;
  transition:.15s;
}

.basic-feature-card:hover{
  transform:translateY(-2px);
  border-color:#6366f1;
}

.basic-feature-card.primary{
  background:#eef2ff;
  border-color:#c7d2fe;
}

.basic-feature-icon{
  font-size:27px;
  margin-bottom:9px;
}

.basic-feature-name{
  font-weight:800;
  font-size:15px;
}

.basic-feature-desc{
  color:#64748b;
  font-size:12px;
  line-height:1.45;
  margin-top:5px;
}

.basic-feature-open{
  margin-top:11px;
  font-size:12px;
  font-weight:800;
  color:#4f46e5;
}

@media(max-width:800px){
  .basic-feature-grid{
    grid-template-columns:repeat(2,1fr);
  }
}

@media(max-width:500px){
  .basic-feature-grid{
    grid-template-columns:1fr;
  }

  .basic-feature-card{
    min-height:auto;
  }
}
`;
document.head.appendChild(style);

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",render);
}else{
  render();
}

setTimeout(render,500);
})();
