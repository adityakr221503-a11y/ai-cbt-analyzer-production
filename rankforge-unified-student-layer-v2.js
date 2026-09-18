/*
 RANKFORGE UNIFIED STUDENT INTELLIGENCE V2
 Additive integration only.
 Does NOT modify PDF parser/engine.
 Reuses existing RankForge/CBT/Ranker/Mistake/Retry storage.
*/
(function () {
  "use strict";

  const RF = {
    version: "2.0",
    keys: {
      history: ["cbtHistory", "rankBoosterAttemptHistory", "rankerTestAttempts"],
      performance: ["rankerTestPerformance", "topper_test_pro_last_result"],
      mistakes: ["rankforgeMistakesV1", "rankforgeMistakes", "cbtMasteryV2"],
      retry: ["rankforgeRetestQueueV1", "retryHistory", "cbtAnalyzer.retryQueue", "cbtRetryQuestion"],
      next: ["rankforgeNextActionV1", "rankforgeNextActions"],
      bookmarks: ["rankforgeBookmarks"],
      pool: ["rankForgeMasterQuestionPoolV2", "rankForgeAIQuestionBankV1", "rankBoosterQuestionBankV1"]
    },

    read(key) {
      try {
        const v = localStorage.getItem(key);
        if (!v) return null;
        return JSON.parse(v);
      } catch (_) {
        return null;
      }
    },

    first(keys) {
      for (const k of keys) {
        const v = RF.read(k);
        if (v !== null) return v;
      }
      return null;
    },

    arr(keys) {
      const v = RF.first(keys);
      if (Array.isArray(v)) return v;
      if (v && Array.isArray(v.items)) return v.items;
      if (v && Array.isArray(v.questions)) return v.questions;
      return [];
    },

    num(x, fallback = 0) {
      const n = Number(x);
      return Number.isFinite(n) ? n : fallback;
    },

    text(x) {
      return String(x == null ? "" : x).trim();
    },

    normalizeAttempt(a) {
      if (!a || typeof a !== "object") return null;

      const total = RF.num(
        a.total ??
        a.totalQuestions ??
        a.questionCount ??
        a.questions?.length,
        0
      );

      const correct = RF.num(
        a.correct ??
        a.correctAnswers ??
        a.right ??
        a.scoreCorrect,
        0
      );

      const attempted = RF.num(
        a.attempted ??
        a.attemptedQuestions,
        correct + RF.num(a.wrong ?? a.incorrect, 0)
      );

      const wrong = RF.num(
        a.wrong ??
        a.incorrect ??
        a.incorrectAnswers,
        Math.max(0, attempted - correct)
      );

      const marks = RF.num(
        a.marks ??
        a.score ??
        a.totalMarks ??
        a.obtainedMarks,
        0
      );

      const accuracy =
        a.accuracy != null
          ? RF.num(a.accuracy)
          : attempted
            ? (correct / attempted) * 100
            : 0;

      const time = RF.num(
        a.timeTaken ??
        a.timeSpent ??
        a.duration ??
        a.elapsedSeconds,
        0
      );

      return {
        id: RF.text(a.id || a.testId || a.attemptId || Date.now()),
        title: RF.text(a.title || a.testName || a.name || "Test"),
        total,
        attempted,
        correct,
        wrong,
        marks,
        accuracy,
        time,
        date: a.date || a.createdAt || a.updatedAt || new Date().toISOString(),
        subject: RF.text(a.subject || ""),
        chapter: RF.text(a.chapter || ""),
        raw: a
      };
    },

    getAttempts() {
      const all = [];
      for (const key of RF.keys.history) {
        const data = RF.read(key);
        if (Array.isArray(data)) all.push(...data);
        else if (data && Array.isArray(data.attempts)) all.push(...data.attempts);
        else if (data && Array.isArray(data.history)) all.push(...data.history);
      }

      return all
        .map(RF.normalizeAttempt)
        .filter(Boolean)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getMistakes() {
      const out = [];
      for (const key of RF.keys.mistakes) {
        const data = RF.read(key);
        if (Array.isArray(data)) out.push(...data);
        else if (data && Array.isArray(data.mistakes)) out.push(...data.mistakes);
        else if (data && Array.isArray(data.items)) out.push(...data.items);
      }
      return out;
    },

    getRetry() {
      const out = [];
      for (const key of RF.keys.retry) {
        const data = RF.read(key);
        if (Array.isArray(data)) out.push(...data);
        else if (data && Array.isArray(data.items)) out.push(...data.items);
        else if (data && Array.isArray(data.queue)) out.push(...data.queue);
      }
      return out;
    },

    getBookmarks() {
      const out = [];
      for (const key of RF.keys.bookmarks) {
        const data = RF.read(key);
        if (Array.isArray(data)) out.push(...data);
        else if (data && Array.isArray(data.items)) out.push(...data.items);
      }
      return out;
    },

    topicOf(x) {
      return RF.text(
        x?.topic ||
        x?.chapter ||
        x?.subject ||
        x?.unit ||
        x?.concept ||
        "General"
      ) || "General";
    },

    mistakeReason(x) {
      return RF.text(
        x?.reason ||
        x?.mistakeReason ||
        x?.type ||
        x?.category ||
        "Concept Gap"
      ) || "Concept Gap";
    },

    analyze() {
      const attempts = RF.getAttempts();
      const mistakes = RF.getMistakes();
      const retry = RF.getRetry();
      const bookmarks = RF.getBookmarks();

      let totalQ = 0;
      let attempted = 0;
      let correct = 0;
      let marks = 0;
      let time = 0;

      attempts.forEach(a => {
        totalQ += a.total;
        attempted += a.attempted;
        correct += a.correct;
        marks += a.marks;
        time += a.time;
      });

      const accuracy = attempted ? correct / attempted * 100 : 0;

      const topicMap = {};
      const reasonMap = {};

      mistakes.forEach(m => {
        const topic = RF.topicOf(m);
        const reason = RF.mistakeReason(m);

        topicMap[topic] = (topicMap[topic] || 0) + 1;
        reasonMap[reason] = (reasonMap[reason] || 0) + 1;
      });

      const weakTopics = Object.entries(topicMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([topic, count]) => ({ topic, mistakes: count }));

      const reasons = Object.entries(reasonMap)
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => ({ reason, count }));

      const recent = attempts.slice(0, 5);
      const last = recent[0] || null;
      const previous = recent[1] || null;

      let trend = "No trend yet";
      if (last && previous) {
        if (last.accuracy > previous.accuracy + 3) trend = "Improving";
        else if (last.accuracy < previous.accuracy - 3) trend = "Needs attention";
        else trend = "Stable";
      }

      const actions = [];

      if (weakTopics.length) {
        actions.push({
          type: "WEAK_TOPIC",
          priority: 1,
          title: "Repair your weakest topic",
          detail: `${weakTopics[0].topic} has ${weakTopics[0].mistakes} recorded mistake(s).`
        });
      }

      if (retry.length) {
        actions.push({
          type: "RETRY",
          priority: 2,
          title: "Clear your retry queue",
          detail: `${retry.length} question(s) are waiting for another attempt.`
        });
      }

      if (bookmarks.length) {
        actions.push({
          type: "BOOKMARK",
          priority: 3,
          title: "Revise bookmarked questions",
          detail: `${bookmarks.length} bookmarked item(s) are available.`
        });
      }

      if (accuracy && accuracy < 70) {
        actions.push({
          type: "ACCURACY",
          priority: 2,
          title: "Accuracy repair session",
          detail: "Focus on solved questions and mistake reasons before increasing speed."
        });
      } else if (accuracy >= 85) {
        actions.push({
          type: "SPEED",
          priority: 3,
          title: "Speed + precision session",
          detail: "Your recorded accuracy is strong; practise timed application."
        });
      }

      if (!actions.length) {
        actions.push({
          type: "START",
          priority: 1,
          title: "Start your first tracked test",
          detail: "Your next attempt will unlock personalised recommendations."
        });
      }

      actions.sort((a, b) => a.priority - b.priority);

      return {
        attempts,
        mistakes,
        retry,
        bookmarks,
        totalTests: attempts.length,
        totalQ,
        attempted,
        correct,
        marks,
        accuracy,
        weakTopics,
        reasons,
        trend,
        nextActions: actions.slice(0, 5)
      };
    },

    saveSnapshot(data) {
      try {
        localStorage.setItem(
          "rankforgeStudentIntelligenceV2",
          JSON.stringify({
            version: RF.version,
            updatedAt: new Date().toISOString(),
            totalTests: data.totalTests,
            accuracy: data.accuracy,
            weakTopics: data.weakTopics,
            reasons: data.reasons,
            trend: data.trend,
            nextActions: data.nextActions
          })
        );
      } catch (_) {}
    },

    css() {
      if (document.getElementById("rf-unified-style-v2")) return;

      const s = document.createElement("style");
      s.id = "rf-unified-style-v2";
      s.textContent = `
        .rf-v2-panel{
          margin:18px 0;
          padding:18px;
          border-radius:18px;
          border:1px solid rgba(120,130,160,.22);
          background:linear-gradient(145deg,rgba(20,25,40,.96),rgba(32,38,58,.96));
          color:#fff;
          font-family:system-ui,-apple-system,Segoe UI,sans-serif;
          box-shadow:0 10px 35px rgba(0,0,0,.12);
        }
        .rf-v2-head{
          display:flex;
          justify-content:space-between;
          gap:12px;
          align-items:center;
          margin-bottom:14px;
        }
        .rf-v2-title{font-size:20px;font-weight:800}
        .rf-v2-sub{font-size:12px;opacity:.68}
        .rf-v2-grid{
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:10px;
          margin:12px 0;
        }
        .rf-v2-card{
          padding:13px;
          border-radius:14px;
          background:rgba(255,255,255,.07);
          border:1px solid rgba(255,255,255,.08);
        }
        .rf-v2-num{font-size:22px;font-weight:800}
        .rf-v2-label{font-size:11px;opacity:.7;margin-top:3px}
        .rf-v2-list{display:grid;gap:8px;margin-top:12px}
        .rf-v2-item{
          padding:11px 12px;
          border-radius:12px;
          background:rgba(255,255,255,.055);
        }
        .rf-v2-item strong{display:block;font-size:13px}
        .rf-v2-item span{display:block;font-size:11px;opacity:.7;margin-top:3px}
        .rf-v2-actions{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-top:14px;
        }
        .rf-v2-btn{
          border:0;
          border-radius:10px;
          padding:9px 12px;
          cursor:pointer;
          font-weight:700;
          background:#fff;
          color:#151923;
        }
        @media(max-width:700px){
          .rf-v2-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        }
      `;
      document.head.appendChild(s);
    },

    pageRoot() {
      return document.querySelector("main") ||
             document.querySelector(".container") ||
             document.querySelector(".app") ||
             document.body;
    },

    render() {
      if (document.getElementById("rf-unified-student-v2")) return;

      RF.css();

      const d = RF.analyze();
      RF.saveSnapshot(d);

      const panel = document.createElement("section");
      panel.id = "rf-unified-student-v2";
      panel.className = "rf-v2-panel";

      const weak = d.weakTopics.length
        ? d.weakTopics.map(x =>
            `<div class="rf-v2-item"><strong>${RF.esc(x.topic)}</strong><span>${x.mistakes} mistake(s) recorded</span></div>`
          ).join("")
        : `<div class="rf-v2-item"><strong>No weak-topic data yet</strong><span>Complete a tracked test to build your learning profile.</span></div>`;

      const actions = d.nextActions.map((x, i) =>
        `<div class="rf-v2-item"><strong>${i + 1}. ${RF.esc(x.title)}</strong><span>${RF.esc(x.detail)}</span></div>`
      ).join("");

      panel.innerHTML = `
        <div class="rf-v2-head">
          <div>
            <div class="rf-v2-title">RankForge Intelligence</div>
            <div class="rf-v2-sub">Student-first learning loop • ${RF.esc(d.trend)}</div>
          </div>
        </div>

        <div class="rf-v2-grid">
          <div class="rf-v2-card">
            <div class="rf-v2-num">${d.totalTests}</div>
            <div class="rf-v2-label">Tests</div>
          </div>
          <div class="rf-v2-card">
            <div class="rf-v2-num">${d.accuracy.toFixed(1)}%</div>
            <div class="rf-v2-label">Accuracy</div>
          </div>
          <div class="rf-v2-card">
            <div class="rf-v2-num">${d.mistakes.length}</div>
            <div class="rf-v2-label">Mistakes</div>
          </div>
          <div class="rf-v2-card">
            <div class="rf-v2-num">${d.retry.length}</div>
            <div class="rf-v2-label">Retry queue</div>
          </div>
        </div>

        <div class="rf-v2-sub">NEXT BEST ACTION</div>
        <div class="rf-v2-list">${actions}</div>

        <div class="rf-v2-sub" style="margin-top:16px">WEAK TOPICS</div>
        <div class="rf-v2-list">${weak}</div>

        <div class="rf-v2-actions">
          <button class="rf-v2-btn" data-rf-action="refresh">Refresh intelligence</button>
          <button class="rf-v2-btn" data-rf-action="mistakes">Open Mistake Book</button>
          <button class="rf-v2-btn" data-rf-action="retry">Open Retry</button>
        </div>
      `;

      panel.addEventListener("click", e => {
        const action = e.target?.dataset?.rfAction;
        if (!action) return;

        if (action === "refresh") {
          panel.remove();
          RF.render();
        }

        if (action === "mistakes") {
          location.href = "./mistake.html";
        }

        if (action === "retry") {
          location.href = "./retry.html";
        }
      });

      RF.pageRoot().prepend(panel);
    },

    esc(x) {
      return RF.text(x)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },

    expose() {
      window.RankForgeStudentIntelligenceV2 = {
        analyze: RF.analyze,
        refresh: RF.render,
        version: RF.version
      };
    },

    init() {
      RF.expose();

      /*
       Never inject this panel into PDF converter pages.
       PDF engine remains completely separate.
      */
      const file = location.pathname.split("/").pop().toLowerCase();
      if (file === "pdf-to-cbt.html" || file.includes("pdf-cbt")) return;

      const run = () => RF.render();

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, { once: true });
      } else {
        run();
      }
    }
  };

  RF.init();
})();
