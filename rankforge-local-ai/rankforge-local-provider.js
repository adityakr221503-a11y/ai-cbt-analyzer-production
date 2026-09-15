
(function () {
  "use strict";

  const ENDPOINT = "http://127.0.0.1:8787/generate";

  window.RankForgeLocalAI = {
    endpoint: ENDPOINT,

    async generateQuestions(options) {
      options = options || {};

      const prompt =
        options.prompt ||
        options.topicPrompt ||
        options.instructions ||
        options.query ||
        "";

      const count = Math.max(
        1,
        Math.min(
          Number(options.count || options.questionCount || 10),
          50
        )
      );

      if (!prompt.trim()) {
        throw new Error("RankForge AI prompt is empty.");
      }

      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          count
        })
      });

      const data = await r.json();

      if (!r.ok || !data.ok) {
        throw new Error(
          data.error || "Local RankForge AI proxy failed."
        );
      }

      return Array.isArray(data.questions)
        ? data.questions
        : [];
    },

    health() {
      return fetch("http://127.0.0.1:8787/health")
        .then(r => r.json());
    }
  };

  /*
   * Provider adapter:
   * If the existing RankForge AI object exposes a provider
   * registration API, use it without replacing the engine.
   */
  try {
    if (window.RankForgeAI) {
      window.RankForgeAI.localProvider = window.RankForgeLocalAI;

      if (typeof window.RankForgeAI.registerProvider === "function") {
        window.RankForgeAI.registerProvider(
          "local-openai",
          window.RankForgeLocalAI
        );
      }

      if (typeof window.RankForgeAI.setProvider === "function") {
        window.RankForgeAI.setProvider("local-openai");
      }
    }
  } catch (e) {
    console.warn("RankForge local provider adapter:", e);
  }

  console.log(
    "[RankForge] Local OpenAI provider ready:",
    ENDPOINT
  );
})();
