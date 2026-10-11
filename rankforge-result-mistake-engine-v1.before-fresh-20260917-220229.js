(function () {
  "use strict";

  const HISTORY_KEY = "cbtHistory";
  const MISTAKE_KEY = "rankforgeMistakesV1";
  const MASTERY_KEY = "cbtMasteryV2";
  const RETRY_KEY = "retryHistory";
  const ACTIVE_RETRY_KEY = "rankforgeActiveRetryV1";

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function clean(v) {
    return String(v == null ? "" : v)
      .trim()
      .replace(/\s+/g, " ");
  }

  function questionText(q) {
    if (!q || typeof q !== "object") return "";
    return clean(
      q.question ||
      q.questionText ||
      q.question_text ||
      q.text ||
      q.stem ||
      ""
    );
  }

  function questionId(q, index) {
    if (!q || typeof q !== "object") return "q-" + index;

    return clean(
      q.id ||
      q.questionId ||
      q.question_id ||
      q.uid ||
      q._id ||
      ("q-" + index)
    );
  }

  function answerOf(q) {
    if (!q || typeof q !== "object") return "";

    return clean(
      q.userAnswer ??
      q.selectedAnswer ??
      q.selectedOption ??
      q.selectedIndex ??
      q.answerGiven ??
      q.response ??
      q.responseAnswer ??
      ""
    );
  }

  function correctOf(q) {
    if (!q || typeof q !== "object") return "";

    let v =
      q.correctAnswer ??
      q.correct ??
      q.answer ??
      q.correctOption ??
      q.correctIndex ??
      q.correctAnswerIndex ??
      "";

    if (typeof v === "number") return String(v);

    return clean(v);
  }

  function isUnanswered(q) {
    const status = clean(q && q.status).toLowerCase();

    if (
      status === "unanswered" ||
      status === "not attempted" ||
      status === "not_attempted" ||
      status === "skipped"
    ) {
      return true;
    }

    const a = answerOf(q);
    return !a;
  }

  function isCorrect(q) {
    const status = clean(q && q.status).toLowerCase();

    if (
      status === "correct" ||
      status === "right" ||
      status === "correct_answer"
    ) {
      return true;
    }

    if (
      status === "wrong" ||
      status === "incorrect" ||
      status === "unanswered"
    ) {
      return false;
    }

    const a = answerOf(q);
    const c = correctOf(q);

    if (!a || !c) return false;

    return normalizeAnswer(a) === normalizeAnswer(c);
  }

  function normalizeAnswer(v) {
    return clean(v)
      .toLowerCase()
      .replace(/^option\s*/i, "")
      .replace(/[.)]$/, "");
  }

  function metadata(q) {
    return [
      q && q.mistakeReason,
      q && q.reason,
      q && q.errorType,
      q && q.mistakeType,
      q && q.category,
      q && q.tags,
      q && q.topic,
      q && q.chapter,
      q && q.subject
    ]
      .flat()
      .map(clean)
      .join(" ")
      .toLowerCase();
  }

  function classify(q) {
    if (isUnanswered(q)) return "Unanswered";

    const explicit = clean(
      q && (
        q.mistakeReason ||
        q.errorType ||
        q.mistakeType ||
        q.reason
      )
    );

    if (explicit) {
      const x = explicit.toLowerCase();

      if (x.includes("calculation")) return "Calculation Error";
      if (x.includes("misread")) return "Misread";
      if (x.includes("guess")) return "Wrong Guess";
      if (x.includes("time")) return "Time Pressure";
      if (x.includes("concept")) return "Concept Gap";
    }

    const meta = metadata(q);

    if (
      meta.includes("calculation") ||
      meta.includes("numerical") ||
      meta.includes("arithmetic")
    ) {
      return "Calculation Error";
    }

    if (
      meta.includes("misread") ||
      meta.includes("misread question") ||
      meta.includes("reading error")
    ) {
      return "Misread";
    }

    if (
      meta.includes("guess") ||
      meta.includes("low confidence")
    ) {
      return "Wrong Guess";
    }

    if (
      meta.includes("time pressure") ||
      meta.includes("timepressure")
    ) {
      return "Time Pressure";
    }

    const time = Number(
      q && (
        q.timeSpent ??
        q.time_taken ??
        q.timeTaken ??
        q.secondsSpent ??
        0
      )
    );

    if (Number.isFinite(time) && time >= 120) {
      return "Time Pressure";
    }

    return "Concept Gap";
  }

  function topicOf(q) {
    return clean(
      q && (
        q.topic ||
        q.chapter ||
        q.unit ||
        q.subjectTopic ||
        q.subject
      )
    ) || "Unknown";
  }

  function subjectOf(q) {
    return clean(
      q && (
        q.subject ||
        q.section ||
        q.sub ||
        ""
      )
    ) || "Unknown";
  }

  function getTests() {
    const raw = read(HISTORY_KEY, []);

    if (Array.isArray(raw)) return raw;

    if (raw && Array.isArray(raw.tests)) return raw.tests;
    if (raw && Array.isArray(raw.history)) return raw.history;
    if (raw && Array.isArray(raw.records)) return raw.records;

    return [];
  }

  function getQuestionsFromTest(test) {
    if (!test || typeof test !== "object") return [];

    return arr(
      test.questions ||
      test.questionResults ||
      test.results ||
      test.items ||
      test.responses
    );
  }

  function testId(test, index) {
    return clean(
      test && (
        test.id ||
        test.testId ||
        test.test_id ||
        test.sessionId ||
        test.attemptId
      )
    ) || ("test-" + index);
  }

  function testTitle(test, index) {
    return clean(
      test && (
        test.title ||
        test.testTitle ||
        test.name ||
        test.testName
      )
    ) || ("Test " + (index + 1));
  }

  function mistakeKey(test, q, index) {
    return [
      testId(test, 0),
      questionId(q, index),
      questionText(q).slice(0, 80)
    ].join("::");
  }

  function getMasteryKeys() {
    const raw = read(MASTERY_KEY, []);
    const set = new Set();

    function add(v) {
      if (!v) return;

      if (typeof v === "string") {
        set.add(clean(v).toLowerCase());
        return;
      }

      if (typeof v === "object") {
        [
          v.id,
          v.questionId,
          v.question_id,
          v.text,
          v.question
        ].forEach(function (x) {
          if (x) set.add(clean(x).toLowerCase());
        });
      }
    }

    if (Array.isArray(raw)) {
      raw.forEach(add);
    } else if (raw && typeof raw === "object") {
      Object.keys(raw).forEach(function (k) {
        add(k);
        add(raw[k]);
      });
    }

    return set;
  }

  function isMastered(q) {
    const keys = getMasteryKeys();
    const id = questionId(q, 0).toLowerCase();
    const text = questionText(q).toLowerCase();

    return keys.has(id) || keys.has(text);
  }

  function collectMistakes() {
    const output = [];
    const seen = new Set();

    getTests().forEach(function (test, ti) {
      getQuestionsFromTest(test).forEach(function (q, qi) {
        if (!q || typeof q !== "object") return;

        if (isCorrect(q)) return;

        const text = questionText(q);
        if (!text) return;

        const id = questionId(q, qi);
        const key = (id + "::" + text).toLowerCase();

        if (seen.has(key)) return;
        seen.add(key);

        output.push({
          id: id,
          text: text,
          topic: topicOf(q),
          subject: subjectOf(q),
          reason: classify(q),
          userAnswer: answerOf(q),
          correctAnswer: correctOf(q),
          testId: testId(test, ti),
          testTitle: testTitle(test, ti),
          createdAt:
            test && (
              test.createdAt ||
              test.date ||
              test.timestamp
            ) || Date.now(),
          status: isMastered(q) ? "mastered" : "active"
        });
      });
    });

    return output;
  }

  function sync() {
    const mistakes = collectMistakes();

    const old = read(MISTAKE_KEY, {});
    const previous = old && typeof old === "object" ? old : {};

    mistakes.forEach(function (m) {
      const key = m.id + "::" + m.text.slice(0, 80);

      const oldItem = previous[key];

      previous[key] = {
        ...m,
        attempts: Number(oldItem && oldItem.attempts || 1),
        retries: Number(oldItem && oldItem.retries || 0),
        masteredAt:
          oldItem && oldItem.masteredAt
            ? oldItem.masteredAt
            : null,
        updatedAt: Date.now()
      };
    });

    write(MISTAKE_KEY, previous);

    return Object.values(previous);
  }

  function getAllMistakes() {
    sync();
    return Object.values(read(MISTAKE_KEY, {}));
  }

  function getActiveMistakes() {
    return getAllMistakes().filter(function (m) {
      return m.status !== "mastered";
    });
  }

  function retry(mistake) {
    if (!mistake || !mistake.text) return false;

    const payload = {
      id: mistake.id,
      questionId: mistake.id,
      question: mistake.text,
      text: mistake.text,
      topic: mistake.topic,
      subject: mistake.subject,
      reason: mistake.reason,
      correctAnswer: mistake.correctAnswer,
      source: "RankForge Mistake Bank",
      createdAt: Date.now()
    };

    write(ACTIVE_RETRY_KEY, payload);

    const history = arr(read(RETRY_KEY, []));
    history.push({
      ...payload,
      action: "retry",
      timestamp: Date.now()
    });

    write(RETRY_KEY, history.slice(-200));

    const all = read(MISTAKE_KEY, {});
    const key = mistake.id + "::" + mistake.text.slice(0, 80);

    if (all[key]) {
      all[key] = {
        ...all[key],
        retries: Number(all[key].retries || 0) + 1,
        lastRetryAt: Date.now()
      };
      write(MISTAKE_KEY, all);
    }

    return true;
  }

  function master(mistake) {
    if (!mistake || !mistake.text) return false;

    const all = read(MISTAKE_KEY, {});
    const key = mistake.id + "::" + mistake.text.slice(0, 80);

    if (all[key]) {
      all[key] = {
        ...all[key],
        status: "mastered",
        masteredAt: Date.now(),
        updatedAt: Date.now()
      };
      write(MISTAKE_KEY, all);
    }

    const raw = read(MASTERY_KEY, []);

    if (Array.isArray(raw)) {
      const exists = raw.some(function (x) {
        const value =
          typeof x === "string"
            ? x
            : questionText(x) || x.id || x.questionId || "";

        return clean(value).toLowerCase() ===
          mistake.text.toLowerCase();
      });

      if (!exists) {
        raw.push({
          id: mistake.id,
          questionId: mistake.id,
          question: mistake.text,
          text: mistake.text,
          topic: mistake.topic,
          masteredAt: Date.now(),
          source: "RankForge Mistake Engine"
        });
        write(MASTERY_KEY, raw);
      }
    } else {
      const next = Array.isArray(raw) ? raw : [];

      next.push({
        id: mistake.id,
        questionId: mistake.id,
        question: mistake.text,
        text: mistake.text,
        topic: mistake.topic,
        masteredAt: Date.now()
      });

      write(MASTERY_KEY, next);
    }

    return true;
  }

  function stats() {
    const all = getAllMistakes();
    const active = all.filter(function (x) {
      return x.status !== "mastered";
    });

    const mastered = all.filter(function (x) {
      return x.status === "mastered";
    });

    const byReason = {};
    const byTopic = {};

    all.forEach(function (m) {
      if (m.status === "mastered") return;

      byReason[m.reason] = (byReason[m.reason] || 0) + 1;
      byTopic[m.topic] = (byTopic[m.topic] || 0) + 1;
    });

    return {
      total: all.length,
      active: active.length,
      mastered: mastered.length,
      byReason: byReason,
      byTopic: byTopic
    };
  }

  function escape(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function render() {
    if (!document.body) return;

    const page = location.pathname.toLowerCase();

    if (
      !page.endsWith("/mistake.html") &&
      !page.endsWith("mistake.html")
    ) {
      return;
    }

    const old = document.getElementById(
      "rankforgeMistakeEngineV1"
    );

    if (old) old.remove();

    const mistakes = getActiveMistakes();

    const panel = document.createElement("section");
    panel.id = "rankforgeMistakeEngineV1";

    panel.innerHTML = `
      <div class="rfm-head">
        <div>
          <div class="rfm-title">🧠 RankForge Mistake Bank</div>
          <div class="rfm-sub">
            Mistake → Reason → Retry → Mastery
          </div>
        </div>
        <div class="rfm-badge">${mistakes.length} active</div>
      </div>

      ${
        mistakes.length
          ? mistakes.map(function (m, i) {
              return `
                <article class="rfm-card">
                  <div class="rfm-top">
                    <span class="rfm-number">#${i + 1}</span>
                    <span class="rfm-reason">${escape(m.reason)}</span>
                  </div>

                  <div class="rfm-question">
                    ${escape(m.text)}
                  </div>

                  <div class="rfm-meta">
                    ${escape(m.subject)} · ${escape(m.topic)}
                  </div>

                  <div class="rfm-actions">
                    <button
                      type="button"
                      data-rf-retry="${escape(m.id)}"
                    >🔁 Retry</button>

                    <button
                      type="button"
                      data-rf-master="${escape(m.id)}"
                    >✓ Mastered</button>
                  </div>
                </article>
              `;
            }).join("")
          : `
            <div class="rfm-empty">
              🎉 No active mistakes detected.
              Keep testing and build your mastery record.
            </div>
          `
      }
    `;

    const style = document.createElement("style");
    style.id = "RANKFORGE_MISTAKE_ENGINE_V1_CSS";
    style.textContent = `
#rankforgeMistakeEngineV1{
  margin:18px 0;
  padding:18px;
  border:1px solid #e2e8f0;
  border-radius:20px;
  background:#fff;
  box-shadow:0 5px 20px rgba(0,0,0,.06);
  position:relative;
  z-index:100;
}
.rfm-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:14px;
}
.rfm-title{
  font-size:19px;
  font-weight:800;
}
.rfm-sub{
  color:#64748b;
  font-size:12px;
  margin-top:3px;
}
.rfm-badge{
  padding:6px 10px;
  border-radius:999px;
  background:#f1f5f9;
  font-size:12px;
  font-weight:800;
}
.rfm-card{
  padding:14px;
  margin-top:10px;
  border:1px solid #e2e8f0;
  border-radius:15px;
  background:#f8fafc;
}
.rfm-top{
  display:flex;
  justify-content:space-between;
  gap:8px;
  align-items:center;
}
.rfm-number{
  font-size:11px;
  color:#64748b;
  font-weight:700;
}
.rfm-reason{
  font-size:11px;
  font-weight:800;
  padding:5px 8px;
  border-radius:999px;
  background:#e2e8f0;
}
.rfm-question{
  margin-top:10px;
  font-size:14px;
  line-height:1.5;
  font-weight:650;
}
.rfm-meta{
  margin-top:7px;
  font-size:11px;
  color:#64748b;
}
.rfm-actions{
  display:flex;
  gap:8px;
  margin-top:12px;
}
.rfm-actions button{
  border:0;
  border-radius:10px;
  padding:9px 12px;
  font-size:12px;
  font-weight:800;
  cursor:pointer;
  touch-action:manipulation;
}
.rfm-actions button:first-child{
  background:#e2e8f0;
}
.rfm-actions button:last-child{
  background:#dcfce7;
}
.rfm-empty{
  padding:20px 8px;
  text-align:center;
  color:#475569;
  font-size:13px;
}
`;

    document.head.appendChild(style);

    const target =
      document.querySelector("main") ||
      document.querySelector(".container") ||
      document.body;

    target.insertBefore(panel, target.firstChild);

    panel.querySelectorAll("[data-rf-retry]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-rf-retry");
        const m = getActiveMistakes().find(function (x) {
          return String(x.id) === String(id);
        });

        if (!m) return;

        retry(m);

        btn.textContent = "✓ Queued";

        setTimeout(function () {
          location.href = "retry.html";
        }, 250);
      });
    });

    panel.querySelectorAll("[data-rf-master]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-rf-master");
        const m = getActiveMistakes().find(function (x) {
          return String(x.id) === String(id);
        });

        if (!m) return;

        master(m);
        render();
      });
    });
  }

  function observe() {
    let previous = "";

    function fingerprint() {
      try {
        return [
          localStorage.getItem(HISTORY_KEY) || "",
          localStorage.getItem(MASTERY_KEY) || "",
          localStorage.getItem(MISTAKE_KEY) || ""
        ].join("|").slice(-5000);
      } catch (_) {
        return "";
      }
    }

    setInterval(function () {
      const now = fingerprint();

      if (now !== previous) {
        previous = now;
        sync();

        if (
          location.pathname.toLowerCase().includes("mistake")
        ) {
          render();
        }
      }
    }, 1000);
  }

  window.RankForgeResultMistakeEngineV1 = {
    sync: sync,
    getAllMistakes: getAllMistakes,
    getActiveMistakes: getActiveMistakes,
    getStats: stats,
    retry: retry,
    master: master,
    classify: classify
  };

  function boot() {
    sync();
    render();
    observe();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
