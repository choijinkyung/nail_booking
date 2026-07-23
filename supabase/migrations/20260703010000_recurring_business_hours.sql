-- 반복 영업시간 기반 예약 가능 시간 자동생성
-- ─────────────────────────────────────────────────────────────

-- 요일별 반복 영업시간 (weekday: 0=일 ~ 6=토, 분 단위 start/end)
create table if not exists public.business_hours (
  weekday    int primary key check (weekday between 0 and 6),
  enabled    boolean not null default false,
  start_min  int not null default 600,   -- 10:00
  end_min    int not null default 1200,  -- 20:00
  updated_at timestamptz not null default now()
);

-- 특정 날짜 휴무 (반복 영업시간이라도 이 날은 슬롯을 만들지 않음)
create table if not exists public.schedule_days_off (
  day        date primary key,
  created_at timestamptz not null default now()
);

-- 자동생성 슬롯 표시 — sync 는 generated=true 인 open 슬롯만 관리한다.
-- (수동 추가 슬롯 / 예약(booked) / 차단(blocked) 슬롯은 절대 건드리지 않음)
alter table public.availability_slots
  add column if not exists generated boolean not null default false;

-- 예약 창(오늘부터 며칠 앞까지 열지)
alter table public.settings
  add column if not exists booking_window_days int not null default 14;

alter table public.business_hours      enable row level security;
alter table public.schedule_days_off   enable row level security;
