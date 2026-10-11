
(function(){
"use strict";

const SUBJECTS = {
  biology: {
    title:"🧬 Biology 360°",
    marks:360,
    focus:[
      "NCERT-first complete revision",
      "Chapter → Topic → Subtopic coverage",
      "NCERT facts, traps and exceptions",
      "PYQ patterns",
      "Weak-area revision",
      "Mistake → Retry → Mastery"
    ]
  },
  chemistry: {
    title:"🧪 Chemistry 360°",
    marks:180,
    focus:[
      "Physical → formulas + numerical practice",
      "Organic → reactions + mechanisms + conversions",
      "Inorganic → NCERT + trends + exceptions",
      "PYQ patterns and traps",
      "Weak-area revision",
      "Mistake → Retry → Mastery"
    ]
  },
  physics: {
    title:"⚡ Physics 360°",
    marks:180,
    focus:[
      "Concept → Formula → Application",
      "Numericals and calculation practice",
      "Graphs, units and dimensions",
      "Fast methods and common traps",
      "PYQ patterns",
      "Mistake → Retry → Mastery"
    ]
  }
};

function esc(v){
  return String(v==null?"":v)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function getSubjectStats(){
  try{
    if(window.CBTAnalyzerCore &&
       typeof window.CBTAnalyzerCore.getSnapshot==="function"){
      return window.CBTAnalyzerCore.getSnapshot().subjectStats || {};
    }
  }catch(e){}
  return {};
}

function render(key){
  const s=SUBJECTS[key];
  if(!s) return;

  const root=document.getElementById("subject360Content");
  if(!root) return;

  const stats=getSubjectStats();
  const stat=
    stats[s.title.replace(/^[^ ]+ /,"")] ||
    stats[key] ||
    null;

  root.innerHTML=
    '<div class="subject360-head">'+
      '<div><h3>'+esc(s.title)+'</h3>'+
      '<p>'+s.marks+' marks coverage layer inside 720 Approach.</p></div>'+
      '<span class="subject360-marks">'+s.marks+'</span>'+
    '</div>'+
    '<div class="subject360-grid">'+
      s.focus.map(function(x){
        return '<div class="subject360-item">✓ '+esc(x)+'</div>';
      }).join("")+
    '</div>'+
    '<div class="subject360-evidence">'+
      (stat && stat.accuracy!=null
        ? 'Recorded accuracy: <b>'+esc(stat.accuracy)+'%</b>'
        : 'No subject-specific evidence yet — revision layer will use existing CBT evidence as it becomes available.')+
    '</div>'+
    '<div class="subject360-actions">'+
      '<a href="question-bank.html">📚 Practice</a>'+
      '<a href="mistake.html">❌ Mistakes</a>'+
      '<a href="retry.html">🔁 Retry / Mastery</a>'+
    '</div>';
}

function boot(){
  const panel=document.getElementById("panel-720");
  if(!panel || document.getElementById("subject360RevisionV1")) return;

  const box=document.createElement("section");
  box.id="subject360RevisionV1";
  box.className="subject360-card";

  box.innerHTML=
    '<div class="subject360-title">'+
      '<div><h2>🔄 Subject 360° Revision</h2>'+
      '<p>Complete revision and reinforcement layer inside the single 720 Approach feature.</p></div>'+
      '<span>720</span>'+
    '</div>'+
    '<div class="subject360-tabs">'+
      '<button data-subject="biology" class="active">🧬 Biology 360°</button>'+
      '<button data-subject="chemistry">🧪 Chemistry 360°</button>'+
      '<button data-subject="physics">⚡ Physics 360°</button>'+
    '</div>'+
    '<div id="subject360Content"></div>';

  const target=document.getElementById("target720");
  panel.insertBefore(box,target || null);

  box.querySelectorAll("[data-subject]").forEach(function(btn){
    btn.addEventListener("click",function(){
      box.querySelectorAll("[data-subject]")
        .forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      render(btn.dataset.subject);
    });
  });

  render("biology");
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",boot,{once:true});
}else{
  boot();
}

window.CBTSubject360V1={
  version:"1.0.0",
  subjects:SUBJECTS,
  render:render
};

})();
