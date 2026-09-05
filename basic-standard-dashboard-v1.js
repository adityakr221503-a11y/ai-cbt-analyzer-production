(function(){
"use strict";

/*
  BASIC STANDARD DASHBOARD V1
  - Main dashboard = clean student entry points
  - Weak/Due = internal Ranker Master / recovery section
  - Does NOT modify learning data
  - Does NOT modify CBT engine
  - Does NOT delete any feature
*/

function isDashboard(){
  const p=(location.pathname||"").toLowerCase();
  return p.endsWith("/index.html") || p.endsWith("/");
}

function removeDirectWeakView(){

  if(!isDashboard()) return;

  const headings=[
    "weak & due revision",
    "weak / due revision",
    "weak & due chapters",
    "weak / due chapters"
  ];

  document.querySelectorAll("h1,h2,h3,h4,strong").forEach(function(el){

    const text=(el.textContent||"")
      .replace(/\s+/g," ")
      .trim()
      .toLowerCase();

    if(!headings.includes(text)) return;

    /*
      Remove only the dashboard presentation block.
      Underlying Ranker Master data/engine remains untouched.
    */

    let node=el;

    for(let i=0;i<6 && node;i++){

      const cls=String(node.className||"").toLowerCase();

      if(
        node.classList?.contains("card") ||
        node.classList?.contains("revision-box") ||
        cls.includes("weak") ||
        cls.includes("due")
      ){
        node.remove();
        return;
      }

      node=node.parentElement;
    }

    /*
      Safe fallback:
      remove nearest reasonably-sized presentation container,
      never body/main/container.
    */
    const parent=el.closest("section,article,.box,.panel,.card");

    if(
      parent &&
      parent !== document.body &&
      parent !== document.documentElement &&
      !parent.classList.contains("container")
    ){
      parent.remove();
    }
  });
}

/*
  Standard mobile-safe dashboard polish.
  No existing feature colors/routes are replaced.
*/
function installStandardView(){

  if(!isDashboard()) return;

  if(document.getElementById("BASIC_STANDARD_DASHBOARD_V1_CSS"))
    return;

  const style=document.createElement("style");
  style.id="BASIC_STANDARD_DASHBOARD_V1_CSS";

  style.textContent=`

    /*
      Keep the main app focused on entry points.
    */
    .basic-main-entry,
    .start-learning-v1,
    #basicFeatureHubV1,
    #basicTestingBackboneV1{
      scroll-margin-top:20px;
    }

    /*
      Consistent dashboard cards without changing their existing
      structure, links or actions.
    */
    .container .card{
      max-width:100%;
    }

    /*
      Mobile readability.
    */
    @media(max-width:700px){

      .container{
        width:100%;
        padding-left:14px;
        padding-right:14px;
      }

      .container .card{
        border-radius:16px;
      }
    }
  `;

  document.head.appendChild(style);
}

function run(){
  installStandardView();
  removeDirectWeakView();
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",run);
}else{
  run();
}

/*
  Re-run only on DOM-ready style changes.
  No observer, no timer, no CBT interference.
*/
window.CBTBasicStandardDashboardV1={
  run,
  removeDirectWeakView
};

})();
