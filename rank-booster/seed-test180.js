/*
 * RankForge Test180 seed adapter.
 * Loads the existing Test180 JSON without replacing it.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "rankforge.test180.seed.v1";

  function normalizePool(raw) {
    let data = raw;

    if (data && !Array.isArray(data)) {
      data =
        data.questions ||
        data.items ||
        data.data ||
        data.test ||
        [];
    }

    if (!Array.isArray(data)) return [];

    if (!global.RankForgeAI) return data;

    return global.RankForgeAI
      .deduplicate(data)
      .filter(global.RankForgeAI.validate);
  }

  function save(pool) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          questions: pool
        })
      );
    } catch (_) {}
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return normalizePool(parsed.questions || []);
    } catch (_) {
      return [];
    }
  }

  async function load(url) {
    try {
      const response = await fetch(url || "./test180-questions.json", {
        cache: "no-store"
      });

      if (!response.ok)
        throw new Error("HTTP " + response.status);

      const raw = await response.json();
      const pool = normalizePool(raw);

      if (pool.length) save(pool);

      return pool;
    } catch (error) {
      console.warn(
        "[RankForge] Test180 seed load failed:",
        error
      );

      return loadSaved();
    }
  }

  global.RankForgeSeed = {
    STORAGE_KEY,
    normalizePool,
    save,
    loadSaved,
    load
  };

})(window);
