-- ============================================================================
-- Multilevel Exam Prep Platform — initial schema
-- Run this in the Supabase SQL editor.
-- Storage lives in an external S3-compatible bucket (not Supabase Storage).
-- ============================================================================

-- ---------- Enums -----------------------------------------------------------
create type user_role       as enum ('student', 'examiner', 'admin');
create type test_status     as enum ('draft', 'published');
create type section_type    as enum ('listening', 'reading', 'writing', 'speaking');
create type question_type   as enum (
  'single_choice', 'multiple_choice', 'text_input',
  'dropdown_match', 'essay', 'speaking_prompt'
);
create type attempt_status  as enum ('in_progress', 'submitted', 'graded');
create type sub_plan        as enum ('free', 'premium');
create type sub_status      as enum ('active', 'canceled', 'expired');
create type room_status     as enum ('open', 'active', 'ended');
create type queue_status    as enum ('waiting', 'matched');

-- ---------- profiles --------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  role        user_role not null default 'student',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helpers (security definer to avoid RLS recursion)
create or replace function public.current_role()
returns user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role() in ('examiner', 'admin'), false) $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role() = 'admin', false) $$;

-- ---------- subscriptions ---------------------------------------------------
create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  plan                sub_plan   not null default 'premium',
  status              sub_status not null default 'active',
  current_period_end  timestamptz,
  provider            text,
  provider_ref        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on public.subscriptions (user_id);

create or replace function public.has_active_premium(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and s.plan = 'premium'
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- ---------- tests / sections / parts / questions ----------------------------
create table public.tests (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  level        text,
  status       test_status not null default 'draft',
  is_premium   boolean not null default false,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.sections (
  id                uuid primary key default gen_random_uuid(),
  test_id           uuid not null references public.tests (id) on delete cascade,
  type              section_type not null,
  title             text not null,
  duration_minutes  int not null default 45,
  order_index       int not null default 0,
  audio_url         text,
  created_at        timestamptz not null default now()
);
create index on public.sections (test_id);

create table public.parts (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references public.sections (id) on delete cascade,
  title         text not null,
  instructions  text,
  content       jsonb not null default '{}'::jsonb, -- passage html, match options, etc.
  audio_url     text,
  order_index   int not null default 0,
  created_at    timestamptz not null default now()
);
create index on public.parts (section_id);

create table public.questions (
  id              uuid primary key default gen_random_uuid(),
  part_id         uuid not null references public.parts (id) on delete cascade,
  order_index     int not null default 0,
  question_number int,
  type            question_type not null,
  prompt          text,
  options         jsonb not null default '[]'::jsonb,
  correct_answer  jsonb,  -- HIDDEN from students via view/RLS
  points          numeric not null default 1,
  meta            jsonb not null default '{}'::jsonb, -- task label, word_limit, prep/speak time, image_url
  created_at      timestamptz not null default now()
);
create index on public.questions (part_id);

-- Student-safe view: every column EXCEPT correct_answer, limited to published
-- tests. Runs as the view owner (security_invoker = false) so the base
-- questions table can stay staff-only — students never see correct answers.
create or replace view public.student_questions
with (security_invoker = false) as
  select q.id, q.part_id, q.order_index, q.question_number, q.type,
         q.prompt, q.options, q.points, q.meta, q.created_at
  from public.questions q
  join public.parts p    on p.id = q.part_id
  join public.sections s on s.id = p.section_id
  join public.tests t    on t.id = s.test_id
  where t.status = 'published';

grant select on public.student_questions to authenticated, anon;

-- ---------- attempts / answers ----------------------------------------------
create table public.attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  test_id       uuid not null references public.tests (id) on delete cascade,
  section_id    uuid not null references public.sections (id) on delete cascade,
  status        attempt_status not null default 'in_progress',
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  auto_score    numeric,
  manual_score  numeric,
  total_score   numeric,
  max_score     numeric,
  examiner_id   uuid references auth.users (id) on delete set null,
  feedback      text,
  created_at    timestamptz not null default now()
);
create index on public.attempts (user_id);
create index on public.attempts (section_id);
create index on public.attempts (status);

create table public.answers (
  id             uuid primary key default gen_random_uuid(),
  attempt_id     uuid not null references public.attempts (id) on delete cascade,
  question_id    uuid not null references public.questions (id) on delete cascade,
  response       jsonb,
  audio_url      text,
  is_correct     boolean,
  awarded_points numeric,
  updated_at     timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index on public.answers (attempt_id);

-- ---------- speaking peer matchmaking ---------------------------------------
create table public.speaking_queue (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  status      queue_status not null default 'waiting',
  room_id     uuid,
  created_at  timestamptz not null default now()
);

create table public.speaking_rooms (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid not null references auth.users (id) on delete cascade,
  user_b      uuid references auth.users (id) on delete cascade,
  status      room_status not null default 'open',
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles       enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.tests          enable row level security;
alter table public.sections       enable row level security;
alter table public.parts          enable row level security;
alter table public.questions      enable row level security;
alter table public.attempts       enable row level security;
alter table public.answers        enable row level security;
alter table public.speaking_queue enable row level security;
alter table public.speaking_rooms enable row level security;

-- profiles
create policy "profiles self read" on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy "profiles self update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin manage" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- subscriptions
create policy "subs self read" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "subs admin manage" on public.subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

-- tests: published readable by anyone signed in; staff full manage
create policy "tests read published" on public.tests
  for select using (status = 'published' or public.is_staff());
create policy "tests staff manage" on public.tests
  for all using (public.is_staff()) with check (public.is_staff());

-- sections / parts inherit test visibility
create policy "sections read" on public.sections
  for select using (
    public.is_staff() or exists (
      select 1 from public.tests t where t.id = test_id and t.status = 'published'
    )
  );
create policy "sections staff manage" on public.sections
  for all using (public.is_staff()) with check (public.is_staff());

create policy "parts read" on public.parts
  for select using (
    public.is_staff() or exists (
      select 1 from public.sections s join public.tests t on t.id = s.test_id
      where s.id = section_id and t.status = 'published'
    )
  );
create policy "parts staff manage" on public.parts
  for all using (public.is_staff()) with check (public.is_staff());

-- questions: base table is STAFF-ONLY (it holds correct_answer). Students never
-- select it directly — they read the security-definer student_questions view,
-- which omits correct_answer and is limited to published tests.
create policy "questions staff read" on public.questions
  for select using (public.is_staff());
create policy "questions staff manage" on public.questions
  for all using (public.is_staff()) with check (public.is_staff());

-- attempts: owner + staff
create policy "attempts owner read" on public.attempts
  for select using (user_id = auth.uid() or public.is_staff());
create policy "attempts owner insert" on public.attempts
  for insert with check (user_id = auth.uid());
create policy "attempts owner update" on public.attempts
  for update using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());

-- answers: through owning attempt
create policy "answers owner read" on public.answers
  for select using (
    public.is_staff() or exists (
      select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()
    )
  );
create policy "answers owner write" on public.answers
  for all using (
    public.is_staff() or exists (
      select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()
    )
  ) with check (
    public.is_staff() or exists (
      select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()
    )
  );

-- speaking queue/rooms: participants manage their own rows
create policy "queue self" on public.speaking_queue
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "rooms participant read" on public.speaking_rooms
  for select using (user_a = auth.uid() or user_b = auth.uid());
create policy "rooms participant update" on public.speaking_rooms
  for update using (user_a = auth.uid() or user_b = auth.uid())
  with check (user_a = auth.uid() or user_b = auth.uid());

-- ============================================================================
-- Realtime (for speaking matchmaking + WebRTC signaling channels)
-- ============================================================================
alter publication supabase_realtime add table public.speaking_queue;
alter publication supabase_realtime add table public.speaking_rooms;
