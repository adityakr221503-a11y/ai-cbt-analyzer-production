
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
        const err = new Error(
          data.error || "Local RankForge AI proxy failed."
        );

        err.rankForgeProviderError = true;
        err.provider = data.provider || "OpenAI";
        err.code = data.code || null;
        err.quotaExhausted =
          data.code === "credit_balance_exhausted" ||
          data.type === "insufficient_quota" ||
          /no credits|quota|credit balance/i.test(
            String(data.error || "")
          );

        throw err;
      }

      return Array.isArray(data.questions)
        ? data.questions
        : [];
    },

    health() {
      return fetch("http://127.0.0.1:8787/health")
        .then(r => r.json());
    }
    ,
    async getStatus() {
      try {
        const r = await fetch("http://127.0.0.1:8787/health", {
          cache: "no-store"
        });
        const h = await r.json();

        return {
          connected: !!h.ok,
          provider: h.provider || null,
          model: h.model || null,
          mode: h.ok ? "LOCAL_PROXY" : "OFFLINE"
        };
      } catch (_) {
        return {
          connected: false,
          provider: null,
          model: null,
          mode: "OFFLINE"
        };
      }
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
