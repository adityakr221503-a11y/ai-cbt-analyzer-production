#!/data/data/com.termux/files/usr/bin/bash

set +e
ROOT="$(pwd)"
REPORT="rankforge-security-audit-$(date +%Y%m%d-%H%M%S).txt"

{
echo "=============================================="
echo "       RANKFORGE SECURITY / ANTI-PIRACY AUDIT"
echo "=============================================="
echo "Repo: $ROOT"
echo "Date: $(date)"
echo

echo "---- 1. BASIC PROJECT CHECK ----"
[ -f package.json ] && echo "PASS: package.json found" || echo "INFO: no package.json"
find . -maxdepth 2 -type f \
  \( -name "*.html" -o -name "*.js" -o -name "*.ts" -o -name "*.json" \) \
  | wc -l | awk '{print "INFO: source/config files:",$1}'

echo
echo "---- 2. VIDEO / MEDIA REFERENCES ----"
grep -RniE \
  --exclude-dir=.git \
  --exclude="*.min.js" \
  '(video|source[^a-z]|\.mp4|\.m3u8|\.mpd|blob:|MediaSource|videoUrl|video_url|streamUrl|stream_url)' \
  . 2>/dev/null | head -100

echo
echo "---- 3. AUTH / SESSION REFERENCES ----"
grep -RniE \
  --exclude-dir=.git \
  '(Authorization|Bearer |access.?token|refresh.?token|session|login|logout|auth|firebase|supabase)' \
  . 2>/dev/null | head -150

echo
echo "---- 4. SUSPICIOUS HARD-CODED SECRETS ----"
grep -RniE \
  --exclude-dir=.git \
  --exclude='*.min.js' \
  '(api[_-]?key|secret|password|private[_-]?key|client[_-]?secret|token)' \
  . 2>/dev/null \
  | grep -vE '(node_modules|\.git|README|example|placeholder|YOUR_|CHANGE_ME)' \
  | head -100

echo
echo "---- 5. POSSIBLE PUBLIC VIDEO/DOWNLOAD PATHS ----"
grep -RniE \
  --exclude-dir=.git \
  '(download|direct.?download|public/|uploads/|storage/|assets/|media/|lecture)' \
  . 2>/dev/null | head -150

echo
echo "---- 6. SIGNED / EXPIRING URL IMPLEMENTATION ----"
grep -RniE \
  --exclude-dir=.git \
  '(signed.?url|expires|expiry|expiration|presigned|signature|hmac|jwt)' \
  . 2>/dev/null | head -150

echo
echo "---- 7. WATERMARK / SESSION IDENTIFICATION ----"
grep -RniE \
  --exclude-dir=.git \
  '(watermark|user.?id|account.?id|session.?id|device.?id|timestamp)' \
  . 2>/dev/null | head -150

echo
echo "---- 8. SOURCE-MAP / DEBUG EXPOSURE ----"
find . -type f \
  \( -name "*.map" -o -name "*.log" -o -name "*.bak" -o -name "*.backup" \) \
  -not -path './.git/*' 2>/dev/null \
  | head -100

echo
echo "---- 9. GIT / SECRET FILE CHECK ----"
git status --short 2>/dev/null
git ls-files 2>/dev/null | grep -Ei \
  '(^|/)(\.env|.*secret.*|.*credential.*|.*private.*|.*password.*)' \
  | head -100

echo
echo "---- 10. SECURITY HEADERS / CSP REFERENCES ----"
grep -RniE \
  --exclude-dir=.git \
  '(Content-Security-Policy|X-Frame-Options|frame-ancestors|Permissions-Policy|Referrer-Policy)' \
  . 2>/dev/null | head -100

echo
echo "---- 11. DANGEROUS FRONTEND PATTERNS ----"
grep -RniE \
  --exclude-dir=.git \
  '(innerHTML\s*=|eval\s*\(|new Function\s*\(|document\.write\s*\()' \
  . 2>/dev/null | head -100

echo
echo "---- 12. SUMMARY ----"

FILES=$(find . -type f -not -path './.git/*' 2>/dev/null | wc -l)
VIDEO=$(grep -RliE --exclude-dir=.git \
  '(https?://[^"'\'' ]+\.(mp4|m3u8|mpd)|\.mp4|\.m3u8|\.mpd)' . 2>/dev/null | wc -l)
SIGNED=$(grep -RliE --exclude-dir=.git \
  '(signed.?url|presigned|expires|expiration|hmac|jwt)' . 2>/dev/null | wc -l)
AUTH=$(grep -RliE --exclude-dir=.git \
  '(Authorization|Bearer |access.?token|session|login|auth)' . 2>/dev/null | wc -l)

echo "Files scanned          : $FILES"
echo "Video-related files    : $VIDEO"
echo "Signed/auth URL refs   : $SIGNED"
echo "Auth/session refs      : $AUTH"
echo

if [ "$VIDEO" -gt 0 ]; then
  echo "WARNING: Video references detected."
  echo "Review whether lecture URLs require authenticated, expiring access."
else
  echo "INFO: No obvious video URL references found."
fi

if [ "$SIGNED" -gt 0 ]; then
  echo "PASS/REVIEW: Expiry/signature mechanisms appear in source."
else
  echo "WARNING: No obvious signed/expiring URL implementation found."
fi

if [ "$AUTH" -gt 0 ]; then
  echo "PASS/REVIEW: Authentication/session logic detected."
else
  echo "WARNING: No obvious authentication logic detected."
fi

echo
echo "=============================================="
echo "AUDIT COMPLETE"
echo "Report: $ROOT/$REPORT"
echo "=============================================="

} | tee "$REPORT"

echo
echo "Done. Report saved as:"
echo "$ROOT/$REPORT"
