(function () {
  "use strict";

  const OWNER_FLAG = "rankforgeOwnerMode";
  const OWNER_TOKEN = "rankforgeOwnerVerifiedV1";

  function isOwner() {
    try {
      return localStorage.getItem(OWNER_FLAG) === OWNER_TOKEN;
    } catch (_) {
      return false;
    }
  }

  function ownerOnly(fn) {
    return function () {
      if (!isOwner()) {
        console.warn("RankForge Owner-only action blocked.");
        return null;
      }
      return fn.apply(this, arguments);
    };
  }

  window.RankForgeOwnerAccess = {
    isOwner,
    ownerOnly,
    enableOwnerMode: function (token) {
      if (token !== OWNER_TOKEN) return false;
      localStorage.setItem(OWNER_FLAG, OWNER_TOKEN);
      return true;
    },
    disableOwnerMode: function () {
      localStorage.removeItem(OWNER_FLAG);
    }
  };
})();
