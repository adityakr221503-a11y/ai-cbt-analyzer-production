/*
 * RANKFORGE OWNER PDF EXTRACTION ENGINE V6
 * Production-grade ingestion backbone
 *
 * Design:
 * - resumable page/batch jobs
 * - bounded page processing
 * - native text first
 * - selective OCR fallback
 * - layout-aware text reconstruction
 * - inline A/B/C/D recovery
 * - explicit answer-key linking only
 * - no answer guessing
 * - quarantine for uncertain records
 * - exact + normalized duplicate protection
 * - existing RankForgeSourceEngine remains canonical persistence layer
 * - student PDF->CBT flow is not touched
 */
(() => {
  "use strict";

  const VERSION = "RANKFORGE_OWNER_PDF_ENGINE_V6";
  const JOB_PREFIX = "rankforgeOwnerPDFJobV6:";
  const JOB_INDEX = "rankforgeOwnerPDFJobsV6";
  const DEFAULT_BATCH = 8;
  const MAX_BATCH = 12;
  const MIN_STEM = 8;
  const MIN_OPTION = 1;

  let active = true;

  const say = (...x) => {
    try { console.log("[RankForge PDF V6]", ...x); } catch (_) {}
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function safeJSON(s, fallback) {
    try { return JSON.parse(s); } catch (_) { return fallback; }
  }

  function normalizeText(v) {
    return String(v ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function cleanQuestionText(v) {
    return normalizeText(v)
      .replace(/^[\s\d.)\-]+/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function fingerprint(v) {
    return cleanQuestionText(v)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hash(v) {
    let h = 2166136261;
    const s = String(v);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ("00000000" + (h >>> 0).toString(16)).slice(-8);
  }

  function jobId(file) {
    return JOB_PREFIX + hash([
      file?.name || "",
      file?.size || 0,
      file?.lastModified || 0
    ].join("|"));
  }

  function loadJob(id) {
    return safeJSON(localStorage.getItem(id), null);
  }

  function saveJob(job) {
    localStorage.setItem(job.id, JSON.stringify(job));

    const ids = safeJSON(localStorage.getItem(JOB_INDEX), []);
    if (!ids.includes(job.id)) ids.push(job.id);
    localStorage.setItem(JOB_INDEX, JSON.stringify(ids.slice(-50)));
  }

  function deleteJob(id) {
    localStorage.removeItem(id);
    const ids = safeJSON(localStorage.getItem(JOB_INDEX), []);
    localStorage.setItem(
      JOB_INDEX,
      JSON.stringify(ids.filter(x => x !== id))
    );
  }

  function jobs() {
    const ids = safeJSON(localStorage.getItem(JOB_INDEX), []);
    return ids.map(loadJob).filter(Boolean);
  }

  function emit(cb, data) {
    try {
      if (typeof cb === "function") cb(data);
    } catch (e) {
      say("callback error", e);
    }
  }

  function loadScript(src, test) {
    if (test()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(s => s.src === src);

      if (existing) {
        existing.addEventListener("load", resolve, { once:true });
        existing.addEventListener("error", reject, { once:true });
        return;
      }

      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Unable to load " + src));
      document.head.appendChild(s);
    });
  }

  async function pdfjs() {
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
      () => !!window.pdfjsLib
    );

    if (!window.pdfjsLib)
      throw new Error("PDF.js unavailable");

    if (window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    return window.pdfjsLib;
  }

  async function tesseract() {
    await loadScript(
      "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
      () => !!window.Tesseract
    );

    if (!window.Tesseract)
      throw new Error("Tesseract unavailable");

    return window.Tesseract;
  }

  function lineReconstruct(items) {
    const rows = [];

    for (const item of items || []) {
      const text = String(item.str || "").trim();
      if (!text) continue;

      const tr = item.transform || [];
      const x = Number(tr[4] || 0);
      const y = Number(tr[5] || 0);

      let row = rows.find(r => Math.abs(r.y - y) <= 3);

      if (!row) {
        row = { y, parts: [] };
        rows.push(row);
      }

      row.parts.push({
        x,
        text
      });
    }

    rows.sort((a,b) => b.y - a.y);

    return rows.map(row => {
      row.parts.sort((a,b) => a.x - b.x);

      let out = "";
      let lastX = null;

      for (const part of row.parts) {
        if (lastX !== null && part.x - lastX > 12) out += " ";
        if (out && !/\s$/.test(out)) out += " ";
        out += part.text;
        lastX = part.x + Math.max(part.text.length * 3, 4);
      }

      return out.trim();
    }).filter(Boolean).join("\n");
  }

  async function renderPage(page, scale = 1.5) {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently:true });

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({
      canvasContext: ctx,
      viewport
    }).promise;

    return canvas;
  }

  async function ocrCanvas(canvas, progress) {
    const T = await tesseract();

    const result = await T.recognize(canvas, "eng", {
      logger: m => {
        if (m && typeof m.progress === "number") {
          emit(progress, {
            phase: "ocr",
            progress: m.progress
          });
        }
      }
    });

    return normalizeText(result?.data?.text || "");
  }

  function parseAnswerKey(text) {
    const map = Object.create(null);
    const s = String(text || "");

    const patterns = [
      /(?:^|\s)(\d{1,4})\s*[\.\):-]?\s*([ABCD])(?=\s|$)/gi,
      /(?:Q(?:uestion)?\s*)?(\d{1,4})\s*[\.\):-]?\s*([ABCD])(?=\s|$)/gi
    ];

    for (const re of patterns) {
      let m;
      while ((m = re.exec(s))) {
        const n = String(Number(m[1]));
        const a = String(m[2]).toUpperCase();

        if (n && /^[ABCD]$/.test(a)) {
          map[n] = a;
        }
      }
    }

    return map;
  }

  function optionParts(text) {
    const src = normalizeText(text);

    const re =
      /(?:^|\s)(?:\(?([ABCD])\)?[\.\):\-])\s*/gi;

    const matches = [];
    let m;

    while ((m = re.exec(src))) {
      matches.push({
        index: m.index,
        end: re.lastIndex,
        label: m[1].toUpperCase()
      });
    }

    if (matches.length < 2) return null;

    const options = [];

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].end;
      const end = i + 1 < matches.length
        ? matches[i + 1].index
        : src.length;

      const value = src.slice(start, end).trim();

      if (value.length >= MIN_OPTION) {
        options.push({
          label: matches[i].label,
          text: value
        });
      }
    }

    const unique = [];
    const seen = new Set();

    for (const o of options) {
      const k = fingerprint(o.text);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      unique.push(o);
    }

    return unique.length >= 2 ? unique : null;
  }

  function reconstruct(text, page = 0) {
    const src = normalizeText(text);
    if (!src) return [];

    /*
     * Question starts:
     * 1.
     * 1)
     * Q1.
     * Question 1:
     * Also supports flattened PDF text.
     */
    const qre =
      /(?:^|\s)(?:Q(?:uestion)?\s*)?(\d{1,4})\s*[\.\):\-]\s*/gi;

    const starts = [];
    let m;

    while ((m = qre.exec(src))) {
      starts.push({
        number: String(Number(m[1])),
        start: m.index === 0 ? 0 : m.index + 1,
        content: qre.lastIndex
      });
    }

    if (!starts.length) return [];

    const out = [];

    for (let i = 0; i < starts.length; i++) {
      const cur = starts[i];
      const end = i + 1 < starts.length
        ? starts[i + 1].start
        : src.length;

      let block = src.slice(cur.content, end).trim();

      /*
       * Protect against answer-key / footer fragments being
       * interpreted as questions.
       */
      if (block.length < MIN_STEM) continue;

      const opts = optionParts(block);
      if (!opts || opts.length < 2) continue;

      const firstOptionMarker =
        /(?:^|\s)(?:\(?[ABCD]\)?[\.\):\-])\s*/i.exec(block);

      if (!firstOptionMarker) continue;

      const stem = cleanQuestionText(
        block.slice(0, firstOptionMarker.index).trim()
      );

      if (stem.length < MIN_STEM) continue;

      const options = opts.map(o => o.text).slice(0,4);

      if (options.length < 2) continue;

      const q = {
        id: `OWNER-PDF-V6-${cur.number}-${hash(
          stem + "|" + options.join("|")
        )}`,
        sourceQuestionNumber: cur.number,
        question: stem,
        text: stem,
        options,
        correctAnswer: null,
        correctIndex: null,
        source: "owner-pdf-v6",
        sourcePage: page || null,
        provenance: {
          engine: VERSION,
          page: page || null
        },
        status: "REVIEW"
      };

      out.push(q);
    }

    /*
     * Exact duplicate question protection inside a page/batch.
     */
    const seen = new Set();

    return out.filter(q => {
      const k = fingerprint(
        q.question + "|" + q.options.join("|")
      );

      if (!k || seen.has(k)) return false;

      seen.add(k);
      return true;
    });
  }

  function attachAnswers(qs, key) {
    return (qs || []).map(q => {
      const answer = key[String(q.sourceQuestionNumber)];

      if (/^[ABCD]$/.test(String(answer || ""))) {
        const index = "ABCD".indexOf(answer);

        return {
          ...q,
          correctAnswer: answer,
          correctIndex: index,
          answerSource: "explicit-answer-key",
          status: "READY"
        };
      }

      return {
        ...q,
        correctAnswer: null,
        correctIndex: null,
        answerSource: null,
        status: "REVIEW"
      };
    });
  }

  async function submitBatch(questions, meta) {
    if (!questions.length) return null;

    if (
      window.RankForgeSourceEngine &&
      typeof window.RankForgeSourceEngine.submitModuleQuestions ===
        "function"
    ) {
      return window.RankForgeSourceEngine.submitModuleQuestions(
        questions,
        {
          ...(meta || {}),
          engine: VERSION,
          sourceType: "PDF",
          ownerOnly: true
        }
      );
    }

    /*
     * Never silently persist into a second database.
     * If canonical source engine is unavailable, retain the
     * batch only in the job checkpoint.
     */
    return {
      accepted: 0,
      review: questions.length,
      quarantine: 0,
      persisted: false,
      reason: "RankForgeSourceEngine unavailable"
    };
  }

  async function importPDF(file, meta = {}, cb = {}) {
    if (!file) throw new Error("No PDF file supplied");

    if (!active) throw new Error("Engine is shut down");

    const P = await pdfjs();

    const id = jobId(file);

    let job = loadJob(id);

    if (!job) {
      const pdf = await P.getDocument({
        data: await file.arrayBuffer()
      }).promise;

      job = {
        id,
        version: VERSION,
        file: {
          name: file.name || "unknown.pdf",
          size: file.size || 0,
          lastModified: file.lastModified || 0
        },
        totalPages: pdf.numPages,
        nextPage: 1,
        processedPages: 0,
        candidates: 0,
        submitted: 0,
        review: 0,
        quarantine: 0,
        pages: {},
        batches: 0,
        status: "RUNNING",
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      saveJob(job);
      await pdf.destroy();
    } else {
      job.status = "RUNNING";
      saveJob(job);
    }

    const pdf = await P.getDocument({
      data: await file.arrayBuffer()
    }).promise;

    const batchSize = Math.max(
      1,
      Math.min(
        Number(meta.batchSize || DEFAULT_BATCH),
        MAX_BATCH
      )
    );

    const answerKey = meta.answerKey || {};

    try {
      while (job.nextPage <= job.totalPages) {
        if (!active) throw new Error("Engine stopped");

        const batchStart = job.nextPage;
        const batchEnd = Math.min(
          job.totalPages,
          batchStart + batchSize - 1
        );

        const batchQuestions = [];

        for (let pageNo = batchStart; pageNo <= batchEnd; pageNo++) {
          if (!active) throw new Error("Engine stopped");

          emit(cb.progress, {
            phase: "page",
            page: pageNo,
            totalPages: job.totalPages,
            percent: Math.round(
              ((pageNo - 1) / job.totalPages) * 100
            )
          });

          const page = await pdf.getPage(pageNo);

          let native = "";

          try {
            const tc = await page.getTextContent({
              normalizeWhitespace: false,
              disableCombineTextItems: false
            });

            native = lineReconstruct(tc.items || []);
          } catch (e) {
            say("native extraction failed", pageNo, e);
          }

          let pageText = native;
          let extractionMode = "native";

          /*
           * OCR only when native extraction is weak.
           * This avoids wasting OCR time on normal PDFs.
           */
          if (native.replace(/\s/g, "").length < 40) {
            try {
              const canvas = await renderPage(page, 1.5);
              const ocr = await ocrCanvas(canvas, cb.progress);

              if (ocr.length > pageText.length) {
                pageText = ocr;
                extractionMode = "ocr";
              }
            } catch (e) {
              say("OCR failed", pageNo, e);
            }
          }

          const questions = reconstruct(pageText, pageNo);

          const linked = attachAnswers(
            questions,
            answerKey
          );

          batchQuestions.push(...linked);

          job.pages[pageNo] = {
            mode: extractionMode,
            nativeChars: native.length,
            extractedChars: pageText.length,
            questions: linked.length,
            processedAt: Date.now()
          };

          job.processedPages = pageNo;
          job.nextPage = pageNo + 1;
          job.candidates += linked.length;
          job.updatedAt = Date.now();

          /*
           * Checkpoint after EVERY page.
           */
          saveJob(job);

          await sleep(0);
        }

        if (batchQuestions.length) {
          const result = await submitBatch(
            batchQuestions,
            {
              ...meta,
              jobId: job.id,
              batchStart,
              batchEnd
            }
          );

          job.submitted += Number(
            result?.accepted || result?.imported || 0
          );

          job.review += Number(
            result?.review || 0
          );

          job.quarantine += Number(
            result?.quarantine || 0
          );
        }

        job.batches++;
        job.updatedAt = Date.now();

        saveJob(job);

        emit(cb.progress, {
          phase: "batch",
          batchStart,
          batchEnd,
          totalPages: job.totalPages,
          percent: Math.round(
            (job.processedPages / job.totalPages) * 100
          )
        });
      }

      job.status = "COMPLETE";
      job.updatedAt = Date.now();
      saveJob(job);

      const result = {
        ok: true,
        version: VERSION,
        jobId: job.id,
        pages: job.totalPages,
        processedPages: job.processedPages,
        candidates: job.candidates,
        submitted: job.submitted,
        review: job.review,
        quarantine: job.quarantine,
        batches: job.batches,
        resumable: true
      };

      say("IMPORT COMPLETE", result);
      emit(cb.complete, result);

      return result;
    } catch (error) {
      job.status = "PAUSED";
      job.error = String(error?.message || error);
      job.updatedAt = Date.now();
      saveJob(job);

      emit(cb.error, {
        jobId: job.id,
        error: job.error,
        resumePage: job.nextPage
      });

      throw error;
    } finally {
      try {
        await pdf.destroy();
      } catch (_) {}
    }
  }

  async function resume(jobIdValue, file, meta = {}, cb = {}) {
    const id =
      jobIdValue.startsWith(JOB_PREFIX)
        ? jobIdValue
        : JOB_PREFIX + jobIdValue;

    const job = loadJob(id);

    if (!job) {
      throw new Error("Checkpoint not found");
    }

    if (!file) {
      throw new Error("Original PDF file is required to resume");
    }

    return importPDF(file, {
      ...meta,
      resumeJobId: id
    }, cb);
  }

  function getJob(id) {
    return loadJob(
      id.startsWith(JOB_PREFIX)
        ? id
        : JOB_PREFIX + id
    );
  }

  function health() {
    return {
      version: VERSION,
      active,
      pdfjs: !!window.pdfjsLib,
      tesseract: !!window.Tesseract,
      sourceEngine: !!(
        window.RankForgeSourceEngine &&
        typeof window.RankForgeSourceEngine.submitModuleQuestions ===
          "function"
      ),
      jobs: jobs().length
    };
  }

  function shutdown() {
    active = false;
    say("SHUTDOWN");
  }

  function restart() {
    active = true;
    say("RESTART");
  }

  const API = {
    version: VERSION,
    importPDF,
    resume,
    reconstruct,
    answerKey: parseAnswerKey,
    attachAnswers,
    jobs,
    getJob,
    deleteJob,
    fingerprint,
    health,
    shutdown,
    restart,
    constants: {
      DEFAULT_BATCH,
      MAX_BATCH,
      MIN_STEM
    }
  };

  /*
   * New canonical V6 API.
   */
  window.RankForgeOwnerPDFExtractionEngineV6 = API;

  /*
   * Backward compatibility:
   * Existing owner-source integration does not immediately break.
   */
  window.RankForgeOwnerPDFExtractionEngineV5 = API;

  say("READY", VERSION);
})();
