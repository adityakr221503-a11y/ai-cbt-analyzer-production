/* =========================================================
   PDF -> CBT LAUNCH FIX
   Reliable handoff to the existing CBT engine.
========================================================= */
(function () {
  "use strict";

  const POOL_KEY = "pdfCbtQuestions";
  const ACTIVE_KEY = "CBT_ACTIVE_QUESTIONS";
  const TEST_KEY = "CBT_ACTIVE_TEST";
  const SOURCE_KEY = "CBT_ACTIVE_SOURCE";

  function getPool() {
    try {
      const data = JSON.parse(
        localStorage.getItem(POOL_KEY) || "[]"
      );

      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("[PDF CBT] Pool read failed:", e);
      return [];
    }
  }

  function prepareCBT() {
    const questions = getPool();

    if (!questions.length) {
      alert("No PDF questions found in the CBT pool.");
      return false;
    }

    const test = {
      id: "PDF-CBT-" + Date.now(),
      title: "PDF Imported CBT",
      name: "PDF Imported CBT",
      source: "PDF Import",
      duration: 180,
      totalQuestions: questions.length,
      questions: questions
    };

    try {
      /*
        These are the keys already consumed by cbt.html.
      */
      sessionStorage.setItem(
        ACTIVE_KEY,
        JSON.stringify(questions)
      );

      sessionStorage.setItem(
        TEST_KEY,
        JSON.stringify(test)
      );

      sessionStorage.setItem(
        SOURCE_KEY,
        "PDF Import"
      );

      /*
        Compatibility keys for older CBT code.
      */
      sessionStorage.setItem(
        "PDF_CBT_ACTIVE",
        JSON.stringify(test)
      );

      sessionStorage.setItem(
        "pdfCbtQuestions",
        JSON.stringify(questions)
      );

      localStorage.setItem(
        "CBT_ACTIVE_SOURCE",
        "PDF Import"
      );

      console.log(
        "[PDF CBT] CBT handoff prepared:",
        questions.length,
        "questions"
      );

      return true;
    } catch (e) {
      console.error("[PDF CBT] Session storage failed:", e);
      alert("Could not prepare CBT session.");
      return false;
    }
  }

  function launch() {
    if (!prepareCBT()) return;

    /*
      Cache-buster prevents GitHub Pages from opening an
      older cached CBT page.
    */
    const url =
      "./cbt.html?source=pdf&pdfcbt=1&t=" +
      Date.now();

    window.location.assign(url);
  }

  function makeButtonReliable() {
    /*
      Catch every existing/new button whose visible text
      says Open PDF Questions in CBT.
    */
    document.addEventListener(
      "click",
      function (event) {
        const target =
          event.target.closest &&
          event.target.closest("button,a");

        if (!target) return;

        const text =
          String(target.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

        if (
          text.includes("open pdf questions in cbt") ||
          text.includes("open pdf") &&
          text.includes("cbt")
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          launch();
        }
      },
      true
    );

    /*
      Also repair an element with the old ID if present.
    */
    const old =
      document.getElementById("openPdfCBT");

    if (old) {
      old.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        launch();
        return false;
      };

      old.removeAttribute("disabled");
      old.style.pointerEvents = "auto";
      old.style.cursor = "pointer";
    }

    /*
      Add a permanent reliable anchor if the page doesn't
      already have one.
    */
    let link =
      document.getElementById("pdfCbtDirectLaunch");

    if (!link) {
      link = document.createElement("a");

      link.id = "pdfCbtDirectLaunch";
      link.href =
        "./cbt.html?source=pdf&pdfcbt=1";
      link.textContent =
        "🚀 Open PDF Questions in CBT";

      link.style.cssText = [
        "display:inline-block",
        "margin-top:10px",
        "padding:12px 18px",
        "border-radius:10px",
        "background:#4f46e5",
        "color:#fff",
        "font-weight:800",
        "text-decoration:none",
        "cursor:pointer"
      ].join(";");

      link.addEventListener("click", function (event) {
        event.preventDefault();
        launch();
      });

      const status =
        document.getElementById("status");

      if (status && status.parentNode) {
        status.parentNode.appendChild(link);
      } else {
        document.body.appendChild(link);
      }
    }
  }

  /*
    Keep the existing conversion result intact.
  */
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      makeButtonReliable
    );
  } else {
    makeButtonReliable();
  }

  window.PDFCBTLaunch = {
    launch,
    prepareCBT,
    getPool
  };
})();
