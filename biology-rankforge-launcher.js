(function () {
  "use strict";

  window.launchBiology7196 = function () {
    try {
      sessionStorage.setItem("CBT_ACTIVE_SOURCE","BIOLOGY_ACTIVE_BANK");
      sessionStorage.setItem("CBT_ACTIVE_TEST_SOURCE","BIOLOGY_ACTIVE_BANK");
      sessionStorage.setItem("CBT_ACTIVE_TEST","Biology 7196");
      sessionStorage.removeItem("CBT_ACTIVE_PDF_FILENAME");
    } catch (_) {}

    window.location.href = "biology-7196-cbt.html";
  };

  document.addEventListener("DOMContentLoaded", function () {
    const el=document.getElementById("rankforge-biology-7196");

    if(el){
      el.onclick=function(e){
        e.preventDefault();
        window.launchBiology7196();
      };
    }
  });
})();
