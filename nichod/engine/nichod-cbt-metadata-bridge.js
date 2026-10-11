"use strict";

/*
=========================================================
 PCB NICHOD — CBT METADATA BRIDGE v1
=========================================================
Preserves NICHOD intelligence when questions enter CBT.

Question
 ↓
NICHOD metadata
 ↓
CBT
 ↓
Result / Mistake Bank / Mentor
=========================================================
*/

(function () {

  const SELECTED_KEY =
    "rbSelectedQuestions";

  const SNAPSHOT_KEY =
    "pcbNichodCBTSnapshot";

  function read(key, fallback) {
    try {
      const x = JSON.parse(
        localStorage.getItem(key) || "null"
      );
      return x == null ? fallback : x;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  }

  function clean(x) {
    return String(x ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isNichod(q) {
    return !!(
      q &&
      (
        q.source === "PCB NICHOD" ||
        q.nichod === true ||
        q.verified === true &&
        q.unseen === true
      )
    );
  }

  function preserve(q, index) {

    if (!q)
      return q;

    if (!isNichod(q))
      return q;

    return Object.assign(
      {},
      q,
      {
        nichod: true,

        nichodIndex:
          Number.isFinite(index)
            ? index
            : null,

        nichodMetadata:
          Object.assign(
            {},
            q.nichodMetadata || {},
            {
              source:
                q.source ||
                "PCB NICHOD",

              concept:
                q.concept ||
                q.conceptTag ||
                "",

              trap:
                q.trap ||
                q.trapTag ||
                "",

              shortcut:
                q.shortcut ||
                q.shortcutTag ||
                "",

              chapter:
                q.chapter ||
                "",

              topic:
                q.topic ||
                "",

              subject:
                q.subject ||
                "",

              explanation:
                q.explanation ||
                q.solution ||
                "",

              variation:
                q.variationStrategy ||
                "",

              verified:
                q.verified === true,

              unseen:
                q.unseen === true
            }
          )
      }
    );

  }

  function snapshot(questions) {

    const pool =
      Array.isArray(questions)
        ? questions
        : [];

    const enriched =
      pool.map(
        preserve
      );

    const nichod =
      enriched.filter(
        isNichod
      );

    write(
      SNAPSHOT_KEY,
      {
        createdAt:
          new Date().toISOString(),

        total:
          enriched.length,

        nichodCount:
          nichod.length,

        questions:
          enriched
      }
    );

    return enriched;

  }

  function boot() {

    const pool =
      read(
        SELECTED_KEY,
        []
      );

    if (
      !Array.isArray(pool) ||
      !pool.length
    )
      return;

    const enriched =
      snapshot(pool);

    write(
      SELECTED_KEY,
      enriched
    );

    window.__PCB_NICHOD_CBT_METADATA =
      {
        total:
          enriched.length,

        nichodCount:
          enriched.filter(
            isNichod
          ).length
      };

  }

  window.PCBNICHODCBTBridge = {
    isNichod,
    preserve,
    snapshot,
    boot
  };

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
