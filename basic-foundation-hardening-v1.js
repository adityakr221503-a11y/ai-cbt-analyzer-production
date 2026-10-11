(function () {
  "use strict";

  /*
   BASIC FOUNDATION HARDENING V1
   --------------------------------
   Additive / non-destructive layer.

   Protects:
   - cbtHistory
   - cbtTestSessions
   - retry/mastery linkage
   - score/accuracy/speed consistency
   - duplicate history entries
   - malformed localStorage
   - safe rendering helpers
   - export / restore-ready backup
   - cross-page data contract
  */

  const VERSION = "basic-foundation-hardening-v1";
  const HISTORY_KEY = "cbtHistory";
  const SESSION_KEY = "cbtTestSessions";
  const MASTERY_KEY = "cbtMasteryV2";
  const RETRY_KEY = "cbtRetryQuestion";
  const RETRY_QUEUE_KEY = "cbtAnalyzer.retryQueue";

  const isHistoryPage = !!document.getElementById("history");
  const isCBTPage = !!document.getElementById("result");

  function safeJSON(raw, fallback) {
    try {
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function read(key, fallback) {
    return safeJSON(localStorage.getItem(key), fallback);
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("[BasicFoundation] write failed:", key, e);
      return false;
    }
  }

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function cleanText(v, fallback) {
    const s = String(v == null ? "" : v).trim();
    return s || (fallback || "");
  }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function array(v) {
    return Array.isArray(v) ? v : [];
  }

  function questionsCount(t) {
    if (Array.isArray(t.questions) && t.questions.length) {
      return t.questions.length;
    }

    return Math.max(
      0,
      num(t.totalQuestions),
      num(t.total),
      num(t.correct) +
      num(t.incorrect ?? t.wrong) +
      num(t.skipped)
    );
  }

  function normalizeTest(t, index) {
    t = t && typeof t === "object" ? t : {};

    const correct = Math.max(0, num(t.correct));
    const wrong = Math.max(
      0,
      num(t.incorrect ?? t.wrong)
    );
    const skipped = Math.max(0, num(t.skipped));

    const total = Math.max(
      questionsCount(t),
      correct + wrong + skipped
    );

    const attempted = correct + wrong;

    let accuracy = num(t.accuracy);

    if (!Number.isFinite(accuracy) || accuracy < 0) {
      accuracy = total
        ? (correct / total) * 100
        : 0;
    }

    let duration = num(
      t.durationSeconds ??
      t.duration ??
      t.timeTakenSeconds
    );

    let speed = num(t.speed);

    if (
      (!speed || speed < 0) &&
      duration > 0 &&
      attempted > 0
    ) {
      speed = attempted / (duration / 60);
    }

    return {
      ...t,

      __basicFoundationVersion: VERSION,

      correct,
      wrong,
      incorrect: wrong,
      skipped,

      totalQuestions: total,
      total,

      attempted,

      accuracy: Math.round(
        Math.max(0, Math.min(100, accuracy)) * 10
      ) / 10,

      durationSeconds: Math.max(0, duration),

      speed: Math.max(0, Math.round(speed * 100) / 100),

      date: cleanText(
        t.date ??
        t.submittedAt ??
        t.completedAt,
        new Date().toISOString()
      ),

      source: cleanText(
        t.source ??
        t.testSource ??
        t.name,
        "CBT"
      ),

      subject: cleanText(
        t.subject ??
        t.testSubject,
        "Mixed"
      )
    };
  }

  function fingerprint(t) {
    const x = normalizeTest(t, 0);

    return [
      cleanText(t.sessionId),
      cleanText(t.testId),
      cleanText(t.id),
      cleanText(t.startedAt),
      cleanText(t.submittedAt),
      x.score,
      x.correct,
      x.wrong,
      x.skipped,
      x.total
    ].join("|");
  }

  /*
   --------------------------------------------------
   HISTORY HARDENING
   --------------------------------------------------
  */

  function hardenHistory() {
    const history = read(HISTORY_KEY, []);

    if (!Array.isArray(history)) {
      return [];
    }

    const output = [];
    const seen = new Set();

    history.forEach(function (item) {
      if (!item || typeof item !== "object") return;

      const normalized = normalizeTest(
        item,
        output.length
      );

      const fp = fingerprint(normalized);

      if (seen.has(fp)) return;

      seen.add(fp);
      output.push(normalized);
    });

    /*
     Never erase valid history merely because the
     normalized array is empty.
    */
    if (output.length || history.length === 0) {
      write(HISTORY_KEY, output);
    }

    return output;
  }

  /*
   --------------------------------------------------
   SESSION HARDENING
   --------------------------------------------------
  */

  function hardenSessions() {
    const sessions = read(SESSION_KEY, []);

    if (!Array.isArray(sessions)) {
      return [];
    }

    const output = [];
    const seen = new Set();

    sessions.forEach(function (item) {
      if (!item || typeof item !== "object") return;

      const fp = [
        cleanText(item.sessionId),
        cleanText(item.testId),
        cleanText(item.startedAt),
        cleanText(item.submittedAt)
      ].join("|");

      if (seen.has(fp)) return;

      seen.add(fp);

      output.push({
        ...item,
        __basicFoundationVersion: VERSION
      });
    });

    if (output.length || sessions.length === 0) {
      write(SESSION_KEY, output);
    }

    return output;
  }

  /*
   --------------------------------------------------
   SAFE ANALYTICS
   --------------------------------------------------
  */

  function analytics(history) {
    const list = array(history);

    const totalTests = list.length;

    const scores = list.map(
      x => num(x.score)
    );

    const bestScore = scores.length
      ? Math.max.apply(null, scores)
      : 0;

    const averageScore = scores.length
      ? scores.reduce((a, b) => a + b, 0) /
        scores.length
      : 0;

    const averageAccuracy = list.length
      ? list.reduce(
          (a, b) => a + num(b.accuracy),
          0
        ) / list.length
      : 0;

    const last5 = list.slice(-5);

    const last5Average = last5.length
      ? last5.reduce(
          (a, b) => a + num(b.score),
          0
        ) / last5.length
      : 0;

    const subjects = {};

    list.forEach(function (t) {
      const subject = cleanText(
        t.subject,
        "Mixed"
      );

      if (!subjects[subject]) {
        subjects[subject] = {
          tests: 0,
          correct: 0,
          wrong: 0,
          skipped: 0,
          total: 0
        };
      }

      const s = subjects[subject];

      s.tests++;
      s.correct += num(t.correct);
      s.wrong += num(
        t.incorrect ?? t.wrong
      );
      s.skipped += num(t.skipped);
      s.total += Math.max(
        num(t.totalQuestions),
        num(t.total)
      );
    });

    Object.keys(subjects).forEach(function (key) {
      const s = subjects[key];

      s.accuracy = s.total
        ? Math.round(
            s.correct / s.total * 1000
          ) / 10
        : 0;
    });

    return {
      version: VERSION,
      totalTests,
      bestScore,
      averageScore:
        Math.round(averageScore * 10) / 10,
      averageAccuracy:
        Math.round(averageAccuracy * 10) / 10,
      last5Average:
        Math.round(last5Average * 10) / 10,
      subjects
    };
  }

  /*
   --------------------------------------------------
   MISTAKE / RETRY / MASTERY HEALTH
   --------------------------------------------------
  */

  function learningState() {
    const mastery = read(MASTERY_KEY, {});
    const retry = read(RETRY_KEY, null);
    const queue = read(RETRY_QUEUE_KEY, []);

    return {
      mastery:
        mastery &&
        typeof mastery === "object"
          ? mastery
          : {},

      retry:
        retry &&
        typeof retry === "object"
          ? retry
          : null,

      retryQueue:
        Array.isArray(queue)
          ? queue
          : []
    };
  }

  /*
   --------------------------------------------------
   HEALTH CHECK
   --------------------------------------------------
  */

  function healthCheck() {
    const historyRaw =
      localStorage.getItem(HISTORY_KEY);

    const sessionRaw =
      localStorage.getItem(SESSION_KEY);

    const history =
      safeJSON(historyRaw, null);

    const sessions =
      safeJSON(sessionRaw, null);

    return {
      version: VERSION,

      historyValid:
        !historyRaw ||
        Array.isArray(history),

      sessionsValid:
        !sessionRaw ||
        Array.isArray(sessions),

      localStorageAvailable:
        (function () {
          try {
            const k =
              "__cbt_basic_health_test__";

            localStorage.setItem(k, "1");
            localStorage.removeItem(k);

            return true;
          } catch (_) {
            return false;
          }
        })(),

      historyCount:
        Array.isArray(history)
          ? history.length
          : 0,

      sessionCount:
        Array.isArray(sessions)
          ? sessions.length
          : 0
    };
  }

  /*
   --------------------------------------------------
   EXPORT
   --------------------------------------------------
  */

  function exportBackup() {
    const payload = {
      schema: VERSION,
      exportedAt:
        new Date().toISOString(),

      history:
        read(HISTORY_KEY, []),

      sessions:
        read(SESSION_KEY, []),

      mastery:
        read(MASTERY_KEY, {}),

      retry:
        read(RETRY_KEY, null),

      retryQueue:
        read(RETRY_QUEUE_KEY, [])
    };

    const blob = new Blob(
      [
        JSON.stringify(
          payload,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      "cbt-analyzer-basic-backup-" +
      new Date()
        .toISOString()
        .replace(/[:.]/g, "-") +
      ".json";

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1500
    );
  }

  /*
   --------------------------------------------------
   RESTORE-READY VALIDATION
   --------------------------------------------------
   Does NOT automatically overwrite data.
  */

  function validateBackup(payload) {
    if (
      !payload ||
      typeof payload !== "object"
    ) {
      return {
        valid: false,
        reason: "Invalid backup object"
      };
    }

    if (
      payload.history !== undefined &&
      !Array.isArray(payload.history)
    ) {
      return {
        valid: false,
        reason: "History is not an array"
      };
    }

    if (
      payload.sessions !== undefined &&
      !Array.isArray(payload.sessions)
    ) {
      return {
        valid: false,
        reason: "Sessions is not an array"
      };
    }

    return {
      valid: true,
      schema:
        payload.schema || "unknown"
    };
  }

  /*
   --------------------------------------------------
   CBT RESULT SAFETY
   --------------------------------------------------
   We do NOT control the CBT timer,
   submit button or active question lifecycle.
   We only harden persisted result data
   after the existing result event.
  */

  let resultHandled = false;

  function hardenAfterResult() {
    if (resultHandled) return;

    /*
     Result screen must actually be visible.
    */
    if (isCBTPage) {
      const result =
        document.getElementById("result");

      if (!result) return;

      const style =
        window.getComputedStyle(result);

      if (
        style.display === "none" ||
        style.visibility === "hidden"
      ) {
        return;
      }
    }

    resultHandled = true;

    hardenHistory();
    hardenSessions();

    window.dispatchEvent(
      new CustomEvent(
        "cbt:basic-foundation-hardened",
        {
          detail: {
            version: VERSION,
            health: healthCheck()
          }
        }
      )
    );
  }

  /*
   Existing CBT ecosystem events only.
   No MutationObserver.
   No interval.
   No timer modification.
  */

  document.addEventListener(
    "cbt:result-ready",
    hardenAfterResult
  );

  document.addEventListener(
    "cbt:orbit-ready",
    hardenAfterResult
  );

  window.addEventListener(
    "load",
    function () {
      /*
       History page can safely normalize
       already-persisted data.
      */
      if (isHistoryPage) {
        hardenHistory();
        hardenSessions();
      }

      /*
       CBT result may already be rendered
       before this script loads.
      */
      if (isCBTPage) {
        setTimeout(
          hardenAfterResult,
          0
        );
      }
    }
  );

  /*
   --------------------------------------------------
   PUBLIC API
   --------------------------------------------------
  */

  window.CBTBasicFoundation = {
    version: VERSION,

    read,

    write,

    normalizeTest,

    hardenHistory,

    hardenSessions,

    analytics,

    learningState,

    healthCheck,

    exportBackup,

    validateBackup,

    escapeHTML: esc
  };

  /*
   --------------------------------------------------
   HISTORY PAGE: ADDITIVE HEALTH PANEL
   --------------------------------------------------
  */

  function renderHistoryHealth() {
    if (!isHistoryPage) return;

    if (
      document.getElementById(
        "basicFoundationHealthV1"
      )
    ) return;

    const box =
      document.getElementById("history");

    if (!box) return;

    const health =
      healthCheck();

    const stats =
      analytics(
        hardenHistory()
      );

    const panel =
      document.createElement("section");

    panel.id =
      "basicFoundationHealthV1";

    panel.className =
      "card";

    panel.innerHTML = `
      <div class="basic-foundation-header-v1">
        <div>
          <h2>🛡️ Basic Foundation</h2>
          <p>Data integrity & learning system health</p>
        </div>

        <span class="basic-foundation-status-v1">
          ${health.localStorageAvailable &&
            health.historyValid &&
            health.sessionsValid
            ? "● Healthy"
            : "● Check required"}
        </span>
      </div>

      <div class="basic-foundation-grid-v1">

        <div>
          <strong>${stats.totalTests}</strong>
          <span>Verified Tests</span>
        </div>

        <div>
          <strong>${health.sessionCount}</strong>
          <span>Sessions</span>
        </div>

        <div>
          <strong>${stats.averageAccuracy}%</strong>
          <span>Avg Accuracy</span>
        </div>

        <div>
          <strong>${stats.last5Average}</strong>
          <span>Last 5 Avg</span>
        </div>

      </div>

      <div class="basic-foundation-actions-v1">

        <button
          type="button"
          id="basicFoundationExportV1">
          ⬇️ Backup Learning Data
        </button>

        <span>
          ${health.historyValid
            ? "History integrity OK"
            : "History needs recovery"}
          ·
          ${health.sessionsValid
            ? "Session integrity OK"
            : "Sessions need recovery"}
        </span>

      </div>
    `;

    const parent =
      box.closest(".card");

    if (
      parent &&
      parent.parentNode
    ) {
      parent.parentNode.insertBefore(
        panel,
        parent.nextSibling
      );
    } else {
      (
        document.querySelector(
          ".container"
        ) || document.body
      ).appendChild(panel);
    }

    const btn =
      document.getElementById(
        "basicFoundationExportV1"
      );

    if (btn) {
      btn.addEventListener(
        "click",
        exportBackup
      );
    }
  }

  const style =
    document.createElement("style");

  style.textContent = `
    #basicFoundationHealthV1{
      border:1px solid #e2e8f0;
    }

    .basic-foundation-header-v1{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:14px;
    }

    .basic-foundation-header-v1 h2{
      margin:0;
    }

    .basic-foundation-header-v1 p{
      margin:5px 0 0;
      color:#64748b;
      font-size:13px;
    }

    .basic-foundation-status-v1{
      white-space:nowrap;
      font-weight:800;
      font-size:13px;
      color:#166534;
      background:#f0fdf4;
      border-radius:999px;
      padding:7px 10px;
    }

    .basic-foundation-grid-v1{
      display:grid;
      grid-template-columns:
        repeat(4,1fr);
      gap:10px;
    }

    .basic-foundation-grid-v1>div{
      background:#f8fafc;
      border:1px solid #e2e8f0;
      border-radius:12px;
      padding:13px;
      text-align:center;
    }

    .basic-foundation-grid-v1 strong{
      display:block;
      font-size:21px;
    }

    .basic-foundation-grid-v1 span{
      display:block;
      margin-top:4px;
      color:#64748b;
      font-size:11px;
      font-weight:700;
    }

    .basic-foundation-actions-v1{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-top:14px;
      flex-wrap:wrap;
    }

    .basic-foundation-actions-v1 button{
      border:0;
      border-radius:10px;
      padding:10px 14px;
      background:#172033;
      color:#fff;
      font-weight:800;
      cursor:pointer;
    }

    .basic-foundation-actions-v1 span{
      color:#64748b;
      font-size:12px;
    }

    @media(max-width:650px){
      .basic-foundation-grid-v1{
        grid-template-columns:
          1fr 1fr;
      }
    }
  `;

  document.head.appendChild(style);

  if (isHistoryPage) {
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        renderHistoryHealth,
        { once:true }
      );
    } else {
      renderHistoryHealth();
    }
  }

})();
