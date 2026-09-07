(function(){
"use strict";

const $=s=>document.querySelector(s);
const KEY="pdfCbtQuestions";
const META="pdfCbtMeta";
const REVIEW="pdfCbtReview";
const ACTIVE="pdfCbtActiveQuestions";
const ACTIVE_TEST="pdfCbtActiveTest";
const ACTIVE_SOURCE="pdfCbtActiveSource";

function status(t){
  const el=$("#status")||$("#conversionStatus")||$("#pdfStatus");
  if(el) el.textContent=String(t||"");
}

function clean(s){
  return String(s??"")
    .replace(/[\u200B-\u200F\uFEFF]/g,"")
    .replace(/\u00AD/g,"")
    .replace(/\s+/g," ")
    .trim();
}

function repairText(s){
  return clean(s)
    .replace(/([A-Za-z])-\s+([a-z])/g,"$1$2")
    .replace(/\s+([,.;:!?])/g,"$1")
    .replace(/([(\[])\s+/g,"$1")
    .replace(/\s+([)\]])/g,"$1")
    .trim();
}

function norm(s){
  return repairText(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"")
    .slice(0,500);
}

function answerLetter(a){
  const x=String(a??"").trim().toUpperCase();
  if(/^[ABCD]$/.test(x)) return x;
  if(x==="1") return "A";
  if(x==="2") return "B";
  if(x==="3") return "C";
  if(x==="4") return "D";
  return "";
}

function safeGet(k,fallback){
  try{
    const v=JSON.parse(localStorage.getItem(k)||"null");
    return v==null?fallback:v;
  }catch(e){return fallback}
}

function safeSet(k,v){
  try{
    localStorage.setItem(k,JSON.stringify(v));
    return true;
  }catch(e){return false}
}

function parseAnswerLine(line){
  const s=clean(line);

  let m=s.match(
    /^(?:answer|ans|correct\s*answer|correct|key)\s*(?:for\s*)?(?:q(?:uestion)?\s*)?(\d{1,3})?\s*[:=\-]?\s*[\(\[]?\s*([A-D1-4])\s*[\)\]]?$/i
  );

  if(m){
    const a=answerLetter(m[2]);
    if(a) return a;
  }

  m=s.match(
    /^(?:q(?:uestion)?\s*)?(\d{1,3})\s*[:=\-]\s*(?:answer|ans)?\s*[\(\[]?\s*([A-D1-4])\s*[\)\]]?$/i
  );

  if(m){
    const a=answerLetter(m[2]);
    if(a) return a;
  }

  return "";
}

/*
 * Strong question-number detection.
 * Supports:
 * 1.
 * 1)
 * 1:
 * 1 -
 * Q1.
 * Q 1.
 * Question 1.
 * OCR variants without punctuation.
 */
function qStart(line){
  const s=clean(line);
  if(!s)return null;

  // Never treat answer-key lines as questions.
  if(/^(answer|answers|ans|solution|solutions|answer\s*key)\b/i.test(s))
    return null;

  // Never treat numbered options (1)-(4) as question numbers.
  if(/^\(?[1-4]\)?\s*[.):\-]\s+/.test(s))
    return null;

  let m=s.match(/^Q(?:uestion)?\s*(\d{1,4})\s*[.):\-]?\s+(.+)$/i);

  if(!m)
    m=s.match(/^Question\s*(\d{1,4})\s*[.):\-]\s*(.+)$/i);

  if(!m)
    m=s.match(/^(\d{1,4})\s*[.):\-]\s+(.+)$/);

  if(!m)return null;

  const text=repairText(m[2]||"");
  if(text.length<5)return null;

  return {
    number:Number(m[1]),
    text
  };
}
function optStart(line){
  const s=clean(line);

  const m=s.match(
    /^(?:\(\s*([A-Da-d1-4])\s*\)|\[\s*([A-Da-d1-4])\s*\]|([A-Da-d1-4])\s*[\.\):\-])\s*(.+)$/i
  );

  if(!m) return null;

  const letter=answerLetter(
    m[1]||m[2]||m[3]
  );

  const text=repairText(m[4]);

  return letter&&text
    ?{letter,text}
    :null;
}

/*
 * Convert PDF.js text items into readable lines.
 * Keeps x-position information so words are not randomly joined.
 */
function groupItems(items){
  const rows=[];

  for(const item of items||[]){
    const text=String(item.str??"").trim();
    if(!text) continue;

    const tr=item.transform||[];
    const x=Number(tr[4]||0);
    const y=Number(tr[5]||0);
    const fs=Math.abs(
      Number(tr[0]||tr[3]||10)
    )||10;

    let row=null;

    for(const r of rows){
      if(
        Math.abs(r.y-y)<=
        Math.max(3,fs*.35)
      ){
        row=r;
        break;
      }
    }

    if(!row){
      row={
        y,
        items:[]
      };
      rows.push(row);
    }

    row.items.push({
      x,
      text,
      fs
    });
  }

  rows.sort((a,b)=>b.y-a.y);

  return rows.map(row=>{
    row.items.sort((a,b)=>a.x-b.x);

    let out="";
    let prev=null;

    for(const it of row.items){
      if(!out){
        out=it.text;
        prev=it;
        continue;
      }

      const gap=it.x-(prev.x+prev.text.length*prev.fs*.45);

      const joinWithoutSpace=
        gap<Math.max(2,prev.fs*.20) &&
        /[A-Za-z0-9]$/.test(out) &&
        /^[A-Za-z0-9]/.test(it.text);

      if(!joinWithoutSpace)
        out+=" ";

      out+=it.text;
      prev=it;
    }

    return repairText(out);
  });
}

async function extractTextPages(file){
  if(!window.pdfjsLib)
    throw new Error("PDF.js is not loaded.");

  const buf=await file.arrayBuffer();

  const pdf=await window.pdfjsLib
    .getDocument({data:buf})
    .promise;

  const pages=[];

  for(let p=1;p<=pdf.numPages;p++){
    status(
      "Reading PDF text — page "+
      p+" of "+pdf.numPages+"…"
    );

    const page=await pdf.getPage(p);
    const content=await page.getTextContent();

    pages.push({
      page:p,
      lines:groupItems(content.items)
    });
  }

  return pages;
}

async function loadTesseract(){
  if(window.Tesseract)
    return window.Tesseract;

  await new Promise((resolve,reject)=>{
    const script=document.createElement("script");

    script.src=
      "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

    script.onload=resolve;
    script.onerror=()=>{
      reject(
        new Error("OCR engine could not be loaded.")
      );
    };

    document.head.appendChild(script);
  });

  return window.Tesseract;
}

async function ocrPages(file){
  const T=await loadTesseract();

  const buf=await file.arrayBuffer();

  const pdf=await window.pdfjsLib
    .getDocument({data:buf})
    .promise;

  const pages=[];

  for(let p=1;p<=pdf.numPages;p++){
    status(
      "OCR processing — page "+
      p+" of "+pdf.numPages+"…"
    );

    const page=await pdf.getPage(p);

    const viewport=
      page.getViewport({scale:2.5});

    const canvas=
      document.createElement("canvas");

    canvas.width=Math.ceil(viewport.width);
    canvas.height=Math.ceil(viewport.height);

    const ctx=
      canvas.getContext("2d",{
        willReadFrequently:true
      });

    await page.render({
      canvasContext:ctx,
      viewport
    }).promise;

    const img=ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

    for(let i=0;i<img.data.length;i+=4){
      const g=
        .299*img.data[i]+
        .587*img.data[i+1]+
        .114*img.data[i+2];

      const v=Math.max(
        0,
        Math.min(
          255,
          (g-128)*1.35+128
        )
      );

      img.data[i]=v;
      img.data[i+1]=v;
      img.data[i+2]=v;
    }

    ctx.putImageData(img,0,0);

    const r=await T.recognize(
      canvas,
      "eng"
    );

    pages.push({
      page:p,
      lines:String(
        r?.data?.text||""
      ).split(/\r?\n/)
    });

    canvas.width=1;
    canvas.height=1;
  }

  return pages;
}

/*
 * Build a question without silently losing repeated
 * option labels caused by OCR.
 */
function buildQuestion(group,page){
  const stem=[];
  const options=new Map();

  let currentOpt=null;
  let answer="";

  for(const raw of group.lines||[]){
    const line=clean(raw);
    if(!line) continue;

    const a=parseAnswerLine(line);

    if(a){
      answer=a;
      continue;
    }

    const os=optStart(line);

    if(os){
      if(!options.has(os.letter)){
        const obj={
          letter:os.letter,
          text:os.text
        };

        options.set(os.letter,obj);
        currentOpt=obj;
      }else{
        currentOpt=options.get(os.letter);
        currentOpt.text=
          repairText(
            currentOpt.text+
            " "+
            os.text
          );
      }

      continue;
    }

    if(currentOpt){
      currentOpt.text=
        repairText(
          currentOpt.text+
          " "+
          line
        );
    }else{
      stem.push(line);
    }
  }

  const ordered=
    ["A","B","C","D"]
      .map(x=>options.get(x))
      .filter(Boolean);

  if(ordered.length!==4)
    return null;

  const question=
    repairText(stem.join(" "));

  if(question.length<5)
    return null;

  const unique=
    new Set(
      ordered.map(x=>norm(x.text))
    );

  if(unique.size!==4)
    return null;

  return {
    id:
      "PDF3-"+Date.now()+"-"+
      group.number+"-"+
      Math.random()
        .toString(36)
        .slice(2,9),

    number:group.number,

    question,
    text:question,

    options:
      ordered.map(x=>repairText(x.text)),

    correctAnswer:answer,

    correctIndex:
      answer?
      "ABCD".indexOf(answer):
      -1,

    explanation:"",
    solution:"",

    subject:"NEET",
    chapter:"",
    topic:"",
    difficulty:"Medium",

    marks:4,
    negativeMarks:1,

    source:"Institute Test PDF",
    sourcePage:page,

    needsReview:!answer,

    solutionSource:
      answer?
      "answer-key":
      "pending"
  };
}

/*
 * Main parser.
 * IMPORTANT:
 * If a new question number appears, finish the old one.
 * This prevents page breaks from merging questions.
 */
function parsePages(pages){
  const groups=[];
  let current=null;

  for(const pg of pages||[]){
    for(const raw of pg.lines||[]){
      const line=clean(raw);
      if(!line) continue;

      const q=qStart(line);

      if(q){
        if(current)
          groups.push(current);

        current={
          number:q.number,
          lines:[q.text],
          page:pg.page
        };

        continue;
      }

      if(current)
        current.lines.push(line);
    }
  }

  if(current)
    groups.push(current);

  return groups
    .map(g=>buildQuestion(g,g.page))
    .filter(Boolean);
}

function dedupe(qs){
  const seenText=new Set();
  const seenNumber=new Set();

  const out=[];

  for(const q of qs||[]){
    const textKey=norm(q.question);
    const numberKey=Number(q.number);

    /*
     * Text duplicate is always rejected.
     * Same question number is rejected only when
     * normalized text is also effectively duplicate.
     */
    if(
      textKey &&
      seenText.has(textKey)
    ) continue;

    if(textKey)
      seenText.add(textKey);

    if(
      numberKey &&
      seenNumber.has(numberKey) &&
      textKey
    ){
      continue;
    }

    if(numberKey)
      seenNumber.add(numberKey);

    out.push(q);
  }

  return out;
}

function mapAnswerKey(pages,questions){
  const answers=new Map();

  for(const pg of pages||[]){
    for(const raw of pg.lines||[]){
      const line=clean(raw);
      if(!line) continue;

      /*
       * ONLY recognize explicit answer-key syntax.
       * Never scan ordinary question text for "12 A".
       */
      let m=line.match(
        /^(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[\.\):\-]?\s*(?:answer|ans|correct\s*answer|option)?\s*[:=\-]\s*[\(\[]?\s*([A-D1-4])\s*[\)\]]?\s*$/i
      );

      if(m){
        const a=answerLetter(m[2]);
        if(a)
          answers.set(
            Number(m[1]),
            a
          );

        continue;
      }

      m=line.match(
        /^(?:Q(?:uestion)?\s*)?(\d{1,3})\s+(?:answer|ans)\s+[\(\[]?\s*([A-D1-4])\s*[\)\]]?$/i
      );

      if(m){
        const a=answerLetter(m[2]);
        if(a)
          answers.set(
            Number(m[1]),
            a
          );
      }
    }
  }

  return (questions||[]).map(q=>{
    const n=Number(q.number);

    if(
      !q.correctAnswer &&
      answers.has(n)
    ){
      q.correctAnswer=
        answers.get(n);

      q.correctIndex=
        "ABCD".indexOf(
          q.correctAnswer
        );

      q.needsReview=false;
      q.solutionSource="answer-key";
    }

    return q;
  });
}

function englishScore(text){
  const s=String(text||"");

  const latin=
    (s.match(/[A-Za-z]/g)||[])
      .length;

  const hindi=
    (s.match(/[\u0900-\u097F]/g)||[])
      .length;

  const total=latin+hindi;

  return total?
    latin/total:
    0;
}

function isEnglishQuestion(q){
  const question=
    String(
      q?.question||
      q?.text||
      ""
    );

  const options=
    Array.isArray(q?.options)?
    q.options:
    [];

  const combined=
    question+
    " "+
    options.join(" ");

  const latin=
    (combined.match(/[A-Za-z]/g)||[])
      .length;

  const hindi=
    (combined.match(/[\u0900-\u097F]/g)||[])
      .length;

  /*
   * If question is bilingual, retain only the
   * predominantly English reconstruction.
   */
  return latin>=5 &&
    (hindi===0 ||
     latin>=hindi*1.5) &&
    englishScore(combined)>=0.70;
}

function englishOnlyFilter(qs){
  const out=[];
  const seen=new Set();

  for(const q of qs||[]){
    if(!isEnglishQuestion(q))
      continue;

    const key=norm(q.question);

    if(!key || seen.has(key))
      continue;

    seen.add(key);

    out.push({
      ...q,

      question:
        repairText(q.question||q.text),

      text:
        repairText(q.text||q.question),

      options:
        (q.options||[])
          .map(repairText),

      language:"English"
    });
  }

  return out;
}

async function resolveAI(q){
  const apis=[
    window.CBTAnalyzerAI,
    window.CBTAnalyzerAIEngine,
    window.AISolutionEngine,
    window.RankerAI
  ].filter(Boolean);

  for(const api of apis){
    for(const fn of [
      "solveQuestion",
      "generateSolution",
      "getSolution",
      "solve"
    ]){
      if(
        typeof api[fn]!=="function"
      ) continue;

      try{
        const r=await api[fn](q);

        if(!r) continue;

        const a=answerLetter(
          r.correctAnswer??
          r.answer??
          r.option
        );

        if(a){
          q.correctAnswer=a;
          q.correctIndex=
            "ABCD".indexOf(a);
        }

        q.explanation=
          String(
            r.explanation??
            r.solution??
            r.reason??
            ""
          );

        q.solution=q.explanation;

        if(q.correctAnswer)
          q.solutionSource="ai";

        q.needsReview=
          !q.correctAnswer;

        return q;
      }catch(e){
        console.warn(
          "[PDF3] AI hook failed",
          e
        );
      }
    }
  }

  return q;
}

function normalizeFinal(qs,fileName){
  const stamp=Date.now();

  return (qs||[])
    .map((q,i)=>({
      ...q,

      id:
        "PDF3-"+stamp+"-"+i+"-"+
        Math.random()
          .toString(36)
          .slice(2,9),

      question:
        repairText(
          q.question||q.text
        ),

      text:
        repairText(
          q.text||q.question
        ),

      options:
        (q.options||[])
          .map(repairText),

      source:"Institute Test PDF",

      sourceFile:fileName,

      sourcePage:
        q.sourcePage||null,

      importedAt:
        new Date().toISOString(),

      sequence:i+1
    }))
    .filter(q=>
      q.question.length>=5 &&
      q.options.length===4 &&
      q.options.every(Boolean)
    );
}

function saveImport(qs,fileName){
  const importedAt=
    new Date().toISOString();

  const testId=
    "pdf-test-"+Date.now()+"-"+
    Math.random()
      .toString(36)
      .slice(2,9);

  const freshQuestions=
    (qs||[]).map((q,i)=>({
      ...q,

      sequence:i+1,

      importedTestId:testId,

      source:"Institute Test PDF",

      sourceFile:fileName,

      importedAt
    }));

  const meta={
    version:"pdf-cbt-universal-final",

    type:"institute-test",

    testId,

    fileName,

    importedAt,

    questionCount:
      freshQuestions.length,

    reviewCount:
      freshQuestions.filter(
        q=>q.needsReview
      ).length
  };

  if(!safeSet(
    KEY,
    freshQuestions
  )){
    throw new Error(
      "Could not save imported questions."
    );
  }

  safeSet(META,meta);

  safeSet(
    REVIEW,
    freshQuestions
      .filter(q=>q.needsReview)
      .map(q=>({
        id:q.id,
        number:q.number,
        sourcePage:q.sourcePage,
        reason:
          "Correct answer not confidently resolved."
      }))
  );

  /*
   * New PDF completely replaces transient
   * imported-test state.
   */
  sessionStorage.removeItem(ACTIVE);
  sessionStorage.removeItem(ACTIVE_TEST);
  sessionStorage.removeItem(ACTIVE_SOURCE);

  sessionStorage.removeItem(
    "CBT_ACTIVE_TEST_ID"
  );

  sessionStorage.removeItem(
    "CBT_ACTIVE_ANSWERS"
  );

  sessionStorage.removeItem(
    "CBT_ACTIVE_SELECTED"
  );

  sessionStorage.removeItem(
    "CBT_ACTIVE_CURRENT_INDEX"
  );

  const freshTest={
    id:testId,

    title:fileName,

    duration:180,

    questions:freshQuestions,

    questionIds:
      freshQuestions.map(
        q=>q.id
      ),

    totalQuestions:
      freshQuestions.length,

    source:"Institute Test PDF",

    sourceFile:fileName,

    importedAt,

    language:"English"
  };

  sessionStorage.setItem(
    ACTIVE,
    JSON.stringify(freshQuestions)
  );

  sessionStorage.setItem(
    ACTIVE_TEST,
    JSON.stringify(freshTest)
  );

  sessionStorage.setItem(
    ACTIVE_SOURCE,
    "PDF"
  );

  sessionStorage.setItem(
    "CBT_ACTIVE_TEST_ID",
    testId
  );

  return freshQuestions;
}

function esc(s){
  return String(s??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function preview(qs){
  const box=$("#questionPreview");

  if(!box) return;

  box.innerHTML=
    (qs||[])
      .slice(0,5)
      .map((q,i)=>
        "<div style='margin:10px 0;padding:12px;border:1px solid #e2e8f0;border-radius:10px'>"+
        "<strong>Q"+(i+1)+".</strong> "+
        esc(q.question)+
        "<br><small>"+
        q.options
          .map(
            (o,j)=>
              String.fromCharCode(65+j)+
              ") "+
              esc(o)
          )
          .join(" &nbsp; ")+
        "</small></div>"
      )
      .join("")+
    (
      qs.length>5?
      "<div>Showing first 5 of "+
      qs.length+
      " questions.</div>":
      ""
    );
}

async function convert(file){
  const name=
    ($("#moduleName")?.value||
     file.name)
      .trim()||
    file.name;

  status(
    "Reading PDF text layer…"
  );

  let textPages=[];

  try{
    textPages=
      await extractTextPages(file);
  }catch(e){
    console.warn(
      "[PDF3] text extraction failed",
      e
    );
  }

  let textQuestions=
    dedupe(
      parsePages(textPages)
    );

  /*
   * OCR is used when text-layer reconstruction
   * is clearly suspicious.
   */
  let qs=textQuestions;

  if(!qs.length || qs.length<20){
    try{
      const ocrPagesResult=
        await ocrPages(file);

      const ocrQuestions=
        dedupe(
          parsePages(
            ocrPagesResult
          )
        );

      if(
        ocrQuestions.length>
        qs.length
      ){
        qs=ocrQuestions;
      }

      textPages=
        textPages.concat(
          ocrPagesResult
        );
    }catch(e){
      console.error(
        "[PDF3] OCR failed",
        e
      );
    }
  }

  qs=mapAnswerKey(
    textPages,
    qs
  );

  qs=
    englishOnlyFilter(
      normalizeFinal(
        qs,
        name
      )
    );

  if(!qs.length){
    throw new Error(
      "No complete English 4-option questions could be reconstructed."
    );
  }

  /*
   * Ask existing AI engines only for unresolved answers.
   */
  for(let i=0;i<qs.length;i++){
    if(!qs[i].correctAnswer){
      status(
        "Resolving answers — "+
        (i+1)+
        " of "+
        qs.length+
        "…"
      );

      qs[i]=
        await resolveAI(qs[i]);
    }
  }

  qs=
    normalizeFinal(
      qs,
      name
    );

  qs=
    englishOnlyFilter(qs);

  /*
   * Re-number sequentially for CBT display,
   * while retaining original PDF number.
   */
  qs=qs.map((q,i)=>({
    ...q,
    sequence:i+1
  }));

  const result=
    saveImport(
      qs,
      name
    );

  preview(result);

  const review=
    result.filter(
      q=>q.needsReview
    ).length;

  status(
    "✅ Test PDF ready\n\n"+
    "File: "+name+"\n"+
    "Valid English questions: "+
    result.length+"\n"+
    "Needs answer review: "+
    review+
    "\n\nFresh CBT test prepared."
  );

  document.dispatchEvent(
    new CustomEvent(
      "pdfCbtPoolUpdated",
      {
        detail:{
          questions:result
        }
      }
    )
  );

  return result;
}

function install(){
  const input=$("#pdfInput");
  const button=$("#convertButton");

  if(
    !input||
    !button||
    button.dataset.pdfUniversalFinal
  ) return;

  button.dataset.pdfUniversalFinal="1";

  button.addEventListener(
    "click",
    async function(ev){
      ev.preventDefault();
      ev.stopImmediatePropagation();

      const file=
        input.files&&
        input.files[0];

      if(!file){
        status(
          "Select a PDF first."
        );
        return;
      }

      button.disabled=true;

      try{
        await convert(file);
      }catch(e){
        console.error(
          "[PDF3]",
          e
        );

        status(
          "❌ Conversion failed\n\n"+
          (
            e.message||
            "Unknown error"
          )
        );
      }finally{
        button.disabled=false;
      }
    },
    true
  );

  const row=
    button.parentElement;

  if(
    row&&
    !$("#pdfUniversalOpenCBT")
  ){
    const open=
      document.createElement(
        "button"
      );

    open.id=
      "pdfUniversalOpenCBT";

    open.type="button";

    open.className="primary";

    open.textContent=
      "🚀 Open Imported Test in CBT";

    open.addEventListener(
      "click",
      function(){
        const q=
          safeGet(
            KEY,
            []
          );

        if(
          !Array.isArray(q)||
          !q.length
        ){
          status(
            "Convert a test PDF first."
          );
          return;
        }

        const fileName=
          (
            $("#moduleName")?.value||
            "Imported NEET Test"
          ).trim();

        const testId=
          "pdf-test-"+Date.now()+"-"+
          Math.random()
            .toString(36)
            .slice(2,9);

        const fresh=
          q.map((x,i)=>({
            ...x,
            sequence:i+1,
            importedTestId:testId
          }));

        sessionStorage.removeItem(ACTIVE);
        sessionStorage.removeItem(ACTIVE_TEST);
        sessionStorage.removeItem(ACTIVE_SOURCE);

        sessionStorage.setItem(
          ACTIVE,
          JSON.stringify(fresh)
        );

        sessionStorage.setItem(
          ACTIVE_TEST,
          JSON.stringify({
            id:testId,
            title:fileName,
            duration:180,
            questions:fresh,
            questionIds:
              fresh.map(x=>x.id),
            totalQuestions:fresh.length,
            source:"Institute Test PDF",
            sourceFile:fileName,
            importedAt:
              new Date().toISOString(),
            language:"English"
          })
        );

        sessionStorage.setItem(
          ACTIVE_SOURCE,
          "PDF"
        );

        sessionStorage.setItem(
          "CBT_ACTIVE_TEST_ID",
          testId
        );

        location.href="./cbt.html";
      }
    );

    row.appendChild(open);
  }

  preview(
    safeGet(KEY,[])
  );
}

if(
  document.readyState===
  "loading"
){
  document.addEventListener(
    "DOMContentLoaded",
    install
  );
}else{
  install();
}

window.PDFCBTUniversalFinal={
  convert,
  extractTextPages,
  ocrPages,
  parsePages,
  resolveAI,
  englishOnlyFilter
};

})();
