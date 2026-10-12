/*
 RANKFORGE NOTEBOOK ENGINE v1  (NotebookLM-style, source-grounded)
 - Sources: pasted text / .txt / .md / PDF (text layer)
 - Retrieval: sentence-aware chunks + BM25
 - Answers: grounded ONLY in your sources, with [n] citations
 - Outputs: summary, study guide, FAQ, key terms
 - Questions: source-grounded MCQs (AI server when connected, offline generator otherwise)
              every question carries sourceQuote + citation; ungrounded AI output is rejected
 - Connected: "Practice" hands questions to cbt.html; bank + analysis metadata (subject/topic/chapter)
 Works in browser (window.RankForgeNotebook) and node (module.exports).
*/
(function (root) {
  "use strict";

  var VERSION = "NOTEBOOK-1.0";
  var STOP = new Set(("a an the and or but if then else of on in at to for from by with without within into onto over under " +
    "is are was were be been being am do does did done has have had having it its this that these those there here which who whom whose " +
    "as not no nor so than too very can could should would may might must will shall about above after again against all any both each few " +
    "more most other some such only own same up down out off once also between during before because while their them they he she his her we you your i me my our").split(/\s+/));

  function tokens(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, " ").split(/\s+/)
      .filter(function (w) { return w.length > 1 && !STOP.has(w); });
  }
  function words(s) { return String(s || "").trim().split(/\s+/).filter(Boolean); }

  /* ---------------- chunking ---------------- */
  function splitSentences(text) {
    var t = String(text || "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ");
    var parts = t.split(/(?<=[.!?])\s+(?=[A-Z0-9(“"'])|\n{2,}|\n(?=[-•*\d]+[.)]?\s)/);
    return parts.map(function (p) { return p.replace(/\s+/g, " ").trim(); }).filter(function (p) { return p.length > 25; });
  }

  function chunkSource(src, target) {
    target = target || 110;
    var sents = splitSentences(src.text);
    var chunks = [], cur = [], count = 0;
    function flush() {
      if (!cur.length) return;
      chunks.push({ id: src.id + "#" + (chunks.length + 1), sourceId: src.id, sourceTitle: src.title, text: cur.join(" "), sentences: cur.slice() });
      cur = []; count = 0;
    }
    sents.forEach(function (s) {
      var n = words(s).length;
      if (count + n > target && cur.length) flush();
      cur.push(s); count += n;
    });
    flush();
    return chunks;
  }

  /* ---------------- BM25 ---------------- */
  function buildIndex(chunks) {
    var df = {}, total = 0;
    var docs = chunks.map(function (c) {
      var tk = tokens(c.text), tf = {};
      tk.forEach(function (w) { tf[w] = (tf[w] || 0) + 1; });
      Object.keys(tf).forEach(function (w) { df[w] = (df[w] || 0) + 1; });
      total += tk.length;
      return { chunk: c, tf: tf, len: tk.length };
    });
    return { docs: docs, df: df, N: docs.length, avg: docs.length ? total / docs.length : 0 };
  }

  function search(index, query, k) {
    var qt = tokens(query);
    if (!qt.length || !index.N) return [];
    var k1 = 1.4, b = 0.75;
    var scored = index.docs.map(function (d) {
      var s = 0;
      qt.forEach(function (w) {
        var f = d.tf[w]; if (!f) return;
        var idf = Math.log(1 + (index.N - (index.df[w] || 0) + 0.5) / ((index.df[w] || 0) + 0.5));
        s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / (index.avg || 1)));
      });
      return { chunk: d.chunk, score: s };
    }).filter(function (x) { return x.score > 0; });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, k || 5);
  }

  /* ---------------- sentence scoring / key terms ---------------- */
  function termFreq(chunks) {
    var tf = {};
    chunks.forEach(function (c) { tokens(c.text).forEach(function (w) { tf[w] = (tf[w] || 0) + 1; }); });
    return tf;
  }

  function keyTerms(chunks, n) {
    var tf = termFreq(chunks);
    var caps = {};
    chunks.forEach(function (c) {
      (c.text.match(/\b[A-Z][a-z]{3,}(?:\s[a-z]{3,})?\b/g) || []).forEach(function (m) { caps[m.toLowerCase()] = m; });
    });
    var list = Object.keys(tf).filter(function (w) { return w.length > 4 && tf[w] >= 2; })
      .sort(function (a, b) { return tf[b] - tf[a]; });
    var out = [];
    list.forEach(function (w) { if (out.length < (n || 15)) out.push(caps[w] || w); });
    return out;
  }

  function topSentences(chunks, n) {
    var tf = termFreq(chunks), sc = [];
    chunks.forEach(function (c) {
      c.sentences.forEach(function (s, i) {
        var tk = tokens(s); if (tk.length < 6 || tk.length > 45) return;
        var v = tk.reduce(function (a, w) { return a + (tf[w] || 0); }, 0) / Math.sqrt(tk.length);
        if (i === 0) v *= 1.15;
        sc.push({ s: s, v: v, cid: c.id, sourceTitle: c.sourceTitle });
      });
    });
    sc.sort(function (a, b) { return b.v - a.v; });
    return sc.slice(0, n || 6);
  }

  /* ---------------- grounded Q&A ---------------- */
  function citationsFor(hits, sources) {
    var order = [], map = {};
    hits.forEach(function (h) { if (!(h.chunk.id in map)) { map[h.chunk.id] = order.length + 1; order.push(h.chunk); } });
    return { map: map, list: order };
  }

  function answer(index, question) {
    var hits = search(index, question, 4);
    if (!hits.length || hits[0].score < 0.5) {
      return { ok: false, text: "I couldn't find this in your sources. Add a source that covers it, or rephrase using words from your notes.", citations: [] };
    }
    var qt = new Set(tokens(question));
    var cites = citationsFor(hits);
    var picked = [];
    hits.forEach(function (h) {
      var ranked = h.chunk.sentences.map(function (s) {
        var overlap = tokens(s).filter(function (w) { return qt.has(w); }).length;
        return { s: s, o: overlap };
      }).sort(function (a, b) { return b.o - a.o; });
      if (ranked[0] && ranked[0].o > 0) picked.push({ s: ranked[0].s, n: cites.map[h.chunk.id] });
      if (ranked[1] && ranked[1].o > 1) picked.push({ s: ranked[1].s, n: cites.map[h.chunk.id] });
    });
    var seen = {}, lines = [];
    picked.forEach(function (p) { if (!seen[p.s]) { seen[p.s] = 1; lines.push(p.s + " [" + p.n + "]"); } });
    return {
      ok: true,
      text: lines.slice(0, 4).join(" "),
      citations: cites.list.map(function (c, i) { return { n: i + 1, sourceTitle: c.sourceTitle, text: c.text.slice(0, 280) }; })
    };
  }

  /* ---------------- study outputs ---------------- */
  function summary(chunks) {
    var ts = topSentences(chunks, 6);
    var order = {}; chunks.forEach(function (c, i) { order[c.id] = i; });
    ts.sort(function (a, b) { return order[a.cid] - order[b.cid]; });
    return ts.map(function (x) { return x.s; });
  }

  function studyGuide(chunks) {
    return { keyTerms: keyTerms(chunks, 12), mustKnow: topSentences(chunks, 8).map(function (x) { return x.s; }), summary: summary(chunks) };
  }

  function faq(chunks, n) {
    var out = [];
    chunks.forEach(function (c) {
      c.sentences.forEach(function (s) {
        var m = s.match(/^([A-Z][\w\- ]{2,40}?)\s+(is|are|refers to|means|is defined as|can be defined as)\s+(.{20,200})$/);
        if (m && out.length < (n || 8)) out.push({ q: "What " + (m[2] === "are" ? "are " : "is ") + m[1].toLowerCase() + "?", a: s, cid: c.id });
      });
    });
    return out;
  }

  /* ---------------- question generation ---------------- */
  function shuffle(a, seed) {
    var r = a.slice(), s = seed || 7;
    function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (var i = r.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = r[i]; r[i] = r[j]; r[j] = t; }
    return r;
  }

  function offlineQuestions(chunks, title, count, subject) {
    var terms = keyTerms(chunks, 40);
    var termSet = new Set(terms.map(function (t) { return t.toLowerCase(); }));
    var out = [], used = {};
    var candidates = [];
    chunks.forEach(function (c) {
      c.sentences.forEach(function (s) {
        var tk = tokens(s); if (tk.length < 7 || tk.length > 40) return;
        var hit = null;
        (s.match(/\b[A-Za-z][A-Za-z\-]{4,}\b/g) || []).forEach(function (w) {
          if (!hit && termSet.has(w.toLowerCase())) hit = w;
        });
        if (hit) candidates.push({ s: s, term: hit, cid: c.id });
      });
    });
    candidates = shuffle(candidates, count + 3);
    for (var i = 0; i < candidates.length && out.length < count; i++) {
      var c = candidates[i];
      if (used[c.s]) continue;
      var key = c.term.toLowerCase();
      var distract = shuffle(terms.filter(function (t) { return t.toLowerCase() !== key && Math.abs(t.length - c.term.length) <= 5; }), i + 11).slice(0, 3);
      if (distract.length < 3) continue;
      used[c.s] = 1;
      var blank = c.s.replace(new RegExp("\\b" + c.term + "\\b", "i"), "_____");
      var opts = shuffle([c.term].concat(distract), i + 5);
      out.push({
        id: "NB-" + Date.now().toString(36) + "-" + out.length,
        question: "Fill in the blank using your notes:\n" + blank,
        options: opts,
        correctIndex: opts.indexOf(c.term),
        correctAnswer: c.term,
        explanation: "From your source: \"" + c.s + "\"",
        sourceQuote: c.s.split(/\s+/).slice(0, 25).join(" "),
        citation: c.cid,
        subject: subject || "Notebook",
        topic: title, chapter: title,
        difficulty: "Source-grounded (offline)",
        source: "NOTEBOOK", sourceType: "NOTEBOOK",
        generator: "offline-cloze", needsReview: true
      });
    }
    return out;
  }

  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  /* an AI question is only accepted if its quote really appears in the sources */
  function isGrounded(q, chunks) {
    var quote = norm(q.sourceQuote);
    if (quote.split(" ").length < 4) return false;
    var probe = quote.split(" ").slice(0, 8).join(" ");
    return chunks.some(function (c) { return norm(c.text).indexOf(probe) >= 0; });
  }

  async function aiQuestions(chunks, title, opts) {
    var fix = opts.fix;
    if (!fix || !fix.getEndpoint()) throw new Error("NO_ENDPOINT");
    var ctx = (opts.focusHits && opts.focusHits.length ? opts.focusHits.map(function (h) { return h.chunk; }) : chunks).slice(0, 14)
      .map(function (c, i) { return "[" + (i + 1) + "] " + c.text; }).join("\n\n");
    var res = await fix.generateQuestions({
      count: opts.count, subject: opts.subject || "Notebook", difficulty: opts.difficulty || "Rank Booster",
      topic: opts.focus || title, chapter: title, context: ctx
    });
    var grounded = [], dropped = 0;
    res.questions.forEach(function (q) {
      if (isGrounded(q, chunks)) { q.source = "NOTEBOOK"; q.sourceType = "NOTEBOOK"; q.topic = q.topic && q.topic !== "Mixed" ? q.topic : title; q.chapter = q.chapter && q.chapter !== "Mixed" ? q.chapter : title; q.generator = "ai-grounded"; grounded.push(q); }
      else dropped++;
    });
    return { questions: grounded, dropped: dropped };
  }

  async function generateQuestions(chunks, title, opts) {
    opts = opts || {};
    var count = Math.max(1, Math.min(opts.count || 10, 30));
    if (!chunks.length) return { questions: [], mode: "none", note: "Add a source first." };
    if (opts.fix && opts.fix.getEndpoint() && !opts.offlineOnly) {
      try {
        var r = await aiQuestions(chunks, title, { count: count, subject: opts.subject, difficulty: opts.difficulty, focus: opts.focus, focusHits: opts.focusHits, fix: opts.fix });
        if (r.questions.length) return { questions: r.questions, mode: "ai-grounded", note: r.dropped ? r.dropped + " AI question(s) rejected: not supported by your sources." : "" };
      } catch (e) {
        var offline = offlineQuestions(chunks, title, count, opts.subject);
        return { questions: offline, mode: "offline", note: "AI server unavailable (" + (e.message || e) + "). Used the offline generator instead." };
      }
    }
    return { questions: offlineQuestions(chunks, title, count, opts.subject), mode: "offline", note: "Offline generator used (connect the AI server in Owner Hub for deeper, exam-style questions)." };
  }

  /* ---------------- notebooks (storage) ---------------- */
  var NB_KEY = "rfNotebooksV1";

  function load() {
    try { return JSON.parse(localStorage.getItem(NB_KEY) || "[]"); } catch (_) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(NB_KEY, JSON.stringify(list)); return { ok: true }; }
    catch (e) { return { ok: false, error: "Storage full. Remove a source or notebook." }; }
  }

  function addSource(nb, title, text) {
    var clean = String(text || "").replace(/\u0000/g, "").trim();
    if (clean.length < 80) throw new Error("Source is too short (need at least a few sentences).");
    var src = { id: "S" + (nb.sources.length + 1) + "-" + Date.now().toString(36), title: title || "Source " + (nb.sources.length + 1), text: clean, addedAt: new Date().toISOString() };
    nb.sources.push(src);
    return src;
  }

  function chunksOf(nb) {
    var all = [];
    nb.sources.forEach(function (s) { chunkSource(s).forEach(function (c) { all.push(c); }); });
    return all;
  }

  /* ---------------- connect to practice / analysis ---------------- */
  function toPractice(questions, title) {
    var clean = questions.map(function (q, i) {
      return Object.assign({}, q, { id: q.id || ("NB-" + (i + 1)), testNumber: 1, questionNumber: i + 1, subject: q.subject || "Notebook", topic: q.topic || title, chapter: q.chapter || title });
    });
    sessionStorage.setItem("CBT_ACTIVE_QUESTIONS", JSON.stringify(clean));
    sessionStorage.setItem("CBT_ACTIVE_SOURCE", "NOTEBOOK");
    sessionStorage.setItem("CBT_ACTIVE_TEST", JSON.stringify({ source: "Notebook", sourceType: "NOTEBOOK", title: title, totalQuestions: clean.length, questions: clean }));
    sessionStorage.setItem("RF_HANDOFF_TS", String(Date.now()));
    sessionStorage.removeItem("RF_HANDOFF_CONSUMED");
    return clean.length;
  }

  /* make notebook questions visible to the DPP / mistake / analysis engines */
  function publishToBank(questions) {
    var key = "importedQuestions", cur = [];
    try { cur = JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { cur = []; }
    if (!Array.isArray(cur)) cur = (cur && cur.questions) || [];
    var have = new Set(cur.map(function (q) { return q && q.id; }));
    var added = 0;
    questions.forEach(function (q) { if (!have.has(q.id)) { cur.push(q); added++; } });
    try { localStorage.setItem(key, JSON.stringify(cur)); } catch (e) { return { ok: false, error: "Storage full" }; }
    return { ok: true, added: added };
  }

  var API = {
    version: VERSION, tokens: tokens, splitSentences: splitSentences, chunkSource: chunkSource,
    buildIndex: buildIndex, search: search, answer: answer, summary: summary, studyGuide: studyGuide, faq: faq,
    keyTerms: keyTerms, offlineQuestions: offlineQuestions, isGrounded: isGrounded, generateQuestions: generateQuestions,
    load: load, save: save, addSource: addSource, chunksOf: chunksOf, toPractice: toPractice, publishToBank: publishToBank
  };
  if (typeof window !== "undefined") window.RankForgeNotebook = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
