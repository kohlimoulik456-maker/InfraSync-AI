# InfraSync-AI — Supervisor Mobile App (Flutter)

Talks to the **same backend APIs and PostgreSQL database** as the Next.js web app.
No API keys live in this app — Gemini calls happen only on the Next.js server.

## Screens
- Supervisor entry (Supervisor_ID + Project selector)
- Text Update — fully functional, calls `POST /api/supervisor/text-update`
- Excel Upload — fully functional, calls `POST /api/supervisor/excel-upload`
- Voice Update / Scan Site Diary — Coming Soon dialogs only (no mic/camera access, no API calls)

## Setup
```bash
cd mobile
flutter pub get
flutter run --dart-define=INFRASYNC_API_BASE_URL=http://10.0.2.2:3000
```

- `10.0.2.2` is how the Android emulator reaches your machine's `localhost`. On iOS
  simulator use `http://localhost:3000`. On a physical device, use your machine's
  LAN IP or a deployed backend URL.
- Make sure the Next.js dev server (`npm run dev` in the project root) is running first.

## Notes
- File picking for Excel Upload uses `file_picker` and supports `.xlsx` / `.csv`.
- This scaffold intentionally mirrors the web app's MVP scope: only Text Update and
  Excel Upload are wired to the backend; Voice and Scan Diary are stubs.
