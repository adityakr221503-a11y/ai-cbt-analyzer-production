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
