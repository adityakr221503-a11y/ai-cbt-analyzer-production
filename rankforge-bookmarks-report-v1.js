/*
 RANKFORGE BOOKMARKS + REPORT v1  (loaded by cbt.html, bookmarks.html)
 - Bookmark any question during a test (kept in localStorage "rankforgeBookmarksV1")
 - Download / share a full test report after submitting (score with +4/-1 marks, topic-wise, mistakes)
*/
(function (root) {
  "use strict";
  var KEY = "rankforgeBookmarksV1";

  function load() { try { var v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-1000))); return true; } catch (_) { return false; } }
  function idOf(q) { return String(q.id || q.questionId || (q.question || "").slice(0, 60)); }
  function isMarked(q) { var id = idOf(q); return load().some(function (b) { return b.bid === id; }); }

  function toggle(q) {
    var list = load(), id = idOf(q), at = -1;
    list.forEach(function (b, i) { if (b.bid === id) at = i; });
    if (at >= 0) { list.splice(at, 1); save(list); return false; }
    var t = root.RankForgeFix ? root.RankForgeFix.inferTopic(q) : { subject: q.subject || "General", topic: q.topic || "Unclassified" };
    list.push({
      bid: id, id: q.id || id, question: q.question, options: q.options, correctIndex: q.correctIndex,
      correctAnswer: q.correctAnswer, explanation: q.explanation || "",
      subject: q.subject || t.subject, topic: q.topic || t.topic, chapter: q.chapter || q.topic || t.topic,
      source: q.source || "", savedAt: new Date().toISOString()
    });
    save(list);
    return true;
  }

  /* ---------- report ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function classify(a) {
    var rows = [];
    (a.questions || []).forEach(function (q, i) {
      var u = (a.answers || [])[i], t = root.RankForgeFix ? root.RankForgeFix.inferTopic(q) : { topic: q.topic || "Unclassified", subject: q.subject || "General" };
      var state = (u === null || u === undefined) ? "unanswered" :
        !(Number.isInteger(q.correctIndex) && q.correctIndex >= 0) ? "unverified" :
        Number(u) === Number(q.correctIndex) ? "correct" : "incorrect";
      rows.push({ i: i, q: q, u: u, state: state, topic: q.topic && !/^biology test/i.test(q.topic) ? q.topic : t.topic });
    });
    return rows;
  }

  function reportHTML(a) {
    var rows = classify(a), by = {};
    rows.forEach(function (r) {
      var b = by[r.topic] = by[r.topic] || { c: 0, w: 0, u: 0 };
      if (r.state === "correct") b.c++; else if (r.state === "incorrect") b.w++; else if (r.state === "unanswered") b.u++;
    });
    var topics = Object.keys(by).map(function (k) {
      var b = by[k], att = b.c + b.w; return { k: k, c: b.c, w: b.w, u: b.u, acc: att ? Math.round(100 * b.c / att) : 0 };
    }).sort(function (x, y) { return (x.acc - y.acc) || (y.w - x.w); });
    var marks = a.marks != null ? a.marks : (a.correct * 4 - a.incorrect), max = a.maxMarks || a.questionCount * 4;
    var pct = (a.correct + a.incorrect) ? Math.round(100 * a.correct / (a.correct + a.incorrect)) : 0;
    var rich = function (t) { return root.RankForgeFix ? root.RankForgeFix.richHTML(t) : "<p>" + esc(t) + "</p>"; };
    var wrong = rows.filter(function (r) { return r.state === "incorrect" || r.state === "unanswered"; }).map(function (r) {
      var q = r.q, ans = r.u == null ? "—" : String.fromCharCode(65 + Number(r.u)) + ". " + esc((q.options || [])[r.u]);
      var cor = q.correctIndex >= 0 ? String.fromCharCode(65 + q.correctIndex) + ". " + esc((q.options || [])[q.correctIndex]) : "not verified";
      return '<div class="m"><b>Q' + (r.i + 1) + " · " + esc(r.state) + " · " + esc(r.topic) + "</b>" + rich(q.question) +
        "<p><b>Your answer:</b> " + ans + "<br><b>Correct:</b> " + cor + "</p>" + (q.explanation ? "<p><i>" + esc(q.explanation) + "</i></p>" : "") + "</div>";
    }).join("");
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(a.title) + ' — Report</title><style>' +
      "body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px;color:#111}h1{font-size:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:7px;text-align:left;font-size:14px}th{background:#eef0ff}" +
      ".k{display:flex;gap:8px;flex-wrap:wrap}.k div{flex:1;min-width:110px;border:1px solid #ddd;border-radius:10px;padding:10px;text-align:center}.k b{display:block;font-size:20px}.m{border:1px solid #ddd;border-radius:10px;padding:10px;margin:10px 0;page-break-inside:avoid}.rf-list{padding-left:1.4em}" +
      "</style></head><body><h1>" + esc(a.title) + "</h1><p>" + esc(new Date(a.submittedAt || Date.now()).toLocaleString()) + " · Source: " + esc(a.source) + "</p>" +
      '<div class="k"><div><b>' + marks + " / " + max + "</b>Marks (+4 / −1)</div><div><b>" + a.correct + "</b>Correct</div><div><b>" + a.incorrect + "</b>Incorrect</div><div><b>" + a.unanswered + "</b>Unanswered</div><div><b>" + pct + "%</b>Accuracy</div></div>" +
      "<h2>Topic-wise (weakest first)</h2><table><tr><th>Topic</th><th>✓</th><th>✗</th><th>Skipped</th><th>Accuracy</th></tr>" +
      topics.map(function (t) { return "<tr><td>" + esc(t.k) + "</td><td>" + t.c + "</td><td>" + t.w + "</td><td>" + t.u + "</td><td>" + t.acc + "%</td></tr>"; }).join("") +
      "</table><h2>Mistakes and unanswered</h2>" + (wrong || "<p>None 🎉</p>") + "</body></html>";
  }

  function lastAttempt() {
    try { var h = JSON.parse(localStorage.getItem("cbtHistory") || "[]"); if (Array.isArray(h) && h.length) return h[h.length - 1]; } catch (_) {}
    return null;
  }

  /* plain-text summary: works everywhere, including the Android app (WebViews cannot save blob files) */
  function summaryText(a) {
    var rows = classify(a), by = {};
    rows.forEach(function (r) {
      var b = by[r.topic] = by[r.topic] || { c: 0, w: 0 };
      if (r.state === "correct") b.c++; else if (r.state === "incorrect") b.w++;
    });
    var weak = Object.keys(by).map(function (k) {
      var b = by[k], att = b.c + b.w; return { k: k, w: b.w, acc: att ? Math.round(100 * b.c / att) : 0, att: att };
    }).filter(function (t) { return t.att > 0; }).sort(function (x, y) { return (x.acc - y.acc) || (y.w - x.w); }).slice(0, 5);
    var marks = a.marks != null ? a.marks : (a.correct * 4 - a.incorrect), max = a.maxMarks || a.questionCount * 4;
    var pct = (a.correct + a.incorrect) ? Math.round(100 * a.correct / (a.correct + a.incorrect)) : 0;
    return "RankForge — " + a.title + "\n" +
      "Marks: " + marks + " / " + max + " (+4/−1)\n" +
      "Correct " + a.correct + " · Wrong " + a.incorrect + " · Skipped " + a.unanswered + " · Accuracy " + pct + "%\n" +
      (weak.length ? "Weakest topics:\n" + weak.map(function (t) { return " • " + t.k + " — " + t.acc + "% (" + t.w + " wrong)"; }).join("\n") : "");
  }

  async function shareSummary() {
    var a = lastAttempt();
    if (!a) { alert("No finished test found."); return false; }
    var text = summaryText(a);
    try { if (navigator.share) { await navigator.share({ title: a.title, text: text }); return true; } } catch (e) { if (e && e.name === "AbortError") return false; }
    try { await navigator.clipboard.writeText(text); alert("Summary copied. Paste it in WhatsApp or Notes."); return true; } catch (_) {}
    try {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select();
      var ok = document.execCommand("copy"); ta.remove(); if (ok) { alert("Summary copied. Paste it in WhatsApp or Notes."); return true; }
    } catch (_) {}
    prompt("Copy your summary:", text); return false;
  }

  async function downloadReport() {
    var a = lastAttempt();
    if (!a) { alert("No finished test found."); return false; }
    /* inside the Android app a file cannot be saved this way: share the text summary instead */
    if (root.Capacitor && typeof root.Capacitor.isNativePlatform === "function" && root.Capacitor.isNativePlatform()) return shareSummary();
    var html = reportHTML(a), name = "RankForge-report-" + String(a.id || Date.now()).replace(/[^a-z0-9-]/gi, "") + ".html";
    var blob = new Blob([html], { type: "text/html" });
    try {
      if (typeof File !== "undefined" && navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: "text/html" })] })) {
        await navigator.share({ files: [new File([blob], name, { type: "text/html" })], title: a.title });
        return true;
      }
    } catch (_) { /* user cancelled or unsupported: fall through */ }
    try {
      var url = URL.createObjectURL(blob), el = document.createElement("a");
      el.href = url; el.download = name; document.body.appendChild(el); el.click(); el.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return true;
    } catch (_) {
      var w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); return true; }
      alert("Could not create the file on this device. Use 'Save as PDF' instead."); return false;
    }
  }

  /* ---------- practice bookmarked ---------- */
  function practice() {
    var list = load();
    if (!list.length) { alert("No bookmarks yet."); return 0; }
    var qs = list.map(function (b, i) { return Object.assign({}, b, { testNumber: 1, questionNumber: i + 1 }); });
    sessionStorage.setItem("CBT_ACTIVE_QUESTIONS", JSON.stringify(qs));
    sessionStorage.setItem("CBT_ACTIVE_SOURCE", "BOOKMARKS");
    sessionStorage.setItem("CBT_ACTIVE_TEST", JSON.stringify({ source: "Bookmarks", sourceType: "BOOKMARKS", title: "Bookmarked Questions", questions: qs }));
    sessionStorage.setItem("RF_HANDOFF_TS", String(Date.now()));
    sessionStorage.removeItem("RF_HANDOFF_CONSUMED");
    location.href = "./cbt.html?source=bookmarks";
    return qs.length;
  }

  var API = { load: load, save: save, toggle: toggle, isMarked: isMarked, reportHTML: reportHTML, summaryText: summaryText, shareSummary: shareSummary, downloadReport: downloadReport, practice: practice, classify: classify };
  root.RankForgeBookmarks = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  /* ---------- cbt.html wiring ---------- */
  if (typeof document === "undefined" || !/\/cbt\.html$/i.test(location.pathname)) return;
  document.addEventListener("DOMContentLoaded", function () {
    var review = document.getElementById("reviewButton");
    if (review && !document.getElementById("bookmarkButton")) {
      var b = document.createElement("button");
      b.id = "bookmarkButton"; b.type = "button"; b.className = "secondary"; b.textContent = "🔖 Bookmark";
      review.parentNode.insertBefore(b, review.nextSibling);
      var paint = function () { var q = root.__RF_CURRENT_Q; b.textContent = q && isMarked(q) ? "🔖 Bookmarked" : "🔖 Bookmark"; };
      b.addEventListener("click", function () { if (root.__RF_CURRENT_Q) { toggle(root.__RF_CURRENT_Q); paint(); } });
      root.addEventListener("rf-question", paint);
    }
    var pdf = document.getElementById("pdfButton");
    if (pdf && !document.getElementById("reportButton")) {
      var r = document.createElement("button");
      r.id = "reportButton"; r.type = "button"; r.className = "secondary"; r.textContent = "⬇ Download report";
      pdf.parentNode.insertBefore(r, pdf);
      r.addEventListener("click", downloadReport);
      var sh = document.createElement("button");
      sh.id = "shareButton"; sh.type = "button"; sh.className = "secondary"; sh.textContent = "📤 Share summary";
      pdf.parentNode.insertBefore(sh, pdf);
      sh.addEventListener("click", shareSummary);
      var l = document.createElement("a");
      l.href = "./bookmarks.html"; l.textContent = "🔖 My bookmarks"; l.style.cssText = "align-self:center;margin-left:6px;font-weight:700";
      pdf.parentNode.appendChild(l);
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
