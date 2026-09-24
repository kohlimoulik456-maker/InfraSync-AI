# Supabase Setup for InfraSync-AI

This app already uses Prisma to talk to PostgreSQL. Supabase provides hosted
PostgreSQL, so we do not need to rewrite the app or replace Prisma.

## What Supabase does

- Supabase stores the projects, schedules, supervisor updates, audits, and
  dashboard data in a hosted PostgreSQL database.
- Prisma remains the code layer that reads and writes that database.
- GitHub stores the code. Supabase stores the application data. They are
  separate services.

## Create the database

1. Open [supabase.com](https://supabase.com) and sign in with GitHub.
2. Create a new project named `infrasync-ai`.
3. Set a strong database password and keep it private.
4. Wait until the project finishes provisioning.
5. Open **Connect** in the Supabase project dashboard.

## Configure the app

Copy the two PostgreSQL connection strings from Supabase into the local `.env`
file. Do not paste them into source files or commit them to GitHub.

```env
DATABASE_URL="the Transaction Pooler URL from Supabase"
DIRECT_URL="the Direct connection URL from Supabase"
```

Use the **Transaction Pooler** URL for `DATABASE_URL` because the running Next.js
app may create many short database connections. Use the **Direct connection**
URL for `DIRECT_URL` because Prisma migrations need a direct database session.

If Supabase gives a URL with a password containing special characters, keep the
password URL-encoded. For example, `@` becomes `%40`.

## Create the tables

From the `infrasync-ai` folder, run:

```bash
npx prisma migrate deploy
npx prisma generate
```

This creates the tables described in `prisma/schema.prisma` inside Supabase.

## Add demo data

To add the sample project and schedule activities:

```bash
npm run seed
```

The command is safe to repeat for the seeded project. It runs through the same
backend pipeline used by the app.

## Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click the intro screen,
and sign in with the credentials configured in `.env`.

## When deploying

Add these values to the deployment provider's environment-variable settings:

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `AUTH_API_KEY`
- `AUTH_API_ROLE`
- The configured authentication usernames and passwords
- `GEMINI_API_KEY` and `GEMINI_MODEL`

Never commit `.env` or paste database passwords into GitHub. The repository
already ignores `.env`; `.env.example` contains placeholders only.

## How to know it worked

Run:

```bash
npx prisma validate
npx prisma migrate deploy
npm run seed
```

Then open the Program Manager page. The projects and dashboard records should
come from Supabase instead of the local PostgreSQL server.

## Recovering projects from the old local database

The repository includes a safe Prisma transfer utility. It preserves project
IDs and related activities, updates, actuals, AI matches, funds, and lessons,
and skips records that already exist in Supabase.

```bash
SOURCE_DATABASE_URL="your-old-local-postgres-url" \
TARGET_DATABASE_URL="$DATABASE_URL" \
npm run migrate-local-to-supabase
```

This utility never deletes Supabase records. It copies the old local data into
the hosted database, so both the old and new projects remain available.