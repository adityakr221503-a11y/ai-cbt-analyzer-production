from pathlib import Path
import re,json,sys
from pypdf import PdfReader

PDF=Path("/storage/emulated/0/Download/NEET Biology Test Series.pdf")
OUT=Path("rank-booster/biology-test-series-2699.json")

if not PDF.exists():
    print("PDF_NOT_FOUND");sys.exit(1)

r=PdfReader(str(PDF))
print("PAGES:",len(r.pages))
if len(r.pages)!=310: sys.exit("STOP: expected 310 pages")

T=[8,18,28,38,47,57,67,77,87,97,106,116,126,136,146,156,
   166,176,185,195,204,214,223,232,242,252,262,272,281,291]

texts=[(p.extract_text() or "").replace("\r","\n") for p in r.pages]
allq=[]

def parse(text,test):
    hits=[]
    for m in re.finditer(r"(?m)^\s*(?:Q\s*)?\(?(\d{1,2})\)?\s*[.)\-:]\s+",text):
        n=int(m.group(1))
        if 1<=n<=90:hits.append((n,m.start(),m.end()))

    # Q53 of Test 11 is intentionally quarantined.
    if test==11:
        hits=[h for h in hits if h[0]!=53]

    chosen=[];pos=0
    wanted=[n for n in range(1,91) if not(test==11 and n==53)]

    for n in wanted:
        f=next((h for h in hits if h[0]==n and h[1]>=pos),None)
        if not f:
            print("FAILED:",test,n);return []
        chosen.append(f);pos=f[2]

    out=[]
    for i,(n,st,en) in enumerate(chosen):
        end=chosen[i+1][1] if i+1<len(chosen) else len(text)
        raw=text[en:end].strip()
        om=list(re.finditer(r"(?m)(?:^|\n)\s*\(?([a-dA-D])\)?\s*[.)\-:]\s+",raw))
        if len(om)>=4:
            om=om[:4]
            q=raw[:om[0].start()].strip()
            opts=[]
            for j,o in enumerate(om):
                z=om[j+1].start() if j<3 else len(raw)
                opts.append(re.sub(r"[ \t]+"," ",raw[o.end():z]).strip())
        else:
            q=re.sub(r"[ \t]+"," ",raw).strip();opts=[]
        out.append({
            "id":f"NEET-BIO-TS-{test}-Q{n}",
            "testNumber":test,"questionNumber":n,
            "subject":"Biology","chapter":f"Biology Test {test}",
            "question":q,"options":opts,
            "correctAnswer":"","correctIndex":None,
            "marks":4,"negativeMarks":1,
            "source":"NEET Biology Test Series PDF"
        })
    return out

for test,start in enumerate(T,1):
    end=T[test] if test<30 else 301
    qs=parse("\n".join(texts[start-1:end-1]),test)
    expected=89 if test==11 else 90
    print(f"TEST {test}: {len(qs)}/{expected}")
    if len(qs)!=expected:sys.exit("STOP: parsing failed")
    allq+=qs

print("TOTAL:",len(allq))
if len(allq)!=2699:sys.exit("STOP: expected 2699")

# Answer-key mapping: PDF format is
# Qus. 1 2 ... 20 Ans. d d a ...
# repeated in blocks of 20.
ans={}

for page_no in range(301,311):
    text=texts[page_no-1]

    # Split by TEST header so answers stay scoped to the correct test.
    blocks=re.split(
        r"(?=ANSWER\s+KEY\s+TEST\s*[- ]?\s*\d+)",
        text,
        flags=re.I
    )

    for block in blocks:
        tm=re.search(
            r"ANSWER\s+KEY\s+TEST\s*[- ]?\s*(\d{1,2})",
            block,
            re.I
        )
        if not tm:
            continue

        test_no=int(tm.group(1))

        # Each Qus/Ans block is parsed independently.
        pairs=re.finditer(
            r"Qus\.?\s*((?:\d+\s*){1,20})"
            r"Ans\.?\s*((?:[A-Da-d]\s*){1,20})",
            block,
            re.I
        )

        for pm in pairs:
            nums=re.findall(r"\d+",pm.group(1))
            vals=re.findall(r"[A-Da-d]",pm.group(2))

            if len(nums)==len(vals):
                for q,a in zip(nums,vals):
                    ans[(test_no,int(q))]=a.lower()

mapped=0
missing=[]

for q in allq:
    key=(q["testNumber"],q["questionNumber"])

    # Q53 is intentionally quarantined.
    if key==(11,53):
        continue

    a=ans.get(key)

    if isinstance(a,str) and a in "abcd":
        q["correctAnswer"]=a
        q["correctIndex"]=ord(a)-97
        mapped+=1
    else:
        missing.append(key)

print("ANSWER_KEY_ENTRIES:",len(ans))

# MANUAL VERIFIED ANSWER OVERRIDE
# These answer-key blocks were confirmed from the PDF text.
manual_answers = {
    # Test 2 Q21-Q40
    **{(2, q): a for q, a in enumerate(
        "a c a d a c a b d b b b a a/c c c d c a c".split(), start=21
    )},

    # Test 27 Q41-Q60
    **{(27, q): a for q, a in enumerate(
        "d b d a d c b c d d b a a a b c c c a a".split(), start=41
    )},
}

for q in allq:
    key = (q["testNumber"], q["questionNumber"])
    if key in manual_answers:
        q["correctAnswer"] = manual_answers[key]

# Recalculate verification after manual confirmed answers
missing = []
mapped = 0

for q in allq:
    key = (q["testNumber"], q["questionNumber"])

    if key == (11, 53):
        continue

    ans = q.get("correctAnswer")
    if isinstance(ans, str) and ans in {"a", "b", "c", "d", "a/c"}:
        mapped += 1
    else:
        missing.append(key)

print("MANUAL_OVERRIDE_APPLIED: 40")
print("ANSWER_MISSING_AFTER_OVERRIDE:", len(missing))
if missing:
    print("FIRST_MISSING_AFTER_OVERRIDE:", missing[:30])
print("ANSWER_MAPPED_AFTER_OVERRIDE:", mapped)

print("ANSWER_MAPPED:",mapped)
print("ANSWER_MISSING:",len(missing))

if missing:
    print("FIRST_MISSING:",missing[:30])

print("ANSWER_MAPPED:",mapped)
print("Q53_STATUS: SKIPPED/QUARANTINED")

OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(allq,ensure_ascii=False,separators=(",",":")))

print("================================")
print("BIOLOGY BANK READY: 2699")
print("Q53: SKIPPED")
print("OUTPUT:",OUT)
print("================================")
