#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"
python - <<'PY'
from pathlib import Path
p=Path("index.html")
s=p.read_text()
if "rankers-test-series.html" in s:
    print("Rankers Test Series card already present")
else:
    marker="<!-- PDF READER -->"
    card='''<!-- RANKERS TEST SERIES -->
<section class="card">
  <h2>Rankers Test Series</h2>
  <p>Coverage-first chapter, multi-chapter and full-syllabus ranker tests.</p>
  <button onclick="window.location.href='rankers-test-series.html'">Open Rankers Test Series</button>
</section>

'''
    if marker not in s: raise SystemExit("Dashboard marker not found")
    p.write_text(s.replace(marker,card+marker,1))
    print("Rankers Test Series card added")
PY
git add rankers-test-series.html index.html
git commit -m "Add Rankers Test Series module"
git push
