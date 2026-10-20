# multilevel.uz

Free, open Multilevel (CEFR) English mock tests. Anyone can sit a test; signing in keeps
the results and sends Writing and Speaking to an examiner.

Built with Nuxt 4 (SSR), Nuxt UI, Nitro, Drizzle ORM on PostgreSQL, and JWT cookie auth
with Google sign-in. The tests, the exam screens, the review and the builder follow the
IELTS app and IELTS addon in erp-lms: the same data structure, question types, marking
and `erp-lms/ielts-test` import/export format, set to the Multilevel format.

## What it does

- **Open to everyone.** `/tests` and each test's page `/tests/{slug}` are rendered on the
  server with the test's title, description and structured data (Quiz, BreadcrumbList),
  and listed in `/sitemap.xml`, so search engines show a test when its title is searched.
- **Checked for everyone, saved for members.** Listening and Reading are checked on the
  server when handed in. A guest sees the score, CEFR level and a full review once, and
  nothing is stored. A signed-in candidate's attempt is saved under **My results**.
- **Writing and Speaking.** A guest writes or records for practice: Writing downloads as
  PDF or Word, recordings play back and download; nothing is marked. A signed-in
  candidate hands them in, and an examiner gives a score out of 75 with feedback
  (the candidate is told live and by push).
- **Builder** (`/builder`, admins): Listening parts, Reading passages, Writing tasks and
  Speaking parts in a library, put together into tests section by section. Publishing
  checks the test against the official format; import and export use
  `erp-lms/ielts-test` files (see `examples/multilevel-practice-test-1.json`).
- **Marking** (`/marking`, examiners and admins).

## Free and Premium

| Free | Premium (time) | Marking credits |
| --- | --- | --- |
| Every test marked Free, checked instantly with score, CEFR level and the answer key | Premium tests (their pages stay public and indexed) and the explanations in every review | One Writing or Speaking section marked by an examiner |

- Plans live in the `plans` table and are edited on `/admin/plans`; the first five come from
  migration 0007 (prices are a starting guess). A plan gives days of Premium, credits, or both.
  Buying while Premium runs adds the new days after the current ones; nothing renews by itself.
- Tests are Free or Premium (Builder → test → Details → Access).
- **Click.uz**: set `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID` and `CLICK_SECRET_KEY` (and optionally
  `CLICK_MERCHANT_USER_ID`), and give Click these URLs:
  - Prepare: `https://multilevel.uz/api/billing/click/prepare`
  - Complete: `https://multilevel.uz/api/billing/click/complete`

  Buy then sends the buyer to Click; the plan switches on when Click confirms (signed with the
  secret key, safe to repeat), and `/billing/return` waits for it.
- **Without Click**: Buy opens a Telegram chat with `NUXT_PUBLIC_SALES_TELEGRAM` (the admin's
  account) with the order written out. When they have paid, an admin finds them on
  `/admin/users` and presses **Grant**, which records a paid order with the amount received.
- `/admin/orders` lists every order and this month's revenue.

## The Multilevel format

| Section | Parts | Questions | Time |
| --- | --- | --- | --- |
| Listening | 6 | 35 (1–8, 9–14, 15–18, 19–23, 24–29, 30–35) | ~35 min |
| Reading | 5 | 35 (1–6, 7–14, 15–20, 21–29, 30–35) | 60 min |
| Writing | Task 1.1, Task 1.2, Task 2 (stored as tasks 1–3) | — | 60 min |
| Speaking | Part 1.1, 1.2, 2, 3 (stored as parts 1–4) | — | ~15 min |

Raw Listening and Reading scores convert to 0–75 with the official tables
(`server/utils/score.ts`); CEFR: 65+ C1, 51+ B2, 38+ B1, below that A2 (shown as "Below B1").

## Setup

```bash
npm ci
cp .env.example .env   # fill in the values
npm run db:migrate     # creates the tables
npm run db:seed        # optional: loads examples/multilevel-practice-test-1.json, published
npm run dev            # http://localhost:3000
```

`.env.example` lists every key. In short: `DATABASE_URL`, the JWT secrets,
`NUXT_SESSION_PASSWORD`, the Google OAuth client (redirect URI `<origin>/auth/google`),
S3-compatible storage (`S3_*`; uploads are stored public-read, so the bucket must allow
public objects), `NUXT_PUBLIC_SITE_URL` (used in the sitemap and canonical links) and,
optionally, Firebase for push.

New users are students. Make yourself an admin once:

```sql
update users set role = 'admin' where email = 'you@example.com';
```

Admins manage roles from `/admin/users`.

## Development

```bash
npm run dev        # dev server
npm run lint       # eslint
npm run typecheck  # vue-tsc
npm run build      # production build
```

## Where things are

- `server/database/schema.ts` — users and sessions; tests → sections → section items →
  parts (question groups → question items) / writing tasks / speaking parts (questions);
  attempts with answers, essays and speaking recordings.
- `server/utils/answers.ts` — answer checking, the same as erp-lms.
- `server/utils/content.ts`, `library.ts`, `marking.ts`, `test-file.ts` — papers without
  keys, the builder library, marking and review, import and export.
- `server/api/tests/**` — the open API: the catalogue, a test, a section's paper, and
  handing in (saved only when signed in).
- `server/api/admin/**` — builder, marking, users, plans and orders; `server/api/__sitemap__/urls.ts` —
  the sitemap's test pages.
- `server/utils/billing.ts`, `server/api/billing/**` — access (Premium, credits), Click's Prepare and
  Complete, orders.
- `app/pages/tests/**` — catalogue, test page, sitting a section, result and review.
- `app/components/exam`, `review`, `builder` — shared with the erp-lms IELTS app.
