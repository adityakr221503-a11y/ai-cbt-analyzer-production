(function () {
  "use strict";

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(value) {
    if (!value) return "Unknown";

    try {
      return new Date(value)
        .toLocaleString();
    } catch (_) {
      return "Unknown";
    }
  }

  function sourceClass(source) {
    if (
      source === "PDF Import"
    ) {
      return "pdf";
    }

    if (
      source ===
      "Rankers Test Series"
    ) {
      return "ranker";
    }

    return "other";
  }

  function render() {
    const root =
      document.getElementById(
        "pcbUnifiedTestLibrary"
      );

    if (!root) return;

    if (
      !window.PCBUnifiedTestLibrary
    ) {
      root.innerHTML =
        "<p>Test library unavailable.</p>";
      return;
    }

    const tests =
      window.PCBUnifiedTestLibrary.all();

    if (!tests.length) {
      root.innerHTML =
        '<div class="pcb-empty">' +
        "No saved tests yet." +
        "</div>";

      return;
    }

    root.innerHTML =
      tests.map(test => {
        const source =
          test.source ||
          "CBT";

        return (
          '<div class="pcb-test-card">' +

          '<div class="pcb-test-info">' +

          '<div class="pcb-test-title">' +
          esc(
            test.title ||
            "Untitled Test"
          ) +
          "</div>" +

          '<div class="pcb-test-meta">' +

          '<span class="pcb-badge ' +
          sourceClass(source) +
          '">' +
          esc(source) +
          "</span>" +

          "<span>" +
          Number(
            test.questionCount ||
            (
              Array.isArray(
                test.questions
              )
                ? test.questions.length
                : 0
            )
          ) +
          " Questions</span>" +

          "<span>" +
          formatDate(
            test.createdAt
          ) +
          "</span>" +

          "</div>" +

          "</div>" +

          '<div class="pcb-test-actions">' +

          '<button type="button" ' +
          'data-open="' +
          esc(test.testId) +
          '">' +
          "Open CBT" +
          "</button>" +

          '<button type="button" ' +
          'class="danger" ' +
          'data-delete="' +
          esc(test.testId) +
          '">' +
          "Delete" +
          "</button>" +

          "</div>" +

          "</div>"
        );
      }).join("");

    root
      .querySelectorAll(
        "[data-open]"
      )
      .forEach(button => {
        button.onclick =
          function () {
            const id =
              button.getAttribute(
                "data-open"
              );

            window
              .PCBUnifiedTestLibrary
              .open(id);
          };
      });

    root
      .querySelectorAll(
        "[data-delete]"
      )
      .forEach(button => {
        button.onclick =
          function () {
            const id =
              button.getAttribute(
                "data-delete"
              );

            if (
              !confirm(
                "Delete this test?"
              )
            ) {
              return;
            }

            window
              .PCBUnifiedTestLibrary
              .remove(id);

            render();
          };
      });
  }

  function mount() {
    if (
      document.getElementById(
        "pcbUnifiedTestLibrary"
      )
    ) {
      render();
      return;
    }

    const container =
      document.createElement(
        "section"
      );

    container.id =
      "pcbUnifiedTestLibrarySection";

    container.innerHTML =

      '<style>' +

      '#pcbUnifiedTestLibrarySection{' +
      'margin:20px 0;' +
      'padding:18px;' +
      'border:1px solid rgba(128,128,128,.2);' +
      'border-radius:16px;' +
      'background:var(--card,#fff);' +
      '}' +

      '.pcb-library-head{' +
      'display:flex;' +
      'align-items:center;' +
      'justify-content:space-between;' +
      'gap:12px;' +
      'margin-bottom:14px;' +
      '}' +

      '.pcb-library-head h2{' +
      'margin:0;' +
      'font-size:20px;' +
      '}' +

      '.pcb-library-refresh{' +
      'padding:8px 12px;' +
      'border-radius:9px;' +
      'border:1px solid #ccd3df;' +
      'background:transparent;' +
      'cursor:pointer;' +
      '}' +

      '.pcb-test-card{' +
      'display:flex;' +
      'justify-content:space-between;' +
      'gap:14px;' +
      'padding:14px 0;' +
      'border-top:1px solid rgba(128,128,128,.15);' +
      '}' +

      '.pcb-test-info{' +
      'min-width:0;' +
      'flex:1;' +
      '}' +

      '.pcb-test-title{' +
      'font-weight:800;' +
      'font-size:16px;' +
      'word-break:break-word;' +
      '}' +

      '.pcb-test-meta{' +
      'display:flex;' +
      'flex-wrap:wrap;' +
      'gap:7px;' +
      'margin-top:7px;' +
      'font-size:12px;' +
      'opacity:.72;' +
      '}' +

      '.pcb-badge{' +
      'padding:3px 7px;' +
      'border-radius:999px;' +
      'font-weight:700;' +
      '}' +

      '.pcb-badge.pdf{' +
      'background:#e8f1ff;' +
      'color:#2457a6;' +
      '}' +

      '.pcb-badge.ranker{' +
      'background:#fff1d9;' +
      'color:#9a5b00;' +
      '}' +

      '.pcb-test-actions{' +
      'display:flex;' +
      'align-items:center;' +
      'gap:7px;' +
      'flex-wrap:wrap;' +
      'justify-content:flex-end;' +
      '}' +

      '.pcb-test-actions button{' +
      'padding:8px 11px;' +
      'border:0;' +
      'border-radius:8px;' +
      'cursor:pointer;' +
      'font-weight:700;' +
      'background:#172033;' +
      'color:#fff;' +
      '}' +

      '.pcb-test-actions .danger{' +
      'background:#a83232;' +
      '}' +

      '.pcb-empty{' +
      'padding:20px;' +
      'text-align:center;' +
      'opacity:.65;' +
      '}' +

      '@media(max-width:650px){' +
      '.pcb-test-card{' +
      'flex-direction:column;' +
      '}' +
      '.pcb-test-actions{' +
      'justify-content:flex-start;' +
      '}' +
      '}' +

      '</style>' +

      '<div class="pcb-library-head">' +
      '<h2>My Tests</h2>' +
      '<button ' +
      'type="button" ' +
      'class="pcb-library-refresh" ' +
      'id="pcbLibraryRefresh">' +
      'Refresh' +
      '</button>' +
      '</div>' +

      '<div id="pcbUnifiedTestLibrary"></div>';

    const host =
      document.querySelector(
        "main"
      ) ||
      document.body;

    host.appendChild(
      container
    );

    document
      .getElementById(
        "pcbLibraryRefresh"
      )
      .onclick = render;

    render();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      mount
    );
  } else {
    mount();
  }

})();
