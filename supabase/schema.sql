-- ============================================================
-- 네일 예약 시스템 — Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
-- (앱 서버는 service_role 키로 접근하며, 아래 RLS는 방어용입니다.)
-- ============================================================

-- 확장: 랜덤 UUID
create extension if not exists "pgcrypto";

-- ── 시술/가격표 ────────────────────────────────────────────
create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  name_ko     text not null,
  name_en     text not null,
  price       numeric(10,2) not null default 0,   -- 단가 (CAD)
  unit        text not null default 'flat',        -- 'flat' | 'per_finger'
  description_ko text default '',
  description_en text default '',
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── 예약 가능 시간대 ───────────────────────────────────────
create table if not exists public.availability_slots (
  id          uuid primary key default gen_random_uuid(),
  starts_at   timestamptz not null,                -- 시작 일시
  ends_at     timestamptz,                         -- (선택) 종료 일시
  status      text not null default 'open',        -- 'open' | 'booked' | 'blocked'
  note_ko     text default '',
  note_en     text default '',
  created_at  timestamptz not null default now()
);
create index if not exists availability_slots_starts_at_idx
  on public.availability_slots (starts_at);

-- ── 예약 요청 ──────────────────────────────────────────────
create table if not exists public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,        -- 고객 조회용 짧은 코드
  customer_name        text not null,
  customer_contact     text not null,               -- 전화 / 카톡 등
  customer_email       text default '',
  services             jsonb not null default '[]', -- 예약 시점 스냅샷
  estimated_total      numeric(10,2) not null default 0,
  note                 text default '',             -- 고객 메모 (연장 손가락 수 등)
  preferred_slot_id    uuid references public.availability_slots(id) on delete set null,
  alternative_slot_ids uuid[] not null default '{}',
  status               text not null default 'pending', -- pending|confirmed|declined|cancelled|completed
  confirmed_slot_id    uuid references public.availability_slots(id) on delete set null,
  admin_message        text default '',             -- 고객에게 전달할 메시지 (다른 시간 제안 등)
  change_request       text default '',             -- 손님이 남긴 변경/취소 요청 메시지
  change_requested_at  timestamptz,                 -- 요청 시각 (있으면 대시보드에 배지 표시)
  request_kind         text default '',             -- '' | 'change' | 'cancel'
  requested_slot_id    uuid references public.availability_slots(id) on delete set null, -- 손님이 희망한 새 시간(변경요청)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- 기존 설치본에도 안전하게 컬럼 추가
alter table public.bookings add column if not exists change_request text default '';
alter table public.bookings add column if not exists change_requested_at timestamptz;
alter table public.bookings add column if not exists request_kind text default '';
alter table public.bookings add column if not exists requested_slot_id uuid references public.availability_slots(id) on delete set null;
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_created_at_idx on public.bookings (created_at desc);

-- ★ 중복 예약 방지: 하나의 시간대(confirmed_slot_id)는 '확정' 예약을 단 하나만 가질 수 있음.
--   두 번째 확정 시도는 이 유니크 인덱스로 DB 레벨에서 거부됩니다.
create unique index if not exists bookings_one_confirmed_per_slot
  on public.bookings (confirmed_slot_id)
  where status = 'confirmed' and confirmed_slot_id is not null;

-- ── 설정 (단일 행) ─────────────────────────────────────────
create table if not exists public.settings (
  id              int primary key default 1 check (id = 1),
  shop_name_ko    text default '홈 네일',
  shop_name_en    text default 'Home Nail',
  location_ko     text default 'Surrey Central 인근 (정확한 주소는 예약 확정 후 안내드려요)',
  location_en     text default 'Near Surrey Central (exact address shared after confirmation)',
  notice_ko       text default '반려동물(강아지·고양이)이 있어 알러지가 있으신 분은 방문이 어렵습니다.',
  notice_en       text default 'We have pets (a dog and a cat). Visits are not possible for guests with allergies.',
  payment_ko      text default '현금(Cash) 또는 e-transfer만 가능합니다.',
  payment_en      text default 'Cash or e-transfer only.',
  etransfer_email text default '',
  etransfer_note_ko text default '',
  etransfer_note_en text default '',
  currency        text default 'CAD',
  updated_at      timestamptz not null default now()
);

-- 기본 설정 행 보장
insert into public.settings (id) values (1)
  on conflict (id) do nothing;

-- 기본 가격표 시드 (비어 있을 때만)
insert into public.services (name_ko, name_en, price, unit, sort_order)
select * from (values
  ('원컬러',   'One Color',        35, 'flat',       10),
  ('제거',     'Removal',           5, 'flat',       20),
  ('연장',     'Extension',         3, 'per_finger', 30)
) as v(name_ko, name_en, price, unit, sort_order)
where not exists (select 1 from public.services);

-- ── 시술 사진 갤러리 ───────────────────────────────────────
create table if not exists public.gallery_photos (
  id           uuid primary key default gen_random_uuid(),
  image_url    text not null,               -- 공개 URL
  storage_path text not null,               -- 스토리지 내 경로 (삭제용)
  category     text not null default '기타', -- 카테고리 (예: 원컬러, 아트, 연장…)
  caption_ko   text default '',
  caption_en   text default '',
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists gallery_category_idx on public.gallery_photos (category);

-- 갤러리 이미지용 공개 스토리지 버킷
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

-- ── RLS: 브라우저에서 직접 접근 차단(앱은 service_role로만 접근) ──
alter table public.services           enable row level security;
alter table public.availability_slots enable row level security;
alter table public.bookings           enable row level security;
alter table public.settings           enable row level security;
alter table public.gallery_photos     enable row level security;
-- 정책을 만들지 않으므로 anon/authenticated 직접 접근은 모두 거부됩니다.
-- service_role 키는 RLS를 우회하므로 서버(Server Actions)에서만 데이터에 접근합니다.
-- (갤러리 '이미지 파일'은 public 버킷이라 URL로 바로 열람 가능)
