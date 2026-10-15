/* RankForge shared navigation v1: one consistent, safe way to move around on every non-exam page. */
(function () {
  "use strict";
  if (window.__rfNavLoaded) return;
  window.__rfNavLoaded = true;
  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  var EXAM = ["cbt.html", "attempt.html", "test-loader.html", "biology-7196-cbt.html", "biology-cbt-live.html"];
  if (EXAM.indexOf(page) >= 0) return;
  var s = document.currentScript;
  var base = (s && s.src ? s.src : location.href).replace(/[^\/]*(\?.*)?(#.*)?$/, "");
  function mount() {
    if (document.getElementById("rf-nav") || document.querySelector("nav.nav,nav.tabs,[data-rf-nav='off']")) return;
    var css = document.createElement("style");
    css.textContent = "#rf-nav{display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;padding:8px 10px;padding-top:calc(8px + env(safe-area-inset-top,0px));background:#12102e;color:#f4f3ff;font:600 13px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch}" +
      "#rf-nav a,#rf-nav button{flex:none;color:inherit;text-decoration:none;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:9px 13px;font:inherit;cursor:pointer;min-height:36px;display:inline-flex;align-items:center}" +
      "#rf-nav a:focus-visible,#rf-nav button:focus-visible{outline:2px solid #22d3ee;outline-offset:2px}";
    document.head.appendChild(css);
    var nav = document.createElement("nav");
    nav.id = "rf-nav"; nav.setAttribute("aria-label", "RankForge navigation");
    var back = document.createElement("button");
    back.type = "button"; back.textContent = "\u2190 Back"; back.setAttribute("aria-label", "Go back");
    back.onclick = function () {
      var r = document.referrer || "";
      if (history.length > 1 && r.indexOf(location.origin) === 0) history.back(); else location.href = base + "index.html";
    };
    nav.appendChild(back);
    [["Home", "index.html#home"], ["Learn", "index.html#learn"], ["Practice", "index.html#practice"], ["Tests", "index.html#tests"], ["Progress", "index.html#progress"], ["Nexus", "notebook-studio.html"]].forEach(function (it) {
      var a = document.createElement("a"); a.href = base + it[1]; a.textContent = it[0]; nav.appendChild(a);
    });
    document.body.insertBefore(nav, document.body.firstChild);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
