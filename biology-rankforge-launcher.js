(function () {
  "use strict";

  window.launchBiology7196 = function () {
    try {
      sessionStorage.setItem("CBT_ACTIVE_SOURCE","BIOLOGY_ACTIVE_BANK");
      sessionStorage.setItem("CBT_ACTIVE_TEST_SOURCE","BIOLOGY_ACTIVE_BANK");
      sessionStorage.setItem("CBT_ACTIVE_TEST","Biology 7196");
      sessionStorage.removeItem("CBT_ACTIVE_PDF_FILENAME");
    } catch (_) {}

    location.href = "biology-7196-cbt.html";
  };

  document.addEventListener("DOMContentLoaded",function(){
    document.querySelectorAll("button,a,[role='button'],.card,.module-card")
      .forEach(function(el){
        if(el.dataset.bio7196Bound) return;

        const t=(el.textContent||"")
          .replace(/\s+/g," ")
          .trim()
          .toLowerCase();

        if(
          t.includes("biology") &&
          (
            t.includes("7196") ||
            t.includes("cbt") ||
            t.includes("question bank") ||
            t.includes("test")
          )
        ){
          el.dataset.bio7196Bound="1";
          el.addEventListener("click",function(e){
            e.preventDefault();
            e.stopPropagation();
            window.launchBiology7196();
          },true);
        }
      });
  });
})();
