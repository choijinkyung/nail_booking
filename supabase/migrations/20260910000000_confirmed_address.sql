-- 확정된 손님에게만 보낼 실제 주소.
-- 공개 랜딩의 location 은 "Surrey Central 인근" 처럼 대략적인 위치를 두고,
-- 예약이 확정된 손님에게 보내는 안내에는 이 주소를 쓴다.
alter table public.settings
  add column if not exists confirmed_address text not null default '';
