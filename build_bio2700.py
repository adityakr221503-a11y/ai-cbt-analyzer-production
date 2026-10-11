from pathlib import Path
import re, json, sys

try:
    from pypdf import PdfReader
except Exception:
    print("PYPDF_MISSING")
    sys.exit(2)

PDF = Path("/storage/emulated/0/Download/NEET Biology Test Series.pdf")
OUT = Path("rank-booster/biology-test-series-2700.json")

print("CHECKING PDF...")
print("PATH:", PDF)

if not PDF.exists():
    print("PDF_NOT_FOUND")
    print("Check Download folder with:")
    print("ls -lh /storage/emulated/0/Download/ | grep -i 'Biology'")
    sys.exit(1)

reader = PdfReader(str(PDF))
print("PAGES:", len(reader.pages))

if len(reader.pages) != 310:
    print("STOP: Expected 310 pages, got", len(reader.pages))
    sys.exit(3)

texts = []
for i, page in enumerate(reader.pages, 1):
    texts.append((page.extract_text() or "").replace("\r", "\n"))
    if i % 25 == 0:
        print("EXTRACTED:", i)

starts = [8,18,28,38,47,57,67,77,87,97,106,116,126,136,146,
          156,166,176,185,195,204,214,223,232,242,252,262,272,281,291]

def parse_test(text, test_no):
    pat = re.compile(
        r"(?m)^\s*(?:Q\s*)?\(?\s*(\d{1,2})\s*\)?\s*[.)\-:]\s+"
    )

    hits = []
    for m in pat.finditer(text):
        n = int(m.group(1))
        if 1 <= n <= 90:
            hits.append((n, m.start(), m.end()))

    chosen = []
    pos = 0

    for n in range(1, 91):
        found = None
        for h in hits:
            if h[0] == n and h[1] >= pos:
                found = h
                break

        # Test 11 has a PDF extraction anomaly:
        # Q53 number is embedded in the text instead of being a
        # normal question-boundary marker. Recover it from the
        # exact "53 Statement I-" text without changing wording.
        if found is None and n == 53:
            embedded = re.search(
                r'(?<!\\d)53\\s+Statement\\s+I\\s*-',
                text[pos:],
                re.I
            )
            if embedded:
                absolute = pos + embedded.start()
                end = pos + embedded.end()
                found = (53, absolute, end)

        if found is None:
            return []

        chosen.append(found)
        pos = found[2]

    result = []

    for i, (n, st, en) in enumerate(chosen):
        end = chosen[i+1][1] if i < 89 else len(text)
        raw = text[en:end].strip()

        om = list(re.finditer(
            r"(?m)(?:^|\n)\s*\(?([a-dA-D])\)?\s*[.)\-:]\s+",
            raw
        ))

        if len(om) >= 4:
            om = om[:4]
            qtext = raw[:om[0].start()].strip()
            opts = []

            for j, o in enumerate(om):
                oe = om[j+1].start() if j < 3 else len(raw)
                opts.append(
                    re.sub(r"[ \t]+", " ", raw[o.end():oe]).strip()
                )
        else:
            qtext = re.sub(r"[ \t]+", " ", raw).strip()
            opts = []

        result.append({
            "id": f"NEET-BIO-TS-{test_no}-Q{n}",
            "testNumber": test_no,
            "questionNumber": n,
            "subject": "Biology",
            "chapter": f"Biology Test {test_no}",
            "question": qtext,
            "options": opts,
            "correctAnswer": "",
            "correctIndex": None,
            "marks": 4,
            "negativeMarks": 1,
            "source": "NEET Biology Test Series PDF",
            "sourceQuestionNumber": n
        })

    return result

allq = []

for test_no, start in enumerate(starts, 1):
    end = starts[test_no] if test_no < 30 else 301
    block = "\n".join(texts[start-1:end-1])

    qs = parse_test(block, test_no)

    print(f"TEST {test_no}: {len(qs)}")

    if len(qs) != 90:
        print("STOP: Test", test_no, "parsed", len(qs), "instead of 90")
        sys.exit(4)

    allq.extend(qs)

print("TOTAL_QUESTIONS:", len(allq))

if len(allq) != 2700:
    print("STOP: Expected 2700")
    sys.exit(5)

# Answer-key extraction
answer = {}

for page_no in range(301, 311):
    text = texts[page_no-1]
    current = None

    for line in text.splitlines():
        line = line.strip()

        tm = re.search(r"TEST\s*[- ]?(\d{1,2})", line, re.I)
        if tm:
            current = int(tm.group(1))

        km = re.search(
            r"Qus\.?\s*([0-9\s]+)\s+Ans\.?\s*([A-Da-d\s/]+)",
            line,
            re.I
        )

        if km and current:
            nums = re.findall(r"\d+", km.group(1))
            vals = re.findall(r"[A-Da-d]", km.group(2))

            if len(nums) == len(vals):
                for q, a in zip(nums, vals):
                    answer[(current, int(q))] = a.lower()

mapped = 0
missing = []

for q in allq:
    a = answer.get((q["testNumber"], q["questionNumber"]))

    if a in "abcd":
        q["correctAnswer"] = a
        q["correctIndex"] = ord(a) - 97
        mapped += 1
    else:
        missing.append(
            (q["testNumber"], q["questionNumber"], a or "MISSING")
        )

print("ANSWER_KEY_ENTRIES:", len(answer))
print("ANSWER_MAPPED:", mapped)
print("MISSING_OR_AMBIGUOUS:", len(missing))

if mapped != 2700:
    print("BANK_NOT_ACTIVATED")
    print("FIRST_PROBLEMS:", missing[:20])
    sys.exit(6)

badopts = [
    q["id"] for q in allq
    if len(q["options"]) != 4
]

print("FOUR_OPTION_QUESTIONS:", 2700 - len(badopts))

if badopts:
    print("BANK_NOT_ACTIVATED: OPTION PARSING FAILED")
    print("FIRST_BAD:", badopts[:20])
    sys.exit(7)

OUT.parent.mkdir(parents=True, exist_ok=True)

OUT.write_text(
    json.dumps(allq, ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8"
)

print("")
print("========================================")
print("BANK_ACTIVATED_READY")
print("TOTAL_VERIFIED: 2700")
print("ANSWER_VERIFIED: 2700")
print("OPTIONS_VERIFIED: 2700")
print("OUTPUT:", OUT)
print("========================================")
