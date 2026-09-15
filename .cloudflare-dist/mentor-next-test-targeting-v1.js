/* Ranker Pro V315 — Mentor Next-Test Targeting Engine */
(function () {
  "use strict";

  const KEY = "rankerProMentorNextTestTargetingV1";
  const HISTORY_KEY = "cbtHistory";
  const VERIFICATION_KEY = "rankerProMentorRecoveryVerificationV1";
  const MISTAKE_KEYS = ["mistakeBank", "mistakes", "cbtMistakes", "cbtMistakeBank"];

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch (_) { return fallback; }
  }

  function history() {
    const h = read(HISTORY_KEY, []);
    return Array.isArray(h) ? h : [];
  }

  function mistakes() {
    for (const key of MISTAKE_KEYS) {
      const value = read(key, null);
      if (Array.isArray(value) && value.length) return value;
      if (value && Array.isArray(value.items) && value.items.length) return value.items;
    }
    return [];
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

  function subjectOf(x) {
    return String(x?.subject || x?.section || "").trim();
  }

  function buildTarget() {
    const h = history();
    const recent = h.slice(-5);
    const sums = {};
    recent.forEach(item => {
      const subject = subjectOf(item) || "Mixed";
      const s = score(item);
      if (Number.isFinite(s)) {
        sums[subject] ||= [];
        sums[subject].push(s);
      }
    });

    const ms = mistakes();
    const counts = {};
    ms.forEach(m => {
      const subject = subjectOf(m) || "Mixed";
      counts[subject] = (counts[subject] || 0) + 1;
    });

    const subjects = new Set([...Object.keys(sums), ...Object.keys(counts)]);
    let best = null;

    subjects.forEach(subject => {
      const vals = sums[subject] || [];
      const avg = vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : null;
      const mistakeCount = counts[subject] || 0;
      const scoreRisk = Number.isFinite(avg) ? Math.max(0, 75 - avg) : 0;
      const priority = scoreRisk + mistakeCount * 3;
      const candidate = {subject, average: avg, mistakes: mistakeCount, priority};
      if (!best || candidate.priority > best.priority) best = candidate;
    });

    const verification = read(VERIFICATION_KEY, {});
    if (verification.status === "REPLAN") {
      return {
        mode: "REPLAN",
        subject: best?.subject || "Mixed",
        reason: "Previous recovery verification requested a replan.",
        recommendedMix: ["weak-topic repair", "fresh questions", "timed check"],
        priority: (best?.priority || 0) + 10,
        generatedAt: Date.now()
      };
    }

    return {
      mode: best ? "TARGETED_REPAIR" : "BASELINE",
      subject: best?.subject || "Mixed",
      reason: best
        ? `Prioritize ${best.subject}: recent performance/mistake load is highest.`
        : "Not enough subject-level history; collect a baseline test.",
      recommendedMix: best ? ["weak-topic repair", "new concept check", "timed transfer"] : ["balanced baseline"],
      priority: best?.priority || 0,
      generatedAt: Date.now()
    };
  }

  function getTarget() {
    const target = buildTarget();
    localStorage.setItem(KEY, JSON.stringify(target));
    return target;
  }

  function render() {
    const t = getTarget();
    const detail = document.getElementById("mentorNextTestTargetDetail");
    const badge = document.getElementById("mentorNextTestTargetStatus");
    if (badge) badge.textContent = t.mode;
    if (detail) detail.textContent = `${t.subject}: ${t.reason} Next test: ${t.recommendedMix.join(" → ")}.`;
  }

  window.RankerProMentorNextTestTargetingV1 = { getTarget, render };
  document.addEventListener("DOMContentLoaded", render);
})();
