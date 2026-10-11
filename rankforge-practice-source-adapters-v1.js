(function () {
  "use strict";

  const VERSION = "RANKFORGE_PRACTICE_SOURCE_ADAPTERS_V1";

  function fabric() {
    if (!window.RankForgeUniversalSourceFabric)
      throw new Error("Universal Source Fabric unavailable");
    return window.RankForgeUniversalSourceFabric;
  }

  function clean(v) {
    return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  }

  function qtiItem(item, meta = {}) {
    const body = item.querySelector?.("qti-item-body");
    const text = clean(body?.textContent || item.textContent);

    const choices = [...(item.querySelectorAll?.(
      "qti-simple-choice,qti-choice"
    ) || [])]
      .map(x => clean(x.textContent))
      .filter(Boolean);

    return {
      id: item.getAttribute?.("identifier") || "",
      question: text,
      options: choices,
      sourceType: "qti",
      sourceId: meta.sourceId || "",
      license: meta.license || "source-dependent",
      provenance: meta.provenance || "QTI 3.x"
    };
  }

  function parseQTI(xml, meta = {}) {
    const doc = new DOMParser().parseFromString(
      String(xml),
      "application/xml"
    );

    if (doc.querySelector("parsererror"))
      throw new Error("Invalid QTI XML");

    return [...doc.querySelectorAll("assessmentItem")]
      .map(item => qtiItem(item, meta));
  }

  async function importQTI(xml, meta = {}) {
    const questions = parseQTI(xml, meta);

    return fabric().ingest(questions, {
      sourceType: "qti",
      sourceId: meta.sourceId || "qti-import",
      license: meta.license || "source-dependent",
      provenance: meta.provenance || "QTI 3.x"
    });
  }

  async function importAuthorizedAPI(data, meta = {}) {
    return fabric().ingest(data, {
      sourceType: meta.sourceType || "licensed-api",
      sourceId: meta.sourceId || "",
      license: meta.license || "requires-verification",
      provenance: meta.provenance || "Authorized API"
    });
  }

  async function importOpenStaxExercises(data, meta = {}) {
    if (!meta.licenseVerified)
      throw new Error(
        "LICENSE_VERIFICATION_REQUIRED: verify each source/content license before ingestion"
      );

    return fabric().ingest(data, {
      sourceType: "licensed-api",
      sourceId: meta.sourceId || "openstax-exercises",
      license: meta.license || "verified-source-license",
      provenance: "OpenStax Exercises API"
    });
  }

  window.RankForgePracticeSourceAdapters = {
    version: VERSION,
    parseQTI,
    importQTI,
    importAuthorizedAPI,
    importOpenStaxExercises
  };
})();
