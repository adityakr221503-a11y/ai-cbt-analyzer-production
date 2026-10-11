(function () {
  "use strict";

  const KEY = "rankforgePremiumStateV1";

  const DEFAULTS = {
    dailyTarget: 30,
    completedToday: 0,
    focusMode: false,
    notes: [],
    revision: [],
    achievements: [],
    planner: [],
    lastActive: Date.now()
  };

  function load() {
    try {
      return Object.assign({}, DEFAULTS,
        JSON.parse(localStorage.getItem(KEY) || "{}")
      );
    } catch (_) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function ensureDailyReset(state) {
    const k = todayKey();
    if (state.day !== k) {
      state.day = k;
      state.completedToday = 0;
      state.lastActive = Date.now();
      save(state);
    }
    return state;
  }

  function countHistory() {
    try {
      const h = JSON.parse(localStorage.getItem("cbtHistory") || "[]");
      return Array.isArray(h) ? h.length : 0;
    } catch (_) {
      return 0;
    }
  }

  function countMistakes() {
    const keys = [
      "cbtMasteryV2",
      "rankforgeMistakesV1",
      "rankforgeFreshMistakeStateV1"
    ];

    for (const key of keys) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        if (Array.isArray(value)) return value.length;
        if (value && Array.isArray(value.active)) return value.active.length;
        if (value && Array.isArray(value.mistakes)) return value.mistakes.length;
      } catch (_) {}
    }
    return 0;
  }

  function injectStyles() {
    if (document.getElementById("rankforgePremiumStyles")) return;

    const style = document.createElement("style");
    style.id = "rankforgePremiumStyles";
    style.textContent = `
      #rankforgePremiumPanel{
        margin:18px 0;
        padding:18px;
        border:1px solid rgba(0,210,255,.22);
        border-radius:22px;
        background:linear-gradient(145deg,#07111f,#0b1628);
        color:#fff;
        box-shadow:0 14px 38px rgba(0,0,0,.18);
      }
      #rankforgePremiumPanel *{box-sizing:border-box}
      .rf-brand{text-align:center}
      .rf-brand-name{
        font-size:22px;
        font-weight:950;
        letter-spacing:2px;
      }
      .rf-ai{
        display:inline-block;
        margin:7px 0;
        padding:4px 10px;
        border:1px solid rgba(0,220,255,.65);
        border-radius:999px;
        color:#7defff;
        font-size:10px;
        font-weight:850;
        letter-spacing:1.3px;
      }
      .rf-tagline{
        font-size:11px;
        letter-spacing:1.4px;
        opacity:.7;
      }
      .rf-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:9px;
        margin-top:15px;
      }
      .rf-card{
        padding:12px;
        border-radius:15px;
        background:rgba(255,255,255,.055);
        border:1px solid rgba(255,255,255,.055);
        cursor:pointer;
        transition:transform .18s ease,background .18s ease;
      }
      .rf-card:active{transform:scale(.98)}
      .rf-card:hover{background:rgba(255,255,255,.085)}
      .rf-card-title{font-weight:800;font-size:13px}
      .rf-card-sub{font-size:11px;opacity:.65;margin-top:4px}
      .rf-progress{
        height:7px;
        margin-top:8px;
        border-radius:99px;
        background:rgba(255,255,255,.1);
        overflow:hidden;
      }
      .rf-progress>i{
        display:block;
        height:100%;
        width:0;
        border-radius:99px;
        background:linear-gradient(90deg,#00d9ff,#5a8cff);
      }
      .rf-stat{
        display:flex;
        justify-content:space-between;
        gap:10px;
        margin-top:14px;
        font-size:11px;
        opacity:.75;
      }
      .rf-credit{
        margin-top:15px;
        text-align:center;
        font-size:11px;
        opacity:.55;
      }
      .rf-focus{
        position:fixed;
        inset:0;
        z-index:2147483000;
        background:#050b13;
        color:#fff;
        display:none;
        align-items:center;
        justify-content:center;
        text-align:center;
        padding:25px;
      }
      .rf-focus.active{display:flex}
      .rf-focus button{
        margin-top:18px;
        padding:11px 18px;
        border:0;
        border-radius:12px;
        background:#00cfff;
        color:#031018;
        font-weight:800;
      }
      @media(max-width:520px){
        .rf-grid{grid-template-columns:1fr 1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function go(target) {
    const el = document.querySelector(
      `[data-go="${target}"], [href="${target}"], a[href="./${target}"]`
    );

    if (el) {
      el.click();
      return true;
    }

    const map = {
      history: ["history.html", "analysis.html"],
      mistakes: ["mistake.html"],
      notes: ["study-vault.html", "study-vault/index.html"],
      lectures: ["rankforge-lecture-module/index.html"],
      cbt: ["cbt.html"],
      pdf: ["pdf-to-cbt.html"]
    };

    const candidates = map[target] || [];
    for (const file of candidates) {
      location.href = "./" + file;
      return true;
    }

    return false;
  }

  function openNotes() {
    const state = ensureDailyReset(load());
    const note = prompt("RankForge Personal Note:");
    if (!note || !note.trim()) return;

    state.notes.push({
      text: note.trim(),
      createdAt: Date.now()
    });

    save(state);
    alert("Note saved locally.");
  }

  function openPlanner() {
    const state = ensureDailyReset(load());
    const task = prompt("Add study task:");
    if (!task || !task.trim()) return;

    state.planner.push({
      text: task.trim(),
      date: todayKey(),
      done: false
    });

    save(state);
    alert("Study task added.");
  }

  function toggleFocus() {
    const state = ensureDailyReset(load());
    state.focusMode = !state.focusMode;
    save(state);

    const focus = document.getElementById("rfFocusMode");
    if (focus) focus.classList.toggle("active", state.focusMode);
  }

  function addAchievement(state) {
    const history = countHistory();

    if (history >= 1 && !state.achievements.includes("first-test")) {
      state.achievements.push("first-test");
    }

    if (history >= 10 && !state.achievements.includes("ten-tests")) {
      state.achievements.push("ten-tests");
    }

    save(state);
  }

  function createPanel() {
    if (document.getElementById("rankforgePremiumPanel")) return;

    const state = ensureDailyReset(load());
    addAchievement(state);

    const panel = document.createElement("section");
    panel.id = "rankforgePremiumPanel";
    panel.setAttribute("aria-label", "RankForge premium student tools");

    panel.innerHTML = `
      <div class="rf-brand">
        <div class="rf-brand-name">RANKFORGE</div>
        <div class="rf-ai">AI POWERED</div>
        <div class="rf-tagline">LEARN • PRACTICE • RISE</div>
      </div>

      <div class="rf-grid">
        <div class="rf-card" data-rf-action="daily">
          <div class="rf-card-title">🎯 Daily Target</div>
          <div class="rf-card-sub">
            ${state.completedToday}/${state.dailyTarget} completed
          </div>
          <div class="rf-progress">
            <i style="width:${Math.min(100,
              state.completedToday / Math.max(1,state.dailyTarget) * 100)}%"></i>
          </div>
        </div>

        <div class="rf-card" data-rf-action="mastery">
          <div class="rf-card-title">🧠 Concept Mastery</div>
          <div class="rf-card-sub">Topic-wise progress</div>
        </div>

        <div class="rf-card" data-rf-action="retry">
          <div class="rf-card-title">🔄 Retry Engine</div>
          <div class="rf-card-sub">${countMistakes()} mistake items</div>
        </div>

        <div class="rf-card" data-rf-action="timeline">
          <div class="rf-card-title">📈 Progress Timeline</div>
          <div class="rf-card-sub">${countHistory()} recorded tests</div>
        </div>

        <div class="rf-card" data-rf-action="revision">
          <div class="rf-card-title">📚 Smart Revision</div>
          <div class="rf-card-sub">Review due concepts</div>
        </div>

        <div class="rf-card" data-rf-action="focus">
          <div class="rf-card-title">⏱️ Focus Mode</div>
          <div class="rf-card-sub">Distraction-free study</div>
        </div>

        <div class="rf-card" data-rf-action="notes">
          <div class="rf-card-title">📝 Personal Notes</div>
          <div class="rf-card-sub">${state.notes.length} saved notes</div>
        </div>

        <div class="rf-card" data-rf-action="planner">
          <div class="rf-card-title">🗓️ Study Planner</div>
          <div class="rf-card-sub">${state.planner.length} planned tasks</div>
        </div>

        <div class="rf-card" data-rf-action="mentor">
          <div class="rf-card-title">🤖 AI Mentor</div>
          <div class="rf-card-sub">Personalized guidance</div>
        </div>

        <div class="rf-card" data-rf-action="analysis">
          <div class="rf-card-title">📊 Smart Analysis</div>
          <div class="rf-card-sub">Speed • accuracy • mistakes</div>
        </div>

        <div class="rf-card" data-rf-action="achievements">
          <div class="rf-card-title">🏆 Achievements</div>
          <div class="rf-card-sub">${state.achievements.length} unlocked</div>
        </div>

        <div class="rf-card" data-rf-action="privacy">
          <div class="rf-card-title">🔒 Privacy Center</div>
          <div class="rf-card-sub">Account & data controls</div>
        </div>
      </div>

      <div class="rf-stat">
        <span>Offline-first student workspace</span>
        <span>v1</span>
      </div>

      <div class="rf-credit">
        Designed &amp; Developed by Aditya Kumar
      </div>
    `;

    const host =
      document.querySelector("main") ||
      document.querySelector(".app") ||
      document.querySelector("#app") ||
      document.body;

    host.appendChild(panel);

    panel.addEventListener("click", function (event) {
      const card = event.target.closest("[data-rf-action]");
      if (!card) return;

      const action = card.dataset.rfAction;

      if (action === "daily") {
        const s = ensureDailyReset(load());
        const value = prompt("Daily target questions:", String(s.dailyTarget));
        if (value && Number(value) > 0) {
          s.dailyTarget = Math.min(500, Math.floor(Number(value)));
          save(s);
          location.reload();
        }
        return;
      }

      if (action === "notes") return openNotes();
      if (action === "planner") return openPlanner();
      if (action === "focus") return toggleFocus();

      const routes = {
        retry: "mistakes",
        timeline: "history",
        mastery: "analysis",
        analysis: "analysis",
        mentor: "lectures",
        revision: "history"
      };

      if (routes[action]) {
        if (!go(routes[action])) {
          alert("This existing RankForge module is not available on this page yet.");
        }
        return;
      }

      if (action === "privacy") {
        alert(
          "Privacy Center\\n\\n" +
          "Your local RankForge premium preferences are stored in your browser/device.\\n" +
          "Server authentication and owner authorization remain controlled by the secure backend."
        );
        return;
      }

      if (action === "achievements") {
        const s = ensureDailyReset(load());
        alert(
          "RankForge Achievements\\n\\n" +
          "Unlocked: " + s.achievements.length + "\\n" +
          "Tests recorded: " + countHistory()
        );
      }
    });
  }

  function createFocus() {
    if (document.getElementById("rfFocusMode")) return;

    const focus = document.createElement("div");
    focus.id = "rfFocusMode";
    focus.className = "rf-focus";
    focus.innerHTML = `
      <div>
        <div style="font-size:28px;font-weight:900">RANKFORGE</div>
        <div style="margin-top:8px;opacity:.7">FOCUS MODE</div>
        <div style="margin-top:18px;opacity:.6;font-size:13px">
          Stay focused on your current study task.
        </div>
        <button type="button" id="rfExitFocus">Exit Focus Mode</button>
      </div>
    `;

    document.body.appendChild(focus);

    document.getElementById("rfExitFocus").onclick = function () {
      const s = ensureDailyReset(load());
      s.focusMode = false;
      save(s);
      focus.classList.remove("active");
    };

    const state = ensureDailyReset(load());
    if (state.focusMode) focus.classList.add("active");
  }

  function boot() {
    injectStyles();
    createFocus();
    createPanel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.RankForgePremium = {
    getState: load,
    saveState: save,
    addDailyProgress(amount) {
      const state = ensureDailyReset(load());
      state.completedToday = Math.max(
        0,
        state.completedToday + (Number(amount) || 0)
      );
      state.lastActive = Date.now();
      addAchievement(state);
      save(state);
    },
    toggleFocus
  };
})();
