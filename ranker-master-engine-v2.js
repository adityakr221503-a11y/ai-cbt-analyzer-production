/* =========================================================
   CBT ANALYZER PRO — RANKER MASTER ENGINE V2
   Real data normalization + dedup + revision intelligence
========================================================= */
(function () {
  "use strict";

  const KEYS = {
    bank: "rankBoosterQuestionBankV1",
    attempts: "rankBoosterAttemptHistory",
    history: "cbtHistory",
    mastery: "cbtMasteryV2",
    retry: "cbtRetryQuestion",
    retryQueue: "cbtAnalyzer.retryQueue",
    revisions: "rankerRevisionHistoryV1",
    sessions: "cbtTestSessions"
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value == null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("Ranker Master write failed:", e);
    }
  }

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function text(v) {
    return String(v == null ? "" : v).trim();
  }

  function norm(v) {
    return text(v)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[“”‘’]/g, "'")
      .trim();
  }

  function questionId(q, i) {
    q = q || {};

    return text(
      q.questionId ||
      q.id ||
      q._id ||
      q.uid ||
      ""
    ) || ("generated-" + i);
  }

  function fingerprint(q) {
    q = q || {};

    const question = norm(
      q.question ||
      q.text ||
      q.questionText ||
      q.question_text ||
      ""
    );

    const options = arr(
      q.options ||
      q.choices ||
      []
    )
      .map(norm)
      .join("|");

    return question + "||" + options;
  }

  function bank() {
    return arr(
      read(KEYS.bank, [])
    );
  }

  function attempts() {
    return arr(
      read(KEYS.attempts, [])
    );
  }

  function history() {
    return arr(
      read(KEYS.history, [])
    );
  }

  function mastery() {
    return arr(
      read(KEYS.mastery, [])
    );
  }

  /* ---------------------------------------------------------
     BANK INDEX
  --------------------------------------------------------- */

  function buildBankIndexes() {
    const byId = {};
    const byFingerprint = {};

    bank().forEach(function (q, i) {
      const id = questionId(q, i);
      const fp = fingerprint(q);

      if (!byId[id]) {
        byId[id] = q;
      }

      if (fp && !byFingerprint[fp]) {
        byFingerprint[fp] = q;
      }
    });

    return {
      byId,
      byFingerprint
    };
  }

  function resolveQuestion(record, indexes) {
    record = record || {};

    const id = text(
      record.questionId ||
      record.id ||
      record._id ||
      ""
    );

    if (id && indexes.byId[id]) {
      return indexes.byId[id];
    }

    const fp = fingerprint(record);

    if (
      fp &&
      indexes.byFingerprint[fp]
    ) {
      return indexes.byFingerprint[fp];
    }

    return record;
  }

  /* ---------------------------------------------------------
     REAL METADATA NORMALIZATION
  --------------------------------------------------------- */

  function metadata(record, indexes) {
    const q = resolveQuestion(
      record,
      indexes
    );

    let subject = text(
      record.subject ||
      q.subject
    );

    let chapter = text(
      record.chapter ||
      q.chapter
    );

    let topic = text(
      record.topic ||
      q.topic
    );

    let concept = text(
      record.concept ||
      q.concept
    );

    /*
     * Never fabricate chapter names.
     * If bank metadata genuinely doesn't contain it,
     * keep Unknown rather than creating fake data.
     */

    if (!chapter) {
      chapter = "Unknown";
    }

    if (!topic) {
      topic = "General";
    }

    if (!concept) {
      concept = "";
    }

    return {
      subject: subject || "Unknown",
      chapter,
      topic,
      concept,
      questionId: questionId(q, 0),
      question:
        text(
          q.question ||
          q.text ||
          record.question ||
          record.text
        )
    };
  }

  /* ---------------------------------------------------------
     DEDUPLICATED MISTAKE EVIDENCE
  --------------------------------------------------------- */

  function isWrong(a) {
    if (
      typeof a.correct === "boolean"
    ) {
      return !a.correct;
    }

    if (
      typeof a.isCorrect === "boolean"
    ) {
      return !a.isCorrect;
    }

    const selected =
      a.selectedAnswer ??
      a.userAnswer ??
      a.answerSelected;

    const correct =
      a.correctAnswer ??
      a.correctOption ??
      a.answer;

    if (
      selected == null ||
      correct == null
    ) {
      return false;
    }

    return norm(selected) !== norm(correct);
  }

  function buildMistakes() {
    const indexes =
      buildBankIndexes();

    const map = {};

    attempts()
      .concat(history())
      .forEach(function (a) {

        if (!isWrong(a)) {
          return;
        }

        const meta =
          metadata(a, indexes);

        const key =
          meta.questionId !== "generated-0"
            ? "id:" + meta.questionId
            : "fp:" + fingerprint(a);

        if (!map[key]) {
          map[key] = {
            questionId:
              meta.questionId,
            question:
              meta.question ||
              "Question",
            subject:
              meta.subject,
            chapter:
              meta.chapter,
            topic:
              meta.topic,
            concept:
              meta.concept,
            mistakes: 0,
            lastAttempt:
              0,
            mistakeTypes: {}
          };
        }

        map[key].mistakes++;

        const t = Number(
          a.timestamp ||
          a.testTime ||
          a.createdAt ||
          Date.now()
        );

        if (t > map[key].lastAttempt) {
          map[key].lastAttempt = t;
        }

        const type =
          text(
            a.mistakeType ||
            a.mistakeReason
          );

        if (type) {
          map[key].mistakeTypes[type] =
            (map[key].mistakeTypes[type] || 0) + 1;
        }
      });

    return Object.values(map)
      .sort(function (a, b) {
        return (
          b.mistakes - a.mistakes ||
          b.lastAttempt - a.lastAttempt
        );
      });
  }

  /* ---------------------------------------------------------
     CHAPTER ANALYSIS
  --------------------------------------------------------- */

  function buildChapterStats() {
    const indexes =
      buildBankIndexes();

    const map = {};

    attempts().forEach(function (a) {
      if (!isWrong(a) && a.correct !== true) {
        /*
         * Explicit correct=false is handled above.
         * Records without correctness are ignored.
         */
      }

      const meta =
        metadata(a, indexes);

      const key =
        [
          meta.subject,
          meta.chapter
        ].join("||");

      if (!map[key]) {
        map[key] = {
          subject: meta.subject,
          chapter: meta.chapter,
          attempts: 0,
          wrong: 0,
          correct: 0
        };
      }

      map[key].attempts++;

      if (isWrong(a)) {
        map[key].wrong++;
      } else {
        map[key].correct++;
      }
    });

    return Object.values(map)
      .map(function (x) {
        x.accuracy =
          x.attempts
            ? Math.round(
                (x.correct / x.attempts) *
                100
              )
            : 0;

        x.priority =
          x.wrong * 3 +
          Math.max(
            0,
            70 - x.accuracy
          );

        return x;
      })
      .sort(function (a, b) {
        return b.priority - a.priority;
      });
  }

  /* ---------------------------------------------------------
     REAL REVISION TRACKING
  --------------------------------------------------------- */

  function revisions() {
    return arr(
      read(KEYS.revisions, [])
    );
  }

  function recordRevision(data) {
    const list = revisions();

    const item = Object.assign(
      {},
      data || {},
      {
        id:
          "REV-" +
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2, 8),
        timestamp: Date.now()
      }
    );

    list.push(item);

    write(
      KEYS.revisions,
      list.slice(-1000)
    );

    return item;
  }

  function revisedChapterKeys() {
    const set = new Set();

    revisions().forEach(function (r) {
      const subject =
        text(r.subject);

      const chapter =
        text(r.chapter);

      if (
        subject &&
        chapter &&
        chapter !== "Unknown"
      ) {
        set.add(
          subject + "||" + chapter
        );
      }
    });

    return set;
  }

  /* ---------------------------------------------------------
     WEAK + DUE
  --------------------------------------------------------- */

  function weakDue() {
    const chapters =
      buildChapterStats();

    const revised =
      revisedChapterKeys();

    return chapters
      .map(function (x) {

        const key =
          x.subject +
          "||" +
          x.chapter;

        /*
         * Due = weak and not recently revised.
         * We do not claim urgency without evidence.
         */

        x.revised =
          revised.has(key);

        x.due =
          x.accuracy < 75 &&
          !x.revised;

        return x;
      })
      .filter(function (x) {
        return (
          x.chapter !== "Unknown" &&
          (
            x.accuracy < 75 ||
            x.due
          )
        );
      });
  }

  /* ---------------------------------------------------------
     MASTERED
  --------------------------------------------------------- */

  function masteredSet() {
    const m =
      mastery();

    const set = new Set();

    m.forEach(function (x) {
      const id =
        text(
          x.questionId ||
          x.id
        );

      if (id) {
        set.add(id);
      }
    });

    return set;
  }

  /* ---------------------------------------------------------
     RENDER MASTER LOOP
  --------------------------------------------------------- */

  function render() {
    const box =
      document.getElementById(
        "rankerMasterLoop"
      );

    if (!box) {
      return;
    }

    const indexes =
      buildBankIndexes();

    const mistakes =
      buildMistakes();

    const chapters =
      buildChapterStats();

    const weak =
      weakDue();

    const revised =
      revisedChapterKeys();

    const mastered =
      masteredSet();

    const totalQuestions =
      bank().length;

    let totalAttempts =
      attempts().length;

    let totalWrong =
      mistakes.reduce(
        function (sum, x) {
          return sum + x.mistakes;
        },
        0
      );

    const accuracy =
      totalAttempts
        ? Math.round(
            (
              (totalAttempts - totalWrong) /
              totalAttempts
            ) * 100
          )
        : 0;

    const uniqueMistakes =
      mistakes.length;

    const chapterRows =
      weak.slice(0, 8)
        .map(function (x, i) {

          const action =
            window.rankerMasterLoop &&
            typeof window.rankerMasterLoop.revise === "function"
              ? `
                <button
                  type="button"
                  data-rm-revise="${i}"
                  style="margin-top:8px;"
                >
                  📖 Revise
                </button>
              `
              : "";

          return `
            <div class="test">
              <h3>${i + 1}. ${escapeHtml(x.chapter)}</h3>
              <div class="muted">
                ${escapeHtml(x.subject)}
                • ${x.accuracy}% accuracy
                • ${x.wrong} mistakes
                ${x.due ? "• 🔔 Due" : ""}
              </div>
              ${action}
            </div>
          `;
        })
        .join("");

    const mistakeRows =
      mistakes.slice(0, 10)
        .map(function (x, i) {

          const safeQuestion =
            escapeHtml(
              x.question ||
              "Question"
            );

          return `
            <div class="test">
              <h3>${i + 1}. ${safeQuestion}</h3>

              <div class="muted">
                ${escapeHtml(x.subject)}
                • ${escapeHtml(x.chapter)}
                • ${escapeHtml(x.topic)}
                • ${x.mistakes} mistake${x.mistakes === 1 ? "" : "s"}
              </div>

              <div style="
                display:grid;
                grid-template-columns:
                  repeat(auto-fit,minmax(150px,1fr));
                gap:8px;
                margin-top:10px;
              ">
                <button
                  type="button"
                  data-rm-question="${escapeHtml(x.questionId)}"
                  data-rm-action="revise"
                >
                  📖 Revise
                </button>

                <button
                  type="button"
                  data-rm-question="${escapeHtml(x.questionId)}"
                  data-rm-action="retry"
                >
                  🎯 Retry
                </button>
              </div>
            </div>
          `;
        })
        .join("");

    const revisionText =
      revised.size
        ? String(revised.size)
        : "0";

    const weakText =
      weak.length
        ? String(weak.length)
        : "0";

    box.innerHTML = `
      <div style="
        display:grid;
        grid-template-columns:
          repeat(auto-fit,minmax(150px,1fr));
        gap:10px;
        margin-bottom:16px;
      ">

        <div class="stat">
          <div class="num">${totalQuestions}</div>
          <div class="muted">Questions</div>
        </div>

        <div class="stat">
          <div class="num">${accuracy}%</div>
          <div class="muted">Accuracy</div>
        </div>

        <div class="stat">
          <div class="num">${uniqueMistakes}</div>
          <div class="muted">Unique Mistakes</div>
        </div>

        <div class="stat">
          <div class="num">${mastered.size}</div>
          <div class="muted">Mastered</div>
        </div>

        <div class="stat">
          <div class="num">${revisionText}</div>
          <div class="muted">Chapters Revised</div>
        </div>

        <div class="stat">
          <div class="num">${weakText}</div>
          <div class="muted">Weak / Due Chapters</div>
        </div>

      </div>

      <div class="card" style="margin-bottom:14px;">
        <h3>🧠 Ranker Decision Engine</h3>

        <div class="muted">
          Evidence → Weak Chapter → Revision →
          Targeted Retry → Mastery Check
        </div>

        <div style="
          margin-top:12px;
          padding:12px;
          border-radius:12px;
          background:#f1f4f9;
        ">
          ${
            weak.length
              ? `
                🎯 Priority:
                <strong>
                  ${escapeHtml(
                    weak[0].chapter
                  )}
                </strong>
                • ${weak[0].accuracy}% accuracy
              `
              : mistakes.length
                ? `
                  🔄 Priority:
                  <strong>
                    Mistake Review
                  </strong>
                `
                : `
                  ✅ No evidence-based urgent action.
                  Continue coverage practice.
                `
          }
        </div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <h3>🎯 Weak / Due Chapters</h3>

        ${
          chapterRows ||
          `
          <div class="muted">
            No verified weak chapter data available yet.
          </div>
          `
        }
      </div>

      <div class="card">
        <h3>🔁 Active Mistakes</h3>

        ${
          mistakeRows ||
          `
          <div class="muted">
            No active mistake evidence found.
          </div>
          `
        }
      </div>
    `;

    attachActions(
      mistakes,
      weak
    );
  }

  function escapeHtml(v) {
    return String(
      v == null ? "" : v
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function attachActions(
    mistakes,
    weak
  ) {
    const box =
      document.getElementById(
        "rankerMasterLoop"
      );

    if (!box) return;

    box.querySelectorAll(
      "[data-rm-revise]"
    ).forEach(function (button) {

      button.onclick =
        function () {

          const index =
            Number(
              button.getAttribute(
                "data-rm-revise"
              )
            );

          const x =
            weak[index];

          if (!x) return;

          recordRevision({
            subject:
              x.subject,
            chapter:
              x.chapter,
            topic:
              "",
            source:
              "Ranker Master Loop"
          });

          if (
            window.rankerMasterLoop &&
            typeof window.rankerMasterLoop.revise === "function"
          ) {
            window.rankerMasterLoop.revise(
              x.subject,
              x.chapter
            );
          } else {
            render();
          }
        };
    });

    box.querySelectorAll(
      "[data-rm-action]"
    ).forEach(function (button) {

      button.onclick =
        function () {

          const id =
            button.getAttribute(
              "data-rm-question"
            );

          const action =
            button.getAttribute(
              "data-rm-action"
            );

          const item =
            mistakes.find(
              function (x) {
                return (
                  x.questionId === id
                );
              }
            );

          if (!item) return;

          if (action === "revise") {

            recordRevision({
              subject:
                item.subject,
              chapter:
                item.chapter,
              topic:
                item.topic,
              questionId:
                item.questionId,
              source:
                "Ranker Master Loop"
            });

            if (
              window.rankerMasterLoop &&
              typeof window.rankerMasterLoop.revise === "function"
            ) {
              window.rankerMasterLoop.revise(
                item.subject,
                item.chapter
              );
            }

            return;
          }

          if (action === "retry") {

            try {
              localStorage.setItem(
                KEYS.retry,
                JSON.stringify({
                  question:
                    item.question,
                  questionId:
                    item.questionId,
                  subject:
                    item.subject,
                  chapter:
                    item.chapter,
                  topic:
                    item.topic,
                  source:
                    "Ranker Master Loop",
                  retrySource:
                    "Ranker Master Loop"
                })
              );
            } catch (e) {}

            if (
              window.rankerMasterLoop &&
              typeof window.rankerMasterLoop.retry === "function"
            ) {
              window.rankerMasterLoop.retry(
                item
              );
            } else {
              window.location.href =
                "./retry.html";
            }
          }
        };
    });
  }

  window.RankerMasterEngineV2 = {
    version: "2.0.0",
    keys: KEYS,
    bank: bank,
    attempts: attempts,
    mistakes: buildMistakes,
    chapters: buildChapterStats,
    weakDue: weakDue,
    revisions: revisions,
    recordRevision: recordRevision,
    render: render
  };

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

  window.addEventListener(
    "cbt:core-ready",
    render
  );

})();
