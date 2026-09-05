#!/data/data/com.termux/files/usr/bin/bash
set -e
cd ~/cbt-repo
cp question-bank.html question-bank.html.bak 2>/dev/null || true
echo "Question Bank file installed."
echo "Now add this card to index.html if it is not already present:"
echo '<a href="question-bank.html" class="card primary"><div class="icon">🎯</div><h2>Rank Booster Question Bank</h2><p>Master every important concept and question pattern.</p></a>'
echo
echo "Then:"
echo "git add question-bank.html"
echo 'git commit -m "Add Rank Booster Question Bank dashboard"'
echo "git push"
