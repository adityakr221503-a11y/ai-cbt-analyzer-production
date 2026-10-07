
/* RANKFORGE_REFRESH_RUNTIME_V2 */
(function(){
  "use strict";

  window.RankForgeRefresh = {
    reload:function(){
      location.reload();
    },
    hardReload:function(){
      var u=new URL(location.href);
      u.searchParams.set("rf_refresh",Date.now());
      location.replace(u.toString());
    }
  };
})();

/*
=========================================================
 RANKFORGE V318 STABILITY LAYER
 Additive runtime safety layer.

 Goals:
 - source isolation
 - PDF/Ranker separation
 - safe storage
 - retryable resource loading
 - stale-state protection
 - duplicate boot protection
 - runtime diagnostics
 - cache/version awareness
=========================================================
*/
(function () {
  "use strict";

  if (window.__RANKFORGE_V318_STABILITY__) return;
  window.__RANKFORGE_V318_STABILITY__ = true;

  const VERSION = "V318-STABILITY-1";
  const SOURCE_KEY = "CBT_ACTIVE_SOURCE";
  const PDF_KEY = "pdfCbtQuestions";
  const ACTIVE_KEY = "CBT_ACTIVE_QUESTIONS";

  function safeJSON(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function read(storage, key, fallback) {
    try {
      const raw = storage.getItem(key);
      if (!raw) return fallback;
      const value = safeJSON(raw, fallback);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function write(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("[RankForge V318] storage write failed", key, e);
      return false;
    }
  }

  function array(value) {
    return Array.isArray(value) ? value : [];
  }

  function cleanText(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeOptions(options) {
    if (Array.isArray(options)) {
      return options
        .map(function (x) {
          if (x && typeof x === "object") {
            return cleanText(
              x.text ??
              x.value ??
              x.label ??
              x.option ??
              ""
            );
          }

          return cleanText(x);
        })
        .filter(Boolean);
    }

    if (options && typeof options === "object") {
      return Object.keys(options)
        .sort()
        .map(function (key) {
          const x = options[key];

          if (x && typeof x === "object") {
            return cleanText(
              x.text ??
              x.value ??
              x.label ??
              x.option ??
              ""
            );
          }

          return cleanText(x);
        })
        .filter(Boolean);
    }

    return [];
  }

  function normalizeQuestion(q, index, source) {
    q = q && typeof q === "object" ? q : {};

    const question = cleanText(
      q.question ??
      q.text ??
      q.questionText ??
      q.prompt ??
      q.stem ??
      ""
    );

    const options = normalizeOptions(
      q.options ??
      q.choices ??
      q.answers ??
      []
    );

    let answer =
      q.correctIndex ??
      q.correctAnswer ??
      q.answer ??
      q.correct ??
      null;

    if (typeof answer === "string") {
      const s = answer.trim();

      if (/^[A-D]$/i.test(s)) {
        answer = s.toUpperCase().charCodeAt(0) - 65;
      } else if (/^\d+$/.test(s)) {
        const n = Number(s);

        if (n >= 0 && n < options.length) {
          answer = n;
        } else if (n >= 1 && n <= options.length) {
          answer = n - 1;
        }
      } else {
        const found = options.findIndex(
          x => x === s
        );

        answer = found >= 0 ? found : null;
      }
    }

    if (
      !Number.isInteger(answer) ||
      answer < 0 ||
      answer >= options.length
    ) {
      answer = null;
    }

    return {
      ...q,
      id: q.id || `${source || "CBT"}-${index + 1}`,
      question,
      text: question,
      options,
      correctIndex: answer,
      source: source || q.source || "CBT"
    };
  }

  function getPDFPool() {
    const pool = read(
      localStorage,
      PDF_KEY,
      []
    );

    return array(pool)
      .map((q, i) =>
        normalizeQuestion(q, i, "PDF")
      )
      .filter(q => q.question && q.options.length >= 2)
      .map(function (q, i) {
        return {
          ...q,
          sourceType: "PDF",
          testNumber: 1,
          questionNumber: i + 1
        };
      });
  }

  function isPDFMode() {
    try {
      return (
        new URLSearchParams(
          location.search
        ).get("source") === "pdf"
      );
    } catch (_) {
      return false;
    }
  }

  function isUsablePDFPool() {
    return getPDFPool().length > 0;
  }

  function clearStalePDFState() {
    if (isPDFMode()) return;

    try {
      sessionStorage.removeItem("PDF_CBT_ACTIVE");
    } catch (_) {}

    try {
      delete window.PDF_CBT_ACTIVE_TEST;
      delete window.PDF_CBT_QUESTIONS;
      delete window.pdfCbtQuestions;
    } catch (_) {}
  }

  /*
   * Prevent a stale PDF test from silently taking over
   * ordinary Ranker/Biology CBT.
   */
  clearStalePDFState();

  /*
   * Public runtime API.
   */
  window.RankForgeV318 = {
    version: VERSION,

    isPDFMode,

    getPDFPool,

    hasPDFPool: isUsablePDFPool,

    clearStalePDFState,

    readStorage: function (key, fallback) {
      return read(localStorage, key, fallback);
    },

    writeStorage: function (key, value) {
      return write(localStorage, key, value);
    },

    markSource: function (source) {
      try {
        sessionStorage.setItem(
          SOURCE_KEY,
          String(source || "CBT")
        );
      } catch (_) {}
    },

    source: function () {
      try {
        return (
          sessionStorage.getItem(
            SOURCE_KEY
          ) || "CBT"
        );
      } catch (_) {
        return "CBT";
      }
    },

    setActiveQuestions: function (questions) {
      const safe = array(questions);

      write(
        sessionStorage,
        ACTIVE_KEY,
        safe
      );

      window.CBT_ACTIVE_QUESTIONS =
        safe.slice();

      window.selectedQuestions =
        safe.slice();

      return safe;
    }
  };

  /*
   * Retry helper for GitHub Pages/static assets.
   * Browser/network/cache failures should not immediately
   * become "Failed to fetch".
   */
  window.RankForgeV318FetchJSON =
    async function (url, options) {

      const attempts = 3;
      let lastError = null;

      for (let i = 1; i <= attempts; i++) {

        try {

          const separator =
            String(url).includes("?")
              ? "&"
              : "?";

          const cacheBusted =
            String(url) +
            separator +
            "rfv318=" +
            Date.now() +
            "_" +
            i;

          const response =
            await fetch(
              cacheBusted,
              {
                ...(options || {}),
                cache: "no-store"
              }
            );

          if (!response.ok) {
            throw new Error(
              "HTTP " +
              response.status
            );
          }

          return await response.json();

        } catch (error) {

          lastError = error;

          console.warn(
            "[RankForge V318] JSON attempt",
            i,
            "failed:",
            error
          );

          if (i < attempts) {
            await new Promise(
              resolve =>
                setTimeout(
                  resolve,
                  500 * i
                )
            );
          }
        }
      }

      throw lastError ||
        new Error("JSON load failed");
    };

  /*
   * Keep runtime errors visible but bounded.
   */
  function report(module, error) {
    try {
      const list =
        read(
          localStorage,
          "rankforgeRuntimeErrors",
          []
        );

      list.push({
        module,
        message: String(
          error?.message ||
          error ||
          "Unknown error"
        ),
        time:
          new Date().toISOString()
      });

      write(
        localStorage,
        "rankforgeRuntimeErrors",
        list.slice(-50)
      );
    } catch (_) {}
  }

  window.addEventListener(
    "error",
    function (event) {
      report(
        "V318.GlobalError",
        event.error ||
        event.message
      );
    }
  );

  window.addEventListener(
    "unhandledrejection",
    function (event) {
      report(
        "V318.Promise",
        event.reason
      );
    }
  );

  /*
   * Refresh after pageshow prevents stale runtime
   * state from surviving back/forward navigation.
   */
  window.addEventListener(
    "pageshow",
    function () {
      try {
        window.dispatchEvent(
          new CustomEvent(
            "rankforge:v318-ready",
            {
              detail: {
                version: VERSION,
                pdfMode: isPDFMode()
              }
            }
          )
        );
      } catch (_) {}
    }
  );

  console.log(
    "[RankForge V318] stability layer ready",
    VERSION
  );

})();
