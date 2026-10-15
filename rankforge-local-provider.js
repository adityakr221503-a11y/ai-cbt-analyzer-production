
(function () {
  "use strict";

  const BASE = "http://127.0.0.1:8787";
  const ENDPOINT = BASE + "/api/ai/generate";
  /* Local AI is opt-in: it only runs when this page itself runs on this device, or you switched it on. */
  function localEnabled() {
    try {
      var h = location.hostname;
      if (h === "localhost" || h === "127.0.0.1") return true;
      return localStorage.getItem("rankforgeLocalAi") === "on";
    } catch (e) { return false; }
  }
  const OFF_MESSAGE = "Local AI is off. It only works when the local AI server runs on this same device. Use the AI server in Owner Hub or the offline generator instead.";

  window.RankForgeLocalAI = {
    endpoint: ENDPOINT,

    async generateQuestions(options) {
      options = options || {};
      if (!localEnabled()) { const off = new Error(OFF_MESSAGE); off.rankForgeProviderError = true; off.code = "LOCAL_AI_OFF"; throw off; }

      function toPromptString(value) {
        if (typeof value === "string") return value;
        if (value == null) return "";

        if (Array.isArray(value)) {
          return value.map(toPromptString)
            .filter(Boolean)
            .join("\n");
        }

        if (typeof value === "object") {
          if (typeof value.text === "string") return value.text;
          if (typeof value.prompt === "string") return value.prompt;
          if (typeof value.instructions === "string") return value.instructions;
          if (typeof value.content === "string") return value.content;

          try {
            return JSON.stringify(value);
          } catch (_) {
            return String(value);
          }
        }

        return String(value);
      }

      const prompt = toPromptString(
        options.prompt ??
        options.topicPrompt ??
        options.instructions ??
        options.query ??
        options.input ??
        ""
      );

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
        body: JSON.stringify({ prompt, count, focus: prompt.slice(0, 200), subject: options.subject, difficulty: options.difficulty })
      });

      const data = await r.json();

      if (!r.ok || data.ok === false || !Array.isArray(data.questions)) {
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
      if (!localEnabled()) return Promise.resolve({ ok: false, off: true });
      return fetch(BASE + "/health")
        .then(r => r.json());
    }
    ,
    async getStatus() {
      if (!localEnabled()) return { connected: false, provider: null, model: null, mode: "OFFLINE" };
      try {
        const r = await fetch(BASE + "/health", {
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
    if (window.RankForgeAI && localEnabled()) {
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
