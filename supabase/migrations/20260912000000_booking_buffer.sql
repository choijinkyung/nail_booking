-- 예약 뒤에 비워둘 여유시간(분). 정리·이동 시간 등.
-- 입력은 5분 단위지만, 예약 가능 시간이 30분 격자라 실제로 막히는 범위는
-- 격자 기준으로 올림된다 (90분 시술 + 10분 여유 = 100분 → 120분 점유).
alter table public.bookings
  add column if not exists buffer_min int not null default 0;
