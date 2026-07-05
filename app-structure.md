# Migrate off Supabase → Postgres + Drizzle + JWT auth + Firebase push, redesign live speaking

## Context

The app was built on `@nuxtjs/supabase` for three things: **auth** (Google), the
**data layer** (client-side queries protected by Postgres RLS), and **realtime**
(WebRTC signaling over Supabase Realtime). The user wants Supabase removed entirely and
replaced with:

- **Stateless JWT auth** (access + refresh) with Google OAuth login. Refresh tokens are
  DB-backed per **device** (user-agent + **IP address** stored); a **blacklist** revokes
  tokens on logout / remote-logout. We own the users table.
- **A separate/local PostgreSQL** accessed with **Drizzle ORM** (over the `postgres`
  driver). Fresh data; we ship Drizzle migrations + a seed.
- **Firebase Cloud Messaging** push (incoming speaking call, grading done), per-device tokens.
- **Onboarding + gamification**: capture each user's current level, English-learning
  duration, and target (A1–C1 or 0–75) on first login; track **streak**, **points**, and
  **coins** (coins can be spent to unlock premium); a **leaderboard** ranks users by points;
  a profile view shows past attempts/results.
- **Redesigned live speaking**: an online-users presence list you can **call directly**,
  a **random call**, and **create-a-room → shareable URL** to join. Signaling moves from
  Supabase Realtime to a built-in **Nitro WebSocket** (`crossws`, already present).

Because RLS disappears, **all data access must move to authorized server API routes**;
pages currently query Supabase directly on the client and will switch to `$fetch`/`useFetch`.

### Prerequisites the user provides
- `DATABASE_URL` for the Postgres instance (e.g. local Docker `postgres`).
- Google OAuth client: `NUXT_OAUTH_GOOGLE_CLIENT_ID`, `NUXT_OAUTH_GOOGLE_CLIENT_SECRET`
  (redirect URI `<origin>/auth/google`).
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (≥32 chars each).
- Firebase: service account (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`) + web config (`NUXT_PUBLIC_FIREBASE_*`) + Web Push VAPID key.
- S3 vars stay (storage layer is unchanged).

## Dependencies
- **Add**: `drizzle-orm`, `postgres`, `jose` (JWT), `firebase-admin` (push send),
  `firebase` (client FCM); `nuxt-auth-utils` used **only** for its
  `defineOAuthGoogleEventHandler` OAuth handshake — we mint our own JWTs in `onSuccess`
  and never use its sessions. dev `drizzle-kit`.
- **Remove**: `@nuxtjs/supabase` (module + dep). `@prisma/nuxt` is unused — leave or drop.
- Keep `@aws-sdk/*` (S3).

## nuxt.config / env
- Modules: drop `@nuxtjs/supabase`, add `nuxt-auth-utils`. Remove the `supabase` block.
- `runtimeConfig`: keep S3; add `jwtAccessSecret`, `jwtRefreshSecret`, `oauth.google.*`,
  Firebase admin creds; `public.firebase*` web config + VAPID key. New `.env.example`
  without `SUPABASE_*`.

## Data layer (Drizzle)
- `server/database/schema.ts` — tables mirroring today's schema, minus RLS/views:
  `users` (id uuid, email unique, name, avatar_url, role enum, timestamps — replaces
  `profiles`/`auth.users`; plus **onboarding** `current_level` (A1–C1), `learning_duration`,
  `target_level`/`target_score` (0–75), `onboarded` bool; plus **gamification** `points`
  int, `coins` int, `streak_count` int, `last_activity_date` date),
  `transactions` (user_id, currency `points|coins`, delta int, reason, created_at — ledger
  for earns/spends incl. premium unlock), `subscriptions`, `tests`, `sections`, `parts`,
  `questions`
  (keeps `correct_answer`), `attempts`, `answers`, `speaking_rooms`, plus auth tables:
  `sessions` (id = refresh-token jti, user_id, user_agent, device_label, **ip_address**,
  `fcm_token` nullable, created_at, last_seen_at, revoked_at, expires_at) and
  `revoked_tokens` (jti, expires_at — the access-token **blacklist**). Drop
  `speaking_queue` and `student_questions` (matchmaking + answer-hiding now in server code).
- `server/utils/db.ts` — a singleton `drizzle(postgres(DATABASE_URL))`.
- `drizzle.config.ts` + `server/database/migrations/`. Scripts in package.json:
  `db:generate`, `db:migrate`, `db:seed`.
- `server/database/seed.ts` — ports `supabase/seed/sample_test.sql` (one published
  sample test, all question types).

## Auth (JWT + refresh + devices + blacklist)
- `server/utils/jwt.ts` — `jose` sign/verify. **Access** JWT (~15 min): `{ sub, role, jti }`.
  **Refresh** JWT (~30 d): `{ sub, sid }` where `sid` = the `sessions` row id. Both set as
  httpOnly, secure, sameSite cookies (`at`, `rt`).
- `server/routes/auth/google.get.ts` via `defineOAuthGoogleEventHandler` → upsert user by
  email; create a `sessions` row capturing **user-agent + IP** (`getRequestIP`); mint
  access+refresh cookies; redirect to `/dashboard`. (No nuxt-auth-utils session used.)
- `server/api/auth/refresh.post.ts` — verify refresh cookie, load `sessions` row (not
  revoked, not expired), rotate access (and refresh), update `last_seen_at`/`ip_address`.
- `server/api/auth/logout.post.ts` — blacklist current access `jti` in `revoked_tokens`,
  revoke the `sessions` row, clear cookies.
- `server/api/auth/sessions` — `GET` list my devices (device_label, ip, last seen, current
  flag); `DELETE /api/auth/sessions/[id]` remote-logout a device (revoke + blacklist).
- `server/utils/auth.ts` (rewritten) — `requireUser(event)`: read `at` cookie/Bearer,
  verify JWT, reject if `jti` is blacklisted, return `{ id, role }`. `requireStaff`,
  `requireAdmin`.
- Client: `app/plugins/auth-refresh.ts` — an `$fetch`/ofetch `onResponseError` interceptor
  that on 401 calls `/api/auth/refresh` once and retries. `useMe()` → `useFetch('/api/me')`
  (replaces `useProfile`); `useSubscription()` → `/api/me/subscription`. Middleware
  `auth.global.ts`/`staff.ts`/`admin.ts` gate via `/api/me` (SSR-cookie aware).
- Pages: `login.vue` button links to `/auth/google`; add a **devices** panel (list/
  revoke) under a `/settings` page. Delete `confirm.vue`.

## Server API (replaces every client Supabase query)
Thin handlers over repository functions in `server/database/repos/*`. Grouped:
- **me**: `GET /api/me`, `GET /api/me/subscription`, `GET /api/me/attempts` (history),
  `POST /api/me/onboarding` (level/duration/target → set + `onboarded=true`),
  `POST /api/me/redeem-premium` (spend coins → create a `subscriptions` row + ledger),
  `POST /api/me/fcm-token` (register the caller's FCM token onto their current session).
- **leaderboard**: `GET /api/leaderboard` (top users by points; includes rank, streak, level).
- **tests (student)**: `GET /api/tests`, `GET /api/tests/[id]` (sections + my attempts).
- **attempts**: `POST /api/attempts/start` (premium gate), `GET /api/attempts/[id]`
  (section + parts + questions **without `correct_answer`** + saved answers),
  `POST /api/attempts/[id]/answer`, `POST /api/attempts/[id]/submit` (auto-grade
  listening/reading via `server/utils/grade.ts`, then **award points, update streak**, and
  write ledger rows), `GET /api/attempts/[id]/result`.
- **admin**: `GET /api/admin/stats`; tests CRUD `GET/POST /api/admin/tests`,
  `GET/PATCH/DELETE /api/admin/tests/[id]`; sections/parts/questions CRUD; grading
  `GET /api/admin/grading`, `GET/POST /api/admin/grading/[id]`; users
  `GET /api/admin/users`, `PATCH /api/admin/users/[id]/role`,
  `POST/DELETE /api/admin/users/[id]/subscription`.
- **storage**: `POST /api/storage/presign` — unchanged logic, auth via session.

Reuse `server/utils/grade.ts` and `server/utils/s3.ts` as-is.

## Gamification (`server/utils/gamify.ts`)
- `awardForAttempt(userId, score)` — points += f(score); update `streak_count`
  (increment if `last_activity_date` was yesterday, keep if today, else reset to 1), set
  `last_activity_date=today`; grant coins on milestones; append `transactions` rows. Called
  from `attempts/[id]/submit`.
- `redeemPremium(userId)` — atomically check/deduct a fixed coin cost, insert a
  `subscriptions` row, write a spend ledger row. Called from `me/redeem-premium`.

## Push notifications (Firebase FCM)
- `server/utils/firebase.ts` — init `firebase-admin` from the service-account env; export
  `sendPush(userIds, { title, body, data })` that looks up non-revoked `sessions.fcm_token`
  for those users and `messaging().sendEachForMulticast(...)`, pruning dead tokens.
- Client: `app/plugins/fcm.client.ts` + `useFcm()` — init the Firebase web SDK from
  `public.firebase*`, request permission, get the token (VAPID key), POST it to
  `/api/me/fcm-token`, and handle foreground messages (toast). `public/firebase-messaging-sw.js`
  service worker for background notifications.
- Triggers: incoming **speaking call** (notify callee via `sendPush` when they're offline/
  tab inactive) and **grading complete** (notify the student from the grading endpoint).

## Pages refactor (Supabase client → API)
Replace `useSupabaseClient()/useSupabaseUser()` with `useFetch`/`$fetch` + `useMe()` in:
`dashboard.vue`, `tests/index.vue`, `tests/[id].vue`, `exam/[attemptId].vue`,
`results/[attemptId].vue`, `upgrade.vue`, and all `admin/**`. `useTestBuilder.ts` swaps
its direct Supabase CRUD for the `/api/admin/*` endpoints (same method shape, so
`SectionPanel`/`PartEditor`/`QuestionEditor` stay unchanged). Layout `signOut` →
`$fetch('/api/auth/logout')`.

New pages: `onboarding.vue` (level / learning-duration / target form, shown until
`onboarded`; `auth.global` redirects un-onboarded users here), `leaderboard.vue` (ranked
list), `profile.vue` (level/target, streak/points/coins, past attempts from
`/api/me/attempts`), `settings.vue` (devices). Header/dashboard show streak 🔥, points, and
coins; `upgrade.vue` gains a **“Unlock with coins”** action (`/api/me/redeem-premium`).

## Live speaking redesign
- `server/routes/ws/speaking.ts` (`defineWebSocketHandler`): in-memory **presence**
  registry (userId → {name, socket, status}) and **rooms** map. Protocol messages:
  `hello` (register), `presence` (broadcast online list), `call-invite/accept/reject`
  (direct call), `random` (server pairs two available users into a room), `join`/`leave`
  a room, and `signal` relay (offer/answer/ice) addressed by peerId. Single-instance
  (in-memory) — fine for now.
- Client `useSpeakingSocket()` (WebSocket) + `useMeshCall()` — manages a **map** of
  `RTCPeerConnection`s (generalizes the old 1:1 `useWebRTC`), one remote `<audio>` per
  peer; STUN as before.
- Pages: rewrite `speaking/live.vue` (online list + Call buttons, Random call, Create
  room→copy link, incoming-call prompt) and add `speaking/room/[roomId].vue` (join by
  URL). Rooms are small full-mesh (call = 2; shared room = a few participants).
- A `call-invite` also fires `sendPush` to the callee so they're alerted when the tab is
  backgrounded.
- Delete `useWebRTC.ts` (superseded), and `server/api/speaking/match.post.ts`.

## Removal / cleanup
Delete `app/composables/useProfile.ts`, `useSubscription.ts` (replaced), `confirm.vue`,
`server/utils/auth.ts`, `supabase/` (migrations/seed — superseded by Drizzle),
`app/types/database.types.ts` (replaced by Drizzle-inferred types in
`server/database/schema.ts` + a slim `app/types/exam.ts` which stays). Remove the
`SUPABASE_*` lines from `.env`.

## Build order
1. Deps, `.env.example`, nuxt.config (remove supabase, add auth-utils).
2. Drizzle schema (incl. `sessions`/`revoked_tokens`) + `db.ts` + config + migration + seed;
   verify `db:migrate`/`db:seed`.
3. Auth: `jwt.ts`, google handler, refresh/logout/sessions endpoints, `requireUser`,
   refresh interceptor plugin, `useMe`, middleware, login + `/settings` devices page.
4. Server API + repos for me/tests/attempts; refactor student pages.
5. Onboarding + gamification: `gamify.ts`, onboarding/leaderboard/profile pages, redeem-
   premium, streak/points wiring in submit, header stat chips.
6. Admin API + refactor `useTestBuilder`/grading/users pages.
7. Firebase push: `firebase.ts`, `fcm-token` endpoint, client plugin + SW; wire triggers.
8. Live speaking WS + `useMeshCall` + pages (with call push).
9. Delete Supabase remnants; `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## Verification
- Start local Postgres, set `DATABASE_URL`; `pnpm db:migrate && pnpm db:seed`.
- Set Google + JWT secrets; `pnpm dev`; sign in with Google; promote to admin:
  `update users set role='admin' where email='you@…';`.
- Auth: access token expires → interceptor silently refreshes; `/settings` lists this
  device with its IP; remote-logout a device revokes it (its next call 401s, no refresh).
- First login redirects to `/onboarding`; after saving level/duration/target, dashboard
  shows the profile and stat chips (streak/points/coins).
- Author/seed a test → take Listening/Reading → autosave → submit → auto-score on results,
  and points/streak increase; `/leaderboard` ranks you; `/profile` lists the attempt.
- Coins → premium: earn/seed coins, `Unlock with coins` on `/upgrade` creates a
  subscription and a premium test opens.
- Writing/Speaking submit → examiner grading queue → grade → student gets an FCM push +
  sees feedback.
- Premium gate: non-subscriber locked out of a premium test until admin grants a sub.
- Live speaking across two browser profiles: see each other online → direct call connects
  audio (callee gets an FCM push); random call pairs; create room → open shared URL in a
  third profile → joins.
- `pnpm typecheck` and `pnpm lint` clean; `pnpm build` succeeds.
