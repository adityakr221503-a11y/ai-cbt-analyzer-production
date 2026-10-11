/* RankForge canonical data layer v1 - single source of truth for mistakes and mastery.
   cbtMistakes  = array of wrong-answer records (written by the CBT when a test is submitted)
   cbtMasteryV2 = array of mastered-question records */
(function () {
  "use strict";
  var LS = window.localStorage;
  function rd(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function wr(k, v) { try { LS.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function norm(s) { return String(s == null ? "" : s).trim().toLowerCase().replace(/\s+/g, " "); }
  function masteredList() { return arr(rd("cbtMasteryV2", [])); }
  function masteredSet() {
    var s = new Set();
    masteredList().forEach(function (x) { if (x && x.question) s.add(norm(x.question)); });
    return s;
  }
  function activeMistakes() {
    var ms = masteredSet(), seen = new Set(), out = [];
    arr(rd("cbtMistakes", [])).forEach(function (q) {
      if (!q || !q.question) return;
      var k = norm(q.question);
      if (ms.has(k) || seen.has(k)) return;
      seen.add(k); out.push(q);
    });
    return out;
  }
  function opts(q) {
    var o = Array.isArray(q.options) ? q.options : Array.isArray(q.choices) ? q.choices : [];
    return o.map(function (x) {
      return x && typeof x === "object"
        ? String(x.text != null ? x.text : x.label != null ? x.label : x.value != null ? x.value : "")
        : String(x);
    });
  }
  function retryable(q) {
    if (!q || !q.question) return null;
    var o = opts(q), ci = -1, c = [q.correctIndex, q.answerIndex];
    for (var i = 0; i < c.length; i++) {
      var n = Number(c[i]);
      if (c[i] != null && c[i] !== "" && Number.isInteger(n) && n >= 0 && n < o.length) { ci = n; break; }
    }
    if (ci < 0 && q.correctAnswer != null) {
      var t = norm(q.correctAnswer);
      ci = o.findIndex(function (x) { return norm(x) === t; });
    }
    if (o.length < 2 || ci < 0) return null;
    return {
      id: String(q.id || q.questionId || ""),
      question: String(q.question),
      options: o,
      correctIndex: ci,
      explanation: String(q.solution || q.explanation || q.mistakeReason || q.reason || ""),
      topic: String(q.topic || q.chapter || q.subject || ""),
      raw: q
    };
  }
  function markMastered(q) {
    var raw = q.raw || q, list = masteredList(), k = norm(raw.question || q.question);
    if (!k || list.some(function (x) { return x && norm(x.question) === k; })) return false;
    list.push(Object.assign({}, raw, {
      question: raw.question || q.question, status: "mastered", mastered: true,
      masteredAt: new Date().toISOString()
    }));
    if (!wr("cbtMasteryV2", list)) return false;
    try { window.dispatchEvent(new Event("rankforge-mastery-updated")); } catch (e) {}
    return true;
  }
  function recordRetry(q, correct) {
    var s = rd("rankforgeRetryStatsV1", { attempts: 0, correct: 0 });
    if (!s || typeof s !== "object" || Array.isArray(s)) s = { attempts: 0, correct: 0 };
    s.attempts = (s.attempts || 0) + 1;
    if (correct) s.correct = (s.correct || 0) + 1;
    s.lastAt = Date.now();
    wr("rankforgeRetryStatsV1", s);
  }
  /* Repair data written by older scripts: wrong shapes, duplicates, and "mistakes" that were actually correct. */
  function repair() {
    var report = { removedCorrect: 0, removedDuplicates: 0, fixedShape: 0 };
    var m = rd("cbtMistakes", []);
    if (m && !Array.isArray(m) && typeof m === "object") { m = Object.keys(m).map(function (k) { return m[k]; }); report.fixedShape++; }
    var ms = rd("cbtMasteryV2", []);
    if (ms && !Array.isArray(ms) && typeof ms === "object") { ms = arr(ms.mastered); report.fixedShape++; }
    ms = arr(ms).filter(function (x) { return x && x.question; });
    var seen = new Set(), out = [];
    arr(m).forEach(function (q) {
      if (!q || !q.question) return;
      var k = norm(q.question);
      var ua = q.userAnswer != null ? q.userAnswer : q.selectedAnswer;
      var wasRight = (Number.isInteger(q.selectedIndex) && Number.isInteger(q.correctIndex) && q.selectedIndex === q.correctIndex) ||
        (ua != null && String(ua).trim() !== "" && q.correctAnswer != null && norm(ua) === norm(q.correctAnswer));
      if (wasRight) { report.removedCorrect++; return; }
      if (seen.has(k)) { report.removedDuplicates++; return; }
      seen.add(k); out.push(q);
    });
    wr("cbtMistakes", out); wr("cbtMasteryV2", ms);
    return report;
  }
  window.RFData = {
    norm: norm, read: rd, write: wr, mastered: masteredList, active: activeMistakes,
    retryable: retryable, markMastered: markMastered, recordRetry: recordRetry, repair: repair,
    retryStats: function () { return rd("rankforgeRetryStatsV1", { attempts: 0, correct: 0 }); }
  };
})();
