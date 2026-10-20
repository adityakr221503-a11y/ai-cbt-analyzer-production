RANKFORGE FINAL PACKAGE - do these steps once
=============================================
On a phone, open github.com in Chrome and choose "Desktop site".
File names must be EXACTLY as in this folder (no "(1)" added by the phone).

STEP 1 - Upload 5 files
  A) Main page of the repo (where index.html is listed) > Add file > Upload files:
       capacitor.config.json
       rf-nav-v1.js
       version.json
  B) Open .github > workflows > Add file > Upload files:
       rankforge-android.yml
       rankforge-check.yml
  Commit changes each time. Upload, do not paste into the editor.

STEP 2 - Add an empty file named .nojekyll
  Main page > Add file > Create new file > type  .nojekyll  as the file name > Commit changes.
  (This stops GitHub from reshaping your files when it publishes the site.)

STEP 3 - Delete leftovers from the main page, if you see them
  rf-apply.sh and delete.txt  (open the file > trash icon > Commit changes).
  Never run rf-apply.sh. It puts old files back and undoes the fixes.

STEP 4 - Check GitHub Pages
  Settings > Pages > Build and deployment:
    Source = Deploy from a branch, Branch = main, Folder = / (root).
  Change it and Save only if it says something else.

STEP 5 - Read the result in the Actions tab
  "RankForge Check" has two parts:
    check = is the app healthy (home page, bank, scripts, links)
    live  = did your live website really receive this push (it waits up to 12 minutes)
  Two green ticks mean your change is live. A red part shows a red message saying exactly what to fix.
  If "live" is red, copy that red message and send it to me.

STEP 6 - Only if the installed app still shows the old screen after Step 5 is green
  Actions > RankForge Android APK > wait for the green tick > download RankForge-v1.0.0-debug
  > unzip > uninstall the old RankForge app once > install app-debug.apk.
  This APK opens your live website, so you never need another one for normal changes.

TO TEST THE WEBSITE: open it in a Chrome Incognito tab. It never shows an old saved copy.

EVERY TIME YOU CHANGE SOMETHING AFTER THIS
  Edit on GitHub, or in Termux run:  rfpush "what I changed"
  Wait for the two green ticks, then reopen the app. The bottom of the home screen shows
  "Updated <date> - your note". No APK download.


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
