-- 고객 식별 규칙을 앱과 일치시킨다.
--
-- 지금까지는 연락처 하나만 UNIQUE 였다. 그래서 관리자가 번호를 모를 때
-- 넣은 "0" 같은 자리채움 값에 서로 다른 손님 여럿이 걸려 한 명으로
-- 합쳐졌다(방문 수·이력이 섞임).
--
-- 새 규칙 (src/lib/customerKey.ts 의 sameCustomer 와 같다):
--   · 숫자 8자리 이상인 제대로 된 번호  → 번호만으로 같은 사람
--   · 그보다 짧은 자리채움 값            → 이름까지 같아야 같은 사람

alter table public.customers
  drop constraint if exists customers_contact_key;

drop index if exists customers_contact_norm_unique;

-- 제대로 된 번호는 여전히 한 사람에 하나
create unique index if not exists customers_real_phone_unique
  on public.customers (contact_norm)
  where length(contact_norm) >= 8;

-- 자리채움 번호는 이름과 묶어서만 유일
create unique index if not exists customers_name_contact_unique
  on public.customers (lower(name), contact)
  where length(contact_norm) < 8;
