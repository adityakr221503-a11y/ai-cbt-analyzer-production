(function(){
"use strict";

const VERSION="RANKFORGE_OWNER_PDF_AUTO_ADAPTER_V4_RECOVERY";
const OCR_LANG="eng";
const PDFJS_VERSION="3.11.174";
const TESS_VERSION="5";
const RENDER_SCALE=3.2;
const MIN_TEXT_CHARS=80;
const OCR_PASSES=3;

let pdfjsPromise=null;
let tessPromise=null;
let workerPromise=null;

function log(){
  console.log.apply(console,["[RankForge OCR V4]"].concat([].slice.call(arguments)));
}

function loadScript(src,test){
  return new Promise(function(resolve,reject){
    if(test()) return resolve();

    const s=document.createElement("script");
    s.src=src;
    s.async=true;
    s.onload=function(){
      if(test()) resolve();
      else reject(new Error("Loaded script but global API missing: "+src));
    };
    s.onerror=function(){
      reject(new Error("Failed to load "+src));
    };
    document.head.appendChild(s);
  });
}

async function loadPDFJS(){
  if(pdfjsPromise) return pdfjsPromise;

  pdfjsPromise=(async function(){
    let last=null;

    const urls=[
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/"+PDFJS_VERSION+"/pdf.min.js",
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@"+PDFJS_VERSION+"/build/pdf.min.js"
    ];

    for(const u of urls){
      try{
        await loadScript(u,function(){
          return !!window.pdfjsLib;
        });

        if(window.pdfjsLib){
          try{
            window.pdfjsLib.GlobalWorkerOptions.workerSrc=
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/"+
              PDFJS_VERSION+"/pdf.worker.min.js";
          }catch(e){}

          log("PDF.js ready");
          return window.pdfjsLib;
        }
      }catch(e){
        last=e;
        console.warn(e);
      }
    }

    throw last || new Error("PDF.js unavailable");
  })();

  return pdfjsPromise;
}

async function loadTesseract(){
  if(tessPromise) return tessPromise;

  tessPromise=(async function(){
    let last=null;

    const urls=[
      "https://cdn.jsdelivr.net/npm/tesseract.js@"+TESS_VERSION+"/dist/tesseract.min.js",
      "https://unpkg.com/tesseract.js@"+TESS_VERSION+"/dist/tesseract.min.js"
    ];

    for(const u of urls){
      try{
        await loadScript(u,function(){
          return !!window.Tesseract;
        });

        if(window.Tesseract){
          log("Tesseract ready");
          return window.Tesseract;
        }
      }catch(e){
        last=e;
        console.warn(e);
      }
    }

    throw last || new Error("Tesseract unavailable");
  })();

  return tessPromise;
}

async function getWorker(progress){
  if(workerPromise) return workerPromise;

  workerPromise=(async function(){
    const T=await loadTesseract();

    if(!T || typeof T.createWorker!=="function"){
      throw new Error("Tesseract.createWorker unavailable");
    }

    const worker=await T.createWorker(OCR_LANG,1,{
      logger:function(m){
        if(progress && m && typeof m.progress==="number"){
          progress({
            stage:"ocr",
            progress:m.progress,
            status:m.status||""
          });
        }
      }
    });

    try{
      await worker.setParameters({
        preserve_interword_spaces:"1"
      });
    }catch(e){}

    return worker;
  })();

  return workerPromise;
}

function canvasFromImageData(imageData,w,h){
  const c=document.createElement("canvas");
  c.width=w;
  c.height=h;
  c.getContext("2d").putImageData(imageData,0,0);
  return c;
}

function preprocess(source,mode){
  const w=source.width;
  const h=source.height;
  const c=document.createElement("canvas");
  c.width=w;
  c.height=h;

  const ctx=c.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(source,0,0);

  const img=ctx.getImageData(0,0,w,h);
  const d=img.data;

  for(let i=0;i<d.length;i+=4){
    let r=d[i],g=d[i+1],b=d[i+2];

    let gray=
      0.299*r+
      0.587*g+
      0.114*b;

    if(mode==="gray"){
      d[i]=d[i+1]=d[i+2]=gray;
    }else if(mode==="contrast"){
      let x=(gray-128)*1.65+128;
      x=Math.max(0,Math.min(255,x));
      d[i]=d[i+1]=d[i+2]=x;
    }else{
      let x=(gray>172)?255:0;
      d[i]=d[i+1]=d[i+2]=x;
    }
  }

  ctx.putImageData(img,0,0);
  return c;
}

function scoreOCR(text,confidence){
  const t=String(text||"");
  const letters=(t.match(/[A-Za-z]/g)||[]).length;
  const words=t.split(/\s+/).filter(Boolean).length;
  const q=(t.match(/(?:^|\n)\s*(?:Q\s*)?\d{1,4}[\).:\-]/gi)||[]).length;
  const opts=(t.match(/(?:^|\n)\s*[A-D][\).:\-]/g)||[]).length;
  const garbage=(t.match(/[^\x20-\x7E\n\r\t₹°±×÷≤≥μΩ²³⁴⁵⁻]/g)||[]).length;

  let s=Number(confidence)||0;
  if(letters>30) s+=8;
  if(words>8) s+=5;
  if(q) s+=8;
  if(opts>=2) s+=8;
  if(garbage>20) s-=12;

  return Math.max(0,Math.min(100,s));
}

async function recognizeCanvas(canvas,progress){
  const worker=await getWorker(progress);

  const modes=["gray","contrast","binary"];
  const results=[];

  for(let i=0;i<modes.length;i++){
    const pc=preprocess(canvas,modes[i]);

    const ret=await worker.recognize(pc);

    const text=ret &&
      ret.data &&
      ret.data.text ?
      ret.data.text :
      "";

    const conf=ret &&
      ret.data &&
      typeof ret.data.confidence==="number" ?
      ret.data.confidence :
      0;

    results.push({
      mode:modes[i],
      text:text,
      confidence:conf,
      score:scoreOCR(text,conf)
    });

    if(progress){
      progress({
        stage:"ocr-pass",
        pass:i+1,
        totalPasses:OCR_PASSES,
        confidence:conf
      });
    }
  }

  results.sort(function(a,b){
    return b.score-a.score;
  });

  return results[0] || {
    mode:"none",
    text:"",
    confidence:0,
    score:0
  };
}

function pageQuality(text){
  const t=String(text||"").trim();
  const chars=t.length;
  const words=t.split(/\s+/).filter(Boolean).length;

  return {
    chars:chars,
    words:words,
    usable:chars>=MIN_TEXT_CHARS
  };
}

async function renderPDFPage(pdf,pageNo){
  const page=await pdf.getPage(pageNo);
  const viewport=page.getViewport({scale:RENDER_SCALE});

  const c=document.createElement("canvas");
  c.width=Math.ceil(viewport.width);
  c.height=Math.ceil(viewport.height);

  const ctx=c.getContext("2d",{willReadFrequently:true});

  await page.render({
    canvasContext:ctx,
    viewport:viewport
  }).promise;

  return c;
}

function detectQuestionStarts(text){
  const lines=String(text||"").split(/\r?\n/);
  const out=[];

  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();

    if(
      /^(?:Q(?:uestion)?\s*)?\d{1,4}\s*[\).:\-]\s+/i.test(line) ||
      /^\(\s*\d{1,4}\s*\)\s+/.test(line)
    ){
      out.push(i);
    }
  }

  return out;
}

function parseQuestions(text){
  const lines=String(text||"")
    .split(/\r?\n/)
    .map(function(x){return x.trim();});

  const starts=detectQuestionStarts(text);
  const blocks=[];

  if(!starts.length){
    return [];
  }

  for(let i=0;i<starts.length;i++){
    const a=starts[i];
    const b=i+1<starts.length ? starts[i+1] : lines.length;
    const block=lines.slice(a,b).filter(Boolean);

    if(block.length){
      blocks.push(block);
    }
  }

  const questions=[];

  for(let bi=0;bi<blocks.length;bi++){
    const block=blocks[bi];

    let qLines=[];
    const options=[];
    let currentOption=-1;

    for(const line of block){
      const m=line.match(/^([A-D])[\).:\-]\s*(.*)$/i);

      if(m){
        currentOption="ABCD".indexOf(m[1].toUpperCase());
        options[currentOption]=m[2].trim();
        continue;
      }

      if(currentOption!==-1){
        options[currentOption]=(options[currentOption]+" "+line).trim();
      }else{
        qLines.push(line);
      }
    }

    const q=qLines.join(" ").replace(/\s+/g," ").trim();

    if(
      q &&
      options.length===4 &&
      options.every(function(x){return typeof x==="string" && x.length>0;})
    ){
      questions.push({
        id:"RF-OCR-"+Date.now()+"-"+bi,
        question:q,
        text:q,
        options:options,
        correctAnswer:null,
        subject:"",
        chapter:"",
        sourceId:"",
        status:"quarantine",
        origin:"module",
        extraction:"ocr"
      });
    }
  }

  return questions;
}

function parseAnswerKey(text){
  const out={};
  const lines=String(text||"").split(/\r?\n/);

  for(const line of lines){
    let m=line.match(
      /(?:Q(?:uestion)?\s*)?(\d{1,4})\s*[\).:\-]?\s*([A-D])\b/i
    );

    if(m){
      out[String(Number(m[1]))]="ABCD".indexOf(m[2].toUpperCase());
    }
  }

  return out;
}

function applyAnswerKey(questions,key){
  for(let i=0;i<questions.length;i++){
    const q=questions[i];

    const nums=String(q.question).match(
      /^(?:Q(?:uestion)?\s*)?(\d{1,4})/
    );

    if(nums && key[String(Number(nums[1]))]!==undefined){
      q.correctAnswer=key[String(Number(nums[1]))];
    }
  }

  return questions;
}

function getSourceMeta(file,meta){
  return Object.assign({
    sourceId:"",
    moduleName:file.name,
    type:"module",
    year:"",
    privateOwnerNote:"",
    filename:file.name
  },meta||{});
}

async function submitToEngine(questions,meta){
  const engine=window.RankForgeSourceEngine;

  if(!engine || typeof engine.submitModuleQuestions!=="function"){
    throw new Error("RankForge Source Engine V4 is not loaded.");
  }

  return engine.submitModuleQuestions(questions,{
    sourceId:meta.sourceId,
    moduleName:meta.moduleName,
    type:meta.type,
    year:meta.year,
    privateOwnerNote:meta.privateOwnerNote,
    filename:meta.filename
  });
}

async function importPDF(file,meta,callbacks){
  if(!file) throw new Error("No PDF selected.");

  const cb=callbacks||{};
  const pdfjs=await loadPDFJS();

  const buffer=await file.arrayBuffer();

  const pdf=await pdfjs.getDocument({
    data:buffer,
    disableAutoFetch:false,
    disableStream:false
  }).promise;

  const totalPages=pdf.numPages;

  if(cb.onProgress) cb.onProgress({
    stage:"pdf-loaded",
    totalPages:totalPages,
    page:0
  });

  let fullText="";
  const pageTexts=[];
  let ocrPages=0;

  for(let pageNo=1;pageNo<=totalPages;pageNo++){
    if(cb.onProgress) cb.onProgress({
      stage:"page",
      page:pageNo,
      totalPages:totalPages
    });

    const page=await pdf.getPage(pageNo);

    let text="";
    try{
      const tc=await page.getTextContent();
      text=(tc.items||[])
        .map(function(x){return x.str||"";})
        .join(" ")
        .replace(/\s+/g," ")
        .trim();
    }catch(e){
      text="";
    }

    const quality=pageQuality(text);

    if(quality.usable){
      text=text+"\n";
    }else{
      const canvas=await renderPDFPage(pdf,pageNo);
      const ocr=await recognizeCanvas(canvas,cb.onProgress);

      text=ocr.text||"";
      ocrPages++;

      if(cb.onProgress) cb.onProgress({
        stage:"ocr-page-complete",
        page:pageNo,
        totalPages:totalPages,
        confidence:ocr.confidence,
        score:ocr.score
      });
    }

    pageTexts.push(text);
    fullText+=text+"\n";
  }

  const questions=parseQuestions(fullText);
  const answerKey=parseAnswerKey(fullText);
  applyAnswerKey(questions,answerKey);

  const source=getSourceMeta(file,meta);

  questions.forEach(function(q){
    q.sourceId=source.sourceId;
    q.filename=source.filename;
    q.extraction="pdf-text-or-ocr";
  });

  let result=null;

  if(questions.length){
    result=await submitToEngine(questions,source);
  }

  if(cb.onProgress) cb.onProgress({
    stage:"complete",
    page:totalPages,
    totalPages:totalPages,
    detectedQuestions:questions.length
  });

  return {
    version:VERSION,
    totalPages:totalPages,
    pages:totalPages,
    detectedQuestions:questions.length,
    questionsDetected:questions.length,
    importedQuestions:result && result.imported || 0,
    cleanQuestions:result && result.imported || 0,
    reviewQuestions:result && result.review || 0,
    quarantinedQuestions:result && result.quarantine || questions.length,
    answerKeyEntries:Object.keys(answerKey).length,
    ocrPages:ocrPages,
    questions:questions,
    engineResult:result
  };
}

async function importImage(file,meta,callbacks){
  if(!file) throw new Error("No image selected.");

  const cb=callbacks||{};

  const bitmap=await createImageBitmap(file);

  const c=document.createElement("canvas");
  c.width=bitmap.width;
  c.height=bitmap.height;

  c.getContext("2d").drawImage(bitmap,0,0);

  if(cb.onProgress) cb.onProgress({
    stage:"image-loaded",
    page:1,
    totalPages:1
  });

  const ocr=await recognizeCanvas(c,cb.onProgress);

  const questions=parseQuestions(ocr.text||"");
  const answerKey=parseAnswerKey(ocr.text||"");

  applyAnswerKey(questions,answerKey);

  const source=getSourceMeta(file,meta);

  questions.forEach(function(q){
    q.sourceId=source.sourceId;
    q.filename=source.filename;
    q.extraction="image-ocr";
  });

  let result=null;

  if(questions.length){
    result=await submitToEngine(questions,source);
  }

  return {
    version:VERSION,
    totalPages:1,
    pages:1,
    detectedQuestions:questions.length,
    questionsDetected:questions.length,
    importedQuestions:result && result.imported || 0,
    cleanQuestions:result && result.imported || 0,
    reviewQuestions:result && result.review || 0,
    quarantinedQuestions:result && result.quarantine || questions.length,
    answerKeyEntries:Object.keys(answerKey).length,
    ocrPages:1,
    questions:questions,
    engineResult:result
  };
}

async function importFile(file,meta,callbacks){
  const type=(file.type||"").toLowerCase();
  const name=file.name.toLowerCase();

  if(type==="application/pdf" || name.endsWith(".pdf")){
    return importPDF(file,meta,callbacks);
  }

  if(
    type.startsWith("image/") ||
    /\.(png|jpe?g|webp)$/i.test(name)
  ){
    return importImage(file,meta,callbacks);
  }

  throw new Error(
    "Unsupported source format: "+file.name+
    ". Supported: PDF, PNG, JPG, JPEG, WEBP."
  );
}

function shutdown(){
  workerPromise&&workerPromise.then(function(w){
    if(w && w.terminate) return w.terminate();
  }).catch(function(){});
  workerPromise=null;
}


async function importScan(file, meta, callbacks) {
  if (!file) {
    throw new Error("Scanned image missing");
  }

  if (typeof loadTesseract === "function") {
    await loadTesseract();
  }

  if (!window.Tesseract) {
    return {
      sourceName: file.name,
      sourceType: "scanned-image",
      questions: [],
      quarantine: 1,
      status: "quarantine",
      reason: "ocr_engine_unavailable"
    };
  }

  if (callbacks && callbacks.status) {
    callbacks.status("OCR scanning " + file.name);
  }

  const result = await Tesseract.recognize(file, "eng", {
    logger: function (m) {
      try {
        if (callbacks && callbacks.status) {
          callbacks.status(
            "OCR " +
            String(m.status || "") +
            " " +
            Math.round((m.progress || 0) * 100) +
            "%"
          );
        }
      } catch (_) {}
    }
  });

  const text =
    result &&
    result.data &&
    typeof result.data.text === "string"
      ? result.data.text
      : "";

  const confidence =
    result &&
    result.data &&
    typeof result.data.confidence === "number"
      ? result.data.confidence
      : 0;

  if (!text.trim()) {
    return {
      sourceName: file.name,
      sourceType: "scanned-image",
      questions: [],
      quarantine: 1,
      status: "quarantine",
      reason: "empty_ocr",
      ocrConfidence: confidence
    };
  }

  /*
   * Do not invent answers or silently create incomplete questions.
   * If this adapter already exposes a question parser, use it.
   * Otherwise quarantine the OCR text for Owner Review.
   */
  let questions = [];

  if (typeof parseOCRQuestions === "function") {
    questions = await parseOCRQuestions(text, {
      sourceName: file.name,
      sourceType: "scanned-image",
      ocrConfidence: confidence
    });
  }

  if (!Array.isArray(questions) || !questions.length) {
    return {
      sourceName: file.name,
      sourceType: "scanned-image",
      questions: [],
      quarantine: 1,
      status: "quarantine",
      reason: "question_reconstruction_unavailable",
      ocrConfidence: confidence,
      rawOCRAvailable: true
    };
  }

  const safeQuestions = questions.filter(function (q) {
    return q &&
      typeof q.question === "string" &&
      q.question.trim() &&
      Array.isArray(q.options) &&
      q.options.length === 4;
  });

  if (!safeQuestions.length) {
    return {
      sourceName: file.name,
      sourceType: "scanned-image",
      questions: [],
      quarantine: questions.length,
      status: "quarantine",
      reason: "four_options_not_recovered",
      ocrConfidence: confidence
    };
  }

  const engine =
    window.RankForgeSourceEngine;

  if (
    engine &&
    typeof engine.submitModuleQuestions === "function"
  ) {
    return engine.submitModuleQuestions(
      safeQuestions,
      Object.assign({}, meta || {}, {
        sourceName: file.name,
        sourceType: "scanned-image",
        ocrConfidence: confidence,
        extractionMethod: "V4-OCR"
      })
    );
  }

  return {
    sourceName: file.name,
    sourceType: "scanned-image",
    questions: safeQuestions,
    quarantine: 0,
    status: "pending_owner_approval",
    ocrConfidence: confidence
  };
}

window.RankForgeOwnerPDFAutoAdapterV4={
  version:VERSION,
  loadPDFJS:loadPDFJS,
  loadTesseract:loadTesseract,
  importPDF:importPDF,
  importScan:importScan,
  importImage:importImage,
  importFile:importFile,
  shutdown:shutdown
};

window.RankForgeOwnerPDFAutoAdapter=
  window.RankForgeOwnerPDFAutoAdapterV4;

window.RankForgeOwnerPDFAutoAdapterV3=
  window.RankForgeOwnerPDFAutoAdapterV4;

log("READY",VERSION);

})();
