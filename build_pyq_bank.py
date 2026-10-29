import os, re, ast, json, sqlite3
from collections import defaultdict

RAW_DIR = os.path.expanduser("~/pyq_raw")
OUT_DIR = os.path.join(os.getcwd(), "pyq-bank")
PAPERS_DIR = os.path.join(OUT_DIR, "papers")
os.makedirs(PAPERS_DIR, exist_ok=True)

def clean_html(s):
    if not s: return ""
    s = re.sub(r'^(\s*<br\s*/?>\s*)+|(\s*<br\s*/?>\s*)+$', '', s.strip(), flags=re.I)
    return s.strip()

def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

papers = defaultdict(dict)

for db_name in ("search_NEET.db", "search_MAIN.db", "search_ADVANCED.db"):
    db_path = os.path.join(RAW_DIR, db_name)
    if not os.path.exists(db_path): continue
    con = sqlite3.connect(db_path)
    for row in con.execute("SELECT id, title, slug, question, tags, options, correct_option, answer FROM questions"):
        qid, title, slug, q_html, tags_str, opts_html, corr_html, sol_html = row
        try:
            tags = ast.literal_eval(tags_str) if tags_str else []
        except Exception:
            continue
        if len(tags) < 4: continue
        subject, chapter, exam, paper = [str(x).strip() for x in tags[:4]]
        p_up = paper.upper()
        if p_up.startswith(("NEET", "AIPMT")):
            cat = "neet"
        elif p_up.startswith(("JEE MAIN", "AIEEE")):
            cat = "jee_main"
        elif p_up.startswith(("JEE ADVANCED", "IIT")):
            cat = "jee_advanced"
        else:
            continue

        dedup_key = slug or f"{cat}-{qid}"
        if dedup_key in papers[(cat, paper)]:
            continue

        options, correct_idx = [], -1
        if opts_html:
            items = re.findall(r'<li\s+class="([^"]*)"[^>]*>\s*<span\s+class="option-label">\s*([A-D])\s*</span>\s*<span\s+class="option-data">(.*?)</span>', opts_html, flags=re.S|re.I)
            for idx, (li_cls, label, opt_text) in enumerate(items):
                options.append(clean_html(opt_text))
                if "correct" in li_cls.lower():
                    correct_idx = idx

        corr_val = ""
        if corr_html:
            m = re.search(r'<span\s+class="option-value">(.*?)</span>', corr_html, flags=re.S|re.I)
            if m: corr_val = clean_html(m.group(1))

        if correct_idx == -1 and options and corr_val:
            for idx, opt in enumerate(options):
                if opt == corr_val or re.sub(r'\s+', '', opt) == re.sub(r'\s+', '', corr_val):
                    correct_idx = idx
                    break
            if correct_idx == -1 and corr_val.upper() in ("A", "B", "C", "D"):
                correct_idx = "ABCD".index(corr_val.upper())

        q_text = clean_html(re.sub(r'^<div\s+class="question">|</div>$', '', (q_html or title or '').strip(), flags=re.I))
        sol_text = clean_html(re.sub(r'^<div\s+class="solution">|</div>$', '', (sol_html or '').strip(), flags=re.I))
        ans_final = options[correct_idx] if (0 <= correct_idx < len(options)) else corr_val

        papers[(cat, paper)][dedup_key] = {
            "id": f"PYQ-{qid}",
            "subject": subject,
            "chapter": chapter,
            "exam": exam,
            "paper": paper,
            "type": "mcq" if options else "numerical",
            "question": q_text,
            "options": options,
            "correctIndex": correct_idx,
            "correctAnswer": ans_final,
            "answer": ans_final,
            "solution": sol_text,
            "explanation": sol_text
        }

if papers:
    manifest = {"neet": [], "jee_main": [], "jee_advanced": []}
    for (cat, paper_title), q_map in papers.items():
        q_list = list(q_map.values())
        subj_order = {"Biology": 0, "Physics": 1, "Chemistry": 2, "Mathematics": 3}
        q_list.sort(key=lambda x: (subj_order.get(x["subject"], 9), x["id"]))
        pslug = slugify(paper_title)
        rel_file = f"pyq-bank/papers/{pslug}.json"
        with open(os.path.join(PAPERS_DIR, f"{pslug}.json"), "w", encoding="utf-8") as f:
            json.dump(q_list, f, ensure_ascii=False)
        ym = re.search(r'(19\d\d|20\d\d)', paper_title)
        year = int(ym.group(1)) if ym else 0
        subjs = {}
        for q in q_list:
            subjs[q["subject"]] = subjs.get(q["subject"], 0) + 1
        manifest[cat].append({
            "id": pslug,
            "title": paper_title,
            "year": year,
            "count": len(q_list),
            "subjects": subjs,
            "file": rel_file
        })

    for cat in manifest:
        manifest[cat].sort(key=lambda x: (x["year"], x["title"]), reverse=True)

    with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"Built {len(manifest['neet'])} NEET Year Papers, {len(manifest['jee_main'])} JEE Main Shifts, and {len(manifest['jee_advanced'])} JEE Advanced Papers!")
else:
    print("Note: ~/pyq_raw databases not found yet; using built-in PYQ starter bank.")
