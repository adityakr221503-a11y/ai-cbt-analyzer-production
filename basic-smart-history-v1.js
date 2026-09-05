(function(){
"use strict";

const HISTORY_KEY="cbtHistory";
const SESSION_KEY="cbtTestSessions";
const PANEL_ID="basicSmartHistoryV1";

function read(key){
  try{
    const x=JSON.parse(localStorage.getItem(key)||"null");
    return x;
  }catch(e){return null;}
}

function n(v){
  const x=Number(v);
  return Number.isFinite(x)?x:0;
}

function esc(v){
  return String(v==null?"":v)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function getHistory(){
  const x=read(HISTORY_KEY);
  return Array.isArray(x)?x:[];
}

function getSessions(){
  const x=read(SESSION_KEY);
  return Array.isArray(x)?x:[];
}

function normalize(t,i){
  const correct=n(t.correct);
  const wrong=n(t.incorrect??t.wrong);
  const skipped=n(t.skipped);

  let total=Array.isArray(t.questions)
    ?t.questions.length
    :n(t.totalQuestions)||correct+wrong+skipped;

  const attempted=correct+wrong;

  return {
    raw:t,
    index:i,
    score:n(t.score),
    correct,
    wrong,
    skipped,
    total,
    attempted,
    accuracy:n(t.accuracy)||(total?(correct/total)*100:0),
    date:t.date||t.submittedAt||t.completedAt||"Unknown date",
    source:t.source||t.testSource||t.name||"CBT",
    subject:t.subject||t.testSubject||"Mixed",
    duration:n(t.durationSeconds),
    speed:n(t.speed)
  };
}

function data(){
  return getHistory().map(normalize);
}

function render(){
  const old=document.getElementById(PANEL_ID);
  if(old)old.remove();

  const list=data();

  const panel=document.createElement("section");
  panel.id=PANEL_ID;
  panel.className="card";

  const avg=list.length
    ?Math.round(list.reduce((a,b)=>a+b.score,0)/list.length)
    :0;

  const best=list.length
    ?Math.max(...list.map(x=>x.score))
    :0;

  const avgAcc=list.length
    ?Math.round(list.reduce((a,b)=>a+b.accuracy,0)/list.length*10)/10
    :0;

  const last5=list.slice(-5);

  const last5Avg=last5.length
    ?Math.round(last5.reduce((a,b)=>a+b.score,0)/last5.length)
    :0;

  const subject={};

  list.forEach(t=>{
    const s=t.subject||"Mixed";

    if(!subject[s])
      subject[s]={correct:0,total:0,tests:0};

    subject[s].correct+=t.correct;
    subject[s].total+=t.total;
    subject[s].tests++;
  });

  const subjectRows=Object.keys(subject).map(s=>{
    const x=subject[s];
    return `
      <div class="smart-subject-row-v1">
        <div>
          <b>${esc(s)}</b>
          <small>${x.tests} test${x.tests===1?"":"s"}</small>
        </div>
        <strong>${x.total?Math.round(x.correct/x.total*1000)/10:0}%</strong>
      </div>
    `;
  }).join("");

  panel.innerHTML=`
    <div>
      <h2 style="margin:0">🧠 Smart Test History</h2>
      <p style="margin:5px 0;color:#64748b">
        Complete CBT performance evidence
      </p>
    </div>

    <div class="smart-history-stats-v1">
      <div><strong>${list.length}</strong><span>Total Tests</span></div>
      <div><strong>${best}</strong><span>Best Score</span></div>
      <div><strong>${avg}</strong><span>Average Score</span></div>
      <div><strong>${avgAcc}%</strong><span>Avg Accuracy</span></div>
      <div><strong>${last5Avg}</strong><span>Last 5 Avg</span></div>
    </div>

    <div class="smart-history-tools-v1">
      <input id="smartHistorySearchV1"
        type="search"
        placeholder="Search test, subject or source…">

      <select id="smartHistoryFilterV1">
        <option value="all">All tests</option>
        <option value="high">Accuracy ≥ 80%</option>
        <option value="low">Accuracy &lt; 60%</option>
        <option value="skipped">Skipped questions</option>
        <option value="attempted">Attempted tests</option>
      </select>

      <button id="smartHistoryExportV1" type="button">
        ⬇️ Export History
      </button>
    </div>

    <div class="smart-history-insights-v1">
      <div>
        <b>📈 Recent Trend</b>
        <span>
          ${last5.length
            ?last5.map(x=>x.score).join(" → ")
            :"No attempts yet"}
        </span>
      </div>

      <div>
        <b>🎯 Focus</b>
        <span>
          ${list.length
            ?"Use low-accuracy tests for targeted revision."
            :"Complete a CBT first."}
        </span>
      </div>

      <div>
        <b>🔁 Recovery</b>
        <span>
          Retry + Mistake Bank remain connected.
        </span>
      </div>
    </div>

    <div class="smart-history-subject-v1">
      <h3>📚 Subject Snapshot</h3>
      ${subjectRows||`
        <div class="smart-empty-v1">
          Subject performance will appear after tests.
        </div>
      `}
    </div>

    <div id="smartHistoryListV1">
      <h3>🗂️ Test Evidence</h3>
    </div>
  `;

  const historySection=
    document.getElementById("history")?.closest(".card");

  if(historySection&&historySection.parentNode){
    historySection.parentNode.insertBefore(
      panel,
      historySection.nextSibling
    );
  }else{
    (document.querySelector(".container")||document.body)
      .appendChild(panel);
  }

  renderList(list);

  document
    .getElementById("smartHistorySearchV1")
    ?.addEventListener("input",()=>renderList(list));

  document
    .getElementById("smartHistoryFilterV1")
    ?.addEventListener("change",()=>renderList(list));

  document
    .getElementById("smartHistoryExportV1")
    ?.addEventListener("click",exportHistory);
}

function renderList(list){
  const el=document.getElementById("smartHistoryListV1");
  if(!el)return;

  const q=
    (document.getElementById("smartHistorySearchV1")
      ?.value||"").toLowerCase();

  const filter=
    document.getElementById("smartHistoryFilterV1")
      ?.value||"all";

  const filtered=list
    .filter(t=>{
      const text=[
        t.source,
        t.subject,
        t.date,
        "test "+(t.index+1)
      ].join(" ").toLowerCase();

      if(q&&!text.includes(q))return false;

      if(filter==="high"&&t.accuracy<80)return false;
      if(filter==="low"&&t.accuracy>=60)return false;
      if(filter==="skipped"&&t.skipped<=0)return false;
      if(filter==="attempted"&&t.attempted<=0)return false;

      return true;
    })
    .sort((a,b)=>b.index-a.index);

  el.innerHTML=`
    <h3>🗂️ Test Evidence</h3>

    ${
      filtered.length
      ?filtered.map(t=>`
        <a class="smart-history-item-v1"
           href="test-details.html?test=${encodeURIComponent(t.index)}">

          <div>
            <b>Test #${t.index+1}</b>
            <small>${esc(t.source)} • ${esc(t.date)}</small>
          </div>

          <div class="smart-history-score-v1">
            <strong>${t.score}</strong>
            <span>${Math.round(t.accuracy*10)/10}% accuracy</span>
          </div>

          <div class="smart-history-meta-v1">
            ✅ ${t.correct}
            &nbsp; ❌ ${t.wrong}
            &nbsp; ⏭️ ${t.skipped}
            &nbsp; 📚 ${t.total}
          </div>

        </a>
      `).join("")
      :`
        <div class="smart-empty-v1">
          No matching tests found.
        </div>
      `
    }
  `;
}

function exportHistory(){
  const payload={
    exportedAt:new Date().toISOString(),
    tests:getHistory(),
    sessions:getSessions()
  };

  const blob=new Blob(
    [JSON.stringify(payload,null,2)],
    {type:"application/json"}
  );

  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");

  a.href=url;
  a.download="cbt-analyzer-test-history.json";

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>{
    URL.revokeObjectURL(url);
  },1000);
}

const style=document.createElement("style");

style.textContent=`
.smart-history-stats-v1{
display:grid;
grid-template-columns:repeat(5,1fr);
gap:10px;
margin:15px 0;
}

.smart-history-stats-v1>div{
background:#f8fafc;
border:1px solid #e2e8f0;
border-radius:12px;
padding:13px;
text-align:center;
}

.smart-history-stats-v1 strong{
display:block;
font-size:21px;
}

.smart-history-stats-v1 span{
display:block;
color:#64748b;
font-size:11px;
margin-top:4px;
font-weight:700;
}

.smart-history-tools-v1{
display:grid;
grid-template-columns:2fr 1fr auto;
gap:9px;
margin:14px 0;
}

.smart-history-tools-v1 input,
.smart-history-tools-v1 select{
width:100%;
padding:11px;
border:1px solid #cbd5e1;
border-radius:10px;
background:#fff;
}

.smart-history-tools-v1 button{
padding:11px 14px;
border:0;
border-radius:10px;
background:#172033;
color:#fff;
font-weight:800;
}

.smart-history-insights-v1{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:10px;
margin:12px 0;
}

.smart-history-insights-v1>div{
background:#f8fafc;
border:1px solid #e2e8f0;
border-radius:12px;
padding:12px;
}

.smart-history-insights-v1 b{
display:block;
font-size:12px;
}

.smart-history-insights-v1 span{
display:block;
margin-top:6px;
font-size:13px;
color:#475569;
}

.smart-history-subject-v1{
margin-top:15px;
}

.smart-subject-row-v1{
display:flex;
justify-content:space-between;
align-items:center;
padding:10px 12px;
border:1px solid #e2e8f0;
border-radius:10px;
margin-top:7px;
background:#fff;
}

.smart-subject-row-v1 small{
display:block;
color:#64748b;
font-size:11px;
margin-top:2px;
}

.smart-history-item-v1{
display:grid;
grid-template-columns:1fr auto;
gap:5px 12px;
text-decoration:none;
color:#0f172a;
border:1px solid #e2e8f0;
border-radius:12px;
padding:12px;
margin-top:8px;
background:#fff;
}

.smart-history-item-v1:hover{
border-color:#6366f1;
background:#f8fafc;
}

.smart-history-item-v1 small{
display:block;
color:#64748b;
font-size:11px;
margin-top:3px;
}

.smart-history-score-v1{
text-align:right;
}

.smart-history-score-v1 strong{
display:block;
font-size:19px;
}

.smart-history-score-v1 span{
font-size:11px;
color:#64748b;
}

.smart-history-meta-v1{
grid-column:1/-1;
color:#64748b;
font-size:11px;
}

.smart-empty-v1{
text-align:center;
color:#64748b;
padding:18px;
background:#f8fafc;
border-radius:10px;
}

@media(max-width:800px){
.smart-history-stats-v1{
grid-template-columns:repeat(3,1fr);
}
.smart-history-tools-v1{
grid-template-columns:1fr 1fr;
}
.smart-history-tools-v1 button{
grid-column:1/-1;
}
.smart-history-insights-v1{
grid-template-columns:1fr;
}
}

@media(max-width:500px){
.smart-history-stats-v1{
grid-template-columns:1fr 1fr;
}
.smart-history-tools-v1{
grid-template-columns:1fr;
}
.smart-history-item-v1{
grid-template-columns:1fr;
}
.smart-history-score-v1{
text-align:left;
}
.smart-history-meta-v1{
grid-column:auto;
}
}
`;

document.head.appendChild(style);

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",render);
}else{
  render();
}

window.CBTSmartHistoryV1={
  render,
  exportHistory
};

})();
