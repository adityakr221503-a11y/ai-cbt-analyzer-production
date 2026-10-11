(function () {
  "use strict";

  const MISTAKE_KEY = "rankforgeMistakesV1";
  const MASTERY_KEY = "cbtMasteryV2";
  const DPP_KEY = "rankforgeAdaptiveDPPV1";
  const QUESTION_KEYS = [
    "pdfCbtQuestions",
    "pdfQuestions",
    "cbtQuestions",
    "importedQuestions",
    "pdfQuestionBank",
    "questionBank",
    "questions",
    "rankerQuestionBank"
  ];

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
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

  function qText(q) {
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

  function qId(q, i) {
    return clean(
      q && (
        q.id ||
        q.questionId ||
        q.question_id ||
        q.uid ||
        q._id
      )
    ) || ("q-" + i);
  }

  function topic(q) {
    return clean(
      q && (
        q.topic ||
        q.chapter ||
        q.unit ||
        q.subjectTopic ||
        q.subtopic
      )
    ) || "Unknown";
  }

  function subject(q) {
    return clean(
      q && (
        q.subject ||
        q.section ||
        q.sub ||
        ""
      )
    ) || "Unknown";
  }

  function allQuestions() {
    const result = [];
    const seen = new Set();

    QUESTION_KEYS.forEach(function (key) {
      const raw = read(key, null);

      let list = [];

      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && typeof raw === "object") {
        list =
          arr(raw.questions).length
            ? raw.questions
            : arr(raw.items).length
              ? raw.items
              : arr(raw.data);
      }

      list.forEach(function (q, i) {
        if (!q || typeof q !== "object") return;

        const text = qText(q);
        if (!text) return;

        const id = qId(q, i);
        const key2 =
          id.toLowerCase() +
          "::" +
          text.toLowerCase().slice(0, 120);

        if (seen.has(key2)) return;
        seen.add(key2);

        result.push({
          ...q,
          id: id,
          _rfText: text,
          _rfTopic: topic(q),
          _rfSubject: subject(q)
        });
      });
    });

    return result;
  }

  function mistakes() {
    const raw = read(MISTAKE_KEY, {});
    const list =
      Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object"
          ? Object.values(raw)
          : [];

    return list.filter(function (m) {
      return (
        m &&
        m.status !== "mastered" &&
        clean(m.text || m.question)
      );
    });
  }

  function masteredKeys() {
    const raw = read(MASTERY_KEY, []);
    const set = new Set();

    function add(x) {
      if (!x) return;

      if (typeof x === "string") {
        set.add(clean(x).toLowerCase());
        return;
      }

      if (typeof x === "object") {
        [
          x.id,
          x.questionId,
          x.question_id,
          x.text,
          x.question
        ].forEach(function (v) {
          if (v) set.add(clean(v).toLowerCase());
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

  function normalizedText(q) {
    return qText(q)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .slice(0, 250);
  }

  function weakTopics() {
    const counts = {};

    mistakes().forEach(function (m) {
      const t = clean(m.topic) || "Unknown";
      counts[t] = (counts[t] || 0) + 1;
    });

    return Object.keys(counts)
      .map(function (t) {
        return {
          topic: t,
          mistakes: counts[t]
        };
      })
      .sort(function (a, b) {
        return b.mistakes - a.mistakes;
      });
  }

  function difficulty(q) {
    const raw = clean(
      q && (
        q.difficulty ||
        q.level ||
        q.difficultyLevel ||
        q.tier
      )
    ).toLowerCase();

    if (
      raw.includes("hard") ||
      raw.includes("advanced") ||
      raw.includes("difficult")
    ) return 3;

    if (
      raw.includes("medium") ||
      raw.includes("moderate")
    ) return 2;

    return 1;
  }

  function relevance(q, weak) {
    const t = topic(q).toLowerCase();
    const ch = clean(q && q.chapter).toLowerCase();

    let score = 0;

    weak.forEach(function (w, index) {
      const wt = w.topic.toLowerCase();

      if (t === wt) {
        score += 100 - index * 10 + w.mistakes * 8;
      } else if (
        t.includes(wt) ||
        wt.includes(t) ||
        (ch && (ch.includes(wt) || wt.includes(ch)))
      ) {
        score += 55 - index * 5;
      }
    });

    const d = difficulty(q);

    // Prefer useful challenge, but don't make every DPP extreme.
    if (d === 2) score += 12;
    if (d === 3) score += 18;

    return score;
  }

  function shuffle(list) {
    const a = list.slice();

    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }

    return a;
  }

  function generate(size) {
    size = Number(size) === 20 ? 20 : 15;

    const bank = allQuestions();
    const mastered = masteredKeys();
    const weak = weakTopics();

    const existingDpp = read(DPP_KEY, null);
    const previousIds = new Set(
      arr(existingDpp && existingDpp.questions)
        .map(function (q) {
          return clean(q && (q.id || q.questionId));
        })
        .filter(Boolean)
    );

    const eligible = bank.filter(function (q) {
      const id = qId(q, 0).toLowerCase();
      const txt = normalizedText(q);

      if (mastered.has(id)) return false;
      if (mastered.has(txt)) return false;

      // Avoid exact questions from the immediately previous DPP.
      if (previousIds.has(id)) return false;

      return true;
    });

    if (!eligible.length) {
      return {
        ok: false,
        reason: "NO_QUESTIONS",
        message:
          "No eligible questions found. Add/import a question bank first."
      };
    }

    const ranked = eligible
      .map(function (q) {
        return {
          q: q,
          score: relevance(q, weak)
        };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });

    const selected = [];

    // First pass: weak-topic questions.
    ranked.forEach(function (item) {
      if (selected.length >= size) return;

      if (item.score > 0) {
        selected.push(item.q);
      }
    });

    // Second pass: fill with unused questions.
    if (selected.length < size) {
      const selectedKeys = new Set(
        selected.map(normalizedText)
      );

      shuffle(eligible).forEach(function (q) {
        if (selected.length >= size) return;

        const key = normalizedText(q);

        if (!selectedKeys.has(key)) {
          selectedKeys.add(key);
          selected.push(q);
        }
      });
    }

    // Final controlled shuffle prevents the DPP from being
    // ordered purely by weakness score.
    const finalQuestions = shuffle(
      selected.slice(0, size)
    ).map(function (q, i) {
      return {
        ...q,
        _dppIndex: i + 1,
        _dppGeneratedAt: Date.now()
      };
    });

    const dpp = {
      id: "RFDPP-" + Date.now(),
      title: "RankForge Adaptive DPP",
      source: "RankForge Adaptive Engine",
      size: finalQuestions.length,
      weakTopics: weak.slice(0, 5),
      questions: finalQuestions,
      createdAt: Date.now(),
      status: "ready"
    };

    localStorage.setItem(
      DPP_KEY,
      JSON.stringify(dpp)
    );

    return {
      ok: true,
      dpp: dpp
    };
  }

  function start(size) {
    const result = generate(size);

    if (!result.ok) return result;

    const dpp = result.dpp;

    // Common active-test contract used by the existing CBT system.
    const active = {
      id: dpp.id,
      title: dpp.title,
      source: dpp.source,
      filename: "",
      questionCount: dpp.questions.length,
      questions: dpp.questions,
      createdAt: dpp.createdAt,
      updatedAt: Date.now(),
      mode: "adaptive-dpp"
    };

    try {
      localStorage.setItem(
        "CBT_ACTIVE_TEST",
        JSON.stringify(active)
      );

      localStorage.setItem(
        "CBT_ACTIVE_TEST_ID",
        dpp.id
      );

      localStorage.setItem(
        "CBT_ACTIVE_TEST_SOURCE",
        "RankForge Adaptive DPP"
      );
    } catch (_) {}

    return {
      ok: true,
      dpp: dpp,
      activeTest: active
    };
  }

  function render() {
    if (!document.body) return;

    if (
      document.getElementById(
        "rankforgeAdaptiveDPPV1"
      )
    ) return;

    const weak = weakTopics();
    const panel = document.createElement("section");

    panel.id = "rankforgeAdaptiveDPPV1";

    panel.innerHTML = `
      <div class="rfd-head">
        <div>
          <div class="rfd-title">🎯 Adaptive Weak-Topic DPP</div>
          <div class="rfd-sub">
            Your recent mistakes decide what gets priority.
          </div>
        </div>
        <div class="rfd-badge">15 / 20</div>
      </div>

      <div class="rfd-weak">
        ${
          weak.length
            ? weak.slice(0, 4).map(function (w) {
                return `
                  <span>
                    ${escapeHtml(w.topic)}
                    <b>${w.mistakes}</b>
                  </span>
                `;
              }).join("")
            : `
              <span>No weak-topic evidence yet</span>
            `
        }
      </div>

      <div class="rfd-actions">
        <button type="button" data-rfd-size="15">
          ⚡ Start 15Q DPP
        </button>
        <button type="button" data-rfd-size="20">
          🔥 Start 20Q DPP
        </button>
      </div>

      <div class="rfd-status" id="rfdStatus">
        Adaptive engine ready.
      </div>
    `;

    const style = document.createElement("style");
    style.id = "RANKFORGE_ADAPTIVE_DPP_V1_CSS";

    style.textContent = `
#rankforgeAdaptiveDPPV1{
  margin:18px 0;
  padding:18px;
  border:1px solid #e2e8f0;
  border-radius:20px;
  background:#fff;
  box-shadow:0 5px 20px rgba(0,0,0,.06);
  position:relative;
  z-index:90;
}
.rfd-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}
.rfd-title{
  font-size:19px;
  font-weight:800;
}
.rfd-sub{
  margin-top:4px;
  color:#64748b;
  font-size:12px;
  line-height:1.45;
}
.rfd-badge{
  padding:6px 9px;
  border-radius:999px;
  background:#f1f5f9;
  font-size:11px;
  font-weight:800;
  white-space:nowrap;
}
.rfd-weak{
  display:flex;
  flex-wrap:wrap;
  gap:7px;
  margin-top:13px;
}
.rfd-weak span{
  display:inline-flex;
  gap:5px;
  align-items:center;
  padding:6px 9px;
  border-radius:999px;
  background:#f8fafc;
  border:1px solid #e2e8f0;
  font-size:11px;
}
.rfd-weak b{
  font-size:10px;
}
.rfd-actions{
  display:flex;
  gap:9px;
  margin-top:14px;
}
.rfd-actions button{
  flex:1;
  border:0;
  border-radius:12px;
  padding:11px 10px;
  font-size:12px;
  font-weight:800;
  cursor:pointer;
  touch-action:manipulation;
}
.rfd-status{
  margin-top:10px;
  color:#64748b;
  font-size:11px;
}
`;

    document.head.appendChild(style);

    const target =
      document.querySelector("main") ||
      document.querySelector(".container") ||
      document.body;

    target.insertBefore(panel, target.firstChild);

    panel.querySelectorAll("[data-rfd-size]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          const size =
            Number(button.getAttribute("data-rfd-size")) || 15;

          const result = start(size);
          const status =
            document.getElementById("rfdStatus");

          if (!result.ok) {
            status.textContent =
              "⚠️ " + result.message;
            return;
          }

          status.textContent =
            "✅ " +
            result.dpp.questions.length +
            " questions prepared. Opening CBT…";

          setTimeout(function () {
            location.href = "cbt.html";
          }, 300);
        });
      });
  }

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.RankForgeAdaptiveDPPV1 = {
    generate: generate,
    start: start,
    getWeakTopics: weakTopics,
    getQuestionBank: allQuestions
  };

  function boot() {
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
