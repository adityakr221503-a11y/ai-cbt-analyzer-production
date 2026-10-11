(function () {
  "use strict";

  const STYLE_ID = "pcb-nichod-app-ui-style";
  const ROOT_ID = "pcbNichodApp";

  function qs(id) {
    return document.getElementById(id);
  }

  function getJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (_) {
      return null;
    }
  }

  function count(key) {
    const x = getJSON(key);

    if (Array.isArray(x)) return x.length;
    if (x && Array.isArray(x.questions)) return x.questions.length;
    if (x && Array.isArray(x.items)) return x.items.length;

    return 0;
  }

  function activeTest() {
    const x = getJSON("CBT_ACTIVE_TEST");

    return x && Array.isArray(x.questions)
      ? x
      : null;
  }

  function status() {
    const active = activeTest();

    return {
      pdf: count("pdfCbtQuestions"),
      ranker: count("rbSelectedQuestions"),
      active: active
        ? active.questions.length
        : 0,
      source:
        localStorage.getItem(
          "CBT_ACTIVE_SOURCE"
        ) || "None"
    };
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID))
      return;

    const style =
      document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
#${ROOT_ID}{
  margin:18px auto;
  max-width:1100px;
  font-family:inherit;
}

.pcb-nichod-card{
  border:1px solid rgba(100,110,130,.18);
  border-radius:18px;
  padding:20px;
  background:var(--card,#fff);
  box-shadow:0 8px 28px rgba(0,0,0,.06);
}

.pcb-nichod-title{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  margin-bottom:18px;
}

.pcb-nichod-title h2{
  margin:0;
  font-size:22px;
}

.pcb-nichod-title small{
  opacity:.65;
}

.pcb-nichod-grid{
  display:grid;
  grid-template-columns:
    repeat(auto-fit,minmax(145px,1fr));
  gap:12px;
  margin-bottom:18px;
}

.pcb-nichod-stat{
  padding:14px;
  border-radius:14px;
  background:rgba(100,120,150,.07);
}

.pcb-nichod-stat strong{
  display:block;
  font-size:24px;
}

.pcb-nichod-stat span{
  font-size:12px;
  opacity:.7;
}

.pcb-nichod-actions{
  display:grid;
  grid-template-columns:
    repeat(auto-fit,minmax(180px,1fr));
  gap:10px;
}

.pcb-nichod-actions button{
  border:0;
  border-radius:12px;
  padding:13px;
  cursor:pointer;
  font-weight:700;
  background:#172033;
  color:#fff;
}

.pcb-nichod-actions button.secondary{
  background:rgba(100,110,130,.12);
  color:inherit;
}

.pcb-nichod-flow{
  margin-top:18px;
  padding:14px;
  border-radius:14px;
  background:rgba(100,120,150,.06);
  font-size:13px;
  line-height:1.7;
}

.pcb-nichod-ok{
  font-weight:700;
}

@media(max-width:600px){
  .pcb-nichod-card{
    padding:15px;
  }
}
`;

    document.head.appendChild(style);
  }

  function navigate(path) {
    window.location.href = path;
  }

  function render() {
    if (!document.body) return;

    injectStyle();

    let root = qs(ROOT_ID);

    if (!root) {
      root =
        document.createElement("section");

      root.id = ROOT_ID;

      const main =
        document.querySelector("main") ||
        document.body;

      main.insertBefore(
        root,
        main.firstChild
      );
    }

    const s = status();

    root.innerHTML = `
      <div class="pcb-nichod-card">

        <div class="pcb-nichod-title">
          <div>
            <h2>🧠 PCB NICHOD</h2>
            <small>
              Unified adaptive intelligence
            </small>
          </div>

          <button
            id="pcbNichodRefresh"
            class="secondary">
            Refresh
          </button>
        </div>

        <div class="pcb-nichod-grid">

          <div class="pcb-nichod-stat">
            <strong>${s.pdf}</strong>
            <span>PDF Questions</span>
          </div>

          <div class="pcb-nichod-stat">
            <strong>${s.ranker}</strong>
            <span>Ranker Questions</span>
          </div>

          <div class="pcb-nichod-stat">
            <strong>${s.active}</strong>
            <span>Active CBT</span>
          </div>

          <div class="pcb-nichod-stat">
            <strong class="pcb-nichod-ok">
              ${s.source !== "None" ? "●" : "○"}
            </strong>
            <span>${s.source}</span>
          </div>

        </div>

        <div class="pcb-nichod-actions">

          <button id="pcbNichodPDF">
            📄 PDF → CBT
          </button>

          <button id="pcbNichodRanker">
            🏆 Ranker Test
          </button>

          <button id="pcbNichodBank">
            🧠 Ranker Question Bank
          </button>

          <button id="pcbNichodCBT">
            ▶ Open CBT
          </button>

          <button id="pcbNichodHistory"
                  class="secondary">
            📊 Test History
          </button>

          <button id="pcbNichodMistakes"
                  class="secondary">
            ❌ Mistake Bank
          </button>

        </div>

        <div class="pcb-nichod-flow">
          <strong>NICHOD Flow</strong><br>
          PDF → New Test → CBT → Analysis → Mistake Bank
          → Mentor<br>
          Ranker Test → CBT → Performance → Mentor<br>
          Ranker Question Bank → NICHOD Selection → CBT
        </div>

      </div>
    `;

    qs("pcbNichodPDF").onclick =
      () => navigate(
        "pdf-to-cbt.v317.html"
      );

    qs("pcbNichodRanker").onclick =
      () => navigate(
        "rankers-test-series.html"
      );

    qs("pcbNichodBank").onclick =
      () => navigate(
        "question-bank.html"
      );

    qs("pcbNichodCBT").onclick =
      () => navigate("cbt.html");

    qs("pcbNichodHistory").onclick =
      () => navigate("history.html");

    qs("pcbNichodMistakes").onclick =
      () => navigate("mistake.html");

    qs("pcbNichodRefresh").onclick =
      render;
  }

  function boot() {
    render();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  } else {
    boot();
  }

  window.PCBNICHODAppUI = {
    refresh: render,
    status
  };

})();
