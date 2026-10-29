/*
  RANKFORGE FIXPACK v2.0 (Unified Post-Test Analysis, Mistake Sync & Question Normalizer)
  - Syncs CBT results across `rf_last_analysis`, `CBT_LAST_RESULT`, `cbtHistory`, and `rfMistakeBankV1`
  - Clears `rf_active_exam` on test finish so navigation is never locked
  - Injects Deep Subject & Chapter Performance Breakdown on `analysis.html`
*/
(function () {
  "use strict";

  function safeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function normalizeQuestion(q, idx) {
    q = q || {};
    var opts = Array.isArray(q.options) ? q.options.slice() :
               Array.isArray(q.choices) ? q.choices.slice() :
               [q.optionA || q.option_a, q.optionB || q.option_b, q.optionC || q.option_c, q.optionD || q.option_d].filter(function (x) { return x != null && String(x).trim() !== ""; });
    var corrIdx = -1;
    if (typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < 4) {
      corrIdx = q.correctIndex;
    } else if (typeof q.answerIndex === "number" && q.answerIndex >= 0 && q.answerIndex < 4) {
      corrIdx = q.answerIndex;
    } else {
      var rawAns = String(q.correctAnswer != null ? q.correctAnswer : (q.answer != null ? q.answer : "")).trim();
      if (/^[A-D]$/i.test(rawAns)) corrIdx = rawAns.toUpperCase().charCodeAt(0) - 65;
      else if (/^[1-4]$/.test(rawAns)) corrIdx = parseInt(rawAns, 10) - 1;
      else if (rawAns && opts.length) {
        for (var i = 0; i < opts.length; i++) {
          if (String(opts[i]).trim() === rawAns) { corrIdx = i; break; }
        }
      }
    }
    var qText = String(q.question || q.text || q.prompt || "").replace(/\b([A-Za-z]{3,})-\s+([a-z]{3,})\b/g, "$1$2");
    return {
      id: String(q.id || ("RF-Q-" + (idx + 1))),
      subject: String(q.subject || "General"),
      chapter: String(q.chapter || q.topic || "Core Syllabus"),
      exam: String(q.exam || "RankForge"),
      paper: String(q.paper || ""),
      type: q.type || (opts.length ? "mcq" : "numerical"),
      question: qText,
      options: opts,
      correctIndex: corrIdx,
      correctAnswer: (corrIdx >= 0 && opts[corrIdx] != null) ? String(opts[corrIdx]) : String(q.correctAnswer || q.answer || ""),
      solution: String(q.solution || q.explanation || "")
    };
  }

  function recordAnalysisPayload(payload) {
    if (!payload) return null;
    try { localStorage.removeItem("rf_active_exam"); } catch (e) {}
    var questions = (payload.questions || []).map(normalizeQuestion);
    var userAnswers = payload.userAnswers || payload.answers || {};
    var correct = 0, wrong = 0, skipped = 0;
    var bySubject = {};
    var byChapter = {};
    var mistakes = [];

    questions.forEach(function (q, i) {
      var sel = userAnswers[i] !== undefined ? userAnswers[i] : userAnswers[q.id];
      var isSkipped = (sel === undefined || sel === null || sel === "" || sel === -1);
      var isCorrect = false;
      if (!isSkipped) {
        if (q.type === "numerical") {
          var numU = parseFloat(String(sel).trim());
          var numC = parseFloat(String(q.correctAnswer).trim());
          isCorrect = (!isNaN(numU) && !isNaN(numC) && Math.abs(numU - numC) <= 0.05) ||
                      String(sel).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
        } else {
          isCorrect = Number(sel) === Number(q.correctIndex);
        }
      }
      var subj = q.subject || "General";
      var chap = q.chapter || "Core Concept";
      if (!bySubject[subj]) bySubject[subj] = { subject: subj, total: 0, correct: 0, wrong: 0, skipped: 0, score: 0, maxScore: 0 };
      if (!byChapter[chap]) byChapter[chap] = { chapter: chap, subject: subj, total: 0, correct: 0, wrong: 0, skipped: 0, score: 0 };

      bySubject[subj].total++;
      bySubject[subj].maxScore += 4;
      byChapter[chap].total++;

      if (isSkipped) {
        skipped++;
        bySubject[subj].skipped++;
        byChapter[chap].skipped++;
      } else if (isCorrect) {
        correct++;
        bySubject[subj].correct++;
        bySubject[subj].score += 4;
        byChapter[chap].correct++;
        byChapter[chap].score += 4;
      } else {
        wrong++;
        bySubject[subj].wrong++;
        bySubject[subj].score -= 1;
        byChapter[chap].wrong++;
        byChapter[chap].score -= 1;
        mistakes.push({
          id: q.id,
          subject: subj,
          chapter: chap,
          paper: q.paper || payload.title || "Practice Test",
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          correctAnswer: q.correctAnswer,
          userAnswer: sel,
          solution: q.solution,
          timestamp: new Date().toISOString()
        });
      }
    });

    var total = questions.length || (Number(payload.total) || (correct + wrong + skipped));
    if (!questions.length && payload.score !== undefined) {
      correct = Number(payload.correct || 0);
      wrong = Number(payload.wrong || 0);
      skipped = Number(payload.skipped || Math.max(0, total - correct - wrong));
    }
    var attempted = correct + wrong;
    var score = (correct * 4) - wrong;
    var maxScore = total * 4;
    var accuracy = attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0;
    var timeSpentSec = Math.max(1, Number(payload.timeSpentSec || payload.durationSec || 60));
    var speedQPerMin = Math.round((attempted / (timeSpentSec / 60)) * 100) / 100;

    var summary = {
      id: payload.id || ("RF-TEST-" + Date.now()),
      title: payload.title || "RankForge CBT Assessment",
      exam: payload.exam || "NEET / JEE",
      date: new Date().toISOString(),
      total: total,
      attempted: attempted,
      correct: correct,
      wrong: wrong,
      skipped: skipped,
      score: score,
      maxScore: maxScore,
      negativeLost: wrong,
      accuracy: accuracy,
      timeSpentSec: timeSpentSec,
      speedQPerMin: speedQPerMin,
      subjects: Object.keys(bySubject).map(function (k) { return bySubject[k]; }),
      chapters: Object.keys(byChapter).map(function (k) { return byChapter[k]; }).sort(function (a, b) { return b.wrong - a.wrong; }),
      mistakes: mistakes
    };

    safeSet("rf_last_analysis", summary);
    safeSet("CBT_LAST_RESULT", summary);
    var hist = safeGet("cbtHistory", []);
    if (!Array.isArray(hist)) hist = [];
    hist.unshift(summary);
    safeSet("cbtHistory", hist.slice(0, 100));

    if (mistakes.length) {
      var mBank = safeGet("rfMistakeBankV1", []);
      if (!Array.isArray(mBank)) mBank = [];
      var existingIds = {};
      mBank.forEach(function (m) { existingIds[m.id] = true; });
      mistakes.forEach(function (m) {
        if (!existingIds[m.id]) mBank.unshift(m);
      });
      safeSet("rfMistakeBankV1", mBank.slice(0, 500));
    }
    return summary;
  }

  function renderAnalysisUpgrade() {
    var path = (location.pathname.split("/").pop() || "").toLowerCase();
    if (path.indexOf("analysis") === -1) return;
    if (document.getElementById("rf-deep-analysis-mount")) return;

    var last = safeGet("rf_last_analysis", null) || safeGet("CBT_LAST_RESULT", null);
    var hist = safeGet("cbtHistory", []);
    if (!last && Array.isArray(hist) && hist.length) last = hist[0];
    if (!last) return;

    var box = document.createElement("section");
    box.id = "rf-deep-analysis-mount";
    box.style.cssText = "max-width:1080px;margin:18px auto;padding:18px;border-radius:16px;background:var(--rf-card,#131b31);color:var(--rf-text,#f1f5f9);border:1px solid var(--rf-line,#1e293b);box-shadow:0 8px 28px rgba(0,0,0,0.22);font-family:system-ui,-apple-system,sans-serif;";
    var subjRows = (last.subjects || []).map(function (s) {
      var acc = (s.correct + s.wrong) > 0 ? Math.round((s.correct / (s.correct + s.wrong)) * 100) : 0;
      return '<tr style="border-bottom:1px solid rgba(148,163,184,0.15);">' +
        '<td style="padding:10px 8px;font-weight:700;">' + s.subject + '</td>' +
        '<td style="padding:10px 8px;text-align:right;color:#4ade80;font-weight:700;">' + s.correct + '</td>' +
        '<td style="padding:10px 8px;text-align:right;color:#f87171;font-weight:700;">' + s.wrong + '</td>' +
        '<td style="padding:10px 8px;text-align:right;color:#94a3b8;">' + s.skipped + '</td>' +
        '<td style="padding:10px 8px;text-align:right;font-weight:700;">' + s.score + ' / ' + s.maxScore + '</td>' +
        '<td style="padding:10px 8px;text-align:right;color:#38bdf8;font-weight:700;">' + acc + '%</td>' +
      '</tr>';
    }).join("");

    var weakList = (last.chapters || []).filter(function (c) { return c.wrong > 0 || c.skipped > 0; }).slice(0, 6).map(function (c) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-radius:10px;background:rgba(15,23,42,0.5);border:1px solid rgba(148,163,184,0.14);">' +
        '<div><strong>' + c.chapter + '</strong> <span style="font-size:12px;opacity:0.75;">(' + c.subject + ')</span></div>' +
        '<div style="font-size:13px;"><span style="color:#f87171;font-weight:700;">❌ ' + c.wrong + ' wrong</span> · <span style="color:#94a3b8;">⏭ ' + c.skipped + ' skipped</span></div>' +
      '</div>';
    }).join("");

    box.innerHTML =
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px;">' +
        '<div>' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#38bdf8;font-weight:700;">RankForge Deep Test Intelligence</div>' +
          '<h2 style="margin:4px 0 0;font-size:20px;">' + (last.title || "Latest CBT Assessment") + '</h2>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<a href="./pyq-hub.html" style="padding:8px 14px;border-radius:10px;background:#0284c7;color:#fff;text-decoration:none;font-weight:700;font-size:13px;">🏛️ Practice PYQ Papers</a>' +
          '<a href="./index.html" style="padding:8px 14px;border-radius:10px;border:1px solid #334155;color:inherit;text-decoration:none;font-weight:600;font-size:13px;">⌂ Dashboard</a>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:18px;">' +
        '<div style="padding:12px;border-radius:12px;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.25);"><div style="font-size:12px;opacity:0.8;">Net Score (+4/-1)</div><div style="font-size:22px;font-weight:800;color:#38bdf8;">' + last.score + ' <span style="font-size:13px;font-weight:500;">/ ' + last.maxScore + '</span></div></div>' +
        '<div style="padding:12px;border-radius:12px;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.25);"><div style="font-size:12px;opacity:0.8;">Accuracy</div><div style="font-size:22px;font-weight:800;color:#4ade80;">' + last.accuracy + '%</div></div>' +
        '<div style="padding:12px;border-radius:12px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.25);"><div style="font-size:12px;opacity:0.8;">Negative Marks Lost</div><div style="font-size:22px;font-weight:800;color:#f87171;">-' + (last.negativeLost || last.wrong || 0) + '</div></div>' +
        '<div style="padding:12px;border-radius:12px;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.25);"><div style="font-size:12px;opacity:0.8;">Attempt Speed</div><div style="font-size:22px;font-weight:800;color:#c084fc;">' + (last.speedQPerMin || 0) + ' Q/m</div></div>' +
      '</div>' +
      (subjRows ? (
        '<h3 style="font-size:15px;margin:14px 0 8px;">Subject-Wise Breakdown</h3>' +
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
          '<thead><tr style="border-bottom:1px solid rgba(148,163,184,0.25);text-align:left;">' +
            '<th style="padding:8px;">Subject</th><th style="padding:8px;text-align:right;">Correct</th><th style="padding:8px;text-align:right;">Wrong</th><th style="padding:8px;text-align:right;">Skipped</th><th style="padding:8px;text-align:right;">Score</th><th style="padding:8px;text-align:right;">Accuracy</th>' +
          '</tr></thead><tbody>' + subjRows + '</tbody></table></div>'
      ) : '') +
      (weakList ? (
        '<h3 style="font-size:15px;margin:16px 0 8px;">Priority Chapters to Revise Next</h3>' +
        '<div style="display:grid;gap:8px;">' + weakList + '</div>'
      ) : '');

    if (document.body) {
      var firstMain = document.querySelector("main, .container, .dashboard") || document.body.firstChild;
      if (firstMain && firstMain.parentNode === document.body) {
        document.body.insertBefore(box, firstMain);
      } else {
        document.body.appendChild(box);
      }
    }
  }

  window.RankForgeFixpack = {
    normalizeQuestion: normalizeQuestion,
    recordAnalysis: recordAnalysisPayload,
    renderAnalysisUpgrade: renderAnalysisUpgrade
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderAnalysisUpgrade);
  } else {
    renderAnalysisUpgrade();
  }
})();

