"use strict";

(function () {

  const PDF_KEY = "pdfCbtQuestions";
  const CORPUS_KEY = "pcbNichodCorpus";

  function clean(v) {
    return String(v ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getQuestions() {
    try {
      const raw =
        JSON.parse(
          localStorage.getItem(PDF_KEY) || "[]"
        );

      if (Array.isArray(raw))
        return raw;

      if (Array.isArray(raw.questions))
        return raw.questions;

      if (Array.isArray(raw.data))
        return raw.data;

    } catch (e) {
      console.warn(
        "PCB NICHOD: invalid PDF question storage",
        e
      );
    }

    return [];
  }

  function detectSubject(q) {

    const s = clean(
      q.subject ||
      q.section ||
      q.category ||
      ""
    ).toLowerCase();

    if (s.includes("physics"))
      return "Physics";

    if (s.includes("chemistry"))
      return "Chemistry";

    if (
      s.includes("biology") ||
      s.includes("botany") ||
      s.includes("zoology")
    )
      return "Biology";

    return q.subject || "";
  }

  function enrich(q, index) {

    const question = clean(
      q.question ||
      q.text ||
      q.prompt
    );

    if (!question)
      return null;

    return {
      ...q,

      nichod: true,

      nichodVersion:
        "PCB-NICHOD-1.0",

      nichodId:
        q.id ||
        `pdf-nichod-${Date.now()}-${index}`,

      subject:
        detectSubject(q),

      concepts:
        Array.isArray(q.concepts)
          ? q.concepts
          : [],

      relatedConcepts:
        Array.isArray(q.relatedConcepts)
          ? q.relatedConcepts
          : [],

      traps:
        Array.isArray(q.traps)
          ? q.traps
          : [],

      shortcuts:
        Array.isArray(q.shortcuts)
          ? q.shortcuts
          : [],

      pyqFamily:
        q.pyqFamily || "",

      verified:
        q.verified === true,

      diamond:
        q.diamond === true,

      unseen:
        q.unseen === true,

      nichodSource:
        "PDF-CBT"
    };
  }

  function merge(questions) {

    let old = [];

    try {
      const parsed =
        JSON.parse(
          localStorage.getItem(
            CORPUS_KEY
          ) || "[]"
        );

      if (Array.isArray(parsed))
        old = parsed;

    } catch (_) {}

    const map = new Map();

    [...old, ...questions]
      .forEach(q => {

        const key =
          clean(
            q.id ||
            q.nichodId ||
            q.question
          ).toLowerCase();

        if (key)
          map.set(key, q);
      });

    const corpus =
      Array.from(map.values());

    localStorage.setItem(
      CORPUS_KEY,
      JSON.stringify(corpus)
    );

    localStorage.setItem(
      "PCB_NICHOD_LAST_IMPORT",
      JSON.stringify({
        count: questions.length,
        corpusSize: corpus.length,
        timestamp:
          new Date().toISOString()
      })
    );

    return corpus;
  }

  function importPDF() {

    const source =
      getQuestions();

    if (!source.length) {
      console.log(
        "PCB NICHOD: no PDF questions available yet."
      );
      return [];
    }

    const enriched =
      source
        .map(enrich)
        .filter(Boolean);

    const corpus =
      merge(enriched);

    console.log(
      `PCB NICHOD: ${enriched.length} PDF questions → corpus (${corpus.length} total)`
    );

    return enriched;
  }

  window.PCBNICHODPDF = {
    importPDF,
    getQuestions,
    enrich,
    merge
  };

  /*
   * Initial attempt plus delayed attempt.
   * Delayed attempt matters because the PDF parser
   * may write pdfCbtQuestions asynchronously.
   */

  function boot() {
    importPDF();

    setTimeout(
      importPDF,
      1500
    );
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
