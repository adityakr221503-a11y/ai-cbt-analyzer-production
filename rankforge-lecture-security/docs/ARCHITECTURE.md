# RankForge Lecture Security

Target flow:

Student
  ↓
Login / authenticated session
  ↓
POST /api/lectures/:id/play
  ↓
Server checks subscription + lecture entitlement
  ↓
Server creates short-lived playback authorization
  ↓
CDN / video provider validates authorization
  ↓
Player receives temporary playback access
  ↓
Visible user/session watermark

Security requirements:

1. No permanent public lecture URLs in HTML/JS.
2. No signing secrets in frontend code.
3. Every playback request requires authentication.
4. Server verifies that the account owns the lecture entitlement.
5. Playback authorization expires quickly.
6. Concurrent-session limits are enforced server-side.
7. Watermark includes an account/session identifier.
8. Compromised sessions can be revoked.
9. Video storage itself must not be publicly readable.
10. PDF/CBT modules remain independent from this lecture layer.
