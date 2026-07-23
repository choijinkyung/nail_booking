-- 시술 가격을 '이상(부터)'로 표기할지 여부.
-- 예: price=30, price_from=true → 고객 화면에 "$30~" 로 표시.
alter table public.services
  add column if not exists price_from boolean not null default false;

-- 예약자가 '일찍 시술 가능할 때 연락받기'를 원하는지 여부.
alter table public.bookings
  add column if not exists early_contact boolean not null default false;
