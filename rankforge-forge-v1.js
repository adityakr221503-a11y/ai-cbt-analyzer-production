/* RankForge Forge v1: syllabus-vs-PYQ coverage and study priority (no AI needed). */
(function () {
  "use strict";
  var SKIP = { and: 1, with: 1, their: 1, from: 1, that: 1, this: 1, class: 1, unit: 1, the: 1 };
  function keywords(t) {
    var out = [], seen = {};
    String(t).toLowerCase().split(/[^a-z0-9]+/).forEach(function (w) { if (w.length > 3 && !SKIP[w] && !seen[w]) { seen[w] = 1; out.push(w); } });
    return out;
  }
  function coverage(sources) {
    var syl = [], pyq = [];
    (sources || []).forEach(function (s) {
      if (s.type === "NTA syllabus") syl.push(s.text);
      if (s.type === "PYQ") pyq.push(String(s.text).toLowerCase());
    });
    var seen = {}, T = [];
    syl.join("\n").split("\n").forEach(function (l) {
      l = l.replace(/^[\s\-\u2013\u2022*\d.)]+/, "").trim();
      if (l.length > 3 && l.length < 90 && !seen[l]) { seen[l] = 1; T.push(l); }
    });
    if (!T.length) return { error: 'Add a source of type "NTA syllabus" first (one topic per line).' };
    if (!pyq.length) return { error: 'Add at least one source of type "PYQ" first.' };
    var blocks = pyq.join("\n\n").split(/\n\s*\n|\n(?=\s*(?:q\.?\s*)?\d{1,3}[.)]\s)/).filter(function (b) { return b.trim().length > 20; });
    var topics = T.map(function (t) {
      var k = keywords(t), need = Math.min(k.length, 2), n = 0;
      if (k.length) blocks.forEach(function (b) { var h = 0; k.forEach(function (w) { if (b.indexOf(w) >= 0) h++; }); if (h >= need) n++; });
      return { t: t, n: n };
    });
    var priority = topics.slice().sort(function (a, b) { return a.n - b.n; });
    return { topics: topics, priority: priority, asked: topics.filter(function (x) { return x.n; }).length };
  }
  window.RankForgeForge = { coverage: coverage, keywords: keywords };
})();
