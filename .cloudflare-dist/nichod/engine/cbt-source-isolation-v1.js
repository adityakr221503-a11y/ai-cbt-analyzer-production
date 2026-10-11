/*
================================================================
 CBT SOURCE ISOLATION V2
 Common renderer allowed.
 Source/runtime/session/analytics/report ownership is isolated.
================================================================
*/

(function () {
  "use strict";

  const PREFIX = "CBT_ISO_V2_";

  const MODES = Object.freeze({
    PDF: "PDF",
    RANKER: "RANKER",
    SERIES: "SERIES",
    NORMAL: "NORMAL"
  });

  function cleanMode(mode) {
    return String(mode || "").toUpperCase();
  }

  function key(mode, name) {
    return PREFIX + cleanMode(mode) + "_" + name;
  }

  function read(mode, name, fallback) {
    try {
      const raw = localStorage.getItem(key(mode, name));
      return raw == null ? fallback : JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function write(mode, name, value) {
    localStorage.setItem(
      key(mode, name),
      JSON.stringify(value)
    );
    return value;
  }

  function array(mode, name) {
    const value = read(mode, name, []);
    return Array.isArray(value) ? value : [];
  }

  function uniqueQuestions(list) {
    const seen = new Set();

    return (Array.isArray(list) ? list : []).filter(function (q, i) {
      if (!q || typeof q !== "object") return false;

      const id = String(
        q.id ||
        q.questionId ||
        q.uid ||
        ("q-" + i)
      );

      if (seen.has(id)) return false;

      seen.add(id);
      return true;
    });
  }

  function saveQuestions(mode, questions) {
    return write(
      mode,
      "QUESTION_POOL",
      uniqueQuestions(questions)
    );
  }

  function getQuestions(mode) {
    return array(mode, "QUESTION_POOL");
  }

  function saveSelection(mode, questions) {
    return write(
      mode,
      "SELECTED",
      uniqueQuestions(questions)
    );
  }

  function getSelection(mode) {
    return array(mode, "SELECTED");
  }

  function markUsed(mode, questions) {
    const old = new Set(array(mode, "USED"));

    uniqueQuestions(questions).forEach(function (q, i) {
      old.add(
        String(
          q.id ||
          q.questionId ||
          q.uid ||
          ("q-" + i)
        )
      );
    });

    write(mode, "USED", Array.from(old));
    return Array.from(old);
  }

  function getUnused(mode, questions) {
    const used = new Set(array(mode, "USED"));

    return uniqueQuestions(questions).filter(function (q, i) {
      const id = String(
        q.id ||
        q.questionId ||
        q.uid ||
        ("q-" + i)
      );

      return !used.has(id);
    });
  }

  function saveSession(mode, session) {
    return write(mode, "SESSION", session || {});
  }

  function getSession(mode) {
    return read(mode, "SESSION", null);
  }

  function addAttempt(mode, attempt) {
    const attempts = array(mode, "ATTEMPTS");
    attempts.push(
      Object.assign(
        {
          timestamp: Date.now(),
          mode: cleanMode(mode)
        },
        attempt || {}
      )
    );

    write(mode, "ATTEMPTS", attempts);
    return attempts;
  }

  function getAttempts(mode) {
    return array(mode, "ATTEMPTS");
  }

  function addMistake(mode, mistake) {
    const mistakes = array(mode, "MISTAKES");

    mistakes.push(
      Object.assign(
        {
          timestamp: Date.now(),
          mode: cleanMode(mode)
        },
        mistake || {}
      )
    );

    write(mode, "MISTAKES", mistakes);
    return mistakes;
  }

  function getMistakes(mode) {
    return array(mode, "MISTAKES");
  }

  function saveMastery(mode, mastery) {
    return write(mode, "MASTERY", mastery);
  }

  function getMastery(mode) {
    return read(mode, "MASTERY", []);
  }

  function saveAnalytics(mode, analytics) {
    return write(mode, "ANALYTICS", analytics || {});
  }

  function getAnalytics(mode) {
    return read(mode, "ANALYTICS", {});
  }

  function addReport(mode, report) {
    const reports = array(mode, "REPORTS");

    reports.push(
      Object.assign(
        {
          timestamp: Date.now(),
          mode: cleanMode(mode)
        },
        report || {}
      )
    );

    write(mode, "REPORTS", reports);
    return reports;
  }

  function getReports(mode) {
    return array(mode, "REPORTS");
  }

  function clearSession(mode) {
    [
      "SELECTED",
      "SESSION"
    ].forEach(function (name) {
      localStorage.removeItem(key(mode, name));
    });
  }

  function clearAllRuntime(mode) {
    [
      "QUESTION_POOL",
      "SELECTED",
      "USED",
      "SESSION",
      "ATTEMPTS",
      "MISTAKES",
      "MASTERY",
      "ANALYTICS",
      "REPORTS"
    ].forEach(function (name) {
      localStorage.removeItem(key(mode, name));
    });
  }

  window.CBTSourceIsolation = {
    PREFIX,
    MODES,
    key,
    read,
    write,
    array,
    uniqueQuestions,
    saveQuestions,
    getQuestions,
    saveSelection,
    getSelection,
    markUsed,
    getUnused,
    saveSession,
    getSession,
    addAttempt,
    getAttempts,
    addMistake,
    getMistakes,
    saveMastery,
    getMastery,
    saveAnalytics,
    getAnalytics,
    addReport,
    getReports,
    clearSession,
    clearAllRuntime
  };

  console.log(
    "CBT Source Isolation V2 loaded:",
    Object.keys(MODES).join(", ")
  );

})();



/* ============================================================
   FINAL PDF SESSION GUARD
   ============================================================ */
(function () {
  const PDF_SESSION_KEY = "CBT_ISO_V2_PDF_SESSION";
  const PDF_USED_KEY = "CBT_ISO_V2_PDF_USED";
  const PDF_QUESTIONS_KEY = "CBT_ISO_V2_PDF_QUESTIONS";
  const PDF_SELECTION_KEY = "CBT_ISO_V2_PDF_SELECTION";

  function pdfRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function pdfWrite(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function pdfUnique(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).filter(function (q, i) {
      if (!q || typeof q !== "object") return false;

      const id = String(
        q.id ||
        q.questionId ||
        q.uid ||
        ("pdf-q-" + i)
      );

      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  window.CBTPDFSessionGuard = {
    start: function (questions, sourceName) {
      const clean = pdfUnique(questions);

      const session = {
        id:
          "PDF-" +
          Date.now() +
          "-" +
          Math.random().toString(36).slice(2),
        source:
          String(sourceName || "PDF").trim(),
        questionCount: clean.length,
        createdAt: Date.now()
      };

      /*
       * New PDF = new pool.
       * Never append to the previous PDF pool.
       */
      pdfWrite(PDF_SESSION_KEY, session);
      pdfWrite(PDF_QUESTIONS_KEY, clean);
      pdfWrite(PDF_SELECTION_KEY, []);
      pdfWrite(PDF_USED_KEY, []);

      /*
       * Kill stale generic PDF test state only.
       */
      localStorage.removeItem("CBT_ACTIVE_TEST");

      return session;
    },

    getQuestions: function () {
      return pdfRead(PDF_QUESTIONS_KEY, []);
    },

    getUnused: function () {
      const questions = pdfUnique(
        pdfRead(PDF_QUESTIONS_KEY, [])
      );

      const used = new Set(
        pdfRead(PDF_USED_KEY, []).map(String)
      );

      return questions.filter(function (q, i) {
        const id = String(
          q.id ||
          q.questionId ||
          q.uid ||
          ("pdf-q-" + i)
        );
        return !used.has(id);
      });
    },

    select: function (limit) {
      const max = Math.min(
        180,
        Math.max(0, Number(limit) || 180)
      );

      const available = this.getUnused();

      /*
       * NEVER exceed 180.
       */
      const selected = available.slice(0, max);

      pdfWrite(PDF_SELECTION_KEY, selected);

      return selected;
    },

    markUsed: function (questions) {
      const used = new Set(
        pdfRead(PDF_USED_KEY, []).map(String)
      );

      for (const q of (Array.isArray(questions) ? questions : [])) {
        if (!q) continue;

        const id = String(
          q.id ||
          q.questionId ||
          q.uid ||
          ""
        );

        if (id) used.add(id);
      }

      pdfWrite(PDF_USED_KEY, Array.from(used));
    }
  };
})();
