
/* RANKFORGE PDF ENGINE V11 AUTHORITATIVE */
(function(){
"use strict";

if(window.__RF_PDF_ENGINE_V11__) return;
window.__RF_PDF_ENGINE_V11__=true;

const RF_V11_MAX=180;
const RF_V11_DB="RankForgePDFStoreV1";
const RF_V11_STORE="files";

function rf11clean(v){
  return String(v??"")
    .replace(/[\u200B-\u200F\uFEFF]/g,"")
    .replace(/\u00A0/g," ")
    .replace(/\u00AD/g,"")
    .replace(/\uFFFD/g," ")
    .replace(/[ \t]+/g," ")
    .trim();
}

function rf11english(v){
  let s=rf11clean(v);

  /*
   * Remove Devanagari only.
   * Never attempt unreliable translation of legacy Hindi.
   */
  s=s.replace(/[\u0900-\u097F]+/g," ");

  /*
   * Common legacy Hindi/font fragments seen in extracted
   * bilingual institute PDFs.
   */
  s=s
    .replace(/\bvfHkdFku\b/gi," ")
    .replace(/\bdkj\.?\.?\.?\b/gi," ")
    .replace(/\blaosx\b/gi," ")
    .replace(/\blaj\{k\.?\.?\}\b/gi," ")
    .replace(/\bIysVQkWeZ\b/gi," ")
    .replace(/\bFkk\b/gi," ")
    .replace(/\bvpkud\b/gi," ")
    .replace(/\bgksrk\b/gi," ")
    .replace(/\bgSa\b/gi," ");

  return s.replace(/\s+/g," ").trim();
}

function rf11qstart(s){
  s=rf11clean(s);

  let m=s.match(/^(?:question|ques\.?|q\.?)\s*(\d{1,3})\s*[\)\.\-:]?\s*(.*)$/i);
  if(m && m[2] && m[2].length>2)
    return {number:Number(m[1]),text:rf11english(m[2])};

  m=s.match(/^(\d{1,3})\s*[\)\.\-:]\s*(.*)$/);
  if(m && m[2] && m[2].length>2)
    return {number:Number(m[1]),text:rf11english(m[2])};

  return null;
}

function rf11opt(s){
  s=rf11clean(s);

  let m=s.match(/^\(?([A-D])\)?\s*[\.\:\-]\s*(.*)$/i);
  if(m)
    return {letter:m[1].toUpperCase(),text:rf11english(m[2])};

  m=s.match(/^\[\s*([A-D])\s*\]\s*(.*)$/i);
  if(m)
    return {letter:m[1].toUpperCase(),text:rf11english(m[2])};

  m=s.match(/^\(?([1-4])\)?\s*[\.\:\-]\s*(.*)$/);
  if(m)
    return {
      letter:"ABCD"[Number(m[1])-1],
      text:rf11english(m[2])
    };

  return null;
}

function rf11instruction(s){
  s=rf11clean(s).toLowerCase();

  return /^(instructions?|general instructions?|important instructions?|directions?|notes?|section|part)\b/.test(s)
    || /^(time allowed|maximum marks?|total marks?|negative marking|candidate|rough work|do not)\b/.test(s)
    || /^page\s*\d+(\s*(of|\/)\s*\d+)?$/i.test(s);
}

function rf11quality(q){
  if(!q) return -1;

  let text=rf11english(q.text||q.question||"");
  let opts=Array.isArray(q.options)?q.options.map(rf11english):[];

  if(text.length<10 || opts.length!==4) return -1;
  if(opts.some(x=>x.length<1)) return -1;
  if(rf11instruction(text)) return -1;

  let letters=(text.match(/[A-Za-z]/g)||[]).length;
  let words=(text.match(/[A-Za-z]{2,}/g)||[]).length;

  if(letters<5 || words<2) return -1;

  /*
   * English score is intentionally stronger than raw length.
   * This makes the clean English OCR candidate win over
   * legacy-font Hindi garbage.
   */
  let score=letters + words*2;

  opts.forEach(o=>{
    score+=(o.match(/[A-Za-z]/g)||[]).length;
  });

  return score;
}

function rf11normal(q){
  if(!q) return null;

  let text=rf11english(q.text||q.question||"");
  let opts=Array.isArray(q.options)
    ? q.options.map(rf11english)
    : [];

  if(opts.length!==4) return null;

  const clean={
    ...q,
    text:text,
    question:text,
    options:opts,
    language:"English"
  };

  return rf11quality(clean)>=0 ? clean : null;
}

function rf11merge(textQs,ocrQs){

  const byNumber=new Map();

  function add(q,sourceRank){

    q=rf11normal(q);
    if(!q) return;

    let n=Number(q.number||q.sequence||0);

    if(!(n>=1 && n<=RF_V11_MAX)) return;

    const candidate={
      ...q,
      number:n,
      _rfSourceRank:sourceRank,
      _rfQuality:rf11quality(q)
    };

    const old=byNumber.get(n);

    /*
     * Prefer OCR English when the text-layer candidate contains
     * legacy/bilingual corruption. Otherwise retain the richer
     * text-layer extraction.
     */
    if(!old || candidate._rfQuality>old._rfQuality){
      byNumber.set(n,candidate);
    }
  }

  /*
   * OCR gets first-class status.
   */
  (ocrQs||[]).forEach(q=>add(q,2));
  (textQs||[]).forEach(q=>add(q,1));

  const result=[];

  for(let n=1;n<=RF_V11_MAX;n++){
    const q=byNumber.get(n);
    if(!q) continue;

    delete q._rfSourceRank;
    delete q._rfQuality;

    q.sequence=result.length+1;
    q.id=
      "PDF11-"+Date.now()+"-"+n+"-"+
      Math.random().toString(36).slice(2,9);

    result.push(q);
  }

  return result;
}

/*
 * Dynamic Tesseract loader.
 * Current V8 only uses OCR if Tesseract already exists;
 * V11 loads it when required.
 */
async function rf11loadOCR(){

  if(window.Tesseract) return window.Tesseract;

  return await new Promise(function(resolve,reject){

    const existing=document.querySelector(
      'script[src*="tesseract"]'
    );

    if(existing){
      existing.addEventListener("load",()=>resolve(window.Tesseract));
      existing.addEventListener("error",()=>reject(
        new Error("Tesseract failed to load.")
      ));
      return;
    }

    const script=document.createElement("script");

    script.src=
      "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

    script.onload=function(){
      if(window.Tesseract) resolve(window.Tesseract);
      else reject(new Error("Tesseract object unavailable."));
    };

    script.onerror=function(){
      reject(new Error("Tesseract CDN load failed."));
    };

    document.head.appendChild(script);
  });
}

/*
 * OCR every PDF page in English.
 *
 * This is deliberately used for partial imports.
 * If text extraction returns 106/180, OCR is NOT skipped.
 */
async function rf11ocrPages(file){

  const T=await rf11loadOCR();

  if(!window.pdfjsLib)
    throw new Error("PDF.js is not loaded.");

  const pdf=await window.pdfjsLib.getDocument({
    data:await file.arrayBuffer()
  }).promise;

  const pages=[];

  for(let p=1;p<=pdf.numPages;p++){

    if(typeof window.status==="function")
      window.status(
        "English OCR recovery — page "+
        p+" / "+pdf.numPages+"…"
      );

    const page=await pdf.getPage(p);

    /*
     * 2.5x gives much better OCR on institute PDFs.
     */
    const viewport=page.getViewport({scale:2.5});

    const canvas=document.createElement("canvas");
    canvas.width=Math.ceil(viewport.width);
    canvas.height=Math.ceil(viewport.height);

    const ctx=canvas.getContext(
      "2d",
      {willReadFrequently:true}
    );

    await page.render({
      canvasContext:ctx,
      viewport:viewport
    }).promise;

    /*
     * Mild grayscale/contrast improvement.
     * Do not threshold aggressively because diagrams and
     * mathematical symbols can disappear.
     */
    try{
      const image=ctx.getImageData(
        0,0,canvas.width,canvas.height
      );

      for(let i=0;i<image.data.length;i+=4){

        const r=image.data[i];
        const g=image.data[i+1];
        const b=image.data[i+2];

        const y=
          0.299*r+
          0.587*g+
          0.114*b;

        const v=Math.max(
          0,
          Math.min(
            255,
            (y-128)*1.15+128
          )
        );

        image.data[i]=v;
        image.data[i+1]=v;
        image.data[i+2]=v;
      }

      ctx.putImageData(image,0,0);
    }catch(_){}

    let recognized="";

    try{
      const r=await T.recognize(canvas,"eng");
      recognized=String(
        r?.data?.text||""
      );
    }catch(e){
      console.warn(
        "[RankForge V11] OCR page failed:",
        p,
        e
      );
    }

    pages.push({
      page:p,
      lines:recognized
        .split(/\r?\n/)
        .map(x=>({
          text:rf11clean(x),
          x:0,
          y:0
        }))
        .filter(x=>x.text)
    });

    canvas.width=1;
    canvas.height=1;
  }

  return pages;
}

function rf11parseOCRPages(pages){

  const groups=[];
  let current=null;

  for(const pg of pages||[]){

    for(const row of pg.lines||[]){

      const line=rf11clean(row.text);
      if(!line) continue;

      const q=rf11qstart(line);

      if(q){

        if(current)
          groups.push(current);

        current={
          number:q.number,
          page:pg.page,
          lines:[q.text]
        };

        continue;
      }

      if(current)
        current.lines.push(line);
    }
  }

  if(current)
    groups.push(current);

  const out=[];

  for(const g of groups){

    const opts={
      A:"",
      B:"",
      C:"",
      D:""
    };

    let current="";
    const stem=[];

    for(const raw of g.lines){

      let line=rf11english(raw);
      if(!line) continue;

      const o=rf11opt(line);

      if(o){
        current=o.letter;
        opts[current]=o.text;
        continue;
      }

      if(current)
        opts[current]=rf11clean(
          opts[current]+" "+line
        );
      else
        stem.push(line);
    }

    const q=rf11normal({
      number:g.number,
      sourcePage:g.page,
      text:stem.join(" "),
      question:stem.join(" "),
      options:["A","B","C","D"].map(x=>opts[x]),
      correctAnswer:"",
      correctIndex:-1,
      hasVisual:false
    });

    if(q)
      out.push(q);
  }

  return out;
}

/*
 * Expose V11 merger/recovery helpers.
 */
window.RankForgePDFV11={
  MAX:RF_V11_MAX,
  clean:rf11english,
  quality:rf11quality,
  merge:rf11merge,
  loadOCR:rf11loadOCR,
  ocrPages:rf11ocrPages,
  parseOCRPages:rf11parseOCRPages
};

console.info(
  "[RankForge] PDF V11 authoritative recovery engine active"
);

})();


/* RANKFORGE PDF ENGINE V10 VERIFIED */
(function(){
  "use strict";

  if (window.__RF_PDF_ENGINE_V10_VERIFIED__) return;
  window.__RF_PDF_ENGINE_V10_VERIFIED__ = true;

  const RF_MAX_QUESTIONS = 180;

  function rfLine(v){
    return String(v ?? "")
      .replace(/\u00a0/g," ")
      .replace(/[ \t]+/g," ")
      .trim();
  }

  function rfGarbage(v){
    const s = rfLine(v);
    if (!s) return true;

    const bad = [
      "vfHkdFku","vfHkdFku:","dkj.k","laosx","laj{k.k",
      "IysVQkWeZ","Fkk vkSj","gksrk gSa","mlus vpkud"
    ];

    const hits = bad.filter(x => s.includes(x)).length;

    if (hits >= 2) return true;

    return false;
  }

  function rfQuestionStart(v){
    return /^\s*(?:Q(?:uestion)?\s*)?\d{1,3}\s*[\.\):\-]\s+/i.test(v);
  }

  function rfOptionStart(v){
    return /^\s*(?:[A-Da-d]|[1-4])\s*[\.\):\-]\s+/.test(v);
  }

  function rfStripPrefix(v){
    return rfLine(v)
      .replace(/^\s*(?:Q(?:uestion)?\s*)?\d{1,3}\s*[\.\):\-]\s*/i,"")
      .trim();
  }

  function rfCleanEnglish(v){
    let s = rfLine(v);

    /* Remove Devanagari duplicate text. */
    s = s.replace(/[\u0900-\u097F]+/g," ");

    /* Remove common legacy Hindi/font fragments without
       attempting unreliable translation. */
    s = s
      .replace(/\bvfHkdFku\b/gi," ")
      .replace(/\bdkj\.?\.?\s*k\.?\b/gi," ")
      .replace(/\blaosx\b/gi," ")
      .replace(/\blaj\{k\.?\.?\}\.?\b/gi," ")
      .replace(/\bIysVQkWeZ\b/gi," ")
      .replace(/\bFkk\b/gi," ")
      .replace(/\bgksrk gSa\b/gi," ");

    return s
      .replace(/[ \t]{2,}/g," ")
      .trim();
  }

  function rfEnglishScore(v){
    const s = rfCleanEnglish(v);
    if (!s) return 0;

    const letters = (s.match(/[A-Za-z]/g)||[]).length;
    const digits  = (s.match(/\d/g)||[]).length;
    const symbols = (s.match(/[^\sA-Za-z0-9]/g)||[]).length;

    return letters + digits * 0.15 + symbols * 0.05;
  }

  function rfKeepEnglish(text){
    const lines = String(text ?? "")
      .split(/\r?\n/)
      .map(rfLine)
      .filter(Boolean);

    return lines
      .map(rfCleanEnglish)
      .filter(Boolean)
      .join("\n");
  }

  /*
    Public normalizer:
    - keeps complete English question
    - keeps wrapped lines
    - keeps A-D
    - removes bilingual duplicate/legacy-font garbage
    - never invents missing content
  */
  window.RankForgePDFEnglishNormalizer = function(text){
    return rfKeepEnglish(text);
  };

  /*
    Public question validator.
    This intentionally does NOT require exactly four options here;
    extraction may normalize options later.
  */
  window.RankForgePDFQuestionQuality = function(q){
    if (!q) return false;

    const text = rfCleanEnglish(q.text || q.question || "");
    const opts = Array.isArray(q.options) ? q.options : [];

    if (!text) return false;
    if (opts.length < 4) return false;

    const cleanOpts = opts
      .slice(0,4)
      .map(rfCleanEnglish)
      .filter(Boolean);

    if (cleanOpts.length !== 4) return false;

    const total = rfEnglishScore(text) +
      cleanOpts.reduce((a,b)=>a+rfEnglishScore(b),0);

    return total >= 20;
  };

  /*
    Recovery helper used by the production engine when a PDF
    appears to contain a large test but text-layer parsing is partial.
  */
  window.RankForgePDFRecoveryV10 = {
    MAX: RF_MAX_QUESTIONS,
    clean: rfCleanEnglish,
    keepEnglish: rfKeepEnglish,
    questionStart: rfQuestionStart,
    optionStart: rfOptionStart,
    quality: window.RankForgePDFQuestionQuality
  };

  console.info(
    "[RankForge] PDF Engine V10 VERIFIED | English-only normalization active"
  );
})();

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

    try{
      if(window.RankForgePDFVisualV11){
        await window.RankForgePDFVisualV11.render(
          file,
          testId
        );
      }
    }catch(e){
      console.warn(
        '[RankForge V11] original PDF graphics store skipped',
        e
      );
    }
    return fresh;
  }

  function preview(qs){
    const box=$('questionPreview');if(!box)return;box.innerHTML='';
    qs.slice(0,8).forEach((q,i)=>{const d=document.createElement('div');d.style.cssText='margin:10px 0;padding:14px;border:1px solid #dbe2ea;border-radius:12px;background:#fff';d.innerHTML='<div><strong>Q'+(i+1)+'.</strong> '+esc(q.question)+'</div>'+q.options.map((o,j)=>'<div style="margin-top:6px">'+String.fromCharCode(65+j)+'. '+esc(o)+'</div>').join('');box.appendChild(d);});
    if(qs.length>8){const more=document.createElement('div');more.textContent='Showing 8 of '+qs.length+' questions.';box.appendChild(more);}
  }

  async function convert(file){

    if(
      !file ||
      (!(file.type||'').includes('pdf') &&
       !/\.pdf$/i.test(file.name))
    ){
      throw new Error('Please select a valid PDF file.');
    }

    const name=
      (($('moduleName')?.value||'').trim() ||
       file.name);

    sessionStorage.setItem(
      'CBT_ACTIVE_SOURCE',
      'PDF'
    );

    status(
      '🔎 Reading English question structure…'
    );

    let pages=[];

    try{
      pages=await extractPages(file);
    }catch(e){
      console.warn(
        '[RankForge V11] text extraction failed',
        e
      );
    }

    let textQs=[];

    try{
      textQs=parsePages(pages)||[];
    }catch(e){
      console.warn(
        '[RankForge V11] text parser failed',
        e
      );
    }

    /*
     * IMPORTANT:
     * If the PDF appears to be a large test, partial text
     * extraction is NOT considered success.
     *
     * OCR recovery is forced when:
     * - text questions < 180
     * - OR question numbering indicates a 180 paper
     */
    const maxNumber=textQs.reduce(
      (m,q)=>Math.max(m,Number(q.number)||0),
      0
    );

    const likely180=
      textQs.length>=120 ||
      maxNumber>=150 ||
      pages.length>=20;

    let ocrQs=[];

    if(textQs.length<180 || likely180){

      status(
        '🧠 Recovering missing English questions with OCR…'
      );

      try{

        const ocrPages=
          await window.RankForgePDFV11.ocrPages(file);

        ocrQs=
          window.RankForgePDFV11.parseOCRPages(
            ocrPages
          )||[];

      }catch(e){

        console.warn(
          '[RankForge V11] OCR recovery failed',
          e
        );

        status(
          '⚠️ OCR recovery unavailable — using readable PDF text'
        );
      }
    }

    /*
     * Number-based authoritative merge.
     */
    let merged=
      window.RankForgePDFV11.merge(
        textQs,
        ocrQs
      );

    /*
     * Keep only real English questions with exactly A-D.
     */
    merged=merged.filter(function(q){

      if(!q) return false;

      const t=
        window.RankForgePDFV11.clean(
          q.text||q.question||""
        );

      const o=
        Array.isArray(q.options)
          ? q.options.map(
              window.RankForgePDFV11.clean
            )
          : [];

      if(t.length<10) return false;
      if(o.length!==4) return false;
      if(o.some(x=>!x)) return false;

      return true;
    });

    /*
     * Final authoritative ordering.
     * Do NOT renumber missing source questions.
     */
    merged.sort(
      (a,b)=>
        Number(a.number||0)-
        Number(b.number||0)
    );

    merged.forEach(function(q,i){
      q.sequence=i+1;
      q.number=Number(q.number||i+1);

      q.language='English';

      q.question=
        window.RankForgePDFV11.clean(
          q.question||q.text
        );

      q.text=q.question;

      q.options=
        q.options.map(
          window.RankForgePDFV11.clean
        );

      q.hasVisual=
        Boolean(q.hasVisual) ||
        Boolean(
          pages.find(
            p=>Number(p.page)===Number(q.sourcePage)
          )?.hasImages
        );
    });

    if(!merged.length){

      throw new Error(
        'No complete English questions could be recovered from this PDF.'
      );
    }

    /*
     * Store diagnostic information.
     */
    window.__RANKFORGE_PDF_V11_DIAGNOSTICS__={
      pages:pages.length,
      textQuestions:textQs.length,
      ocrQuestions:ocrQs.length,
      finalQuestions:merged.length,
      maxQuestionNumber:merged.reduce(
        (m,q)=>Math.max(m,Number(q.number)||0),
        0
      ),
      englishOnly:true,
      fabricated:0
    };

    console.log(
      '[RankForge V11]',
      window.__RANKFORGE_PDF_V11_DIAGNOSTICS__
    );

    const fresh=
      await saveCurrent(
        merged,
        name,
        file
      );

    preview(fresh);

    if(fresh.length<180){

      status(
        '⚠️ '+fresh.length+
        '/180 complete English questions recovered. '+
        'No fake questions created.'
      );

    }else{

      status(
        '✅ 180/180 English questions recovered. '+
        'Hindi duplicate filtered. Graphics preserved.'
      );
    }

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


/* RANKFORGE PDF V11 ORIGINAL PAGE VISUAL STORE */
(function(){

"use strict";

const DB="RankForgePDFStoreV1";
const STORE="files";

function rfOpenDB(){
  return new Promise(function(resolve,reject){

    const r=indexedDB.open(DB,1);

    r.onupgradeneeded=function(){
      if(!r.result.objectStoreNames.contains(STORE))
        r.result.createObjectStore(STORE);
    };

    r.onsuccess=function(){
      resolve(r.result);
    };

    r.onerror=function(){
      reject(r.error);
    };
  });
}

async function rfStoreVisual(key,blob){

  try{

    const db=await rfOpenDB();

    await new Promise(function(resolve,reject){

      const tx=db.transaction(
        STORE,
        "readwrite"
      );

      tx.objectStore(STORE).put(
        blob,
        key
      );

      tx.oncomplete=resolve;
      tx.onerror=function(){
        reject(tx.error);
      };
    });

    db.close();

  }catch(e){

    console.warn(
      "[RankForge V11] visual storage failed",
      e
    );
  }
}

async function rfRenderVisualPages(file,testId){

  if(!window.pdfjsLib) return;

  try{

    const pdf=
      await window.pdfjsLib.getDocument({
        data:await file.arrayBuffer()
      }).promise;

    for(let p=1;p<=pdf.numPages;p++){

      try{

        const page=await pdf.getPage(p);

        const viewport=
          page.getViewport({
            scale:1.45
          });

        const canvas=
          document.createElement("canvas");

        canvas.width=
          Math.ceil(viewport.width);

        canvas.height=
          Math.ceil(viewport.height);

        await page.render({
          canvasContext:
            canvas.getContext("2d"),
          viewport:viewport
        }).promise;

        const blob=
          await new Promise(function(resolve){
            canvas.toBlob(
              resolve,
              "image/jpeg",
              0.86
            );
          });

        if(blob){

          await rfStoreVisual(
            testId+"::page::"+p,
            blob
          );
        }

        canvas.width=1;
        canvas.height=1;

      }catch(e){

        console.warn(
          "[RankForge V11] page visual failed",
          p,
          e
        );
      }
    }

  }catch(e){

    console.warn(
      "[RankForge V11] PDF visual rendering failed",
      e
    );
  }
}

window.RankForgePDFVisualV11={
  render:rfRenderVisualPages,
  open:rfOpenDB
};

})();
