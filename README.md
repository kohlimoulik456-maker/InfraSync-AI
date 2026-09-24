# InfraSync-AI

**From field updates to verified schedule actuals.**

An AI-powered infrastructure project-progress platform. Program Managers import a
baseline schedule (Excel/CSV, standing in for Primavera/MS Project exports in this
MVP); Supervisors submit field progress via Text or Excel; Gemini Flash extracts
structured facts; a transparent, backend-computed confidence score decides whether
an update is auto-applied to the schedule or routed to a Program Manager review
queue with a full audit trail.

## Stack

- **Web**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Recharts + lucide-react
- **Mobile**: Flutter, in `/mobile`, calling the same REST APIs and database
- **Backend**: Next.js Route Handlers (Node.js/TypeScript), REST
- **Database**: PostgreSQL + Prisma ORM
- **LLM**: Gemini Flash (server-side only; falls back to a deterministic **Demo AI Mode**
  when no API key is configured)

## Project layout

```
app/                 Next.js pages + API routes (app/api/**)
lib/
  gemini/            Gemini service abstraction + prompt files + demo-mode mocks
  inputProcessors/   textProcessor, excelProcessor (functional), voice/diary (stubs)
  services/          confidence scoring, candidate retrieval, audit, dashboard, etc.
  types.ts           Shared types (normalized input, extraction, audit JSON, ...)
prisma/
  schema.prisma      The six required tables
  seed.ts            Seeds REFINERY-A-2026 with 12 activities + 5 test updates
components/          Shared UI (status chips, Coming Soon modal, toasts, PM nav)
mobile/              Flutter supervisor app (see mobile/README.md)
```

## 1. Prerequisites

- Node.js 18+
- A PostgreSQL database (local, Docker, or hosted e.g. Neon/Supabase/RDS)
- (Optional) A Gemini API key — the app runs fully in **Demo AI Mode** without one

## 2. Setup

```bash
npm install
cp .env.example .env
# edit .env:
#   DATABASE_URL=postgresql://user:password@localhost:5432/infrasync
#   DIRECT_URL=postgresql://user:password@localhost:5432/infrasync
#   GEMINI_API_KEY=            (leave blank to use Demo AI Mode)
#   GEMINI_MODEL=gemini-1.5-flash
#   AUTH_SECRET=               (long random secret used to sign sessions)
#   AUTH_MANAGER_USERNAME=manager
#   AUTH_MANAGER_PASSWORD=     (strong password)
#   AUTH_SUPERVISOR_USERNAME=supervisor
#   AUTH_SUPERVISOR_PASSWORD=  (strong password)

npx prisma migrate dev --name init
npm run seed
npm run dev
```

### Supabase Postgres

The app uses Prisma for all database access, so Supabase connects as the hosted
PostgreSQL database without changing the application queries. In the Supabase
dashboard, open **Connect** and copy:

- The **Transaction Pooler** URL into `DATABASE_URL` for the running app.
- The **Direct connection** URL into `DIRECT_URL` for Prisma migrations.

Keep both values only in `.env` or your deployment secret manager. Never commit
them to GitHub. After setting them, run:

```bash
npx prisma migrate deploy
npm run seed
```

Open http://localhost:3000/login and sign in with one of the configured accounts.
Manager accounts can use project management, audit, and institutional-memory
features. Supervisor accounts can submit field updates. All API routes require
an authenticated session.

For the Flutter client, configure the optional bearer token in `.env` with
`AUTH_API_KEY`, then run:

```bash
flutter run --dart-define=INFRASYNC_API_BASE_URL=http://10.0.2.2:3000 \
  --dart-define=INFRASYNC_API_KEY=your-api-key
```

## 3. Demo AI Mode vs live Gemini

- If `GEMINI_API_KEY` is empty, every extraction/rerank/institutional-memory call
  uses deterministic mock logic in `lib/gemini/demoResponses.ts`, tuned to the five
  seeded example inputs (see below). A "Demo AI Mode" badge is shown in the UI, and
  the app never claims Gemini processed the update.
- If `GEMINI_API_KEY` is set, the app calls Gemini Flash live via
  `@google/generative-ai`, validates the JSON response against the expected shape,
  and retries once with a repair instruction before falling back to
  `INVALID` / `FLAG_FOR_REVIEW` with reason "LLM structured extraction failed
  validation."
- `GEMINI_MODEL` is read from the environment and never hard-coded.

## 4. Seed data

`npm run seed` creates project `REFINERY-A-2026` with 12 schedule activities across
Civil, Piping, Electrical, Mechanical, Instrumentation and HSE, and runs 5 test
supervisor updates through the **real pipeline** (using Demo AI Mode if no API key
is set):

1. "Piping crew started erection of Line 24-A spool at Rack 3 today at 9 AM. Six
   workers deployed." → expected `PIP-BLK-A-001`, high confidence, `AUTO_ACCEPT`
2. "Spool work completed in Pipe Rack." → expected `FLAG_FOR_REVIEW` with top-3
   candidates (ambiguous)
3. "Concrete pour for Foundation F-12 completed today. Quantity 45 m3." → expected
   `CIV-BLK-A-012`
4. "Cable pulling for C-305 completed in Utility Area." → expected `ELEC-U1-018`
5. "Work done." → expected `NO_MATCH` / `FLAG_FOR_REVIEW`, no automatic update

Re-running `npm run seed` is idempotent for the project/activities (upsert), but
will insert the 5 test updates again each time (useful for demoing repeatedly;
delete `ai_activity_matches`/`supervisor_updates` rows if you want a clean queue).

## 5. Running the mobile app

See `mobile/README.md`. Quick start:

```bash
cd mobile
flutter pub get
flutter run --dart-define=INFRASYNC_API_BASE_URL=http://10.0.2.2:3000
```

## 6. MVP limitations (intentional)

- **Voice Update** and **Scan Site Diary** are visible in both apps but show a
  "Coming Soon" dialog only — no microphone/camera access, no backend calls, no
  fake transcripts or audits are ever generated for them.
- Schedule import supports **.xlsx/.csv only** — no live Primavera P6 API sync or
  XER/XML parsing (this is explicitly noted in the Start New Project screen).
- Candidate matching uses fuzzy/token-overlap similarity plus keyword overlap
  (`lib/services/confidenceService.ts`); it is deliberately simple and fully
  deterministic/unit-testable rather than embedding-based. `pgvector` support is
  optional infrastructure for a future upgrade and is not required for MVP.
- The "Critical / At-Risk" dashboard section uses transparent rule-based flags
  (planned finish passed, predecessor incomplete, pending audit, etc.) and does not
  claim a full CPM critical-path engine.
- Institutional Memory only ever reads **verified `activity_actuals`** and
  **manager-approved `lessons_learned`** — it is advisory-only and never
  auto-modifies an uploaded schedule.

## 7. Key API routes

| Route | Purpose |
|---|---|
| `GET /api/projects` | List projects with computed stats |
| `POST /api/projects/import` | Create project + import baseline schedule (multipart) |
| `GET /api/projects/:projectId` | Project detail + filter metadata |
| `GET /api/templates/schedule` / `schedule-sample` | Schedule format / sample downloads |
| `GET /api/templates/supervisor` / `supervisor-sample` | Supervisor update format / sample downloads |
| `POST /api/supervisor/text-update` | Process one text update through the AI pipeline |
| `POST /api/supervisor/excel-upload` | Process every row of an uploaded file independently |
| `POST /api/supervisor/voice`, `/diary-scan` | Stubs — always return `COMING_SOON` |
| `GET /api/audit` | AI Audit Queue list with filters |
| `GET/POST /api/audit/:matchId` | Audit detail + manager actions (approve/override/unmatch/reject) |
| `GET /api/dashboard/:projectId` | All dashboard sections, computed from the database |
| `POST /api/institutional-memory/query` | Natural-language query over verified records |
| `GET/POST /api/institutional-memory/lessons` | List/approve draft lessons |

## 8. Confidence formula (backend-computed, never LLM-guessed)

```
overall_confidence =
  0.40 * semantic_similarity +
  0.25 * schedule_consistency +
  0.20 * context_match +
  0.15 * rule_validation
```

Thresholds: ≥90 → `AUTO_ACCEPT`, 80–89.9 → `ACCEPT_MONITOR`, 60–79.9 →
`FLAG_FOR_REVIEW` (ambiguous), <60 → `NO_MATCH`. A top-two-candidate gap under 10
points forces `AMBIGUOUS`/`FLAG_FOR_REVIEW` regardless of the top score. See
`lib/services/confidenceService.ts` for the full, unit-testable implementation.
