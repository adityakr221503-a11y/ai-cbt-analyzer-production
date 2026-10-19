# RankForge Lecture Security

This is a security architecture scaffold, not a video-hosting implementation.

It intentionally does NOT:
- bypass DRM
- extract protected videos
- defeat screen-recording protection
- expose private video URLs
- modify existing PDF/CBT modules

Before production, connect the server contract to an authenticated backend
and a video/CDN provider supporting expiring playback authorization.
