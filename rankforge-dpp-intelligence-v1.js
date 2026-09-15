(function () {
  "use strict";

  const DPP_KEY = "rankforgeAdaptiveDPPV1";
  const HISTORY_KEY = "cbtHistory";
  const INTEL_KEY = "rankforgeDPPIntelligenceV1";
  const MISTAKE_KEY = "rankforgeMistakesV1";
  const MASTERY_KEY = "cbtMasteryV2";

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

  function text(q) {
    return clean(
      q && (
        q.question ||
        q.questionText ||
        q.question_text ||
        q.text ||
        q.stem
      )
    );
  }

  function answer(q) {
    return clean(
      q && (
        q.userAnswer ??
        q.selectedAnswer ??
        q.selectedOption ??
        q.selectedIndex ??
        q.answerGiven ??
        q.response ??
        ""
      )
    );
  }

  function correct(q) {
    return clean(
      q && (
        q.correctAnswer ??
        q.correct ??
        q.answer ??
        q.correctOption ??
        q.correctIndex ??
        ""
      )
    );
  }

  function normalized(v) {
    return clean(v)
      .toLowerCase()
      .replace(/^option\s*/i, "")
      .replace(/[.)]$/, "");
  }

  function isUnanswered(q) {
    const s = clean(q && q.status).toLowerCase();

    return (
      !answer(q) ||
      s === "unanswered" ||
      s === "skipped" ||
      s === "not attempted" ||
      s === "not_attempted"
    );
  }

  function isCorrect(q) {
    const s = clean(q && q.status).toLowerCase();

    if (s === "correct" || s === "right") return true;
    if (
      s === "wrong" ||
      s === "incorrect" ||
      s === "unanswered"
    ) return false;

    const a = answer(q);
    const c = correct(q);

    return !!a && !!c && normalized(a) === normalized(c);
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
        q.sub
      )
    ) || "Unknown";
  }

  function difficulty(q) {
    const d = clean(
      q && (
        q.difficulty ||
        q.level ||
        q.difficultyLevel ||
        q.tier
      )
    ).toLowerCase();

    if (
      d.includes("hard") ||
      d.includes("advanced") ||
      d.includes("difficult")
    ) return 3;

    if (
      d.includes("medium") ||
      d.includes("moderate")
    ) return 2;

    return 1;
  }

  function timeSpent(q) {
    const v = Number(
      q && (
        q.timeSpent ??
        q.time_taken ??
        q.timeTaken ??
        q.secondsSpent ??
        0
      )
    );

    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  function currentDPP() {
    return read(DPP_KEY, null);
  }

  function extractQuestions(dpp) {
    if (!dpp || typeof dpp !== "object") return [];

    return arr(
      dpp.questions ||
      dpp.questionResults ||
      dpp.results ||
      dpp.items
    );
  }

  function history() {
    const raw = read(HISTORY_KEY, []);

    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.tests)) return raw.tests;
    if (raw && Array.isArray(raw.history)) return raw.history;
    if (raw && Array.isArray(raw.records)) return raw.records;

    return [];
  }

  function latestDPPResult() {
    const dpp = currentDPP();
    const id = clean(dpp && dpp.id);

    if (!id) return null;

    const tests = history();

    for (let i = tests.length - 1; i >= 0; i--) {
      const t = tests[i];
      const tid = clean(
        t && (
          t.id ||
          t.testId ||
          t.test_id ||
          t.sessionId ||
          t.attemptId
        )
      );

      const title = clean(
        t && (
          t.title ||
          t.testTitle ||
          t.name ||
          t.testName
        )
      ).toLowerCase();

      if (
        tid === id ||
        title.includes("adaptive dpp") ||
        title.includes("rankforge adaptive")
      ) {
        const qs = arr(
          t && (
            t.questions ||
            t.questionResults ||
            t.results ||
            t.items ||
            t.responses
          )
        );

        if (qs.length) {
          return {
            test: t,
            questions: qs
          };
        }
      }
    }

    return null;
  }

  function score(questions) {
    let correctCount = 0;
    let wrongCount = 0;
    let unanswered = 0;

    questions.forEach(function (q) {
      if (isUnanswered(q)) {
        unanswered++;
      } else if (isCorrect(q)) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    return {
      total: questions.length,
      correct: correctCount,
      wrong: wrongCount,
      unanswered: unanswered,
      accuracy:
        questions.length
          ? Math.round(
              correctCount / questions.length * 100
            )
          : 0
    };
  }

  function topicStats(questions) {
    const map = {};

    questions.forEach(function (q) {
      const t = topic(q);

      if (!map[t]) {
        map[t] = {
          topic: t,
          total: 0,
          correct: 0,
          wrong: 0,
          unanswered: 0,
          time: 0
        };
      }

      map[t].total++;
      map[t].time += timeSpent(q);

      if (isUnanswered(q)) {
        map[t].unanswered++;
      } else if (isCorrect(q)) {
        map[t].correct++;
      } else {
        map[t].wrong++;
      }
    });

    return Object.values(map)
      .map(function (x) {
        return {
          ...x,
          accuracy: x.total
            ? Math.round(x.correct / x.total * 100)
            : 0,
          avgTime: x.total
            ? Math.round(x.time / x.total)
            : 0
        };
      })
      .sort(function (a, b) {
        return a.accuracy - b.accuracy;
      });
  }

  function calculateDifficulty(questions, overall) {
    const attempted = overall.correct + overall.wrong;

    if (!attempted) return "medium";

    const accuracy =
      overall.correct / attempted * 100;

    const hardCount =
      questions.filter(function (q) {
        return difficulty(q) === 3;
      }).length;

    const hardRatio =
      questions.length
        ? hardCount / questions.length
        : 0;

    if (accuracy >= 85 && hardRatio >= 0.25) {
      return "hard";
    }

    if (accuracy >= 80) {
      return "hard";
    }

    if (accuracy < 50) {
      return "easy";
    }

    return "medium";
  }

  function nextAction(overall, topics) {
    if (!overall.total) {
      return {
        type: "test",
        title: "Take a real DPP",
        reason: "No DPP result is available yet."
      };
    }

    const weakest = topics[0];

    if (overall.accuracy < 50) {
      return {
        type: "revision",
        title: "Revise before another hard DPP",
        reason:
          "Overall accuracy is " +
          overall.accuracy +
          "%."
      };
    }

    if (
      weakest &&
      weakest.accuracy < 60
    ) {
      return {
        type: "weak-topic",
        title: "Target " + weakest.topic,
        reason:
          weakest.accuracy +
          "% accuracy with " +
          weakest.wrong +
          " wrong."
      };
    }

    if (overall.accuracy >= 85) {
      return {
        type: "challenge",
        title: "Move to a harder DPP",
        reason:
          "Strong performance at " +
          overall.accuracy +
          "% accuracy."
      };
    }

    return {
      type: "practice",
      title: "Continue adaptive practice",
      reason:
        "Keep the current difficulty and improve consistency."
    };
  }

  function analyze(questions) {
    const overall = score(questions);
    const topics = topicStats(questions);

    const totalTime = questions.reduce(
      function (sum, q) {
        return sum + timeSpent(q);
      },
      0
    );

    const avgTime = questions.length
      ? Math.round(totalTime / questions.length)
      : 0;

    const result = {
      id:
        "RF-DPP-INTEL-" +
        Date.now(),
      dppId:
        clean(currentDPP() && currentDPP().id),
      createdAt: Date.now(),
      overall: overall,
      topics: topics,
      totalTime: totalTime,
      avgTime: avgTime,
      nextDifficulty:
        calculateDifficulty(questions, overall),
      nextAction:
        nextAction(overall, topics)
    };

    return result;
  }

  function save(result) {
    const raw = read(INTEL_KEY, []);
    const list = Array.isArray(raw) ? raw : [];

    const dppId = result.dppId;

    const withoutDuplicate = list.filter(
      function (x) {
        return x && x.dppId !== dppId;
      }
    );

    withoutDuplicate.push(result);

    write(
      INTEL_KEY,
      withoutDuplicate.slice(-100)
    );

    return result;
  }

  function processLatest() {
    const result = latestDPPResult();

    if (!result) {
      return {
        ok: false,
        reason: "NO_DPP_RESULT"
      };
    }

    const analysis = analyze(result.questions);

    save(analysis);

    return {
      ok: true,
      analysis: analysis
    };
  }

  function render() {
    if (!document.body) return;

    const path = location.pathname.toLowerCase();

    if (
      !path.includes("ranker-command-center") &&
      !path.includes("mistake") &&
      !path.includes("history") &&
      !path.includes("cbt")
    ) {
      return;
    }

    const result = processLatest();

    if (!result.ok) return;

    const old = document.getElementById(
      "rankforgeDPPIntelligenceV1"
    );

    if (old) old.remove();

    const a = result.analysis;
    const weak = a.topics[0];

    const panel = document.createElement("section");
    panel.id = "rankforgeDPPIntelligenceV1";

    panel.innerHTML = `
      <div class="rfi-head">
        <div>
          <div class="rfi-title">🧠 DPP Intelligence</div>
          <div class="rfi-sub">
            Your performance is changing the next recommendation.
          </div>
        </div>
        <div class="rfi-score">
          ${a.overall.accuracy}%
        </div>
      </div>

      <div class="rfi-grid">
        <div>
          <b>${a.overall.correct}</b>
          <span>Correct</span>
        </div>
        <div>
          <b>${a.overall.wrong}</b>
          <span>Wrong</span>
        </div>
        <div>
          <b>${a.overall.unanswered}</b>
          <span>Skipped</span>
        </div>
        <div>
          <b>${a.avgTime}s</b>
          <span>Avg time</span>
        </div>
      </div>

      ${
        weak
          ? `
            <div class="rfi-weak">
              <small>WEAKEST TOPIC</small>
              <strong>${escapeHtml(weak.topic)}</strong>
              <span>
                ${weak.accuracy}% accuracy ·
                ${weak.wrong} wrong
              </span>
            </div>
          `
          : ""
      }

      <div class="rfi-next">
        <small>NEXT BEST ACTION</small>
        <strong>
          ${escapeHtml(a.nextAction.title)}
        </strong>
        <span>
          ${escapeHtml(a.nextAction.reason)}
        </span>
      </div>

      <div class="rfi-difficulty">
        Next DPP difficulty:
        <b>${escapeHtml(a.nextDifficulty)}</b>
      </div>
    `;

    const style = document.createElement("style");
    style.id = "RANKFORGE_DPP_INTELLIGENCE_V1_CSS";

    style.textContent = `
#rankforgeDPPIntelligenceV1{
  margin:18px 0;
  padding:18px;
  border:1px solid #e2e8f0;
  border-radius:20px;
  background:#fff;
  box-shadow:0 5px 20px rgba(0,0,0,.06);
  position:relative;
  z-index:80;
}
.rfi-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}
.rfi-title{
  font-size:19px;
  font-weight:800;
}
.rfi-sub{
  margin-top:4px;
  color:#64748b;
  font-size:12px;
}
.rfi-score{
  font-size:22px;
  font-weight:900;
}
.rfi-grid{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:7px;
  margin-top:14px;
}
.rfi-grid div{
  padding:10px 6px;
  border-radius:12px;
  background:#f8fafc;
  text-align:center;
}
.rfi-grid b{
  display:block;
  font-size:17px;
}
.rfi-grid span{
  display:block;
  margin-top:3px;
  color:#64748b;
  font-size:10px;
}
.rfi-weak,
.rfi-next{
  margin-top:12px;
  padding:12px;
  border-radius:13px;
  background:#f8fafc;
}
.rfi-weak small,
.rfi-next small{
  display:block;
  font-size:9px;
  font-weight:900;
  color:#64748b;
}
.rfi-weak strong,
.rfi-next strong{
  display:block;
  margin-top:4px;
  font-size:14px;
}
.rfi-weak span,
.rfi-next span{
  display:block;
  margin-top:4px;
  font-size:11px;
  color:#64748b;
  line-height:1.4;
}
.rfi-difficulty{
  margin-top:10px;
  font-size:11px;
  color:#64748b;
}
.rfi-difficulty b{
  color:#0f172a;
  text-transform:uppercase;
}
@media(max-width:520px){
  .rfi-grid{
    grid-template-columns:repeat(2,1fr);
  }
}
`;

    document.head.appendChild(style);

    const target =
      document.querySelector("main") ||
      document.querySelector(".container") ||
      document.body;

    target.insertBefore(panel, target.firstChild);
  }

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.RankForgeDPPIntelligenceV1 = {
    analyze: analyze,
    processLatest: processLatest,
    getLatest: latestDPPResult,
    getHistory: function () {
      return arr(read(INTEL_KEY, []));
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  setTimeout(render, 1200);
})();
