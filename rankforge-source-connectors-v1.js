(function () {
  "use strict";

  const VERSION = "RANKFORGE_SOURCE_CONNECTORS_V1";
  const registry = new Map();

  function register(cfg) {
    if (!cfg || !cfg.id || typeof cfg.fetch !== "function") {
      throw new Error("Invalid source connector");
    }
    registry.set(cfg.id, {
      id: cfg.id,
      name: cfg.name || cfg.id,
      type: cfg.type || "authorized",
      enabled: cfg.enabled !== false,
      license: cfg.license || "requires-verification",
      fetch: cfg.fetch
    });
    return true;
  }

  function list() {
    return [...registry.values()].map(({ fetch, ...x }) => x);
  }

  async function run(id, options = {}) {
    const c = registry.get(id);
    if (!c) throw new Error("Unknown connector: " + id);
    if (!c.enabled) throw new Error("Connector disabled: " + id);

    const result = await c.fetch(options);

    const fabric = window.RankForgeUniversalSourceFabric;
    if (!fabric) throw new Error("Universal Source Fabric unavailable");

    return fabric.ingest(result, {
      sourceType: id,
      sourceId: options.sourceId || id,
      license: c.license,
      provenance: options.provenance || c.name
    });
  }

  register({
    id: "owner-json",
    name: "Owner JSON",
    type: "owner",
    license: "owner",
    fetch: async o => o.data || []
  });

  register({
    id: "owner-jsonl",
    name: "Owner JSONL",
    type: "owner",
    license: "owner",
    fetch: async o => o.data || ""
  });

  register({
    id: "rankforge-ai",
    name: "RankForge AI",
    type: "generated",
    license: "rankforge-generated",
    fetch: async o => o.data || []
  });

  register({
    id: "licensed-api",
    name: "Authorized External API",
    type: "licensed",
    license: "requires-verification",
    fetch: async o => {
      if (!o.fetcher || typeof o.fetcher !== "function") {
        throw new Error("Authorized API fetcher not configured");
      }
      return o.fetcher();
    }
  });

  register({
    id: "qti",
    name: "QTI 3.x",
    type: "standard",
    license: "source-dependent",
    fetch: async o => o.data || []
  });

  window.RankForgeSourceConnectors = {
    version: VERSION,
    register,
    list,
    run,
    health: () => ({
      version: VERSION,
      connectors: list(),
      universalFabric: !!window.RankForgeUniversalSourceFabric
    })
  };
})();
