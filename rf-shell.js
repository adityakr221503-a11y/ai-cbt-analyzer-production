/*
 RANKFORGE SHELL v1
 - Dark / Light / Auto theme (saved, applied before first paint)
 - Skin engine: brings every older page into the same premium look
 - App bar with a real Back button, bottom tabs, "More" sheet
 Replaces rf-nav-v1.js.
*/
(function () {
  "use strict";
  var KEY = "rfTheme", root = document.documentElement;
  var path = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  /* ------------------------------------------------------------ theme */
  function pref() { try { return localStorage.getItem(KEY) || "dark"; } catch (e) { return "dark"; } }
  function sysLight() { return !!(window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches); }
  function resolve(p) { return p === "auto" ? (sysLight() ? "light" : "dark") : (p === "light" ? "light" : "dark"); }
  function apply(p) {
    var t = resolve(p);
    root.setAttribute("data-theme", t);
    root.setAttribute("data-rf-pref", p);
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.name = "theme-color"; (document.head || root).appendChild(m); }
    m.content = t === "light" ? "#f3f4ff" : "#0b0a1f";
  }
  apply(pref());

  var isIndex = false;      /* decided after DOM is ready */

  /* ------------------------------------------------------------ colour helpers */
  function parse(c) {
    if (!c) return null;
    var m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,\/]\s*([\d.]+%?))?\s*\)/.exec(c);
    if (m) { var a = m[4] === undefined ? 1 : (m[4].indexOf("%") > 0 ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return [+m[1], +m[2], +m[3], a]; }
    m = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)/.exec(c);
    if (m) { var b = m[4] === undefined ? 1 : (m[4].indexOf("%") > 0 ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return [m[1] * 255, m[2] * 255, m[3] * 255, b]; }
    return null;
  }
  function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
  function chroma(c) { return (Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])) / 255; }
  function ratio(a, b) { var x = Math.max(a, b), y = Math.min(a, b); return (x + 0.05) / (y + 0.05); }

  /* ------------------------------------------------------------ skin engine */
  var seen = new WeakSet();
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, SVG: 1, PATH: 1, CANVAS: 1, IMG: 1, VIDEO: 1, IFRAME: 1, NOSCRIPT: 1, OPTION: 1, LINK: 1, META: 1, BR: 1 };
  var BTN_SEL = 'button,input[type=button],input[type=submit],a.btn,a[class*="button"],[role=button]';
  var CLS = ".rf-surf,.rf-surf-2,.rf-page,.rf-tint,.rf-tint-d,.rf-fgd,.rf-fgl,.rf-fg-fix,.rf-fs,.rf-btn,.rf-btn-pri,.rf-btn-ghost,.rf-btn-danger";

  function themeBg() { return resolve(pref()) === "light" ? 0.91 : 0.006; }
  function effBg(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] >= 0.6) return lum(c);
    }
    return themeBg();
  }
  function depth(el) {
    var d = 0;
    for (var n = el.parentElement; n; n = n.parentElement) {
      if (n.classList && (n.classList.contains("rf-surf") || n.classList.contains("rf-surf-2"))) d++;
    }
    return d;
  }
  function skip(el) { return SKIP_TAGS[el.tagName.toUpperCase()] || el.closest(".rf-ui") || el.closest("nav.nav") || el.closest("[data-rf-noskin]"); }

  function skinSurfaces(list) {
    var vw = window.innerWidth, vh = window.innerHeight, light = resolve(pref()) === "light";
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (seen.has(el) || skip(el)) continue;
      if (el.matches(BTN_SEL)) continue;
      var cs = getComputedStyle(el), c = parse(cs.backgroundColor);
      if (!c || c[3] < 0.5) continue;
      var w = el.offsetWidth, h = el.offsetHeight;
      if (w < 36 || h < 18) continue;
      var L = lum(c), ch = chroma(c);
      /* a full-page wrapper: let the themed page background show through */
      if (w >= vw * 0.94 && h >= vh * 0.55 && (el.parentElement === document.body || el.parentElement === root) && ch < 0.4) { el.classList.add("rf-page"); seen.add(el); continue; }
      var neutralLight = L > 0.6 && ch < 0.05, neutralDark = L < 0.2 && ch < 0.22;
      if (neutralLight || neutralDark) { el.classList.add(depth(el) >= 1 ? "rf-surf-2" : "rf-surf"); seen.add(el); continue; }
      /* tinted pastel (status boxes etc): keep the hue, but fit it to the theme */
      if (L > 0.6 && ch >= 0.05 && !light) { el.style.setProperty("--rf-tint", "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"); el.classList.add("rf-tint"); seen.add(el); continue; }
      if (L < 0.2 && ch >= 0.22 && light) { el.style.setProperty("--rf-tint", "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"); el.classList.add("rf-tint-d"); seen.add(el); continue; }
    }
  }

  function skinButtons(list) {
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.__rfb || skip(el) || el.closest("#options") || el.closest("#palette") || el.closest(".palette")) continue;
      el.__rfb = 1;
      var cs = getComputedStyle(el), c = parse(cs.backgroundColor), clr = parse(cs.color);
      el.classList.add("rf-btn");
      var transparent = !c || c[3] < 0.3;
      var L = c ? lum(c) : 0, ch = c ? chroma(c) : 0;
      var redish = c && c[0] > 170 && c[1] < 110 && c[2] < 120 && !transparent;
      if (redish || (c && c[0] > 150 && c[0] > c[1] * 1.8 && c[0] > c[2] * 1.8 && !transparent && L > 0.1 && L < 0.45)) el.classList.add("rf-btn-danger");
      else if (transparent || (ch < 0.12 && (L > 0.55 || L < 0.12))) el.classList.add("rf-btn-ghost");
      else el.classList.add("rf-btn-pri");
    }
  }

  function skinText(list) {
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.__rft || skip(el)) continue;
      var hasText = false;
      for (var k = el.firstChild; k; k = k.nextSibling) { if (k.nodeType === 3 && k.nodeValue.trim().length > 1) { hasText = true; break; } }
      if (!hasText) continue;
      el.__rft = 1;
      var cs = getComputedStyle(el), fg = parse(cs.color);
      if (!fg) continue;
      if (parseFloat(cs.fontSize) < 12.5 && !el.closest(BTN_SEL)) el.classList.add("rf-fs");
      if (el.classList.contains("rf-btn")) continue;
      var bgL = effBg(el), r = ratio(lum(fg), bgL);
      if (r < 3.4) {
        if (chroma(fg) < 0.3) el.classList.add(bgL > 0.4 ? "rf-fgd" : "rf-fgl");   /* dark text on light, light text on dark */
        else el.classList.add("rf-fg-fix");
      }
    }
  }

  /* legacy pages sometimes carry their own sticky/fixed header or bottom bar: slide them clear of ours */
  var posSeen = new WeakSet();
  function clearBars() {
    if (path === "cbt.html" || !document.querySelector(".rf-top")) return;
    var topH = Math.round(document.querySelector(".rf-top").getBoundingClientRect().height), vw = window.innerWidth;
    var all = document.body.querySelectorAll("*");
    for (var i = 0; i < all.length && i < 4000; i++) {
      var el = all[i];
      if (posSeen.has(el) || el.closest(".rf-ui") || el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
      var cs = getComputedStyle(el), pos = cs.position;
      if (pos !== "fixed" && pos !== "sticky") continue;
      posSeen.add(el);
      if (el.offsetWidth < vw * 0.6) continue;
      var top = parseFloat(cs.top), bottom = parseFloat(cs.bottom);
      if (!isNaN(top) && top <= 2 && (isNaN(bottom) || bottom > 40)) el.style.setProperty("top", topH + "px", "important");
      else if (!isNaN(bottom) && bottom <= 2 && (isNaN(top) || top > 40)) {
        /* a legacy bottom tab bar is replaced by ours; any other bottom bar (e.g. an action bar) is lifted above it */
        var items = el.querySelectorAll("a,button").length;
        if (items >= 3 && el.offsetHeight < 120) el.setAttribute("data-rf-hidden", "1");
        else el.style.setProperty("bottom", "calc(var(--rf-nav) + 22px + env(safe-area-inset-bottom,0px))", "important");
      }
    }
  }

  function skinAll(scope) {
    var els = (scope || document.body).querySelectorAll("*");
    if (els.length > 7000) return;
    var arr = Array.prototype.slice.call(els);
    skinSurfaces(arr);
    skinButtons((scope || document.body).querySelectorAll(BTN_SEL));
    skinText(arr);
    clearBars();
  }

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(function () { try { skinAll(); } catch (e) {} }, 70); }

  function resetSkin() {
    var nodes = document.querySelectorAll(CLS);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      ["rf-surf", "rf-surf-2", "rf-page", "rf-tint", "rf-tint-d", "rf-fgd", "rf-fgl", "rf-fg-fix", "rf-fs", "rf-btn", "rf-btn-pri", "rf-btn-ghost", "rf-btn-danger"].forEach(function (c) { n.classList.remove(c); });
      n.__rfb = 0; n.__rft = 0;
    }
    seen = new WeakSet();
  }

  /* ------------------------------------------------------------ UI */
  var ICON = {
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    learn: '<svg viewBox="0 0 24 24"><path d="M3 5a2 2 0 0 1 2-2h6v18H5a2 2 0 0 1-2-2zM21 5a2 2 0 0 0-2-2h-6v18h6a2 2 0 0 0 2-2z"/></svg>',
    practice: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
    tests: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h6"/></svg>',
    progress: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
    nexus: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>'
  };
  var TABS = [
    ["home", "Home", "index.html#home"], ["learn", "Learn", "index.html#learn"], ["practice", "Practice", "index.html#practice"],
    ["tests", "Tests", "index.html#tests"], ["progress", "Progress", "index.html#progress"], ["nexus", "Nexus", "notebook-studio.html"]
  ];
  var TAB_OF = {
    "notebook-studio.html": "nexus", "lectures.html": "learn", "tag-practice.html": "learn", "study-vault.html": "learn",
    "cbt.html": "tests", "pdf-to-cbt.html": "tests", "rankers-test-series.html": "tests", "ai-test-generator.html": "tests", "test-details.html": "tests", "biology-cbt-live.html": "tests",
    "question-bank.html": "practice", "subject-practice.html": "practice", "mistake.html": "practice", "retry.html": "practice", "mastered.html": "practice", "bookmarks.html": "practice", "biology-mistake-retry.html": "practice",
    "history.html": "progress", "orbit-test-analysis.html": "progress", "ranker-command-center.html": "progress", "command-center.html": "progress", "nichod-hub.html": "progress"
  };
  var TITLES = {
    "mistake.html": "Mistake Bank", "retry.html": "Retry Mistakes", "mastered.html": "Mastered", "history.html": "Test History", "bookmarks.html": "Bookmarks",
    "question-bank.html": "Question Bank", "subject-practice.html": "Subject Practice", "rankers-test-series.html": "Rankers Test Series", "ai-test-generator.html": "AI Test Generator", "pdf-to-cbt.html": "PDF → CBT",
    "notebook-studio.html": "Nexus", "owner-hub.html": "Owner Hub", "owner-access.html": "Owner Access", "owner-source.html": "Owner Upload", "cbt.html": "CBT",
    "ranker-command-center.html": "Command Center", "command-center.html": "Command Center", "orbit-test-analysis.html": "Test Analysis", "nichod-hub.html": "NICHOD Hub",
    "rankforge-system-check.html": "System Check", "privacy.html": "Privacy", "security.html": "Security", "lectures.html": "AI Lectures", "ai-question-lab.html": "AI Question Lab",
    "rankers-ai-new-questions.html": "AI New Questions", "tag-practice.html": "Tag Practice", "test-details.html": "Test Details"
  };
  function pageTitle() {
    if (TITLES[path]) return TITLES[path];
    var t = (document.title || "").replace(/^\s*RankForge\s*[-—·:|]?\s*/i, "").trim();
    return t || "RankForge";
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function goBack() {
    if (history.length > 1) history.back(); else location.href = "index.html";
  }

  var sheet, scrim;
  function openSheet(on) { sheet.classList.toggle("open", on); scrim.classList.toggle("open", on); }

  function themeBtnIcon(b) { b.innerHTML = resolve(pref()) === "light" ? ICON.moon : ICON.sun; b.setAttribute("aria-label", "Switch theme"); }
  function cycleTheme() {
    var cur = resolve(pref()), next = cur === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, next); } catch (e) {}
    apply(next); resetSkin(); schedule();
    document.querySelectorAll(".rf-theme-btn").forEach(themeBtnIcon);
    markSeg();
  }
  function markSeg() {
    var p = pref();
    document.querySelectorAll(".rf-seg button").forEach(function (b) { b.classList.toggle("on", b.dataset.t === p); });
  }
  function setPref(p) {
    try { localStorage.setItem(KEY, p); } catch (e) {}
    apply(p); resetSkin(); schedule();
    document.querySelectorAll(".rf-theme-btn").forEach(themeBtnIcon); markSeg();
  }

  function owner() { try { return !!(window.RankForgeOwnerAccess && window.RankForgeOwnerAccess.isOwner()); } catch (e) { return false; } }

  function buildSheet() {
    scrim = document.createElement("div"); scrim.className = "rf-ui rf-scrim"; scrim.onclick = function () { openSheet(false); };
    sheet = document.createElement("div"); sheet.className = "rf-ui rf-sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "More");
    var items = [
      ["🧠", "NICHOD Hub", "Patterns, concepts and mastery", "nichod-hub.html"],
      ["📚", "Study Vault", "Notes, screenshots, PDFs", "study-vault/index.html"],
      ["🔖", "Bookmarks", "Questions you saved", "bookmarks.html"],
      ["📄", "PDF → CBT", "Turn a paper into a test", "pdf-to-cbt.html"],
      ["✅", "System Check", "Health of data, banks and pages", "rankforge-system-check.html"],
      ["🔒", "Privacy & Security", "Your data stays on your device", "privacy.html"]
    ];
    if (owner()) items.push(["🛠", "Owner Hub", "Upload, connect AI, diagnose", "owner-hub.html"]); else items.push(["🔑", "Owner Access", "Sign in as owner", "owner-access.html"]);
    sheet.innerHTML = '<h4>Appearance</h4><div class="rf-seg"><button data-t="dark">🌙 Dark</button><button data-t="light">☀️ Light</button><button data-t="auto">⚙️ Auto</button></div><h4>More</h4>' +
      items.map(function (x) { return '<a href="' + x[3] + '"><span class="ic">' + x[0] + '</span><span><b>' + esc(x[1]) + '</b><small>' + esc(x[2]) + '</small></span></a>'; }).join("");
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    sheet.querySelectorAll(".rf-seg button").forEach(function (b) { b.onclick = function () { setPref(b.dataset.t); }; });
    markSeg();
  }

  function buildTop(showBack) {
    var bar = document.createElement("header"); bar.className = "rf-ui rf-top";
    bar.innerHTML = (showBack ? '<button class="rf-ib rf-back" aria-label="Back" type="button">' + ICON.back + "</button>" : "") +
      '<div class="rf-title"><small>RankForge</small>' + esc(pageTitle()) + "</div>" +
      '<button class="rf-ib rf-theme-btn" type="button"></button><button class="rf-ib rf-more" aria-label="More" type="button">' + ICON.more + "</button>";
    document.body.insertBefore(bar, document.body.firstChild);
    var b = bar.querySelector(".rf-back"); if (b) b.onclick = goBack;
    themeBtnIcon(bar.querySelector(".rf-theme-btn"));
    bar.querySelector(".rf-theme-btn").onclick = cycleTheme;
    bar.querySelector(".rf-more").onclick = function () { openSheet(true); };
  }

  function buildTabs() {
    var cur = TAB_OF[path] || "";
    var nav = document.createElement("nav"); nav.className = "rf-ui rf-tabbar"; nav.setAttribute("aria-label", "Main");
    nav.innerHTML = TABS.map(function (t) { return '<a class="rf-tab' + (t[0] === cur ? " on" : "") + '" href="' + t[2] + '">' + ICON[t[0]] + "<span>" + t[1] + "</span></a>"; }).join("");
    document.body.appendChild(nav);
  }

  function watchExam() {
    var cbt = document.getElementById("cbt");
    if (!cbt) return;
    function sync() { root.classList.toggle("rf-exam", !cbt.classList.contains("hidden")); }
    sync();
    new MutationObserver(sync).observe(cbt, { attributes: true, attributeFilter: ["class"] });
  }

  function indexTweaks() {
    /* The Home screen keeps its own tabs; add the theme switch beside the exam chip. */
    var chips = document.querySelector(".top .chips");
    if (chips && !chips.querySelector(".rf-theme-btn")) {
      var b = document.createElement("button"); b.className = "rf-ui rf-ib rf-theme-btn"; b.type = "button"; themeBtnIcon(b); b.onclick = cycleTheme;
      chips.insertBefore(b, chips.firstChild);
    }
  }

  function hideLegacyBack() {
    var cand = document.querySelectorAll("button,a");
    for (var i = 0; i < cand.length; i++) {
      var el = cand[i];
      if (el.closest(".rf-ui") || el.closest("#cbt") || el.closest("#result")) continue;
      var t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (/^(←|⬅|‹)?\s*(back|go back)$/i.test(t) && el.getBoundingClientRect().top < 260) el.setAttribute("data-rf-hidden", "1");
    }
  }

  function boot() {
    isIndex = !!document.querySelector("nav.nav[aria-label=Main]");
    var noShell = root.hasAttribute("data-rf-noshell") || (document.body && document.body.hasAttribute("data-rf-noshell"));
    if (isIndex) { indexTweaks(); return; }
    if (noShell) { schedule(); return; }
    root.classList.add("rf-bars");
    buildTop(true);
    var tabs = path !== "cbt.html" || true;
    if (tabs) { root.classList.add("rf-tabs"); buildTabs(); }
    buildSheet();
    watchExam();
    skinAll();
    hideLegacyBack();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("rf-pool-seeded", schedule);
    if (window.matchMedia) { try { matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () { if (pref() === "auto") { apply("auto"); resetSkin(); schedule(); } }); } catch (e) {} }
  }

  window.RankForgeShell = { setTheme: setPref, theme: pref, skin: schedule, back: goBack };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
