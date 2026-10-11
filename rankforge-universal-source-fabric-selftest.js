(function () {
  const F = window.RankForgeUniversalSourceFabric;
  const tests = [];

  function t(name, ok) {
    tests.push({ name, ok: !!ok });
  }

  t("VERSION", !!F && F.version === "RANKFORGE_UNIVERSAL_SOURCE_FABRIC_V1");
  t("SOURCE_LIST", F && F.sources.length >= 7);

  const q = F.normalize({
    question: "What is the SI unit of force?",
    options: ["Newton", "Joule", "Watt", "Pascal"],
    correctAnswer: 0
  }, {
    sourceType: "owner-json",
    license: "owner"
  });

  t("NORMALIZE", q.question && q.options.length === 4);
  t("VALIDATION", F.validate(q).valid);
  t("HASH", /^[0-9a-f]{8}$/.test(F.hash("rankforge")));
  t("JSON_FORMAT", F.detectFormat("questions.json", "{}") === "json");
  t("JSONL_FORMAT", F.detectFormat("questions.jsonl", "{}") === "jsonl");
  t("PDF_FORMAT", F.detectFormat("module.pdf", "") === "pdf-v6");

  const parsed = F.parse(JSON.stringify([q]), {
    sourceType: "owner-json"
  });

  t("PARSER", parsed.normalized.length === 1);
  t("NO_GUESSING", q.correctAnswer !== null);
  t("SINGLE_PIPELINE", F.health().singleCanonicalPipeline === true);
  t("NO_PARALLEL_DB", F.health().parallelQuestionDatabase === false);

  const failed = tests.filter(x => !x.ok);

  console.log("===== RANKFORGE UNIVERSAL SOURCE FABRIC V1 =====");
  tests.forEach(x => console.log((x.ok ? "PASS " : "FAIL ") + x.name));
  console.log("===============================================");
  console.log("RESULT:", failed.length ? "FAILED" : "ALL " + tests.length + " CHECKS PASSED");

  if (failed.length) throw new Error("Universal Source Fabric self-test failed");
})();
