# Android build

This project is prepared for Capacitor Android wrapping.

1. Install Node.js and Android Studio on a computer.
2. In this folder run `npm install`.
3. Run `npx cap add android` (only once).
4. Run `npx cap sync android`.
5. Run `npx cap open android`.
6. In Android Studio choose Build > Build APK(s).

The web app remains the source of truth, so CBT/PDF/mistake/history pages stay bundled in the Android WebView.
