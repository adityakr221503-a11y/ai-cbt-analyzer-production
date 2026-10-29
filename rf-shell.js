/*
  RANKFORGE SHELL v2.0 (Stabilized Navigation, Unbroken Typography & Exam Guard)
  - Persistent Top App Bar with working Back + Home + PYQ Hub + Analysis + Mistakes buttons
  - Prevents Android WebView history loops (cbt.html <-> analysis.html) and hardware back-button traps
  - Replaces `overflow-wrap: anywhere` mid-word breaking with clean `word-break: normal; overflow-wrap: break-word; hyphens: none`
  - Cleans OCR split hyphenations ("photo- synthesis" -> "photosynthesis") automatically
  - Exposes both `window.RankForgeShell` and `window.rfShell` so all onclick handlers work
*/
(function () {
  "use strict";
  var KEY = "rfTheme";
  var STACK_KEY = "rf_nav_stack_v2";
  var root = document.documentElement;
  var path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (!path || path === "/") path = "index.html";

  /* ------------------------------------------------------------ 1. Theme Engine */
  function pref() {
    try { return localStorage.getItem(KEY) || "dark"; } catch (e) { return "dark"; }
  }
  function resolve(p) {
    if (p === "light" || p === "dark") return p;
    try { return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"; } catch (e) { return "dark"; }
  }
  function apply(p) {
    var mode = resolve(p || pref());
    root.setAttribute("data-rf-theme", mode);
    root.style.colorScheme = mode;
    var btn = document.getElementById("rf-shell-theme-btn");
    if (btn) btn.textContent = mode === "light" ? "🌙 Dark" : "☀️ Light";
  }
  function setPref(p) {
    try { localStorage.setItem(KEY, p); } catch (e) {}
    apply(p);
  }
  function toggleTheme() {
    var cur = resolve(pref());
    setPref(cur === "light" ? "dark" : "light");
  }
  apply(pref());

  /* ------------------------------------------------------------ 2. Safe Navigation Stack (No Loops) */
  function getStack() {
    try {
      var raw = sessionStorage.getItem(STACK_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveStack(arr) {
    try { sessionStorage.setItem(STACK_KEY, JSON.stringify(arr.slice(-15))); } catch (e) {}
  }
  function recordVisit() {
    var stack = getStack();
    var cur = path + (location.search || "");
    if (!stack.length || stack[stack.length - 1] !== cur) {
      stack.push(cur);
      saveStack(stack);
    }
  }
  recordVisit();

  function clearStaleExamLock() {
    try { localStorage.removeItem("rf_active_exam"); } catch (e) {}
  }

  function goHome() {
    clearStaleExamLock();
    location.href = "./index.html";
  }

  function goBack() {
    clearStaleExamLock();
    // If on index.html already, scroll to top or close any open drawer
    if (path === "index.html") {
      var sheet = document.getElementById("rf-shell-sheet");
      if (sheet && sheet.classList.contains("open")) {
        sheet.classList.remove("open");
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    var stack = getStack();
    // Pop current page
    while (stack.length && stack[stack.length - 1].split("?")[0].toLowerCase() === path) {
      stack.pop();
    }
    // Avoid bouncing back from analysis.html into a finished cbt.html session
    var isAnalysis = path.indexOf("analysis") !== -1 || path.indexOf("result") !== -1;
    while (stack.length) {
      var candidate = stack.pop();
      var candBase = candidate.split("?")[0].toLowerCase();
      if (isAnalysis && (candBase.indexOf("cbt") !== -1 || candBase.indexOf("examhall") !== -1)) {
        continue;
      }
      saveStack(stack);
      location.href = "./" + candidate;
      return;
    }
    saveStack([]);
    location.href = "./index.html";
  }

  // Android WebView hardware Back button safety net on subpages
  if (path !== "index.html") {
    try {
      if (window.history && window.history.length <= 1) {
        window.history.replaceState({ rfGuard: true }, "", location.href);
        window.history.pushState({ rfSubpage: true }, "", location.href);
      }
      window.addEventListener("popstate", function (ev) {
        if (ev.state && ev.state.rfGuard) {
          goHome();
        }
      });
    } catch (e) {}
  }

  /* ------------------------------------------------------------ 3. Unbroken Typography & Shell CSS */
  function injectStyles() {
    if (document.getElementById("rf-shell-v2-styles")) return;
    var st = document.createElement("style");
    st.id = "rf-shell-v2-styles";
    st.textContent = [
      ":root[data-rf-theme='dark'] { --rf-bg: #0b1020; --rf-card: #131b31; --rf-text: #f1f5f9; --rf-muted: #94a3b8; --rf-line: #1e293b; --rf-accent: #38bdf8; }",
      ":root[data-rf-theme='light'] { --rf-bg: #f8fafc; --rf-card: #ffffff; --rf-text: #0f172a; --rf-muted: #475569; --rf-line: #e2e8f0; --rf-accent: #0284c7; }",
      "/* Fix mid-word breaking across all cards, questions, options, and analysis panels */",
      "html, body, p, div, span, li, td, th, label, article, section, .question-text, .option-text, .analysis-card, .card, .rf-card {",
      "  word-break: normal !important;",
      "  overflow-wrap: break-word !important;",
      "  word-wrap: break-word !important;",
      "  hyphens: none !important;",
      "  -webkit-hyphens: none !important;",
      "}",
      "button, .btn, .badge, .pill, .chip, .tab, .rf-shell-btn, .rf-shell-link {",
      "  white-space: nowrap !important;",
      "  word-break: keep-all !important;",
      "  hyphens: none !important;",
      "}",
      ".option-row, .option-item, .flex-row > *, .grid > * { min-width: 0; }",
      "body { padding-top: 56px !important; overflow-x: hidden !important; }",
      "#rf-shell-top {",
      "  position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important;",
      "  height: 52px !important; z-index: 2147483640 !important;",
      "  display: flex !important; align-items: center !important; justify-content: space-between !important;",
      "  gap: 8px !important; padding: 0 12px !important;",
      "  background: var(--rf-card, #131b31) !important; color: var(--rf-text, #f1f5f9) !important;",
      "  border-bottom: 1px solid var(--rf-line, #1e293b) !important;",
      "  box-shadow: 0 2px 10px rgba(0,0,0,0.22) !important;",
      "  font-family: system-ui, -apple-system, sans-serif !important;",
      "}",
      ".rf-shell-left, .rf-shell-right { display: flex !important; align-items: center !important; gap: 6px !important; }",
      ".rf-shell-btn {",
      "  display: inline-flex !important; align-items: center !important; gap: 5px !important;",
      "  padding: 6px 11px !important; border-radius: 8px !important; font-size: 13px !important; font-weight: 600 !important;",
      "  border: 1px solid var(--rf-line, #334155) !important; background: rgba(56,189,248,0.12) !important;",
      "  color: var(--rf-text, #f1f5f9) !important; text-decoration: none !important; cursor: pointer !important;",
      "}",
      ".rf-shell-btn:active { transform: scale(0.97); }",
      ".rf-shell-title {",
      "  font-size: 14px !important; font-weight: 700 !important; overflow: hidden !important;",
      "  text-overflow: ellipsis !important; white-space: nowrap !important; max-width: 38vw !important;",
      "}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------ 4. Top App Bar Mount */
  function buildTop() {
    injectStyles();
    if (document.getElementById("rf-shell-top")) return;
    var bar = document.createElement("header");
    bar.id = "rf-shell-top";
    var cleanTitle = (document.title || "RankForge AI").replace(/\s*[|•-].*$/, "").trim();
    var isHome = (path === "index.html");
    bar.innerHTML =
      '<div class="rf-shell-left">' +
        (isHome
          ? '<a class="rf-shell-btn" href="./index.html" aria-label="RankForge Home">⚡ RankForge</a>'
          : '<button type="button" class="rf-shell-btn" id="rf-shell-back-btn" aria-label="Go Back">← Back</button>' +
            '<a class="rf-shell-btn" href="./index.html" aria-label="Home">⌂ Home</a>') +
      '</div>' +
      '<div class="rf-shell-title">' + cleanTitle + '</div>' +
      '<div class="rf-shell-right">' +
        '<a class="rf-shell-btn" href="./pyq-hub.html" title="40-Yr NEET & 30-Yr JEE PYQ Archive">🏛️ PYQs</a>' +
        '<a class="rf-shell-btn" href="./analysis.html" title="Performance Analysis">📊 Analysis</a>' +
        '<button type="button" class="rf-shell-btn" id="rf-shell-theme-btn" aria-label="Toggle Theme">☀️ Light</button>' +
      '</div>';
    if (document.body) {
      document.body.insertBefore(bar, document.body.firstChild);
      var backBtn = document.getElementById("rf-shell-back-btn");
      if (backBtn) backBtn.addEventListener("click", goBack);
      var themeBtn = document.getElementById("rf-shell-theme-btn");
      if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
      apply(pref());
    }
  }

  /* ------------------------------------------------------------ 5. Repair OCR Split Words */
  varCHEM_PREFIX = /^(alpha|beta|gamma|delta|cis|trans|ortho|meta|para|non|anti|sub|inter|intra|semi|multi|pseudo|quasi|self|cross|co|re|pre|post|bi|tri|tetra|penta|hexa|mono|di|poly|sec|tert|iso|neo|cyclo)$/i;
  function repairTextNodes(rootNode) {
    if (!rootNode || !document.createTreeWalker) return;
    var walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentNode;
      if (!parent || /^(SCRIPT|STYLE|CODE|PRE|TEXTAREA)$/i.test(parent.tagName)) continue;
      var val = node.nodeValue;
      if (!val || val.indexOf("-") === -1) continue;
      var fixed = val.replace(/\b([A-Za-z]{3,})-\s+([a-z]{3,})\b/g, function (m, a, b) {
        if (varCHEM_PREFIX.test(a)) return a + "-" + b;
        return a + b;
      });
      if (fixed !== val) node.nodeValue = fixed;
    }
  }

  function boot() {
    buildTop();
    repairTextNodes(document.body);
    var timer = null;
    if (window.MutationObserver && document.body) {
      new MutationObserver(function () {
        if (!document.getElementById("rf-shell-top")) buildTop();
        clearTimeout(timer);
        timer = setTimeout(function () { repairTextNodes(document.body); }, 180);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  var api = {
    setTheme: setPref,
    theme: pref,
    toggleTheme: toggleTheme,
    back: goBack,
    goBack: goBack,
    goHome: goHome,
    repairWords: function () { repairTextNodes(document.body); }
  };
  window.RankForgeShell = api;
  window.rfShell = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

