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


  /* ============================================================
     RANKFORGE CLEAN PDF PARSER V9
     - preserves complete stems/options
     - handles wrapped question lines
     - handles A-D, (A), [A], 1-4 options
     - removes page/header/footer noise
     - does NOT reject valid questions merely because of
       bilingual / legacy-font garbage
     - keeps diagnostic counts
     ============================================================ */

  function rfCleanLine(v){
    return String(v == null ? '' : v)
      .replace(/[\u200B-\u200F\uFEFF]/g,'')
      .replace(/\u00AD/g,'')
      .replace(/\u00A0/g,' ')
      .replace(/[ \t]+/g,' ')
      .trim();
  }

  function rfLooksGarbage(v){
    const s=rfCleanLine(v);
    if(!s) return true;

    if(/^(page|pg\.?)\s*\d+(\s*(of|\/)\s*\d+)?$/i.test(s))
      return true;

    if(/^(instructions?|general instructions?|important instructions?|directions?|notes?|section|part)\b/i.test(s))
      return true;

    if(/^(time allowed|maximum marks?|total marks?|candidate|negative marking|do not|all questions|each question|rough work)\b/i.test(s))
      return true;

    return false;
  }

  function rfQuestionStart(s){
    const x=rfCleanLine(s);

    let m=x.match(/^(?:question|ques\.?|q\.?)\s*(\d{1,4})\s*[\)\.\-:]?\s*(.*)$/i);
    if(m && m[2] && m[2].length >= 3)
      return {number:Number(m[1]),text:rfCleanLine(m[2])};

    m=x.match(/^(\d{1,4})\s*[\)\.\-:]\s*(.*)$/);
    if(m && m[2] && m[2].length >= 3)
      return {number:Number(m[1]),text:rfCleanLine(m[2])};

    return null;
  }

  function rfOptionStart(s){
    const x=rfCleanLine(s);

    let m=x.match(/^\(\s*([A-D])\s*\)\s*(.*)$/i);
    if(m) return {letter:m[1].toUpperCase(),text:rfCleanLine(m[2])};

    m=x.match(/^\[\s*([A-D])\s*\]\s*(.*)$/i);
    if(m) return {letter:m[1].toUpperCase(),text:rfCleanLine(m[2])};

    m=x.match(/^([A-D])\s*[\)\.\-:]\s*(.*)$/i);
    if(m) return {letter:m[1].toUpperCase(),text:rfCleanLine(m[2])};

    return null;
  }

  function rfNumericOptionStart(s){
    const x=rfCleanLine(s);

    let m=x.match(/^\(\s*([1-4])\s*\)\s*(.*)$/);
    if(m) return {index:Number(m[1])-1,text:rfCleanLine(m[2])};

    m=x.match(/^\[\s*([1-4])\s*\]\s*(.*)$/);
    if(m) return {index:Number(m[1])-1,text:rfCleanLine(m[2])};

    m=x.match(/^([1-4])\s*[\)\.\-:]\s*(.*)$/);
    if(m) return {index:Number(m[1])-1,text:rfCleanLine(m[2])};

    return null;
  }

  function rfStripMojibake(s){
    return rfCleanLine(s)
      .replace(/[\u0080-\u009F]/g,' ')
      .replace(/(?:â€™|â€œ|â€|â€“|â€”|â€¦|Â)/g,' ')
      .replace(/[\uFFFD]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function rfEnglishClean(s){
    let x=rfStripMojibake(s);

    /*
     * Legacy-font Hindi sometimes appears as strings such as
     * vfHkdFku / dkj.k etc. Do not allow those fragments to
     * pollute the clean English question.
     *
     * Only remove obvious legacy-font runs when English text
     * is also present. This avoids deleting legitimate symbols.
     */
    const latin=(x.match(/[A-Za-z]/g)||[]).length;
    const devan=(x.match(/[\u0900-\u097F]/g)||[]).length;

    if(latin >= 8 && devan > 0){
      x=x.replace(/[\u0900-\u097F]+/g,' ');
    }

    /*
     * Common PDF legacy-encoding garbage: keep punctuation,
     * numbers, units and mathematical symbols.
     */
    x=x.replace(/\s{2,}/g,' ').trim();

    return x;
  }

  function rfValidStem(s){
    const x=rfEnglishClean(s);
    if(x.length < 8) return false;
    if(rfLooksGarbage(x)) return false;

    const letters=(x.match(/[A-Za-z]/g)||[]).length;
    const digits=(x.match(/\d/g)||[]).length;

    /*
     * Accept numerical questions too.
     * Reject only lines that are overwhelmingly noise.
     */
    if(letters < 3 && digits < 2) return false;

    return true;
  }

  function rfMakeQuestion(number,stem,options,page,hasImages){
    const cleanStem=rfEnglishClean(stem);
    const cleanOptions=options.map(rfEnglishClean);

    if(!rfValidStem(cleanStem)) return null;
    if(cleanOptions.length!==4) return null;
    if(cleanOptions.some(x=>x.length<1)) return null;

    return {
      number:number,
      question:cleanStem,
      text:cleanStem,
      options:cleanOptions,
      correctAnswer:'',
      correctIndex:-1,
      sourcePage:page,
      hasVisual:Boolean(hasImages) ||
        /(figure|diagram|graph|shown|image|following|given below)/i.test(cleanStem),
      language:'English'
    };
  }

  function parseGroup(lines,number,page,hasImages){
    let stem=[];
    const opts={A:'',B:'',C:'',D:''};
    let current='';

    for(const raw of lines){
      let line=rfCleanLine(raw);
      if(!line) continue;

      /*
       * Ignore obvious page-level noise.
       */
      if(rfLooksGarbage(line)) continue;

      /*
       * Answer keys are NOT part of the visible test question.
       */
      if(/^(answer|ans|correct\s*answer|answer\s*key)\b/i.test(line))
        continue;

      const os=rfOptionStart(line);

      if(os){
        current=os.letter;
        if(!opts[current]) opts[current]=os.text;
        else opts[current]=rfCleanLine(opts[current]+' '+os.text);
        continue;
      }

      if(current){
        opts[current]=rfCleanLine(opts[current]+' '+line);
      }else{
        stem.push(line);
      }
    }

    return rfMakeQuestion(
      number,
      stem.join(' '),
      ['A','B','C','D'].map(k=>opts[k]),
      page,
      hasImages
    );
  }

  function parseNumericGroup(lines,number,page,hasImages){
    let stem=[];
    const opts=['','','',''];
    let current=-1;

    for(const raw of lines){
      const line=rfCleanLine(raw);
      if(!line) continue;
      if(rfLooksGarbage(line)) continue;

      if(/^(answer|ans|correct\s*answer|answer\s*key)\b/i.test(line))
        continue;

      const os=rfNumericOptionStart(line);

      if(os && os.index>=0 && os.index<4){
        current=os.index;
        opts[current]=os.text;
        continue;
      }

      if(current>=0)
        opts[current]=rfCleanLine(opts[current]+' '+line);
      else
        stem.push(line);
    }

    return rfMakeQuestion(
      number,
      stem.join(' '),
      opts,
      page,
      hasImages
    );
  }

  function parsePages(pages){
    const all=[];
    const diagnostics={
      pages:Array.isArray(pages)?pages.length:0,
      questionStarts:0,
      candidates:0,
      valid:0,
      rejected:0
    };

    for(const pg of (pages||[])){
      const rows=Array.isArray(pg.rows)?pg.rows:[];
      if(!rows.length) continue;

      const candidates=[];

      for(let i=0;i<rows.length;i++){
        const row=rows[i]||{};
        const text=rfCleanLine(row.text);

        if(!text) continue;

        const q=rfQuestionStart(text);

        if(q){
          diagnostics.questionStarts++;
          candidates.push({
            index:i,
            number:q.number,
            first:q.text
          });
        }
      }

      for(let i=0;i<candidates.length;i++){
        const a=candidates[i];
        const b=candidates[i+1];

        let block=rows
          .slice(a.index,b ? b.index : rows.length)
          .map(r=>rfCleanLine(r.text))
          .filter(Boolean);

        if(!block.length) continue;

        block[0]=a.first;

        /*
         * First try A-D.
         */
        let q=parseGroup(
          block,
          a.number,
          pg.page,
          pg.hasImages
        );

        /*
         * Then numeric 1-4.
         */
        if(!q){
          q=parseNumericGroup(
            block,
            a.number,
            pg.page,
            pg.hasImages
          );
        }

        if(q){
          diagnostics.valid++;
          all.push(q);
        }else{
          diagnostics.rejected++;
        }

        diagnostics.candidates++;
      }
    }

    /*
     * Remove exact duplicates but DO NOT require numbering
     * to be continuous. PDFs frequently restart numbering
     * inside sections.
     */
    const seen=new Set();
    const out=[];

    for(const q of all){
      const key=
        rfEnglishClean(q.question).toLowerCase()+
        '||'+
        q.options.map(x=>rfEnglishClean(x).toLowerCase()).join('|');

      if(seen.has(key)) continue;
      seen.add(key);
      out.push(q);
    }

    out.sort(function(a,b){
      return (a.sourcePage-b.sourcePage) ||
             (a.number-b.number);
    });

    const now=Date.now();

    out.forEach(function(q,i){
      q.sequence=i+1;
      q.id='PDF9-'+now+'-'+i+'-'+
        Math.random().toString(36).slice(2,8);
    });

    diagnostics.final=out.length;
    diagnostics.duplicatesRemoved=diagnostics.valid-out.length;

    window.__RANKFORGE_PDF_PARSE_DIAGNOSTICS__=diagnostics;

    console.log(
      '[RankForge PDF V9]',
      JSON.stringify(diagnostics,null,2)
    );

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
    if(!qs.length){
      const d=window.__RANKFORGE_PDF_PARSE_DIAGNOSTICS__||{};
      throw new Error(
        'No complete questions detected. Starts='+
        (d.questionStarts||0)+
        ', candidates='+(d.candidates||0)+
        ', valid='+(d.valid||0)
      );
    }
    // Hard rejection of obvious instruction fragments.
    qs=qs.filter(q=>!isInstruction(q.question)&&q.options.every(o=>!isInstruction(o)));
    if(!qs.length)throw new Error('Questions were detected but all candidates were rejected as instructions/invalid content.');
    const fresh=await saveCurrent(qs,name,file);
    preview(fresh);

    const diag=window.__RANKFORGE_PDF_PARSE_DIAGNOSTICS__||{};
    console.log('[RankForge PDF V9 FINAL]',{
      detectedStarts:diag.questionStarts||0,
      candidates:diag.candidates||0,
      valid:diag.valid||0,
      duplicatesRemoved:diag.duplicatesRemoved||0,
      final:fresh.length
    });
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
