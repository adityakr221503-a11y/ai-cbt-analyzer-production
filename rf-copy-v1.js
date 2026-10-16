/* RankForge safe copy v1: copies text without errors, with a fallback, and says what happened. */
(function () {
  "use strict";
  function fallback(text) {
    try {
      var t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      t.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(t);
      t.select();
      t.setSelectionRange(0, text.length);
      var ok = document.execCommand("copy");
      document.body.removeChild(t);
      return ok;
    } catch (e) { return false; }
  }
  window.rfCopy = function (text, btn) {
    text = String(text == null ? "" : text);
    function done(ok) {
      if (btn) {
        var old = btn.getAttribute("data-label") || btn.textContent;
        btn.setAttribute("data-label", old);
        btn.textContent = ok ? "Copied" : "Copy failed. Select the text and copy it.";
        setTimeout(function () { btn.textContent = old; }, 1800);
      }
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return new Promise(function (resolve) {
        var settled = false;
        function finish(ok) { if (settled) return; settled = true; clearTimeout(timer); resolve(done(ok)); }
        var timer = setTimeout(function () { finish(fallback(text)); }, 1200);
        try {
          navigator.clipboard.writeText(text).then(function () { finish(true); }, function () { finish(fallback(text)); });
        } catch (e) { finish(fallback(text)); }
      });
    }
    return Promise.resolve(done(fallback(text)));
  };
})();
