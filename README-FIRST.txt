RANKFORGE LIVE UPDATE - where each file goes
=============================================
Use ONLY the files in this folder. Ignore any older rankforge-android.yml you downloaded before.

A) Main page of your repo (where index.html is listed)
   GitHub > Add file > Upload files > choose these 3 files > Commit changes
     capacitor.config.json
     rf-nav-v1.js
     version.json

B) The .github/workflows folder
   Open the repo > .github > workflows > Add file > Upload files > choose these 2 files > Commit changes
     rankforge-android.yml   (replaces the old one)
     rankforge-check.yml     (new)
   Upload the files. Do not paste them into the editor.

C) Build the app ONE more time (the last time)
   Repo > Actions > RankForge Android APK > wait for the green tick > download RankForge-v1.0.0-debug
   > unzip > uninstall the old RankForge app once > install app-debug.apk
   After this the app shows your live website, so you never download an APK for normal changes again.


TERMUX: one-time setup
======================
1. pkg update -y && pkg install -y git
2. git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   git config --global credential.helper store
3. Make a GitHub token in your phone browser:
   GitHub > your photo > Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token
   Repository access: Only select repositories > ai-cbt-analyzer-production
   Permissions: Contents = Read and write, Workflows = Read and write
   Generate, then copy the token.
4. cd ~ && git clone https://github.com/adityakr221503-a11y/ai-cbt-analyzer-production.git
   Username = adityakr221503-a11y, Password = paste the token.
5. Add the push shortcut:
cat >> ~/.bashrc <<'EOF'
rfpush() {
  cd ~/ai-cbt-analyzer-production || return 1
  git pull --rebase --autostash || return 1
  note=$(printf '%s' "${1:-update}" | tr -d '"\\')
  printf '{"updated":"%s","note":"%s"}\n' "$(date '+%d %b %Y, %H:%M')" "$note" > version.json
  git add -A
  git commit -m "${1:-update}"
  git push
}
EOF
source ~/.bashrc


TERMUX: every time you change the app
=====================================
   nano ~/ai-cbt-analyzer-production/index.html      (or any file you want to change)
   rfpush "what I changed"
Wait 1 to 2 minutes, then reopen the app. The bottom of the home screen shows
"Updated <date and time> - what I changed", so you can see the new version arrived.
On GitHub, a green tick next to your commit means the app passed its health check;
a red cross shows what to fix.
