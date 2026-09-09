"use strict";

/*
=========================================================
 PCB NICHOD — SYSTEM HEALTH + REAL PIPELINE VALIDATOR V1
=========================================================

Checks:
  PDF → NICHOD
  PYQ → verification
  unseen → candidate
  authoring → verification
  Ranker → selection
  CBT → metadata
  Result → Mistake Bank
  Mentor → adaptive plan

Subjects:
  Physics / Chemistry / Biology
=========================================================
*/

(function () {

  const REPORT_KEY =
    "pcbNichodSystemHealth";

  const PLAN_KEY =
    "pcbNichodAdaptivePlan";

  const SOURCES = [
    "pdfCbtQuestions",
    "rbSelectedQuestions",
    "cbtHistory",
    "pcbNichodAdaptivePlan",
    "pcbNichodMentorEvidence"
  ];

  const SUBJECTS = [
    "Physics",
    "Chemistry",
    "Biology"
  ];

  function read(key, fallback) {

    try {

      const value =
        JSON.parse(
          localStorage.getItem(key) || "null"
        );

      return value == null
        ? fallback
        : value;

    } catch (_) {

      return fallback;

    }

  }

  function clean(v) {

    return String(v ?? "")
      .replace(/\s+/g, " ")
      .trim();

  }

  function subject(q) {

    const s =
      clean(
        q?.subject ||
        q?.section ||
        q?.stream
      ).toLowerCase();

    if (s.includes("phys"))
      return "Physics";

    if (s.includes("chem"))
      return "Chemistry";

    if (s.includes("bio"))
      return "Biology";

    return "Other";

  }

  function questionText(q) {

    return clean(
      q?.question ||
      q?.text ||
      q?.questionText
    );

  }

  function options(q) {

    const o =
      q?.options ||
      q?.choices ||
      q?.option;

    if (Array.isArray(o))
      return o.filter(Boolean);

    return [];

  }

  function validateQuestion(q) {

    const errors = [];

    if (!questionText(q))
      errors.push("missing-question");

    if (
      options(q).length &&
      options(q).length < 2
    )
      errors.push("invalid-options");

    if (
      q?.correctAnswer == null &&
      q?.answer == null &&
      q?.correct == null
    )
      errors.push("missing-answer");

    return {
      valid:
        errors.length === 0,
      errors
    };

  }

  function validatePool(pool) {

    const result = {

      total: 0,
      valid: 0,
      invalid: 0,
      duplicates: 0,

      subjects: {
        Physics: 0,
        Chemistry: 0,
        Biology: 0,
        Other: 0
      },

      errors: {}

    };

    if (!Array.isArray(pool))
      return result;

    const seen = new Set();

    pool.forEach(q => {

      result.total++;

      const key =
        questionText(q)
          .toLowerCase();

      if (
        key &&
        seen.has(key)
      ) {

        result.duplicates++;

      } else if (key) {

        seen.add(key);

      }

      const s =
        subject(q);

      if (
        result.subjects[s] ==
        null
      )
        result.subjects.Other++;

      else
        result.subjects[s]++;

      const v =
        validateQuestion(q);

      if (v.valid) {

        result.valid++;

      } else {

        result.invalid++;

        v.errors.forEach(e => {

          result.errors[e] =
            (
              result.errors[e] || 0
            ) + 1;

        });

      }

    });

    return result;

  }

  function inspectGlobals() {

    return {

      unified:
        !!window.PCBNICHODUnified,

      pdf:
        !!window.PCBNICHODPDF,

      verifiedFeed:
        !!window.PCBNICHODVerifiedFeed,

      lifecycle:
        !!window.RankerV11Lifecycle,

      postTest:
        !!window.PCBNICHODPostTest,

      authoring:
        !!window.PCBNICHODAuthoring,

      unseen:
        !!window.PCBNICHODUnseen

    };

  }

  function inspectStorage() {

    const output = {};

    SOURCES.forEach(key => {

      const raw =
        localStorage.getItem(key);

      output[key] = {

        present:
          raw !== null,

        size:
          raw
            ? raw.length
            : 0

      };

    });

    return output;

  }

  function buildReport() {

    const pdfPool =
      read(
        "pdfCbtQuestions",
        []
      );

    const selected =
      read(
        "rbSelectedQuestions",
        []
      );

    const history =
      read(
        "cbtHistory",
        []
      );

    const evidence =
      read(
        "pcbNichodMentorEvidence",
        {}
      );

    const plan =
      read(
        PLAN_KEY,
        {}
      );

    return {

      version: 1,

      generatedAt:
        new Date().toISOString(),

      globals:
        inspectGlobals(),

      storage:
        inspectStorage(),

      pdf:
        validatePool(pdfPool),

      ranker:
        validatePool(selected),

      history: {

        present:
          Array.isArray(history),

        attempts:
          Array.isArray(history)
            ? history.length
            : 0

      },

      mentor: {

        evidencePresent:
          !!evidence &&
          typeof evidence === "object",

        planPresent:
          !!plan &&
          typeof plan === "object",

        nextAction:
          clean(
            plan?.nextAction?.action
          ) || null

      },

      subjects:
        SUBJECTS.reduce(
          (out, s) => {

            out[s] = {

              pdf:
                validatePool(
                  pdfPool.filter(
                    q =>
                      subject(q) === s
                  )
                ),

              ranker:
                validatePool(
                  selected.filter(
                    q =>
                      subject(q) === s
                  )
                )

            };

            return out;

          },
          {}
        )

    };

  }

  function healthScore(report) {

    let total = 0;
    let passed = 0;

    function check(ok) {

      total++;

      if (ok)
        passed++;

    }

    const g =
      report.globals;

    check(g.unified);
    check(g.pdf);
    check(g.verifiedFeed);
    check(g.lifecycle);
    check(g.postTest);
    check(g.authoring);
    check(g.unseen);

    check(
      report.pdf.total > 0
        ? report.pdf.valid > 0
        : true
    );

    check(
      report.ranker.total > 0
        ? report.ranker.valid > 0
        : true
    );

    check(
      report.history.present
    );

    check(
      report.mentor.planPresent
    );

    return {

      passed,
      total,

      percentage:
        total
          ? Math.round(
              passed /
              total *
              100
            )
          : 0

    };

  }

  function run() {

    const report =
      buildReport();

    report.health =
      healthScore(report);

    localStorage.setItem(
      REPORT_KEY,
      JSON.stringify(
        report,
        null,
        2
      )
    );

    return report;

  }

  function render(report) {

    const existing =
      document.getElementById(
        "nichodHealthPanel"
      );

    if (existing)
      existing.remove();

    const panel =
      document.createElement(
        "section"
      );

    panel.id =
      "nichodHealthPanel";

    panel.style.cssText =
      [
        "margin:16px",
        "padding:16px",
        "border:1px solid #ccc",
        "border-radius:14px",
        "font-family:system-ui",
        "background:#fff"
      ].join(";");

    const h =
      report.health;

    let html =
      "<h2>🧠 PCB NICHOD Health</h2>";

    html +=
      "<p><b>System score:</b> " +
      h.percentage +
      "% (" +
      h.passed +
      "/" +
      h.total +
      ")</p>";

    html +=
      "<p><b>PDF questions:</b> " +
      report.pdf.total +
      " | valid: " +
      report.pdf.valid +
      " | invalid: " +
      report.pdf.invalid +
      " | duplicates: " +
      report.pdf.duplicates +
      "</p>";

    html +=
      "<p><b>Ranker questions:</b> " +
      report.ranker.total +
      " | valid: " +
      report.ranker.valid +
      " | invalid: " +
      report.ranker.invalid +
      "</p>";

    html +=
      "<h3>Subjects</h3>";

    SUBJECTS.forEach(s => {

      const x =
        report.subjects[s];

      html +=
        "<div><b>" +
        s +
        "</b>: PDF " +
        x.pdf.total +
        " | Ranker " +
        x.ranker.total +
        "</div>";

    });

    html +=
      "<h3>Pipeline</h3>";

    Object.entries(
      report.globals
    ).forEach(
      ([key, value]) => {

        html +=
          "<div>" +
          (
            value
              ? "✅ "
              : "⚠️ "
          ) +
          key +
          "</div>";

      }
    );

    html +=
      "<p><b>Mentor next action:</b> " +
      (
        report.mentor.nextAction ||
        "No adaptive action recorded yet."
      ) +
      "</p>";

    panel.innerHTML =
      html;

    const target =
      document.body;

    if (target)
      target.appendChild(panel);

  }

  function boot() {

    const report =
      run();

    window.PCBNICHODHealth = {

      run,

      getReport:
        () =>
          read(
            REPORT_KEY,
            null
          ),

      validateQuestion,

      validatePool,

      healthScore

    };

    /*
      Do not force UI on every page.
      Show only on Ranker / PDF pages.
    */

    const path =
      location.pathname
        .toLowerCase();

    if (
      path.includes(
        "rankers-test-series"
      ) ||
      path.includes(
        "pdf-to-cbt"
      )
    ) {

      setTimeout(
        () => render(report),
        500
      );

    }

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

})();
