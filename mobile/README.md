# InfraSync-AI — Supervisor Mobile App (Flutter)

Talks to the **same backend APIs and PostgreSQL database** as the Next.js web app.
No API keys live in this app — Gemini calls happen only on the Next.js server.

## Screens

## Setup
```bash
cd mobile
flutter create .
flutter pub get
flutter run --dart-define=INFRASYNC_API_BASE_URL=http://10.0.2.2:3000
```

The local development API key defaults to `local-dev-mobile-key`. Override it
with `--dart-define=INFRASYNC_API_KEY=...` when using a different backend key.
When running in Chrome, the default Android emulator host is automatically
mapped to `http://localhost:3000`.

Run `flutter create .` once from this directory if the `android/`, `ios/`, or
other platform runner folders are not present yet. It preserves the existing
`lib/` application code and generates the native Flutter project files.

  simulator use `http://localhost:3000`. On a physical device, use your machine's
  LAN IP or a deployed backend URL.

## Notes
  Excel Upload are wired to the backend; Voice and Scan Diary are stubs.

## Run on a physical phone

Connect the phone and Mac to the same Wi-Fi network. Start the backend so it
accepts LAN connections:

```bash
cd ..
npm run dev -- --hostname 0.0.0.0
```

Then connect the phone by USB, enable developer mode, and run from `mobile`:

```bash
flutter devices
flutter run -d <phone-id> \\
  --dart-define=INFRASYNC_API_BASE_URL=http://10.25.45.50:3000 \\
  --dart-define=INFRASYNC_API_KEY=local-dev-mobile-key
```

If the phone is not listed, use Android Studio with USB debugging enabled or
Xcode with the iPhone trusted and configured for development.
