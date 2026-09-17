(function () {
  "use strict";

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function arr(key) {
    const v = read(key, []);
    return Array.isArray(v) ? v : [];
  }

  function countQuestions(key) {
    const v = arr(key);
    return v.length;
  }

  function getCounts() {
    const pdf =
      countQuestions("pdfCbtQuestions") ||
      countQuestions("pdfQuestionBank") ||
      countQuestions("pdfQuestions");

    const ranker =
      countQuestions("rankBoosterQuestionBankV1") ||
      countQuestions("rankForgeQuestionBank") ||
      countQuestions("rankerQuestionBank");

    const history = arr("cbtHistory");

    const mistakes =
      arr("rankBoosterAttemptHistory").length ||
      arr("cbtMistakes").length ||
      0;

    const retry =
      arr("rankforgeRetryQueueV2").length ||
      arr("retryQueue").length ||
      0;

    const adaptive =
      read("rankforgeAdaptiveDecisionV2", {}) || {};

    const dpp =
      read("rankforgeAdaptiveDPPV1", {}) || {};

    const weak =
      adaptive.topic ||
      adaptive.weakTopic ||
      dpp.topic ||
      "Mixed Weak Areas";

    return {
      pdf,
      ranker,
      history: history.length,
      mistakes,
      retry,
      weak
    };
  }

  const features = [
    {
      icon: "🏆",
      title: "Rankers Test Series",
      sub: "Pre-Test → Actual CBT → Analysis → Retry → Mastery",
      href: "rankers-test-series.html",
      count: c => c.ranker ? `${c.ranker} Ranker Questions` : "Ranker CBT"
    },
    {
      icon: "📄",
      title: "PDF → CBT",
      sub: "Import any PDF → Preview → Start CBT",
      href: "pdf-to-cbt.html",
      count: c => `${c.pdf} PDF Questions`
    },
    {
      icon: "🧠",
      title: "PCB NICHOD",
      sub: "Physics + Chemistry + Biology unified intelligence",
      href: "ranker-command-center.html",
      count: c => `${c.pdf} PDF Questions • ${c.ranker} Ranker Questions`
    },
    {
      icon: "🎯",
      title: "Adaptive AI / Weak-Topic DPP",
      sub: "Mistakes decide priority and next practice",
      href: "ranker-command-center.html",
      count: c => `Weak Area: ${c.weak}`
    },
    {
      icon: "📚",
      title: "Ranker Question Bank",
      sub: "Chapter • Topic • New • Weak • Adaptive",
      href: "question-bank.html",
      count: c => `${c.ranker} questions`
    },
    {
      icon: "🤖",
      title: "AI Question Practice",
      sub: "AI-generated practice and adaptive flow",
      href: "ai-question-lab.html",
      count: () => "AI Practice"
    },
    {
      icon: "📕",
      title: "Mistake Bank",
      sub: "Mistake → Reason → Revision → Retry → Mastery",
      href: "mistake.html",
      count: c => `${c.mistakes} recorded mistakes`
    },
    {
      icon: "🔄",
      title: "Retry / Mastery",
      sub: "Previously missed questions become practice",
      href: "retry.html",
      count: c => `${c.retry} retry queue`
    },
    {
      icon: "📊",
      title: "Test History",
      sub: "All previous CBT attempts and records",
      href: "history.html",
      count: c => `${c.history} tests`
    },
    {
      icon: "🧠",
      title: "Orbit Analysis",
      sub: "Detailed post-test performance analysis",
      href: "analysis.html",
      count: () => "Performance Intelligence"
    },
    {
      icon: "🧭",
      title: "Mentor / Next Best Action",
      sub: "Evidence-based next study action",
      href: "ranker-command-center.html",
      count: () => "AI Mentor"
    },
    {
      icon: "🎯",
      title: "720 Approach",
      sub: "Score-gap planning and target strategy",
      href: "ranker-command-center.html",
      count: () => "Score Strategy"
    },
    {
      icon: "⏱️",
      title: "Skip / Attempt Strategy",
      sub: "Attempt order, skipping and time control",
      href: "ranker-command-center.html",
      count: () => "Exam Strategy"
    },
    {
      icon: "📖",
      title: "Revision",
      sub: "Subject → Chapter → Quick revision",
      href: "ranker-revision/index.html",
      count: () => "NCERT Revision"
    },
    {
      icon: "🚀",
      title: "Start Learning",
      sub: "Direct entry into the complete CBT learning flow",
      href: "cbt.html",
      count: () => "Start CBT"
    }
  ];

  function render() {
    if (document.getElementById("rankforgeTopAllFeaturesV1")) return;

    const anchor =
      document.getElementById("rfConnectedShell") ||
      document.querySelector("main") ||
      document.body.firstElementChild ||
      document.body;

    const counts = getCounts();

    const section = document.createElement("section");
    section.id = "rankforgeTopAllFeaturesV1";

    section.innerHTML = `
      <style>
        #rankforgeTopAllFeaturesV1{
          max-width:1100px;
          margin:18px auto 22px;
          padding:0 15px;
          position:relative;
          z-index:100;
        }

        .rfhub-shell{
          background:#fff;
          border:1px solid rgba(100,116,139,.16);
          border-radius:24px;
          padding:20px;
          box-shadow:0 8px 28px rgba(15,23,42,.07);
        }

        .rfhub-head{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin-bottom:6px;
        }

        .rfhub-title{
          font-size:26px;
          font-weight:900;
          letter-spacing:-.5px;
          margin:0;
        }

        .rfhub-sub{
          color:#64748b;
          font-size:14px;
          line-height:1.5;
          margin-bottom:16px;
        }

        .rfhub-badge{
          white-space:nowrap;
          padding:8px 11px;
          border-radius:999px;
          background:#eef2ff;
          color:#3730a3;
          font-weight:800;
          font-size:12px;
        }

        .rfhub-grid{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:11px;
        }

        .rfhub-card{
          display:block;
          text-decoration:none;
          color:#0f172a;
          background:#f8fafc;
          border:1px solid rgba(100,116,139,.14);
          border-radius:17px;
          padding:15px;
          min-height:126px;
          transition:.15s;
        }

        .rfhub-card:hover{
          transform:translateY(-2px);
          border-color:#818cf8;
          box-shadow:0 7px 20px rgba(15,23,42,.08);
        }

        .rfhub-icon{
          font-size:25px;
          margin-bottom:8px;
        }

        .rfhub-card b{
          display:block;
          font-size:15px;
          line-height:1.3;
        }

        .rfhub-card span{
          display:block;
          margin-top:5px;
          color:#64748b;
          font-size:12px;
          line-height:1.4;
        }

        .rfhub-count{
          margin-top:9px !important;
          color:#3730a3 !important;
          font-weight:800;
        }

        .rfhub-primary{
          background:#eef2ff;
          border-color:#c7d2fe;
        }

        @media(max-width:700px){
          #rankforgeTopAllFeaturesV1{
            margin-top:10px;
          }

          .rfhub-shell{
            padding:15px;
            border-radius:20px;
          }

          .rfhub-title{
            font-size:22px;
          }

          .rfhub-grid{
            grid-template-columns:1fr 1fr;
            gap:9px;
          }

          .rfhub-card{
            min-height:122px;
            padding:13px;
          }
        }

        @media(max-width:430px){
          .rfhub-grid{
            grid-template-columns:1fr;
          }
        }

        /* Remove duplicate navigation/drawer from old connected view.
           Search remains available below the unified hub. */
        #rfConnectedShell .rf-quick,
        #rfConnectedShell .rf-all,
        #rfFeatureDrawer{
          display:none !important;
        }
      </style>

      <div class="rfhub-shell">
        <div class="rfhub-head">
          <h2 class="rfhub-title">⚡ RankForge AI — All Features</h2>
          <div class="rfhub-badge">ONE-CLICK HUB</div>
        </div>

        <div class="rfhub-sub">
          Tests, PDF CBT, PCB NICHOD, Adaptive AI, mistakes, retry,
          analysis, mentor and revision — everything organized in one place.
        </div>

        <div class="rfhub-grid">
          ${features.map((f, i) => `
            <a
              class="rfhub-card ${i < 4 ? "rfhub-primary" : ""}"
              href="${f.href}"
            >
              <div class="rfhub-icon">${f.icon}</div>
              <b>${f.title}</b>
              <span>${f.sub}</span>
              <span class="rfhub-count">${f.count(counts)}</span>
            </a>
          `).join("")}
        </div>
      </div>
    `;

    anchor.parentNode.insertBefore(section, anchor);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once:true });
  } else {
    render();
  }

  window.RankForgeTopAllFeaturesV1 = {
    render,
    getCounts
  };
})();
