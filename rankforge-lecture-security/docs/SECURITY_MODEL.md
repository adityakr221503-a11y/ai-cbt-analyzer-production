# RankForge Lecture Security Model

Current Lecture Module = learning metadata + AI learning flow.

Future paid lecture flow:

Login
-> authenticated session
-> server authorization
-> short-lived signed token
-> protected streaming endpoint
-> player
-> session watermark

Required:
- API keys server-side only
- short-lived stream tokens
- user/session/lecture binding
- session limits
- session revocation
- server-side authorization
- access logging
- suspicious-session detection
- watermarking
- protected CDN/streaming
- DRM where commercially required

Signed URLs are access-control primitives, not DRM.
