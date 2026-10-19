/*
 RANKFORGE FIX-PACK v1
 One small shared layer that fixes the cross-module wiring bugs:
   1. CBT hand-off  -> every module (PDF, AI, Adaptive DPP, Ranker, Notebook)
                       opens ITS OWN questions in cbt.html (no 90-Q Biology hijack)
   2. Rich text     -> questions render as formatted lists / tables / sub-sup
   3. One AI endpoint + RankForgeAI.generateQuestions() provider
   4. Topic inference so DPP/mistakes never show "Unknown"
   5. Debug panels ("PCB NICHOD LIVE") hidden unless ?debug=1
 Works in the browser (window.RankForgeFix) and in node (module.exports) for tests.
*/
(function (root) {
  "use strict";

  var VERSION = "FIXPACK-1.0";
  var isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

  /* ------------------------------------------------------------------ */
  /* storage helpers                                                     */
  /* ------------------------------------------------------------------ */
  function store(kind) {
    try { return isBrowser ? window[kind] : null; } catch (_) { return null; }
  }
  function getRaw(kind, key) {
    try { var s = store(kind); return s ? s.getItem(key) : null; } catch (_) { return null; }
  }
  function setRaw(kind, key, val) {
    try { var s = store(kind); if (s) s.setItem(key, val); return true; } catch (_) { return false; }
  }
  function getJSON(kind, key) {
    var raw = getRaw(kind, key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  /* ------------------------------------------------------------------ */
  /* question normalisation (accepts every shape the engines produce)    */
  /* ------------------------------------------------------------------ */
  function toText(v) { return v == null ? "" : String(v); }

  function normalizeAny(q, index) {
    if (!q || typeof q !== "object") return null;
    var text = toText(q.question != null ? q.question :
      q.text != null ? q.text :
      q.questionText != null ? q.questionText :
      q.prompt != null ? q.prompt :
      q.stem != null ? q.stem : "").trim();

    var opts = q.options != null ? q.options : q.choices != null ? q.choices : q.answers;
    if (opts && !Array.isArray(opts) && typeof opts === "object") opts = Object.keys(opts).map(function (k) { return opts[k]; });
    if (!Array.isArray(opts)) opts = [];
    opts = opts.map(function (x) {
      if (x && typeof x === "object") return toText(x.text != null ? x.text : x.value != null ? x.value : x.label != null ? x.label : x.option);
      return toText(x);
    }).map(function (s) { return s.trim(); }).filter(Boolean);

    if (!text || opts.length < 2) return null;

    var ci = -1;
    /* 0-based fields */
    var zero = [q.correctIndex, q.answerIndex, q.correct_index];
    for (var z = 0; z < zero.length && ci < 0; z++) {
      if (typeof zero[z] === "number" && isFinite(zero[z])) ci = zero[z];
      else if (typeof zero[z] === "string" && /^\d+$/.test(zero[z].trim())) ci = Number(zero[z].trim());
    }
    /* free-form fields: letter, 1-based number, or option text */
    var free = [q.correctOption, q.correct, q.answer, q.ans];
    for (var f = 0; f < free.length && ci < 0; f++) {
      var c = free[f];
      if (c == null || c === "") continue;
      if (typeof c === "number" && isFinite(c)) { if (c >= 1 && c <= opts.length) ci = c - 1; }
      else if (typeof c === "string") {
        var s = c.trim();
        if (/^[A-Da-d]$/.test(s)) ci = s.toUpperCase().charCodeAt(0) - 65;
        else if (/^[1-4]$/.test(s)) ci = Number(s) - 1;
        else {
          var at = opts.findIndex(function (o) { return o.toLowerCase() === s.toLowerCase(); });
          if (at >= 0) ci = at;
        }
      }
    }
    if (ci < 0 || ci >= opts.length) ci = -1;

    var out = {};
    Object.keys(q).forEach(function (k) { out[k] = q[k]; });
    out.id = q.id || ("Q-" + (index + 1));
    out.question = text;
    out.options = opts;
    out.correctIndex = ci;
    return out;
  }

  function normalizeList(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var n = normalizeAny(list[i], i);
      if (n) out.push(n);
    }
    return out;
  }

  function arrayFrom(v) {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.questions)) return v.questions;
    if (v && Array.isArray(v.pool)) return v.pool;
    return [];
  }

  /* ------------------------------------------------------------------ */
  /* 1. HAND-OFF CHOOSER                                                 */
  /* ------------------------------------------------------------------ */
  var BIOLOGY_TAGS = /^(BIOLOGY|BIOLOGY_ACTIVE_BANK)$/i;
  var HANDOFF_FRESH_MS = 10 * 60 * 1000;

  /*
   env = { search, session(key)->json|null, local(key)->json|null, now }
   returns { mode: "biology" | "handoff", source, title, questions, reason }
  */
  function chooseSource(env) {
    var params = new URLSearchParams(env.search || "");
    var src = (params.get("source") || "").toLowerCase();
    var now = env.now || Date.now();

    if (params.get("retry") === "biology") return { mode: "biology", reason: "retry" };
    if (src === "biology") return { mode: "biology", reason: "explicit-biology" };

    var cands = [];
    function add(label, raw, tag) {
      var list = normalizeList(arrayFrom(raw));
      if (list.length) cands.push({ label: label, list: list, tag: tag || "" });
    }

    var sTag = toText(env.sessionRaw && env.sessionRaw("CBT_ACTIVE_SOURCE")).replace(/^"|"$/g, "");
    var activeTest = env.session("CBT_ACTIVE_TEST") || env.local("CBT_ACTIVE_TEST");

    add("session.CBT_ACTIVE_QUESTIONS", env.session("CBT_ACTIVE_QUESTIONS"), sTag);
    add("CBT_ACTIVE_TEST", activeTest && activeTest.questions, activeTest && (activeTest.sourceType || activeTest.source));

    var explicitHandoff = src && src !== "biology";
    var stamp = Number(env.sessionRaw && env.sessionRaw("RF_HANDOFF_TS")) || 0;
    var fresh = stamp && now - stamp < HANDOFF_FRESH_MS;
    var consumed = env.sessionRaw && env.sessionRaw("RF_HANDOFF_CONSUMED");

    if (src === "pdf" || params.get("rf-final") === "1" || params.get("pdfcbt") === "1") {
      add("local.pdfCbtQuestions", env.local("pdfCbtQuestions"), "PDF");
      add("local.CBT_ACTIVE_QUESTIONS", env.local("CBT_ACTIVE_QUESTIONS"), "PDF");

      /*
       * PDF handoff must preserve the just-imported test. Never choose by
       * question count: a stale TOPPER_TEST_180 or old pool can be larger
       * than the file the user selected. Prefer the current session payload,
       * then its active-test wrapper, then the persisted PDF pool. Deliberately
       * do not treat TOPPER_TEST_180 as a PDF fallback.
       */
      var pick = cands.find(function (c) {
        return c.label === "session.CBT_ACTIVE_QUESTIONS" && /pdf/i.test(c.tag);
      });
      if (!pick) pick = cands.find(function (c) {
        return c.label === "CBT_ACTIVE_TEST" && /pdf/i.test(c.tag);
      });
      if (!pick) pick = cands.find(function (c) {
        return c.label === "local.pdfCbtQuestions";
      });
      if (!pick) pick = cands.find(function (c) {
        return c.label === "local.CBT_ACTIVE_QUESTIONS" && /pdf/i.test(c.tag);
      });
      if (pick) return done(pick, "pdf");
      return { mode: "handoff", source: "pdf", questions: [], reason: "pdf-empty" };
    }

    if (explicitHandoff) {
      var pick = cands.filter(function (c) { return !BIOLOGY_TAGS.test(c.tag); })[0] || cands[0];
      if (pick) return done(pick, src);
      return { mode: "handoff", source: src, questions: [], reason: "handoff-empty" };
    }

    /* no ?source= : only honour a fresh, un-consumed hand-off that is not Biology */
    if (fresh && !consumed) {
      var p2 = cands.filter(function (c) { return !BIOLOGY_TAGS.test(c.tag); })[0];
      if (p2) return done(p2, (p2.tag || "handoff").toLowerCase());
    }
    return { mode: "biology", reason: "default" };

    function done(c, source) {
      var t = activeTest && activeTest.title;
      return { mode: "handoff", source: source, title: t || "", questions: c.list, reason: c.label };
    }
  }

  function browserEnv() {
    return {
      search: location.search,
      session: function (k) { return getJSON("sessionStorage", k); },
      local: function (k) { return getJSON("localStorage", k); },
      sessionRaw: function (k) { return getRaw("sessionStorage", k); }
    };
  }

  /* duration: NEET 180 -> 200 min, 90 -> 30 min (existing), else ~1.1 min/q */
  function durationSeconds(n) {
    if (n === 180) return 200 * 60;
    if (n === 90) return 30 * 60;
    return Math.max(10 * 60, Math.round(n * 66));
  }

  /* ------------------------------------------------------------------ */
  /* 2. RICH TEXT                                                        */
  /* ------------------------------------------------------------------ */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function decodeEntities(s) {
    return s.replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, "&");
  }

  /* strip html tags the PDF/AI engines sometimes leak, keep sub/sup/br meaning */
  function cleanMarkup(s) {
    s = toText(s).replace(/\r\n?/g, "\n");
    s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n");
    s = s.replace(/<li[^>]*>/gi, "\n- ");
    s = s.replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, "_{$1}").replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, "^{$1}");
    s = s.replace(/<\/?(b|strong)[^>]*>/gi, "**").replace(/<\/?(i|em)[^>]*>/gi, "*");
    s = s.replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, " | ").replace(/<[^>]+>/g, "");
    return decodeEntities(s).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function inline(s) {
    var h = esc(s);
    h = h.replace(/_\{([^}]{1,12})\}/g, "<sub>$1</sub>").replace(/\^\{([^}]{1,12})\}/g, "<sup>$1</sup>");
    h = h.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>");
    return h;
  }

  /* "…statements: 1. aaa 2. bbb 3. ccc Which…" -> split on sequential numbering */
  function splitInlineList(line) {
    var re = /(?:^|\s)(\d{1,2})[.)]\s+(?=\S)/g, m, marks = [], expect = 1;
    while ((m = re.exec(line))) {
      if (Number(m[1]) === expect) { marks.push({ n: expect, idx: m.index, len: m[0].length }); expect++; }
    }
    if (marks.length < 2) return null;
    var head = line.slice(0, marks[0].idx).trim();
    var items = [];
    for (var i = 0; i < marks.length; i++) {
      var start = marks[i].idx + marks[i].len;
      var end = i + 1 < marks.length ? marks[i + 1].idx : line.length;
      items.push(line.slice(start, end).trim());
    }
    /* a trailing question sentence ("Which of the above ... ?") belongs after the list */
    var tail = "";
    var last = items[items.length - 1];
    var t = last.match(/^([\s\S]*?[.;!])\s+((?:Which|What|Choose|Select|Identify|Find|How|Arrange|Match)[\s\S]*)$/);
    if (t) { items[items.length - 1] = t[1].trim(); tail = t[2].trim(); }
    return { head: head, items: items, tail: tail };
  }

  function isTableLine(l) { return (l.match(/\|/g) || []).length >= 1 && /\S\s*\|\s*\S/.test(l); }

  function tableHTML(rows) {
    var cells = rows.map(function (r) {
      return r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(function (c) { return c.trim(); });
    }).filter(function (r) { return !r.every(function (c) { return /^:?-{2,}:?$/.test(c); }); });
    if (!cells.length) return "";
    var out = '<div class="rf-tablewrap"><table class="rf-table">';
    cells.forEach(function (r, i) {
      out += "<tr>" + r.map(function (c) { return (i === 0 ? "<th>" : "<td>") + inline(c) + (i === 0 ? "</th>" : "</td>"); }).join("") + "</tr>";
    });
    return out + "</table></div>";
  }

  function richHTML(input) {
    var text = cleanMarkup(input);
    if (!text) return "";
    var lines = text.split("\n");
    var html = [], i = 0;

    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }

      /* table block */
      if (isTableLine(line)) {
        var rows = [];
        while (i < lines.length && isTableLine(lines[i])) rows.push(lines[i++]);
        if (rows.length >= 2 || /^\s*\|/.test(rows[0])) { html.push(tableHTML(rows)); continue; }
        html.push("<p>" + inline(rows[0]) + "</p>");
        continue;
      }

      /* explicit list block (1. / (1) / A. / - ) */
      var lm = line.match(/^\s*(?:\(?(\d{1,2})[.)]|\(?([A-Da-d])[.)]|([-•*]))\s+(.*)$/);
      if (lm) {
        var ordered = !lm[3];
        var items = [];
        while (i < lines.length) {
          var m2 = lines[i].match(/^\s*(?:\(?(\d{1,2})[.)]|\(?([A-Da-d])[.)]|([-•*]))\s+(.*)$/);
          if (!m2) break;
          items.push(m2[4]);
          i++;
          /* continuation lines (wrapped text) */
          while (i < lines.length && lines[i].trim() && !/^\s*(?:\(?\d{1,2}[.)]|\(?[A-Da-d][.)]|[-•*])\s+/.test(lines[i]) && !isTableLine(lines[i])) {
            items[items.length - 1] += " " + lines[i].trim();
            i++;
          }
        }
        if (items.length >= 2 || !ordered) {
          var tag = ordered ? "ol" : "ul";
          html.push("<" + tag + ' class="rf-list">' + items.map(function (it) { return "<li>" + inline(it) + "</li>"; }).join("") + "</" + tag + ">");
          continue;
        }
        i -= items.length ? 1 : 0;
        line = lines[i];
        i++;
        html.push("<p>" + inline(line) + "</p>");
        continue;
      }

      /* paragraph (possibly an inline-numbered statement list) */
      var para = [line.trim()];
      i++;
      while (i < lines.length && lines[i].trim() && !isTableLine(lines[i]) && !/^\s*(?:\(?\d{1,2}[.)]|[-•*])\s+/.test(lines[i])) para.push(lines[i++].trim());
      var joined = para.join(" ");
      var sp = splitInlineList(joined);
      if (sp) {
        if (sp.head) html.push("<p>" + inline(sp.head) + "</p>");
        html.push('<ol class="rf-list">' + sp.items.map(function (it) { return "<li>" + inline(it) + "</li>"; }).join("") + "</ol>");
        if (sp.tail) html.push("<p>" + inline(sp.tail) + "</p>");
      } else {
        html.push("<p>" + inline(joined) + "</p>");
      }
    }
    return html.join("");
  }

  var RICH_CSS =
    ".rf-rich p{margin:0 0 .7em;line-height:1.6}.rf-rich .rf-list{margin:.2em 0 .8em;padding-left:1.6em}" +
    ".rf-rich .rf-list li{margin:.35em 0;line-height:1.55}.rf-tablewrap{overflow-x:auto;margin:.6em 0 1em}" +
    ".rf-table{border-collapse:collapse;width:100%;font-size:.95em}.rf-table th,.rf-table td{border:1px solid rgba(100,116,139,.45);padding:9px 11px;text-align:left;vertical-align:top}" +
    ".rf-table th{background:rgba(99,102,241,.12);font-weight:700}.rf-rich sub,.rf-rich sup{font-size:.75em}";

  /* ------------------------------------------------------------------ */
  /* 3. ONE AI ENDPOINT + PROVIDER                                       */
  /* ------------------------------------------------------------------ */
  var EP_KEYS = ["rankforgeAiEndpoint", "rankerAiEndpointV1"];

  function relativeOnStaticHost(ep) {
    if (!isBrowser) return false;
    return ep.charAt(0) === "/" && /github\.io$/i.test(location.hostname);
  }

  function getEndpoint() {
    var ep = (isBrowser && window.RANKFORGE_AI_ENDPOINT) || "";
    for (var i = 0; i < EP_KEYS.length && !ep; i++) ep = toText(getRaw("localStorage", EP_KEYS[i])).trim();
    if (!ep || relativeOnStaticHost(ep)) return "";
    return ep;
  }

  function setEndpoint(url) {
    url = toText(url).trim();
    EP_KEYS.forEach(function (k) { setRaw("localStorage", k, url); });
    if (isBrowser) window.RANKFORGE_AI_ENDPOINT = url;
    return url;
  }

  function endpointProblem() {
    var ep = getEndpoint();
    if (ep) return "";
    return "No AI server is connected. Open Owner Hub → AI Server and paste your Cloudflare Worker URL " +
      "(example: https://rankforge-ai.<your-name>.workers.dev/api/ai/generate).";
  }

  function validateAIQuestion(q) {
    var n = normalizeAny(q, 0);
    if (!n) return null;
    if (n.options.length !== 4) return null;
    if (new Set(n.options.map(function (o) { return o.toLowerCase(); })).size !== n.options.length) return null;
    if (n.correctIndex < 0) return null;
    return n;
  }

  async function generateQuestions(cfg) {
    cfg = cfg || {};
    var ep = getEndpoint();
    if (!ep) throw new Error(endpointProblem());

    var count = Math.max(1, Math.min(Number(cfg.count) || 10, 30));
    var payload = {
      count: count,
      subject: cfg.subject || "Mixed NEET",
      difficulty: cfg.difficulty || "Rank Booster",
      chapter: cfg.chapter || cfg.topic || cfg.focus || "",
      topic: cfg.topic || cfg.chapter || cfg.focus || "",
      focus: cfg.focus || cfg.topic || "",
      context: cfg.context || ""
    };

    /* The free Workers AI model returns a few questions per call: ask in batches, de-duplicate */
    var good = [], seen = {}, rejected = 0, lastErr = null, calls = 0;
    while (good.length < count && calls < 6) {
      calls++;
      var batch = Object.assign({}, payload, { count: Math.min(count - good.length, 6) });
      var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, 90000) : null;
      var res, data = null;
      try {
        res = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(batch), signal: ctl ? ctl.signal : undefined });
      } catch (e) {
        if (timer) clearTimeout(timer);
        if (good.length) { lastErr = e; break; }
        throw new Error("Cannot reach AI server (" + ep + "). Check the URL and that the Worker is deployed. " + (e && e.message ? e.message : ""));
      }
      if (timer) clearTimeout(timer);
      try { data = await res.json(); } catch (_) { /* handled below */ }
      if (!res.ok || (data && data.ok === false)) {
        var limit = (data && data.code === "AI_LIMIT_REACHED") || res.status === 429;
        var msg = limit ? "The free AI limit for today is used up. Try again tomorrow, or use the offline generator."
          : ((data && data.error) || ("AI server returned HTTP " + res.status));
        if (good.length) { lastErr = new Error(msg); break; }
        throw new Error(msg);
      }
      var raw = Array.isArray(data) ? data : (data && (data.questions || data.candidates)) || [];
      if (!raw.length) break;
      raw.map(validateAIQuestion).forEach(function (q) {
        if (!q) { rejected++; return; }
        var key = q.question.toLowerCase().replace(/\W+/g, " ").trim();
        if (seen[key]) { rejected++; return; }
        seen[key] = 1; good.push(q);
      });
    }
    good = good.slice(0, count);
    good.forEach(function (q) {
      q.source = q.source || "AI";
      q.sourceType = "AI";
      q.subject = q.subject || payload.subject;
      q.chapter = q.chapter || payload.chapter || undefined;
      q.topic = q.topic || payload.topic || q.chapter || undefined;
    });
    return { ok: true, questions: good, rejected: rejected, note: lastErr ? String(lastErr.message || lastErr) : "" };
  }

  /* ------------------------------------------------------------------ */
  /* 4. TOPIC INFERENCE (kills the "Unknown" bucket)                     */
  /* ------------------------------------------------------------------ */
  var TOPICS = [
    ["Biology", "The Living World", "taxonomy nomenclature classification binomial species genus biodiversity living world taxon"],
    ["Biology", "Biological Classification", "monera protista fungi kingdom bacteria virus viroid lichen archaebacteria five kingdom"],
    ["Biology", "Plant Kingdom", "algae bryophyte pteridophyte gymnosperm angiosperm alternation of generation"],
    ["Biology", "Animal Kingdom", "porifera coelenterata annelida arthropoda mollusca echinodermata chordata notochord"],
    ["Biology", "Morphology of Flowering Plants", "inflorescence root stem leaf phyllotaxy aestivation placentation"],
    ["Biology", "Anatomy of Flowering Plants", "meristem xylem phloem cambium epidermis vascular bundle"],
    ["Biology", "Cell: The Unit of Life", "organelle mitochondria ribosome golgi nucleus endoplasmic reticulum plasma membrane cell wall"],
    ["Biology", "Cell Cycle and Division", "mitosis meiosis prophase metaphase anaphase telophase interphase crossing over"],
    ["Biology", "Biomolecules", "enzyme protein carbohydrate lipid nucleic acid amino acid cofactor substrate"],
    ["Biology", "Photosynthesis", "chlorophyll calvin cycle light reaction c3 c4 photophosphorylation rubisco"],
    ["Biology", "Respiration in Plants", "glycolysis krebs oxidative phosphorylation fermentation respiratory quotient atp"],
    ["Biology", "Plant Growth and Development", "auxin gibberellin cytokinin abscisic ethylene photoperiodism vernalisation"],
    ["Biology", "Breathing and Exchange of Gases", "alveoli lung haemoglobin spirometry tidal volume respiratory"],
    ["Biology", "Body Fluids and Circulation", "blood plasma heart ecg cardiac cycle lymph platelet"],
    ["Biology", "Excretory Products", "nephron kidney urine glomerular filtration loop of henle dialysis"],
    ["Biology", "Locomotion and Movement", "muscle sarcomere actin myosin skeleton joint bone"],
    ["Biology", "Neural Control", "neuron synapse axon reflex brain neurotransmitter action potential"],
    ["Biology", "Chemical Coordination", "hormone pituitary thyroid insulin adrenal endocrine glucagon"],
    ["Biology", "Reproduction in Organisms", "asexual vegetative budding fission reproduction organisms"],
    ["Biology", "Sexual Reproduction in Flowering Plants", "pollination fertilisation embryo sac endosperm double fertilization pollen"],
    ["Biology", "Human Reproduction", "gametogenesis spermatogenesis oogenesis menstrual placenta ovary testis"],
    ["Biology", "Reproductive Health", "contraceptive amniocentesis sti infertility ivf art"],
    ["Biology", "Principles of Inheritance and Variation", "mendel allele dominant recessive linkage pedigree chromosomal disorder genotype phenotype"],
    ["Biology", "Molecular Basis of Inheritance", "dna replication transcription translation genetic code lac operon rna polymerase"],
    ["Biology", "Evolution", "darwin natural selection hardy weinberg fossil speciation homologous analogous"],
    ["Biology", "Human Health and Disease", "immunity antibody vaccine cancer aids pathogen malaria typhoid"],
    ["Biology", "Microbes in Human Welfare", "biogas sewage fermentation biofertilizer antibiotic yeast lactobacillus"],
    ["Biology", "Biotechnology", "recombinant dna pcr restriction enzyme vector transgenic gene therapy bt cotton"],
    ["Biology", "Organisms and Populations", "population adaptation niche interaction predation mutualism commensalism"],
    ["Biology", "Ecosystem", "trophic level food chain ecological pyramid productivity decomposition nutrient cycling"],
    ["Biology", "Biodiversity and Conservation", "hotspot extinction conservation endemic in situ ex situ iucn"],
    ["Physics", "Kinematics", "velocity acceleration projectile displacement uniform motion relative velocity"],
    ["Physics", "Laws of Motion", "newton friction inertia momentum tension pulley"],
    ["Physics", "Work, Energy and Power", "kinetic energy potential energy work done power conservative"],
    ["Physics", "Rotational Motion", "torque moment of inertia angular momentum rolling"],
    ["Physics", "Gravitation", "gravitational escape velocity orbital satellite kepler"],
    ["Physics", "Thermodynamics", "isothermal adiabatic entropy heat engine carnot first law"],
    ["Physics", "Current Electricity", "resistance ohm kirchhoff galvanometer potentiometer drift velocity wheatstone"],
    ["Physics", "Electrostatics", "coulomb electric field capacitor dielectric gauss potential charge"],
    ["Physics", "Magnetism and Moving Charges", "magnetic field biot savart lorentz solenoid ampere"],
    ["Physics", "Electromagnetic Induction", "faraday lenz inductance eddy transformer alternating current"],
    ["Physics", "Optics", "lens mirror refraction diffraction interference polarisation young prism"],
    ["Physics", "Modern Physics", "photoelectric de broglie bohr nuclei radioactive semiconductor diode"],
    ["Chemistry", "Atomic Structure", "orbital quantum number bohr electronic configuration photon spectrum"],
    ["Chemistry", "Chemical Bonding", "hybridisation vsepr sigma pi bond molecular orbital dipole"],
    ["Chemistry", "Equilibrium", "le chatelier ph buffer solubility product ionic equilibrium kc kp"],
    ["Chemistry", "Thermochemistry", "enthalpy hess law gibbs spontaneous bond energy"],
    ["Chemistry", "Electrochemistry", "galvanic nernst electrolysis conductivity cell emf"],
    ["Chemistry", "Chemical Kinetics", "rate constant order half life activation energy arrhenius"],
    ["Chemistry", "Organic Chemistry", "alkane alkene alcohol aldehyde ketone carboxylic amine haloalkane benzene nucleophilic"],
    ["Chemistry", "Coordination Compounds", "ligand crystal field coordination isomerism chelate"],
    ["Chemistry", "p-Block and d-Block", "halogen noble gas transition lanthanoid oxoacid"]
  ];

  var TOPIC_INDEX = TOPICS.map(function (t) {
    return { subject: t[0], topic: t[1], words: t[2].split(/\s+/) };
  });

  function textOf(q) {
    return (toText(q.question || q.text || "") + " " + (Array.isArray(q.options) ? q.options.map(function (o) { return o && o.text != null ? o.text : o; }).join(" ") : "") + " " + toText(q.explanation)).toLowerCase();
  }

  function inferTopic(q) {
    q = q || {};
    var have = {
      subject: toText(q.subject || q.section).trim(),
      topic: toText(q.topic || q.chapter || q.unit || q.subtopic || q.concept || q.chapterName).trim()
    };
    if (have.topic && !/^unknown$/i.test(have.topic) && have.subject && !/^unknown$/i.test(have.subject)) {
      return { subject: have.subject, topic: have.topic, inferred: false };
    }
    var hay = " " + textOf(q) + " ";
    var best = null, bestScore = 0;
    TOPIC_INDEX.forEach(function (t) {
      var score = 0;
      t.words.forEach(function (w) { if (hay.indexOf(" " + w) >= 0 || hay.indexOf(w + " ") >= 0) score += w.length > 6 ? 2 : 1; });
      if (score > bestScore) { bestScore = score; best = t; }
    });
    var hint = toText(q.pageTitle || q.title || q.bookTitle).trim();
    if (best && bestScore >= 2) {
      return {
        subject: have.subject && !/^unknown$/i.test(have.subject) ? have.subject : best.subject,
        topic: have.topic && !/^unknown$/i.test(have.topic) ? have.topic : best.topic,
        inferred: true
      };
    }
    return {
      subject: have.subject && !/^unknown$/i.test(have.subject) ? have.subject : "General",
      topic: have.topic && !/^unknown$/i.test(have.topic) ? have.topic : (hint || "Mixed / Unclassified"),
      inferred: true
    };
  }

  function enrichQuestions(list) {
    return (list || []).map(function (q) {
      if (!q || typeof q !== "object") return q;
      var t = inferTopic(q);
      if (!q.subject || /^unknown$/i.test(q.subject)) q.subject = t.subject;
      if (!q.topic || /^unknown$/i.test(q.topic)) q.topic = t.topic;
      if (!q.chapter || /^unknown$/i.test(q.chapter)) q.chapter = q.topic;
      return q;
    });
  }

  /* ------------------------------------------------------------------ */
  /* 5. browser wiring                                                   */
  /* ------------------------------------------------------------------ */
  function hideDebugPanels() {
    if (!isBrowser) return;
    var debug = /[?&]debug=1/.test(location.search) || getRaw("localStorage", "rfDebug") === "1";
    if (debug) return;
    var css = document.createElement("style");
    css.id = "rf-hide-debug";
    css.textContent = "#pcbNichodLiveReport,#nichodLiveFlowMonitor,#rf-live-source-panel,[data-rf-debug-panel]{display:none!important}";
    (document.head || document.documentElement).appendChild(css);
    function sweep() {
      var nodes = document.querySelectorAll("body > div[style*='position:fixed'],body > div[style*='position: fixed']");
      for (var i = 0; i < nodes.length; i++) {
        var t = nodes[i].textContent || "";
        if (/PCB NICHOD LIVE|NICHOD LIVE|Live snapshots:|PDF bridge:/i.test(t)) nodes[i].remove();
      }
    }
    sweep();
    if (typeof MutationObserver !== "undefined") {
      new MutationObserver(sweep).observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  /* leaving any page that holds a non-Biology active set => mark it as a fresh hand-off */
  function stampHandoffOnLeave() {
    if (!isBrowser) return;
    /* cbt.html is the consumer, never the producer */
    if (/\/cbt\.html$/i.test(location.pathname)) return;
    function stamp() {
      var tag = toText(getRaw("sessionStorage", "CBT_ACTIVE_SOURCE")).replace(/^"|"$/g, "");
      var qs = getJSON("sessionStorage", "CBT_ACTIVE_QUESTIONS");
      if (Array.isArray(qs) && qs.length && !BIOLOGY_TAGS.test(tag)) {
        setRaw("sessionStorage", "RF_HANDOFF_TS", String(Date.now()));
        try { sessionStorage.removeItem("RF_HANDOFF_CONSUMED"); } catch (_) {}
      }
    }
    window.addEventListener("pagehide", stamp);
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest && e.target.closest("a[href*='cbt.html'],button,[onclick]");
      if (a) stamp();
    }, true);
  }

  function installProvider() {
    if (!isBrowser) return;
    var api = window.RankForgeAI = window.RankForgeAI || {};
    /* Replace the missing/stub provider with the real one (never overwrite a working custom one) */
    if (typeof api.generateQuestions !== "function" || api.__rfFixStub) {
      api.generateQuestions = generateQuestions;
      api.__rfFixProvider = VERSION;
    }
  }

  function injectCSS() {
    if (!isBrowser || document.getElementById("rf-rich-css")) return;
    var s = document.createElement("style");
    s.id = "rf-rich-css";
    s.textContent = RICH_CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* One shared way for every launcher (practice, adaptive, DPP, unified test) to open a prepared test in the CBT. */
  function handoff(test, source) {
    source = String(source || (test && test.source) || "handoff");
    try {
      var t = Object.assign({}, test || {});
      t.source = t.source || source; t.sourceType = t.sourceType || source;
      var TITLES = {"rankforge-unified":"AI + Bank Test","rankforge-practice":"Practice","rankforge-adaptive":"Adaptive Practice","rankforge-dpp":"Adaptive DPP"};
      if (!t.title || /^rankforge/i.test(t.title) === false && false) t.title = t.title || TITLES[source] || source;
      var json = JSON.stringify(t);
      localStorage.setItem("CBT_ACTIVE_TEST", json);
      sessionStorage.setItem("CBT_ACTIVE_TEST", json);
      sessionStorage.setItem("CBT_ACTIVE_SOURCE", source.toUpperCase());
      sessionStorage.setItem("RF_HANDOFF_TS", String(Date.now()));
      sessionStorage.removeItem("RF_HANDOFF_CONSUMED");
    } catch (e) {}
    location.href = "./cbt.html?source=" + encodeURIComponent(source);
  }

  var API = {
    version: VERSION,
    handoff: handoff,
    normalizeAny: normalizeAny,
    normalizeList: normalizeList,
    chooseSource: chooseSource,
    browserChoose: function () { return chooseSource(browserEnv()); },
    markConsumed: function () { setRaw("sessionStorage", "RF_HANDOFF_CONSUMED", String(Date.now())); },
    durationSeconds: durationSeconds,
    richHTML: richHTML,
    cleanMarkup: cleanMarkup,
    getEndpoint: getEndpoint,
    setEndpoint: setEndpoint,
    endpointProblem: endpointProblem,
    generateQuestions: generateQuestions,
    inferTopic: inferTopic,
    enrichQuestions: enrichQuestions,
    injectCSS: injectCSS
  };

  if (isBrowser) {
    window.RankForgeFix = API;
    injectCSS();
    installProvider();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", hideDebugPanels);
    } else { hideDebugPanels(); }
    stampHandoffOnLeave();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
