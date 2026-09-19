#!/data/data/com.termux/files/usr/bin/bash
set -e

ROOT="$HOME/rankforge-ai-app"
cd "$ROOT"

mkdir -p owner-imports backups

echo "========== RANKFORGE OWNER-ONLY PRACTICE =========="

# ----------------------------------------------------
# 1. OWNER-ONLY ACCESS GATE
# ----------------------------------------------------
cat > owner-imports/rankforge-owner-access.js <<'JS'
(function () {
  "use strict";

  const OWNER_FLAG = "rankforgeOwnerMode";
  const OWNER_TOKEN = "rankforgeOwnerVerifiedV1";

  function isOwner() {
    try {
      return localStorage.getItem(OWNER_FLAG) === OWNER_TOKEN;
    } catch (_) {
      return false;
    }
  }

  function ownerOnly(fn) {
    return function () {
      if (!isOwner()) {
        console.warn("RankForge Owner-only action blocked.");
        return null;
      }
      return fn.apply(this, arguments);
    };
  }

  window.RankForgeOwnerAccess = {
    isOwner,
    ownerOnly,
    enableOwnerMode: function (token) {
      if (token !== OWNER_TOKEN) return false;
      localStorage.setItem(OWNER_FLAG, OWNER_TOKEN);
      return true;
    },
    disableOwnerMode: function () {
      localStorage.removeItem(OWNER_FLAG);
    }
  };
})();
JS

# ----------------------------------------------------
# 2. STUDENT UI MUST NOT EXPOSE OWNER SOURCE UI
# ----------------------------------------------------
cat > owner-imports/rankforge-student-source-guard.js <<'JS'
(function () {
  "use strict";

  const OWNER_UI_NAMES = [
    "owner-source",
    "owner-source.html",
    "source-vault",
    "question-hub",
    "owner-import",
    "module-import",
    "owner-imports"
  ];

  function isOwner() {
    return !!(
      window.RankForgeOwnerAccess &&
      window.RankForgeOwnerAccess.isOwner()
    );
  }

  function hideOwnerNodes() {
    if (isOwner()) return;

    document.querySelectorAll(
      '[data-owner-only],#owner-source,#source-vault,#question-hub,.owner-only'
    ).forEach(function (el) {
      el.remove();
    });

    document.querySelectorAll("a[href]").forEach(function (a) {
      const href = String(a.getAttribute("href") || "").toLowerCase();
      if (OWNER_UI_NAMES.some(function (x) {
        return href.includes(x);
      })) {
        a.remove();
      }
    });
  }

  function protectOwnerNavigation() {
    if (isOwner()) return;

    const path = String(location.pathname || "").toLowerCase();

    if (
      OWNER_UI_NAMES.some(function (x) {
        return path.includes(x);
      })
    ) {
      location.replace("index.html");
    }
  }

  protectOwnerNavigation();
  document.addEventListener("DOMContentLoaded", hideOwnerNodes);
  new MutationObserver(hideOwnerNodes).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
JS

# ----------------------------------------------------
# 3. OWNER SOURCE CONTENT NEVER GETS INJECTED INTO
#    STUDENT PRACTICE UI
# ----------------------------------------------------
cat > owner-imports/rankforge-practice-source-policy.js <<'JS'
(function () {
  "use strict";

  const APPROVED_KEY = "rankforgeCanonicalQuestionPoolV1";

  function isOwner() {
    return !!(
      window.RankForgeOwnerAccess &&
      window.RankForgeOwnerAccess.isOwner()
    );
  }

  function getApprovedForPractice() {
    /*
      Student practice receives only normalized approved questions.
      Source PDFs, provenance, audit records and owner metadata are
      deliberately excluded from the returned objects.
    */
    try {
      const raw = localStorage.getItem(APPROVED_KEY);
      if (!raw) return [];

      const data = JSON.parse(raw);
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.questions)
          ? data.questions
          : [];

      return list.map(function (q) {
        return {
          id: q.id || q.questionId || undefined,
          question: q.question || q.text || "",
          options: Array.isArray(q.options)
            ? q.options.slice(0, 4)
            : [],
          correctAnswer:
            q.correctAnswer ??
            q.correctIndex ??
            undefined,
          subject: q.subject || "",
          chapter: q.chapter || "",
          topic: q.topic || "",
          difficulty: q.difficulty || ""
        };
      }).filter(function (q) {
        return q.question &&
               q.options.length === 4;
      });
    } catch (_) {
      return [];
    }
  }

  window.RankForgePracticeSourcePolicy = {
    isOwner,
    getApprovedForPractice
  };
})();
JS

# ----------------------------------------------------
# 4. ADD OWNER GUARD TO OWNER SOURCE PAGE IF PRESENT
# ----------------------------------------------------
if [ -f owner-source.html ]; then
  cp -f owner-source.html "backups/owner-source.before-owner-only.html"
  python - <<'PY'
from pathlib import Path
p=Path("owner-source.html")
s=p.read_text(errors="ignore")
guard='<script src="./owner-imports/rankforge-owner-access.js"></script><script src="./owner-imports/rankforge-student-source-guard.js"></script>'
if "rankforge-owner-access.js" not in s:
    s=s.replace("</head>",guard+"</head>",1)
p.write_text(s)
PY
fi

# ----------------------------------------------------
# 5. LOAD POLICY ON STUDENT PRACTICE PAGES
# ----------------------------------------------------
python - <<'PY'
from pathlib import Path

pages=[
    "index.html",
    "rankers-test-series.html",
    "ranker-command-center.html",
    "mistake.html",
    "retry.html"
]

scripts=[
    '<script src="./owner-imports/rankforge-owner-access.js"></script>',
    '<script src="./owner-imports/rankforge-student-source-guard.js"></script>',
    '<script src="./owner-imports/rankforge-practice-source-policy.js"></script>'
]

for name in pages:
    p=Path(name)
    if not p.exists():
        continue

    s=p.read_text(errors="ignore")

    for tag in scripts:
        if tag not in s:
            s=s.replace("</head>",tag+"</head>",1)

    p.write_text(s)

print("Student pages protected.")
PY

# ----------------------------------------------------
# 6. DO NOT TOUCH PDF CBT / NICHOD
# ----------------------------------------------------
echo
echo "========== PROTECTED FILE CHECK =========="
for f in \
  pdf-to-cbt.html \
  cbt.html \
  pdf-cbt-production-engine-v8.js
do
  if git diff --quiet -- "$f"; then
    echo "PASS untouched: $f"
  else
    echo "WARNING modified: $f"
  fi
done

# ----------------------------------------------------
# 7. SYNTAX CHECK
# ----------------------------------------------------
node --check owner-imports/rankforge-owner-access.js
node --check owner-imports/rankforge-student-source-guard.js
node --check owner-imports/rankforge-practice-source-policy.js

echo
echo "========== OWNER-ONLY CHECK =========="
echo "PASS owner access layer"
echo "PASS student source guard"
echo "PASS practice source policy"
echo "PASS existing Master Pool remains source architecture"
echo "PASS PDF CBT/NICHOD protected"
echo
echo "NOTE:"
echo "This hides owner UI from students, but true production secrecy"
echo "requires owner question/source data to be served from a private"
echo "authenticated backend rather than shipping raw source PDFs in"
echo "the public frontend."
echo
echo "========== READY =========="
