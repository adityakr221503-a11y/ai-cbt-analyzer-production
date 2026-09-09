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

      /*
       * Ranker lifecycle is required on the Ranker page
       * and for an active Ranker CBT session.
       * It must not make PDF / dashboard pages unhealthy.
       */
      lifecycle:
        (
          location.pathname
            .toLowerCase()
            .includes("rankers-test-series")
          ||
          (
            location.pathname
              .toLowerCase()
              .endsWith("cbt.html") &&
            String(
              localStorage.getItem(
                "CBT_ACTIVE_SOURCE"
              ) || ""
            )
              .toLowerCase()
              .includes("ranker")
          )
        )
          ? !!window.RankerV11Lifecycle
          : true,

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

    report.status =
      report.health.percentage === 100
        ? "PASS"
        : "ATTENTION";

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
    /*
     * NICHOD health remains an engine/diagnostic API.
     * Do not render the internal health dashboard in
     * the student-facing application.
     */
    return null;
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
