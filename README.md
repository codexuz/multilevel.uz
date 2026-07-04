# Multilevel — English Exam Prep Platform

A full CEFR/Multilevel English exam platform built with **Nuxt 4**, **Nuxt UI 4** and
**Supabase**. It supports the four exam skills — Listening, Reading, Writing and
Speaking — with an admin authoring panel, auto-graded objective sections, manual
examiner grading, premium subscriptions, and a live random speaking-partner call
over WebRTC.

## Features

- **Google sign-in** (Supabase Auth).
- **Roles**: `student`, `examiner`, `admin`.
- **Admin authoring** (`/admin`): build tests → sections → parts → questions of every
  type (single/multiple choice, gap-fill, A–J dropdown match, essay, speaking prompt),
  upload audio/images, publish, and mark tests premium.
- **Exam runner** (`/exam/:attemptId`): real countdown timers with a one-minute
  warning, answer autosave, listening audio, reading passages side-by-side, essay word
  counts, and in-browser speaking recordings.
- **Auto-grading**: Listening & Reading scored server-side on submit (correct answers
  never reach the client). Writing & Speaking go to the examiner grading queue.
- **Examiner grading** (`/admin/grading`): review essays and play speaking recordings,
  award points per task, leave feedback.
- **Premium gating**: `tests.is_premium` + `subscriptions`; premium tests are locked
  behind an active subscription (enforced in the server `attempts/start` endpoint).
- **Live speaking** (`/speaking/live`): random peer matchmaking + WebRTC audio call,
  signaling over Supabase Realtime.
- **File storage**: AWS S3-compatible bucket via presigned uploads (not Supabase Storage).

## One-time setup

### 1. Install & env

```bash
pnpm install
cp .env.example .env   # then fill in the values
```

`.env` keys:

| Key | Where to get it |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_KEY` | Supabase → Project Settings → API (URL + anon key) |
| `SUPABASE_SERVICE_KEY` | Supabase → API → service_role key (server only) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` | Your S3-compatible provider |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | S3 credentials |
| `S3_PUBLIC_URL` | Public base URL objects are served from (no trailing slash) |

### 2. Database

In the Supabase SQL editor, run:

1. `supabase/migrations/0001_init.sql` — tables, enums, RLS, triggers, `has_active_premium()`.
2. `supabase/seed/sample_test.sql` — a published sample test covering every question type (optional but recommended).

### 3. Google auth

Supabase → Authentication → Providers → **Google**: enable it and set the authorized
redirect to `<your-app-origin>/confirm` (e.g. `http://localhost:3000/confirm`).

### 4. S3 CORS

Allow `PUT` (and `GET`) from your app origin on the bucket so presigned browser
uploads succeed, e.g.:

```json
[{ "AllowedOrigins": ["http://localhost:3000"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["*"] }]
```

### 5. Promote staff

New users default to `student`. Promote yourself in the SQL editor:

```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

Admins can then manage roles and grant premium from `/admin/users`.

## Development

```bash
pnpm dev        # http://localhost:3000
pnpm lint       # eslint
pnpm typecheck  # vue-tsc
pnpm build      # production build
```

## Architecture notes

- **Correct answers stay server-side.** The `questions` table is staff-only under RLS;
  students read the security-definer `student_questions` view, which omits
  `correct_answer` and is limited to published tests. Grading happens in
  `server/api/attempts/[id]/submit.post.ts` with the service-role client.
- **Types**: `app/types/database.types.ts` is hand-maintained to match the migration.
  Regenerate with the Supabase CLI (`supabase gen types typescript`) if you prefer.
- **Key composables**: `useProfile`, `useSubscription`, `useTestBuilder`, `useExamTimer`,
  `useRecorder`, `useS3Upload`, `useWebRTC`.
