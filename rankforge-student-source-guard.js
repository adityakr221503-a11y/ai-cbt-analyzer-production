(function () {
  "use strict";

  const OWNER_UI_NAMES = [
    "owner-source",
    "owner-source.html",
    "source-vault",
    "question-hub",
    "owner-import",
    "module-import",
    "owner-imports"
  ];

  function isOwner() {
    return !!(
      window.RankForgeOwnerAccess &&
      window.RankForgeOwnerAccess.isOwner()
    );
  }

  function hideOwnerNodes() {
    if (isOwner()) return;

    document.querySelectorAll(
      '[data-owner-only],#owner-source,#source-vault,#question-hub,.owner-only'
    ).forEach(function (el) {
      el.remove();
    });

    document.querySelectorAll("a[href]").forEach(function (a) {
      const href = String(a.getAttribute("href") || "").toLowerCase();
      if (OWNER_UI_NAMES.some(function (x) {
        return href.includes(x);
      })) {
        a.remove();
      }
    });
  }

  function protectOwnerNavigation() {
    if (isOwner()) return;

    const path = String(location.pathname || "").toLowerCase();

    if (
      OWNER_UI_NAMES.some(function (x) {
        return path.includes(x);
      })
    ) {
      location.replace("index.html");
    }
  }

  protectOwnerNavigation();
  document.addEventListener("DOMContentLoaded", hideOwnerNodes);
  new MutationObserver(hideOwnerNodes).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
