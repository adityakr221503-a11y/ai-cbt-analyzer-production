/* Ranker Pro V314 — Mentor Recovery Verification Engine */
(function () {
  "use strict";
  const KEY = "rankerProMentorRecoveryVerificationV1";
  const HISTORY_KEY = "cbtHistory";

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch (_) { return fallback; }
  }
  function score(item) {
    if (!item || typeof item !== "object") return null;
    for (const v of [item.accuracy, item.scorePercent, item.percentage, item.percent]) {
      const n = Number(v);
      if (Number.isFinite(n)) return n <= 1 ? n * 100 : n;
    }
    const c = Number(item.correct ?? item.correctAnswers);
    const t = Number(item.total ?? item.totalQuestions);
    return Number.isFinite(c) && Number.isFinite(t) && t > 0 ? c / t * 100 : null;
  }
  function history() {
    const h = read(HISTORY_KEY, []);
    return Array.isArray(h) ? h : [];
  }
  function getState() {
    return read(KEY, {status:"WAITING",baseline:null,latest:null,delta:null,updatedAt:null});
  }
  function evaluate() {
    const s = getState(), h = history(), baseline = Number(s.baseline);
    if (!Number.isFinite(baseline) || !h.length) return s;
    const latest = score(h[h.length - 1]);
    if (!Number.isFinite(latest)) return s;
    const delta = latest - baseline;
    const status = delta >= 5 ? "VERIFIED" : delta <= -5 ? "REPLAN" : delta >= 2 ? "IMPROVING" : "REPEAT";
    const next = {...s, latest, delta, status, updatedAt:Date.now()};
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }
  function start(note) {
    const h = history(), baseline = score(h[h.length - 1]);
    const state = {status:Number.isFinite(baseline)?"IN_PROGRESS":"WAITING",
      baseline:Number.isFinite(baseline)?baseline:null,latest:null,delta:null,
      note:String(note||""),updatedAt:Date.now()};
    localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  }
  function render() {
    const s = evaluate();
    const d = document.getElementById("mentorRecoveryVerificationDetail");
    const b = document.getElementById("mentorRecoveryVerificationStatus");
    if (b) b.textContent = s.status || "WAITING";
    if (d) d.textContent = Number.isFinite(s.delta)
      ? `Baseline ${s.baseline.toFixed(1)}% → latest ${s.latest.toFixed(1)}% (${s.delta>=0?"+":""}${s.delta.toFixed(1)} pts).`
      : "Start recovery verification after a baseline test.";
  }
  window.RankerProMentorRecoveryVerificationV1 = {getState,start,evaluate,render};
  document.addEventListener("DOMContentLoaded", render);
})();
