-- 이름 + 전화번호로 예약을 찾기 위한 정규화 연락처 컬럼.
-- 손님이 "604-123-4567" 로 예약하고 "6041234567" 로 조회해도 같은 번호로 인식한다.
-- 화면에 보이는 값은 손님이 입력한 원본(contact / customer_contact)을 그대로 쓰고,
-- 이 컬럼은 매칭 전용이다. src/lib/phone.ts 의 normalizePhone 과 규칙이 같아야 한다.

create or replace function public.normalize_phone(raw text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
  if digits = '' then
    return '';                                  -- 카톡 아이디 등 숫자 없는 연락처
  end if;
  if length(digits) = 11 and left(digits, 1) = '1' then
    return substr(digits, 2);                   -- 북미 국가번호 제거
  end if;
  if left(digits, 2) = '82' and length(digits) >= 11 then
    return '0' || substr(digits, 3);            -- 한국 국가번호 → 국내 표기
  end if;
  return digits;
end;
$$;

alter table public.customers
  add column if not exists contact_norm text not null default '';

alter table public.bookings
  add column if not exists customer_contact_norm text not null default '';

update public.customers
   set contact_norm = public.normalize_phone(contact)
 where contact_norm = '';

update public.bookings
   set customer_contact_norm = public.normalize_phone(customer_contact)
 where customer_contact_norm = '';

-- 숫자가 없는 연락처(카톡 아이디 등)는 '' 로 남으므로 유니크 대상에서 제외한다.
-- 이 인덱스 생성이 실패하면 서로 다르게 적힌 같은 번호가 이미 두 건 이상 있다는 뜻 —
-- 해당 고객 레코드를 먼저 하나로 합쳐야 한다.
create unique index if not exists customers_contact_norm_unique
  on public.customers (contact_norm)
  where contact_norm <> '';

create index if not exists bookings_customer_contact_norm_idx
  on public.bookings (customer_contact_norm);

-- 이름 조회는 대소문자를 무시하므로 인덱스도 lower() 기준으로 둔다.
create index if not exists bookings_customer_name_lower_idx
  on public.bookings (lower(customer_name));
