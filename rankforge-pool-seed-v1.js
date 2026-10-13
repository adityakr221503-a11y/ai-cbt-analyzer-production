/* RankForge pool seed v1 - fills the Ranker / DPP / AI question pool from your verified banks on first use,
   so Practice, Adaptive Practice, AI + Bank tests and the Command Center have real questions to work with. */
(function () {
  "use strict";
  var KEY = "rankerQuestionBank", FLAG = "rankforgePoolSeedV1";
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function list(d) { return Array.isArray(d) ? d : (d && (d.questions || d.items)) || []; }
  function ok(q) { return q && q.question && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4; }
  function topicOf(q) { try { if (window.RankForgeFix && RankForgeFix.inferTopic) var t = RankForgeFix.inferTopic(q); if (t && typeof t === "object") t = t.chapter || t.topic || t.name; return String(t || "General Biology"); } catch (e) {} return "General Biology"; }
  function norm(q, subject, idx, src) {
    var topic = subject === "Biology" ? topicOf(q) : (q.topic || q.chapter || subject);
    return { id: String(q.id || src + "-" + idx), question: String(q.question), options: q.options.map(String), correctIndex: q.correctIndex,
      correctAnswer: q.correctIndex, subject: subject, chapter: q.chapter || topic, topic: q.topic || topic, difficulty: q.difficulty || "medium",
      explanation: q.explanation || q.solution || "", source: src, sourceType: "CURATED" };
  }
  async function seed() {
    var have = list(read(KEY));
    if (have.length >= 150 && localStorage.getItem(FLAG) === "1") return false;
    var out = [];
    try {
      var t = list(await (await fetch("test180-questions.json", { cache: "no-store" })).json());
      t.forEach(function (q, i) { if (ok(q)) { var s = /chem/i.test(q.subject) ? "Chemistry" : /phys/i.test(q.subject) ? "Physics" : "Biology"; out.push(norm(q, s, i, "Test 180")); } });
    } catch (e) {}
    try {
      var b = list(await (await fetch("biology-7196-bank-readonly.json")).json()), picked = 0;
      for (var i = 0; i < b.length && picked < 150; i += 46) { if (ok(b[i])) { out.push(norm(b[i], "Biology", i, "Biology bank")); picked++; } }
    } catch (e) {}
    if (!out.length) return false;
    try { localStorage.setItem(KEY, JSON.stringify(out)); localStorage.setItem(FLAG, "1"); } catch (e) { return false; }
    try { if (window.RankForgeMasterPoolV2 && RankForgeMasterPoolV2.build) await RankForgeMasterPoolV2.build(); } catch (e) {}
    return true;
  }
  window.RFPoolSeed = { seed: seed };
  function go() {
    seed().then(function (fresh) {
      if (fresh && !sessionStorage.getItem("rfPoolSeedReloaded")) { sessionStorage.setItem("rfPoolSeedReloaded", "1"); location.reload(); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
