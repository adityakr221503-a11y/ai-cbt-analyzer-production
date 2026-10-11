(function(){
  'use strict';

  if(!window.CBT_MAIN_DASHBOARD) return;

  const KEEP = [
    'rfConnectedShell',
    'rfFeatureDrawer'
  ];

  const DUPLICATE_HEADINGS = [
    'Start Learning',
    'CBT Analyzer Pro',
    'RankForge AI — All Features',
    'RankForge AI — All Features',
    'RANKFORGE DAILY LOOP',
    "Today's #1 Action",
    'Rankers Test Series',
    'My Tests'
  ];

  function insideKeep(el){
    return KEEP.some(id=>{
      const root=document.getElementById(id);
      return root && root.contains(el);
    });
  }

  function clean(){
    const headings=[...document.querySelectorAll(
      'h1,h2,h3,h4,h5,strong,.section-title,.card-title,.rf-brand'
    )];

    const seen=new Set();

    for(const h of headings){
      if(insideKeep(h)) continue;

      const text=(h.textContent||'')
        .replace(/\\s+/g,' ')
        .trim();

      const match=DUPLICATE_HEADINGS.find(x=>
        text.toLowerCase()===x.toLowerCase()
      );

      if(!match) continue;

      /*
       * Keep the first canonical occurrence of each semantic block.
       * Hide later legacy/injected copies instead of deleting data/controllers.
       */
      const key=match.toLowerCase();

      if(seen.has(key)){
        let block=h;

        for(let i=0;i<6 && block && block.parentElement;i++){
          const parent=block.parentElement;
          const txt=(parent.textContent||'').replace(/\\s+/g,' ').trim();

          if(
            parent.tagName==='SECTION' ||
            parent.tagName==='ARTICLE' ||
            txt.length>80
          ){
            block=parent;
            break;
          }

          block=parent;
        }

        if(block && !insideKeep(block)){
          block.style.display='none';
          block.setAttribute('data-rankforge-dedup','true');
        }
      }else{
        seen.add(key);
      }
    }
  }

  clean();

  const observer=new MutationObserver(()=>{
    clearTimeout(window.__RF_DEDUP_TIMER);
    window.__RF_DEDUP_TIMER=setTimeout(clean,50);
  });

  observer.observe(document.body,{
    childList:true,
    subtree:true
  });

  window.RankForgeDashboardDedupV1={
    clean,
    version:'1.0'
  };
})();
