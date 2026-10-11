#!/data/data/com.termux/files/usr/bin/bash
set -e

ROOT="$HOME/cbt-repo"
cd "$ROOT"

case "$1" in
  check)
    echo "=== CBT CHECK ==="
    node --check nichod/engine/pdf-cbt-universal-parser.js
    node --check nichod/engine/cbt-source-isolation-v1.js
    echo "JS syntax OK"
    ;;

  status)
    git status --short
    git log -1 --oneline
    ;;

  diff)
    git diff --stat
    ;;

  test)
    echo "=== PROJECT TEST ==="
    node --check nichod/engine/pdf-cbt-universal-parser.js
    node --check nichod/engine/cbt-source-isolation-v1.js
    echo "=== GIT ==="
    git status --short
    git log -1 --oneline
    ;;

  push)
    git status --short
    git add pdf-to-cbt.html cbt.html nichod/engine/*.js
    git commit -m "${2:-CBT consolidated update}" || true
    git push origin main
    ;;

  *)
    echo "Allowed commands:"
    echo "  ./run-cbt.sh check"
    echo "  ./run-cbt.sh status"
    echo "  ./run-cbt.sh diff"
    echo "  ./run-cbt.sh test"
    echo "  ./run-cbt.sh push \"commit message\""
    exit 1
    ;;
esac
