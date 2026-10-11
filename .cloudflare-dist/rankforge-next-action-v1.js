(function () {
  "use strict";

  const HISTORY_KEY = "cbtHistory";
  const MASTERY_KEY = "cbtMasteryV2";
  const RETRY_KEY = "retryHistory";

  function read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "");
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function text(q) {
    if (!q || typeof q !== "object") return "";
    return String(
      q.question ||
      q.text ||
      q.questionText ||
      q.question_text ||
      ""
    ).trim();
  }

  function topic(q) {
    if (!q || typeof q !== "object") return "Unknown";
    return String(
      q.topic ||
      q.chapter ||
      q.subject ||
      q.unit ||
      "Unknown"
    ).trim() || "Unknown";
  }

  function getHistory() {
    return arr(read(HISTORY_KEY, []));
  }

  function getWrongQuestions() {
    const result = [];
    const seen = new Set();

    getHistory().forEach(function (test) {
      arr(test.questions).forEach(function (q) {
        const status = String(q.status || "").toLowerCase();

        if (
          status !== "wrong" &&
          status !== "incorrect" &&
          status !== "unanswered"
        ) {
          return;
        }

        const t = text(q);
        if (!t) return;

        const key = t.toLowerCase().replace(/\s+/g, " ");

        if (seen.has(key)) return;
        seen.add(key);

        result.push({
          ...q,
          _text: t,
          _topic: topic(q),
          _status: status
        });
      });
    });

    return result;
  }

  function getMastered() {
    const raw = read(MASTERY_KEY, []);
    const values = [];

    if (Array.isArray(raw)) {
      raw.forEach(function (x) {
        if (typeof x === "string") {
          values.push(x);
        } else if (x && typeof x === "object") {
          values.push(text(x));
        }
      });
    } else if (raw && typeof raw === "object") {
      Object.keys(raw).forEach(function (k) {
        const x = raw[k];
        if (x && typeof x === "object") values.push(text(x));
        else if (typeof x === "string") values.push(x);
      });
    }

    return new Set(
      values
        .filter(Boolean)
        .map(function (x) {
          return String(x).toLowerCase().replace(/\s+/g, " ");
        })
    );
  }

  function getActiveMistakes() {
    const mastered = getMastered();

    return getWrongQuestions().filter(function (q) {
      const key = q._text.toLowerCase().replace(/\s+/g, " ");
      return !mastered.has(key);
    });
  }

  function getTopicStats() {
    const map = {};

    getWrongQuestions().forEach(function (q) {
      const t = q._topic || "Unknown";

      if (!map[t]) {
        map[t] = {
          topic: t,
          mistakes: 0
        };
      }

      map[t].mistakes++;
    });

    return Object.values(map).sort(function (a, b) {
      return b.mistakes - a.mistakes;
    });
  }

  function getBestAction() {
    const active = getActiveMistakes();
    const topics = getTopicStats();
    const history = getHistory();

    if (active.length) {
      return {
        type: "mistake",
        title: "Fix your active mistakes",
        desc:
          active.length +
          " question" +
          (active.length === 1 ? "" : "s") +
          " still need revision/retry.",
        url: "mistake.html"
      };
    }

    if (topics.length) {
      return {
        type: "practice",
        title: "Practice your weakest topic",
        desc:
          topics[0].topic +
          " has the highest mistake load.",
        url: "question-bank.html?mode=topic"
      };
    }

    if (history.length) {
      return {
        type: "analysis",
        title: "Review your latest test",
        desc: "Use the latest performance data to choose the next task.",
        url: "orbit-test-analysis.html"
      };
    }

    return {
      type: "start",
      title: "Start your first CBT",
      desc: "Take a test to generate performance evidence.",
      url: "pdf-to-cbt.html"
    };
  }

  function inject() {
    if (!document.body) return;
    if (document.getElementById("rankforgeNextActionV1")) return;

    const action = getBestAction();
    const active = getActiveMistakes();
    const topics = getTopicStats();

    const box = document.createElement("section");
    box.id = "rankforgeNextActionV1";
    box.innerHTML =
      '<div class="rfa-head">' +
        '<div>' +
          '<div class="rfa-title">🧭 Next Best Action</div>' +
          '<div class="rfa-sub">Evidence-based study priority</div>' +
        '</div>' +
        '<div class="rfa-count">' +
          active.length +
          ' active</div>' +
      '</div>' +

      '<a class="rfa-action" href="' +
        escapeHtml(action.url) +
      '">' +
        '<div class="rfa-action-icon">' +
          iconFor(action.type) +
        '</div>' +
        '<div class="rfa-action-body">' +
          '<strong>' +
            escapeHtml(action.title) +
          '</strong>' +
          '<span>' +
            escapeHtml(action.desc) +
          '</span>' +
        '</div>' +
        '<div class="rfa-arrow">→</div>' +
      '</a>' +

      (
        topics.length
          ? '<div class="rfa-topics">' +
              '<div class="rfa-mini-title">Weak-topic load</div>' +
              topics.slice(0, 3).map(function (x) {
                return (
                  '<div class="rfa-topic">' +
                    '<span>' +
                      escapeHtml(x.topic) +
                    '</span>' +
                    '<b>' +
                      x.mistakes +
                    '</b>' +
                  '</div>'
                );
              }).join("") +
            '</div>'
          : ""
      );

    const style = document.createElement("style");
    style.id = "RANKFORGE_NEXT_ACTION_V1_CSS";
    style.textContent = `
#rankforgeNextActionV1{
  margin:18px 0;
  padding:17px;
  border:1px solid #e2e8f0;
  border-radius:18px;
  background:#fff;
  box-shadow:0 4px 16px rgba(0,0,0,.06);
  position:relative;
  z-index:30;
}
.rfa-head{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  margin-bottom:12px;
}
.rfa-title{
  font-size:19px;
  font-weight:800;
}
.rfa-sub{
  margin-top:3px;
  color:#64748b;
  font-size:12px;
}
.rfa-count{
  font-size:12px;
  font-weight:800;
  padding:6px 9px;
  border-radius:999px;
  background:#f1f5f9;
}
.rfa-action{
  display:flex;
  align-items:center;
  gap:12px;
  text-decoration:none;
  color:#0f172a;
  padding:13px;
  border-radius:14px;
  background:#f8fafc;
  border:1px solid #e2e8f0;
}
.rfa-action-icon{
  font-size:27px;
}
.rfa-action-body{
  flex:1;
}
.rfa-action-body strong{
  display:block;
  font-size:15px;
}
.rfa-action-body span{
  display:block;
  margin-top:4px;
  color:#64748b;
  font-size:12px;
  line-height:1.45;
}
.rfa-arrow{
  font-size:22px;
  font-weight:800;
}
.rfa-topics{
  margin-top:13px;
}
.rfa-mini-title{
  font-size:12px;
  font-weight:800;
  margin-bottom:7px;
}
.rfa-topic{
  display:flex;
  justify-content:space-between;
  padding:7px 0;
  border-bottom:1px solid #f1f5f9;
  font-size:12px;
}
.rfa-topic b{
  font-size:13px;
}
`;

    document.head.appendChild(style);

    const target =
      document.querySelector(".container") ||
      document.querySelector("main") ||
      document.body;

    if (target.firstChild) {
      target.insertBefore(box, target.firstChild);
    } else {
      target.appendChild(box);
    }
  }

  function iconFor(type) {
    if (type === "mistake") return "🔁";
    if (type === "practice") return "🎯";
    if (type === "analysis") return "📊";
    return "🚀";
  }

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.RankForgeNextActionV1 = {
    getActiveMistakes,
    getTopicStats,
    getBestAction
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }

  setTimeout(inject, 500);
})();
