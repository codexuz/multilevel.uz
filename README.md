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
- **Full tests or one part at a time.** `/tests` lists full tests or single parts (Listening and
  Reading parts, Writing tasks, Speaking parts), filtered by words, skill, part, question type and
  "all four skills"; the filters live in the address. A part is sat at
  `/tests/{slug}/{skill}?part=N`, with its own share of the time, and saved as that part.
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
  the first migration (prices are a starting guess). A plan gives days of Premium, credits, or both.
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

### AI feedback on Writing

With `OPENAI_API_KEY` set, Writing gets a **Get AI feedback** button: on the practice screen
after writing, and on a handed-in Writing's result while it waits for an examiner. OpenAI's
`gpt-6-luna` (a low-cost reasoning model; `AI_FEEDBACK_MODEL` and `AI_FEEDBACK_EFFORT` change the
model and its reasoning effort, `medium` by default) rates
each task on task achievement, organisation, vocabulary and grammar (0–5, anchored to CEFR),
lists the corrections that matter most and rewrites one sentence a level up; the score out of 75
is worked out from those marks (Task 1.1 counts 20%, Task 1.2 30%, Task 2 50%) and is shown as an
estimate. The answer is structured output checked against a schema, and the essays are not stored
by OpenAI (`store: false`). It runs in the background (`ai_reviews`); the page waits for it, and a Telegram message
says when it is ready. Without Premium a user gets `AI_FEEDBACK_FREE_PER_MONTH` (2) a month, with
Premium `AI_FEEDBACK_PREMIUM_PER_DAY` (10) a day; staff have no limit; failed ones do not count.

### Sharing results

A scored result has **Share result**: a 1200×630 picture ("Aziz scored 58/75, B2 in Multilevel
Reading", with the sharer's invite link), sent to Telegram, the phone's share sheet, copied, or
saved. The link opens `/share/<token>`, whose preview is the picture and whose button takes the
friend to the same test through the invite link. Links are signed with `JWT_ACCESS_SECRET`, so
only results their owner shared can be opened. The picture is drawn on the server (satori +
sharp) with the Roboto files in `server/assets/fonts` (SIL Open Font License).

### Telegram messages

The bot tells users when their Writing or Speaking is marked, when their AI feedback is ready, and
when an invite earns them credits, with a button back to the page. They can turn this off in
Settings.

A signed-in user who has not joined the bot gets a popup a few seconds into the app (at most once
every three days; "Not now" waits that long): **Join the bot** opens
`t.me/<bot>?start=<signed code>`, and pressing Start there connects their Telegram to their
account (also for Google accounts) and marks them as joined; the popup closes by itself. Settings
has the same button. Blocking the bot marks them as not joined again.

For this the server sets the bot's webhook to `<site>/api/telegram/webhook` when it starts (only
with an https `NUXT_PUBLIC_SITE_URL`; Telegram's calls carry a secret made from the bot token). Set
`TELEGRAM_WEBHOOK=false` if the same bot's webhook is used by something else.

### Earning credits

Besides buying Premium, a user can open single Premium tests with **credits** they earn (not to be
confused with marking credits, shown as "Markings"). One credit opens one Premium test for good;
the test page offers it when they have enough. `/earn` shows the balance, the invite link and the
tasks.

- **Invite friends**: each user's link is `https://multilevel.uz/r/<code>`. A friend who opens it
  and makes an account within 30 days on that device starts with `REWARD_REFERRED_CREDITS` (1);
  the inviter gets `REWARD_REFERRER_CREDITS` (2) when that friend finishes their first test, at
  most `REFERRAL_MONTHLY_CAP` (30) friends in 30 days, so made-up accounts do not pay.
- **Join the Telegram channel**: set `TELEGRAM_CHANNEL=@yourchannel` and make the sign-in bot
  (`TELEGRAM_BOT_TOKEN`) an **admin of the channel** (it only needs to see members). The user
  joins, presses "I've joined — check", and the bot confirms they are in it:
  `REWARD_TELEGRAM_CHANNEL_CREDITS` (1), once. Their account needs Telegram linked; the page
  offers to connect it.
- `TEST_UNLOCK_CREDITS` (1) is what one test costs. Set any reward to `0` to turn it off.

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
npm run db:migrate     # creates the tables (the server also does this when it starts)
npm run db:seed        # optional: loads examples/multilevel-practice-test-1.json, published
npm run dev            # http://localhost:3000
```

`.env.example` lists every key. In short: `DATABASE_URL`, the JWT secrets,
`NUXT_SESSION_PASSWORD`, the Google OAuth client (redirect URI `<origin>/auth/google`),
optionally a Telegram bot for signing in with Telegram (`TELEGRAM_BOT_TOKEN`),
S3-compatible storage (`S3_*`; uploads are stored public-read, so the bucket must allow
public objects), `NUXT_PUBLIC_SITE_URL` (used in the sitemap and canonical links) and,
optionally, Firebase for push.

### Signing in

Google, Telegram, or both: each button shows only when it is set up.

- **Google**: `NUXT_OAUTH_GOOGLE_CLIENT_ID` / `NUXT_OAUTH_GOOGLE_CLIENT_SECRET`, with the redirect
  URI `<origin>/auth/google`.
- **Telegram**: create a bot with [@BotFather](https://t.me/BotFather) (`/newbot`), then
  `/setdomain` → your site's domain (e.g. `multilevel.uz`), and set `TELEGRAM_BOT_TOKEN`.
  Telegram's own window asks the user to confirm; the server accepts the result only if
  Telegram signed it with that bot's token, within a day. Telegram gives no email, so such an
  account is known by its Telegram id and username. A Google user can add Telegram on their
  Profile (Sign-in → Connect) to sign in either way. Telegram only allows the domain set in
  BotFather, so it cannot be tried on `localhost`; use a tunnel or the live site.

### Admins

New users are students. To make someone an admin:

- **On deploy**: list them in `ADMIN_EMAILS` (Google emails) or `ADMIN_TELEGRAM_IDS` (numeric
  Telegram ids; [@userinfobot](https://t.me/userinfobot) tells you yours), comma-separated.
  They become admins the next time they sign in. Nobody is demoted by leaving the list.
- **In the database** (for example from Coolify's terminal for the Postgres service, `psql`),
  after they have signed in once:

  ```sql
  update users set role = 'admin' where email = 'you@example.com';
  update users set role = 'admin' where telegram_username = 'yourname';
  ```

  Then they sign out and in again (the role is part of the sign-in token).
- **In the app**: an admin can change anyone's role on `/admin/users`.

## Database migrations

Migrations live in `server/database/migrations` and are applied when the server starts
(`server/plugins/migrate.ts`), so a deploy brings the database up to date by itself: whatever
has not run yet runs, in order, in one transaction, and requests wait until it is done. If a
migration fails, the server exits, the deploy's health check fails, and the old version keeps
running.

To change the schema, edit `server/database/schema.ts`, run `npm run db:generate`, review the
new SQL file, and commit it with the code that needs it. Never edit a migration that has been
deployed; add a new one.

- `DB_MIGRATE=false` turns migrating on start off (then run `npm run db:migrate` yourself).
- A database that already has tables but none of this app's migrations is refused. Use an empty
  database, or set `DB_DROP_LEGACY_TABLES=true` for one deploy to drop everything in it and start
  fresh (it does nothing once the first migration is recorded; remove it afterwards).

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
