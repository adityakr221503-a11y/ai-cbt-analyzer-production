/* RANKFORGE PDF CBT PRODUCTION ENGINE v8
   - one authoritative importer
   - current-PDF isolation
   - English-only
   - layout-aware parsing
   - rejects instructions/headers/footers
   - supports A-D and 1-4 option styles
   - stores source page metadata
   - no fixed 180-question limit for imported PDFs
*/
(function(){
  'use strict';

  const KEY='pdfCbtQuestions';
  const META='pdfCbtImportMetaV8';
  const ACTIVE='CBT_ACTIVE_QUESTIONS';
  const ACTIVE_TEST='CBT_ACTIVE_TEST';
  const ACTIVE_SOURCE='CBT_ACTIVE_SOURCE';
  const ACTIVE_ID='CBT_ACTIVE_TEST_ID';
  const PDF_DB='RankForgePDFStoreV1';
  const PDF_STORE='files';

  const $=id=>document.getElementById(id);
  const text=v=>String(v==null?'':v);
  const clean=v=>text(v)
    .replace(/[\u200b-\u200f\ufeff]/g,'')
    .replace(/\u00ad/g,'')
    .replace(/\u00a0/g,' ')
    .replace(/[ \t]+/g,' ')
    .trim();
  const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function status(v){const e=$('status');if(e)e.textContent=v;}
  function read(k,f){try{const r=localStorage.getItem(k);return r==null?f:JSON.parse(r)}catch(_){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v));}
  function answerLetter(v){const s=clean(v).toUpperCase().replace(/[()[\].:]/g,'');if(/^[ABCD]$/.test(s))return s;if(/^[1-4]$/.test(s))return 'ABCD'[Number(s)-1];return ''}

  function englishClean(v){
    return clean(v).replace(/[\u0900-\u097F]/g,' ').replace(/\s+/g,' ').trim();
  }
  function englishRatio(v){
    const s=text(v), latin=(s.match(/[A-Za-z]/g)||[]).length, hindi=(s.match(/[\u0900-\u097F]/g)||[]).length;
    return latin+ hindi ? latin/(latin+hindi) : 0;
  }
  function englishOK(q){
    const s=clean(q.question||q.text), opts=q.options||[];
    if(s.length<8 || opts.length!==4)return false;
    if(englishRatio(s)<0.45)return false;
    return opts.every(o=>englishRatio(o)>=0.35 && clean(o).length>0);
  }

  function isInstruction(line){
    const s=clean(line).toLowerCase();
    if(!s)return true;
    return /^(instructions?|general instructions?|important instructions?|note|notes|directions?|read carefully|section|part)\b/.test(s)
      || /^(the )?(test|paper|question paper)\b|^(time allowed|duration|maximum marks?|total marks?|this (test|paper|booklet)|do not|candidate|negative marking|each question|all questions|use of|rough work)\b/.test(s)
      || /^page\s*\d+\s*(of|\/)/i.test(s)
      || /^(physics|chemistry|biology)\s*(section|part)?\s*$/i.test(s);
  }

  function rowText(items){
    const a=(items||[]).filter(x=>clean(x.str));
    if(!a.length)return {text:'',x:0,y:0,h:0};
    a.sort((p,q)=>p.x-q.x);
    let out='';let last=null;
    for(const it of a){
      if(last!==null){const gap=it.x-last; if(gap>Math.max(1,it.fs*.22))out+=' ';}
      out+=it.str; last=it.x+it.w;
    }
    return {text:clean(out),x:Math.min(...a.map(x=>x.x)),y:a[0].y,h:Math.max(...a.map(x=>x.fs||10)),items:a};
  }

  function groupRows(items){
    const rows=[];
    for(const item of items||[]){
      const str=clean(item.str); if(!str)continue;
      const tr=item.transform||[];
      const x=Number(tr[4]||0), y=Number(tr[5]||0), fs=Math.abs(Number(tr[0]||tr[3]||10))||10;
      let row=null;
      for(const r of rows){if(Math.abs(r.y-y)<=Math.max(2.5,fs*.28)){row=r;break;}}
      if(!row){row={y,items:[]};rows.push(row);}
      row.items.push({str,x,y,fs,w:Number(item.width||0)});
    }
    rows.sort((a,b)=>b.y-a.y);
    return rows.map(r=>rowText(r.items));
  }

  async function loadPDF(file){
    if(!window.pdfjsLib)throw new Error('PDF.js is not loaded.');
    return window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
  }

  async function extractPages(file){
    const pdf=await loadPDF(file), pages=[];
    for(let p=1;p<=pdf.numPages;p++){
      status('Reading PDF — page '+p+' / '+pdf.numPages+'…');
      const page=await pdf.getPage(p), c=await page.getTextContent();
      const rows=groupRows(c.items||[]);
      const maxX=rows.reduce((m,r)=>Math.max(m,r.x),0);
      let hasImages=false;
      try{
        const op=await page.getOperatorList();
        const OPS=window.pdfjsLib.OPS||{};
        const imageFns=new Set([OPS.paintImageMaskXObject,OPS.paintImageMaskXObjectRepeat,OPS.paintImageXObject,OPS.paintInlineImageXObject].filter(v=>v!=null));
        hasImages=(op.fnArray||[]).some(fn=>imageFns.has(fn));
      }catch(_){}
      pages.push({page:p,rows,maxX,hasImages});
    }
    return pages;
  }

  function qCandidate(row, page, margin){
    const s=clean(row.text); if(!s || isInstruction(s))return null;
    let m=s.match(/^(?:Question\s*|Q\s*)(\d{1,4})\s*[.)\-:]?\s*(.+)$/i);
    if(m)return {number:Number(m[1]),text:clean(m[2]),explicit:true,row};
    m=s.match(/^(\d{1,4})\s*[.)\-:]\s+(.+)$/);
    if(!m)return null;
    const n=Number(m[1]), rest=clean(m[2]);
    if(n<1||n>999||rest.length<8)return null;
    if(/^[A-D1-4](?:[.)]|\s*$)/i.test(rest))return null;
    // numeric option rows are not question starts unless they occur at a plausible left margin.
    if(row.x > Math.max(36, margin+20))return null;
    return {number:n,text:rest,explicit:false,row};
  }

  function optionStart(s){
    let m=clean(s).match(/^\(\s*([A-D1-4])\s*\)\s*(.*)$/i); if(m)return {letter:answerLetter(m[1]),text:clean(m[2])};
    m=clean(s).match(/^\[\s*([A-D1-4])\s*\]\s*(.*)$/i); if(m)return {letter:answerLetter(m[1]),text:clean(m[2])};
    m=clean(s).match(/^([A-D1-4])\s*[.)\-:]\s+(.+)$/i); if(m)return {letter:answerLetter(m[1]),text:clean(m[2])};
    return null;
  }

  function parseGroup(lines, number, page, hasImages){
    let stem=[], opts={}, current=null, answer='';
    for(const raw of lines){
      const line=clean(raw); if(!line)continue;
      if(/^(?:answer|ans|correct\s*answer|answer\s*key)\b/i.test(line)){
        const am=line.match(/([A-D1-4])\s*$/i); if(am)answer=answerLetter(am[1]);
        continue;
      }
      const os=optionStart(line);
      if(os){
        if(os.letter && !opts[os.letter]){opts[os.letter]=os.text;current=os.letter;}
        else if(current)opts[current]=clean(opts[current]+' '+line);
        continue;
      }
      if(current)opts[current]=clean(opts[current]+' '+line);
      else stem.push(line);
    }
    const ordered=['A','B','C','D'];
    const options=ordered.map(k=>opts[k]||'');
    const qtext=englishClean(stem.join(' '));
    if(qtext.length<8 || options.some(o=>clean(o).length<1))return null;
    const q={number,question:qtext,text:qtext,options:options.map(englishClean),correctAnswer:answer,correctIndex:answer?ordered.indexOf(answer):-1,sourcePage:page,hasVisual:Boolean(hasImages)||/(figure|diagram|graph|shown|image|following)/i.test(qtext),language:'English'};
    if(!englishOK(q))return null;
    return q;
  }

  function parseNumericOptionsGroup(lines,number,page,hasImages){
    let stem=[], opts=[], current=-1, answer='';
    for(const raw of lines){
      const line=clean(raw);if(!line)continue;
      const am=line.match(/(?:answer|ans|correct\s*answer|answer\s*key)\s*[:=-]?\s*([1-4A-D])/i);if(am){answer=answerLetter(am[1]);continue;}
      const m=line.match(/^(?:\(\s*([1-4])\s*\)|\[\s*([1-4])\s*\]|([1-4])\s*[.)\-:])\s*(.*)$/);
      if(m){const n=Number(m[1]||m[2]||m[3]);if(n>=1&&n<=4){opts[n-1]=englishClean(m[4]);current=n-1;continue;}}
      if(current>=0)opts[current]=englishClean((opts[current]||'')+' '+line);else stem.push(line);
    }
    const options=[0,1,2,3].map(i=>clean(opts[i]||''));
    const qtext=englishClean(stem.join(' '));
    if(qtext.length<8||options.some(o=>!o))return null;
    const q={number,question:qtext,text:qtext,options,correctAnswer:answer,correctIndex:answer?'ABCD'.indexOf(answer):-1,sourcePage:page,hasVisual:Boolean(hasImages)||/(figure|diagram|graph|shown|image|following)/i.test(qtext),language:'English'};
    return englishOK(q)?q:null;
  }

  function parsePages(pages){
    const all=[];
    for(const pg of pages){
      const rows=pg.rows||[];
      const margin=rows.length?Math.min(...rows.map(r=>r.x)):0;
      const candidates=[];
      for(let i=0;i<rows.length;i++){
        const c=qCandidate(rows[i],pg.page,margin);if(c)candidates.push({i,c});
      }
      // Detect numeric option runs such as 1. 2. 3. 4. so they cannot become fake questions.
      const optionCandidateIndex=new Set();
      for(let ci=0;ci<candidates.length-3;ci++){
        const nums=candidates.slice(ci,ci+4).map(x=>x.c.number);
        if(nums.join(',')==='1,2,3,4') {
          const base=candidates[ci];
          // If the previous candidate is an actual question start, this is its numeric option run.
          if(ci>0) optionCandidateIndex.add(ci);
          else if(base.c.number===1 && !base.c.explicit) optionCandidateIndex.add(ci);
          optionCandidateIndex.add(ci+1); optionCandidateIndex.add(ci+2); optionCandidateIndex.add(ci+3);
        }
      }
      const chosen=[];
      for(let ci=0;ci<candidates.length;ci++){
        if(optionCandidateIndex.has(ci)) continue;
        const x=candidates[ci];
        if(!chosen.length || x.i>chosen[chosen.length-1].i) chosen.push(x);
      }
      for(let k=0;k<chosen.length;k++){
        const a=chosen[k], b=chosen[k+1];
        const block=rows.slice(a.i+0,b?b.i:rows.length).map(r=>r.text);
        // Remove question prefix but retain wrapped stem.
        if(block.length)block[0]=a.c.text;
        let q=parseGroup(block,a.c.number,pg.page,pg.hasImages);
        if(!q)q=parseNumericOptionsGroup(block,a.c.number,pg.page,pg.hasImages);
        if(q)all.push(q);
      }
    }
    // final sequential de-duplication; do not require numbering to be perfect.
    const out=[],seen=new Set();
    for(const q of all){const key=norm(q.question)+'|'+q.options.map(norm).join('|');if(seen.has(key))continue;seen.add(key);out.push(q);}
    out.sort((a,b)=>a.sourcePage-b.sourcePage || a.number-b.number);
    out.forEach((q,i)=>{q.sequence=i+1;q.id='PDF8-'+Date.now()+'-'+i+'-'+Math.random().toString(36).slice(2,8);});
    return out;
  }

  async function ocrFallback(file){
    if(!window.Tesseract)return [];
    const T=window.Tesseract,pdf=await loadPDF(file),pages=[];
    for(let p=1;p<=pdf.numPages;p++){
      status('OCR fallback — page '+p+' / '+pdf.numPages+'…');
      const page=await pdf.getPage(p),vp=page.getViewport({scale:2.0}),canvas=document.createElement('canvas');
      canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
      await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
      const r=await T.recognize(canvas,'eng');pages.push({page:p,rows:String(r?.data?.text||'').split(/\r?\n/).map(text=>({text:clean(text),x:0,y:0}))});
      canvas.width=1;canvas.height=1;
    }
    return parsePages(pages);
  }

  function openPDFDB(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB)return reject(new Error('IndexedDB unavailable'));
      const r=indexedDB.open(PDF_DB,1);
      r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(PDF_STORE))r.result.createObjectStore(PDF_STORE);};
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error||new Error('IndexedDB error'));
    });
  }
  async function storePDF(testId,file){
    try{
      const db=await openPDFDB();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(PDF_STORE,'readwrite');
        tx.objectStore(PDF_STORE).put(file,testId);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
      });
      db.close();
    }catch(e){console.warn('[PDF8] PDF visual store skipped',e);}
  }

  async function saveCurrent(qs,name,file){
    const testId='pdf-test-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
    const fresh=qs.map((q,i)=>({...q,sequence:i+1,importedTestId:testId,sourceFile:name,source:'PDF Import',importedAt:new Date().toISOString()}));
    write(KEY,fresh);write(META,{version:'v8',testId,fileName:name,questionCount:fresh.length,importedAt:new Date().toISOString()});
    sessionStorage.removeItem('CBT_ACTIVE_ANSWERS');sessionStorage.removeItem('CBT_ACTIVE_SELECTED');sessionStorage.removeItem('CBT_ACTIVE_CURRENT_INDEX');
    sessionStorage.setItem(ACTIVE,JSON.stringify(fresh));
    sessionStorage.setItem(ACTIVE_TEST,JSON.stringify({id:testId,title:name,name:name,source:'PDF Import',duration:180,totalQuestions:fresh.length,questionIds:fresh.map(q=>q.id),questions:fresh,language:'English'}));
    sessionStorage.setItem(ACTIVE_SOURCE,'PDF');sessionStorage.setItem(ACTIVE_ID,testId);
    // local mirror is only a compatibility pointer; CBT reads session first.
    localStorage.setItem('CBT_ACTIVE_SOURCE','PDF Import');localStorage.setItem('CBT_ACTIVE_TEST',JSON.stringify({id:testId,title:name,source:'PDF Import',duration:180,totalQuestions:fresh.length,questionIds:fresh.map(q=>q.id),questions:fresh}));
    await storePDF(testId,file);
    return fresh;
  }

  function preview(qs){
    const box=$('questionPreview');if(!box)return;box.innerHTML='';
    qs.slice(0,8).forEach((q,i)=>{const d=document.createElement('div');d.style.cssText='margin:10px 0;padding:14px;border:1px solid #dbe2ea;border-radius:12px;background:#fff';d.innerHTML='<div><strong>Q'+(i+1)+'.</strong> '+esc(q.question)+'</div>'+q.options.map((o,j)=>'<div style="margin-top:6px">'+String.fromCharCode(65+j)+'. '+esc(o)+'</div>').join('');box.appendChild(d);});
    if(qs.length>8){const more=document.createElement('div');more.textContent='Showing 8 of '+qs.length+' questions.';box.appendChild(more);}
  }

  async function convert(file){
    if(!file || !(file.type||'').includes('pdf')&&!/\.pdf$/i.test(file.name))throw new Error('Please select a valid PDF file.');
    const name=(($('moduleName')?.value||'').trim()||file.name);
    const fp=[file.name,file.size,file.lastModified].join('::');
    sessionStorage.setItem('CBT_ACTIVE_SOURCE','PDF');sessionStorage.setItem('CBT_PDF_FILE_FINGERPRINT',fp);
    status('🔎 Analysing PDF layout…');
    let pages=[];try{pages=await extractPages(file)}catch(e){console.warn('[PDF8] text layer failed',e)}
    let qs=parsePages(pages);
    if(!qs.length){
      status('⚠️ Text layer did not produce complete questions. Trying OCR…');
      try{qs=await ocrFallback(file)}catch(e){console.warn('[PDF8] OCR unavailable/failed',e)}
    }
    if(!qs.length)throw new Error('No complete English 4-option questions were safely detected.');
    // Hard rejection of obvious instruction fragments.
    qs=qs.filter(q=>!isInstruction(q.question)&&q.options.every(o=>!isInstruction(o)));
    if(!qs.length)throw new Error('Questions were detected but all candidates were rejected as instructions/invalid content.');
    const fresh=await saveCurrent(qs,name,file);preview(fresh);
    status('✅ PDF CBT READY\n\nFile: '+name+'\nQuestions: '+fresh.length+'\nLanguage: English only\nInstructions: filtered\nOld PDF: replaced for CBT\n\nOpen Imported Test in CBT.');
    document.dispatchEvent(new CustomEvent('pdfCbtPoolUpdated',{detail:{questions:fresh}}));
    return fresh;
  }

  function launch(){
    const qs=read(KEY,[]);
    if(!Array.isArray(qs)||!qs.length){status('Convert a PDF first.');return;}
    const meta=read(META,{});
    const id=meta.testId||('pdf-test-'+Date.now());
    const fresh=qs.map((q,i)=>({...q,sequence:i+1,importedTestId:id}));
    sessionStorage.setItem(ACTIVE,JSON.stringify(fresh));
    sessionStorage.setItem(ACTIVE_TEST,JSON.stringify({id,title:meta.fileName||'PDF Imported CBT',name:meta.fileName||'PDF Imported CBT',source:'PDF Import',duration:180,totalQuestions:fresh.length,questionIds:fresh.map(q=>q.id),questions:fresh,language:'English'}));
    sessionStorage.setItem(ACTIVE_SOURCE,'PDF');sessionStorage.setItem(ACTIVE_ID,id);
    localStorage.setItem('CBT_ACTIVE_SOURCE','PDF Import');localStorage.setItem('CBT_ACTIVE_TEST',JSON.stringify({id,title:meta.fileName||'PDF Imported CBT',source:'PDF Import',duration:180,totalQuestions:fresh.length,questionIds:fresh.map(q=>q.id),questions:fresh}));
    location.href='./cbt.html?source=pdf&v8='+Date.now();
  }

  function install(){
    const oldInput=$('pdfInput'),oldButton=$('convertButton');if(!oldInput||!oldButton)return;
    // Clone controls once: removes every legacy listener from previous parser versions.
    if(!oldInput.dataset.pdf8){const ni=oldInput.cloneNode(true);ni.disabled=false;ni.removeAttribute('disabled');ni.dataset.pdf8='1';oldInput.replaceWith(ni);}
    const input=$('pdfInput');
    if(!oldButton.dataset.pdf8){const nb=oldButton.cloneNode(true);nb.disabled=true;nb.dataset.pdf8='1';oldButton.replaceWith(nb);}
    const button=$('convertButton');
    input.addEventListener('change',function(){const f=input.files&&input.files[0];button.disabled=!f;status(f?'📄 Selected: '+f.name:'Select a PDF to begin.');},{capture:true});
    button.addEventListener('click',async function(e){e.preventDefault();e.stopImmediatePropagation();const f=input.files&&input.files[0];if(!f){status('Select a PDF first.');return;}button.disabled=true;try{await convert(f)}catch(err){console.error('[PDF8]',err);status('❌ PDF conversion failed\n\n'+(err.message||err));}finally{button.disabled=false;}},{capture:true});
    document.querySelectorAll('#pdfUniversalOpenCBT,#pdfCbtDirectLaunch,#openPdfCBT').forEach(e=>e.remove());
    const row=button.parentElement;let open=document.getElementById('pdf8OpenCBT');if(!open){open=document.createElement('button');open.id='pdf8OpenCBT';open.type='button';open.className='primary';open.textContent='🚀 Open Imported Test in CBT';open.style.marginTop='10px';row.appendChild(open);}open.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();launch();},{capture:true});
    const pool=read(KEY,[]);if(Array.isArray(pool)&&pool.length){preview(pool);status('📚 Current imported PDF: '+pool.length+' questions. Select another PDF to replace it.');}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.PDFCBTProductionV8={convert,launch,extractPages,parsePages};
})();
