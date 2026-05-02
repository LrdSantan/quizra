create table questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  correct_answer text not null,
  wrong_answers text[] not null,
  category text not null default 'general',
  difficulty text not null default 'medium',
  image_url text,
  is_flag_question boolean default false,
  created_at timestamptz default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  host_name text not null,
  status text not null default 'waiting',
  mode text not null default 'classic',
  category text default 'mixed',
  question_count int default 10,
  time_per_question int default 15,
  current_question_index int default 0,
  created_at timestamptz default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  username text not null,
  score int default 0,
  is_host boolean default false,
  is_active boolean default true,
  joined_at timestamptz default now()
);

create table room_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  question_id uuid references questions(id),
  question_order int not null
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  question_id uuid references questions(id),
  answer_given text,
  is_correct boolean default false,
  time_taken_ms int,
  answered_at timestamptz default now()
);

-- Realtime Setup
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table answers;
