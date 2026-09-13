(() => {
  'use strict';

  const POOL_KEY = 'pdfCbtQuestions';
  const ACTIVE_KEY = 'CBT_ACTIVE_TEST';
  const ACTIVE_ID_KEY = 'CBT_ACTIVE_TEST_ID';
  const SOURCE_KEY = 'CBT_ACTIVE_SOURCE';
  const DB_NAME = 'CBT_PDF_SOURCE_V1';
  const DB_STORE = 'files';

  const $ = id => document.getElementById(id);
  const input = $('pdfInput');
  const convert = $('convertButton');
  const moduleInput = $('moduleName');
  const status = $('status');

  if (!input || !convert) {
    console.log('PDF final engine: not a PDF import page; skipping importer hooks.');
    return;
  }

  function msg(s) {
    if (status) status.textContent = s;
    console.log('[PDF FINAL]', s);
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function norm(s) {
    return String(s ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function englishScore(s) {
    const x = String(s || '');
    const letters = (x.match(/[A-Za-z]/g) || []).length;
    const bad = (x.match(/[\u0900-\u097F]|[\u0600-\u06FF]/g) || []).length;
    const legacy = (x.match(/dFku|dkj\.k|pkyd|lEiw|nksuksa|lgh|O;k\[;k|foyfxr|LFkkukUrfjr/gi) || []).length;
    return letters - bad * 3 - legacy * 8;
  }

  function garbage(s) {
    const x = norm(s);
    if (!x) return true;
    const letters = (x.match(/[A-Za-z]/g) || []).length;
    const digits = (x.match(/[0-9]/g) || []).length;
    const legacy = /dFku|dkj\.k|pkyd|lEiw\.kZ|nksuksa|lgh|O;k\[;k|foyfxr|LFkkukUrfjr/i.test(x);
    if (legacy && letters < 35) return true;
    if (letters < 3 && digits < 2) return true;
    return false;
  }

  function isInstruction(s) {
    const x = norm(s).toLowerCase();
    return /^(general )?instructions?\b|^marking scheme\b|^important instructions?\b|^read the following instructions\b|^for each question\b|^choose (the|one)\b/.test(x) ||
      /maximum marks|time allowed|negative marking|do not use|all questions are compulsory|rough work/i.test(x);
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(DB_STORE)) r.result.createObjectStore(DB_STORE);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async function saveSource(file, sessionId) {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(file, sessionId);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (e) {
      console.warn('PDF source storage unavailable:', e);
    }
  }

  async function getSource(sessionId) {
    try {
      const db = await openDB();
      const value = await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const r = tx.objectStore(DB_STORE).get(sessionId);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      db.close();
      return value;
    } catch (_) { return null; }
  }

  function newSession(file) {
    const id = 'pdf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
    sessionStorage.clear();
    sessionStorage.setItem('CBT_ACTIVE_SOURCE', 'PDF');
    localStorage.setItem('CBT_PDF_SESSION_ID', id);
    localStorage.setItem('CBT_PDF_SESSION_META', JSON.stringify({
      id, name: file.name, size: file.size, lastModified: file.lastModified
    }));
    localStorage.removeItem(POOL_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(ACTIVE_ID_KEY);
    saveSource(file, id);
    return id;
  }

  function currentSession() {
    return localStorage.getItem('CBT_PDF_SESSION_ID') || '';
  }

  function rowsFromItems(items) {
    const rows = [];
    for (const item of items || []) {
      const text = norm(item.str);
      if (!text) continue;
      const tr = item.transform || [];
      const x = Number(tr[4] || 0);
      const y = Number(tr[5] || 0);
      let row = rows.find(r => Math.abs(r.y - y) <= 3.5);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, y, text, w: Number(item.width || 0), h: Number(item.height || 0) });
    }
    rows.sort((a,b) => b.y - a.y);
    return rows.map(r => {
      r.items.sort((a,b) => a.x - b.x);
      return {
        y: r.y,
        x1: r.items[0]?.x || 0,
        x2: Math.max(...r.items.map(i => i.x + i.w), r.items[0]?.x || 0),
        text: norm(r.items.map(i => i.text).join(' '))
      };
    }).filter(r => r.text);
  }

  function chooseEnglishRows(rows, width) {
    if (!rows.length) return [];
    const left = rows.filter(r => r.x1 < width * 0.54);
    const right = rows.filter(r => r.x1 >= width * 0.46);
    const leftScore = left.reduce((n,r) => n + englishScore(r.text), 0);
    const rightScore = right.reduce((n,r) => n + englishScore(r.text), 0);
    const twoColumn = left.length > 8 && right.length > 8 && Math.abs(leftScore - rightScore) > Math.max(100, rows.length * 3);
    if (twoColumn) return left;
    return rows.filter(r => englishScore(r.text) >= 0 || r.x1 < width * 0.7);
  }

  function qStart(text) {
    return norm(text).match(/^\s*(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[.)\-:]\s+(.+)$/i);
  }

  function optStart(text) {
    return norm(text).match(/^\s*(?:\(([1-4])\)|([A-D]))\s*[.)\-:]?\s+(.+)$/i);
  }

  function inlineOptions(text) {
    const s = norm(text);
    const re = /(?:^|\s)(?:\(([1-4])\)|([A-D]))\s*[.)\-:]\s+/gi;
    const m = [...s.matchAll(re)];
    if (m.length < 2) return null;
    const first = m[0].index;
    const q = norm(s.slice(0, first));
    const opts = [];
    for (let i=0; i<m.length && opts.length<4; i++) {
      const st = m[i].index + m[i][0].length;
      const en = i+1<m.length ? m[i+1].index : s.length;
      opts.push(norm(s.slice(st,en)));
    }
    return q.length >= 5 && opts.length >= 2 ? {q, opts} : null;
  }

  function parseQuestionPages(pageData) {
    const out = [];
    let cur = null;
    const flush = () => {
      if (!cur) return;
      cur.text = norm(cur.text);
      cur.options = cur.options.map(norm).filter(Boolean).slice(0,4);
      if (cur.text.length >= 8 && cur.options.length >= 2 && !garbage(cur.text) && !isInstruction(cur.text)) out.push(cur);
      cur = null;
    };

    for (const page of pageData) {
      for (const row of page.rows) {
        const t = norm(row.text);
        if (!t || garbage(t) || isInstruction(t)) continue;
        const qm = qStart(t);
        if (qm) {
          flush();
          const io = inlineOptions(qm[2]);
          cur = {
            number: Number(qm[1]), text: io ? io.q : qm[2], options: io ? io.opts : [],
            page: page.page, bbox: { x: row.x1, y: Math.max(0,row.y-18), w: Math.max(100,row.x2-row.x1), h: 36 }
          };
          continue;
        }
        const om = optStart(t);
        if (om && cur) {
          cur.options.push(om[3]);
          cur.bbox.w = Math.max(cur.bbox.w, row.x2 - cur.bbox.x);
          cur.bbox.h += 18;
          continue;
        }
        if (cur) {
          if (cur.options.length) cur.options[cur.options.length-1] = norm(cur.options[cur.options.length-1] + ' ' + t);
          else cur.text = norm(cur.text + ' ' + t);
          cur.bbox.w = Math.max(cur.bbox.w, row.x2 - cur.bbox.x);
          cur.bbox.h += 18;
        }
      }
    }
    flush();
    return out;
  }

  async function parsePDF(file) {
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data}).promise;
    const pages = [];
    let solutionStart = false;
    const solutionMap = new Map();

    for (let p=1; p<=pdf.numPages; p++) {
      msg(`📖 Reading page ${p} of ${pdf.numPages}...`);
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({scale:1});
      const content = await page.getTextContent();
      const rowsAll = rowsFromItems(content.items);
      const rows = chooseEnglishRows(rowsAll, viewport.width);
      const joined = rows.map(r=>r.text).join(' ');
      if (/HINTS\s*&\s*SOLUTIONS|SOLUTIONS/i.test(joined)) solutionStart = true;
      if (solutionStart) {
        for (const r of rows) {
          const m = r.text.match(/^\s*(\d{1,3})\s*[.)]?\s*\(?([1-4A-D])\)?\s*$/i);
          if (m) solutionMap.set(Number(m[1]), { answer: m[2].toUpperCase(), page:p });
        }
      }
      pages.push({page:p, width:viewport.width, height:viewport.height, rows});
    }

    const qs = parseQuestionPages(pages);
    const unique = [];
    const seen = new Set();
    for (const q of qs) {
      const key = norm(q.text).toLowerCase().replace(/[^a-z0-9]+/g,' ');
      if (seen.has(key)) continue;
      seen.add(key);
      const sol = solutionMap.get(q.number);
      unique.push({
        id: `PDF-${Date.now()}-${q.number}-${unique.length}`,
        text: q.text,
        question: q.text,
        questionText: q.text,
        options: q.options,
        correctAnswer: sol ? (Number.isNaN(Number(sol.answer)) ? sol.answer : '') : '',
        correctIndex: sol && /[1-4]/.test(sol.answer) ? Number(sol.answer)-1 : -1,
        explanation: '', solution: '',
        subject: 'Unknown', difficulty:'Medium', marks:4, negativeMarks:1,
        source:'PDF Import', sourceType:'pdf',
        pdfPage:q.page, pdfBBox:q.bbox, pdfSessionId:currentSession()
      });
    }

    return unique.filter(q => q.options.length >= 2 && !garbage(q.text));
  }

  function makeTest(questions, file) {
    const id = currentSession() || newSession(file);
    const test = {
      id, testId:id,
      title: moduleInput?.value.trim() || file.name.replace(/\.pdf$/i,''),
      source:'PDF Import', sourceType:'pdf', fileName:file.name,
      questionCount:questions.length, questions,
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
      engine:'PDF-CBT-FINAL'
    };
    localStorage.setItem(POOL_KEY, JSON.stringify(questions));
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(test));
    localStorage.setItem(ACTIVE_ID_KEY, id);
    sessionStorage.setItem(SOURCE_KEY,'PDF');
    sessionStorage.setItem('CBT_ACTIVE_QUESTIONS', JSON.stringify(questions));
    sessionStorage.setItem('CBT_ACTIVE_TEST', JSON.stringify(test));
    return test;
  }

  function addLanguageUI() {
    if ($('pdfLanguageMode')) return;
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `<label for="pdfLanguageMode">Question language</label><select id="pdfLanguageMode" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:10px"><option value="en" selected>English Only</option><option value="hi">Hindi Only</option><option value="both">English + Hindi</option></select>`;
    const anchor = moduleInput?.closest('.field');
    if (anchor) anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    else convert.parentNode.insertBefore(wrap, convert);
  }

  addLanguageUI();

  /* Capture click before all legacy PDF handlers. */
  convert.addEventListener('click', async e => {
    e.preventDefault(); e.stopImmediatePropagation();
    const file = input.files?.[0];
    if (!file) { alert('Please select a PDF first.'); return; }
    if (!/\.pdf$/i.test(file.name) && !/pdf/i.test(file.type)) { alert('Please select a valid PDF.'); return; }
    convert.disabled = true;
    try {
      newSession(file);
      await saveSource(file, currentSession());
      msg('🔒 New PDF session created. Old PDF questions cleared.');
      const questions = await parsePDF(file);
      if (!questions.length) throw new Error('No clean MCQ questions detected. The PDF was not converted into usable questions.');
      const test = makeTest(questions,file);
      msg(`✅ CLEAN PDF READY\n\n${file.name}\n\nActual questions detected: ${questions.length}\nEnglish Only: ON\nHindi column: excluded\nInstructions: excluded\nOld PDF pool: cleared\nCBT: ready`);
      const preview = $('questionPreview');
      if (preview) preview.innerHTML = questions.slice(0,5).map((q,i)=>`<div style="margin:10px 0;padding:14px;border:1px solid #e2e8f0;border-radius:12px"><b>Q${i+1}.</b> ${esc(q.text)}<div style="margin-top:8px">${q.options.map((o,j)=>`<div><b>${String.fromCharCode(65+j)}.</b> ${esc(o)}</div>`).join('')}</div></div>`).join('');
      window.PDF_CBT_FINAL_TEST = test;
    } catch (err) {
      console.error(err);
      msg('❌ Conversion failed\n\n' + err.message);
      alert(err.message);
    } finally { convert.disabled = false; }
  }, true);

  /* Force the existing Open PDF Questions button to use current session. */
  document.addEventListener('click', e => {
    const el = e.target.closest('button');
    if (!el || !/Open PDF Questions in CBT/i.test(el.textContent || '')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const qs = JSON.parse(localStorage.getItem(POOL_KEY) || '[]');
    if (!qs.length) { alert('Convert a PDF first.'); return; }
    sessionStorage.setItem(SOURCE_KEY,'PDF');
    sessionStorage.setItem('CBT_ACTIVE_QUESTIONS', JSON.stringify(qs));
    sessionStorage.setItem('CBT_ACTIVE_TEST', localStorage.getItem(ACTIVE_KEY) || '');
    location.href='./cbt.html';
  }, true);

  /* Optional PDF visual fallback in CBT. */
  if (/\/cbt\.html$/i.test(location.pathname)) {
    const original = window.renderQuestion;
    if (typeof original === 'function') {
      window.renderQuestion = function() {
        original();
        const qs = window.selectedQuestions || [];
        const q = qs[window.currentIndex || 0];
        const old = document.getElementById('pdfVisualFallback');
        if (old) old.remove();
        if (!q?.pdfPage || !q?.pdfSessionId || !q?.pdfBBox) return;
        const host = document.getElementById('questionText');
        if (!host) return;
        const box = document.createElement('div');
        box.id='pdfVisualFallback'; box.style.cssText='margin:12px 0;display:none;';
        host.parentNode.insertBefore(box, host.nextSibling);
        getSource(q.pdfSessionId).then(async file => {
          if (!file || !window.pdfjsLib) return;
          try {
            const pdf = await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
            const page = await pdf.getPage(q.pdfPage);
            const vp = page.getViewport({scale:1.35});
            const canvas = document.createElement('canvas');
            canvas.width=Math.ceil(vp.width); canvas.height=Math.ceil(vp.height);
            await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
            canvas.style.cssText='max-width:100%;height:auto;border-radius:10px;border:1px solid #e2e8f0;';
            box.appendChild(canvas); box.style.display='block';
          } catch (_) {}
        });
      };
    }
  }

  window.PDF_CBT_FINAL_READY = true;
  console.log('✅ PDF-CBT FINAL ENGINE ACTIVE');
})();
