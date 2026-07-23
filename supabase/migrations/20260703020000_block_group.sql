-- 범위 블록(Square식 'block off time') 그룹 식별자.
-- 같은 block_group 을 가진 blocked 슬롯들은 하나의 블록으로 함께 생성/해제된다.
alter table public.availability_slots
  add column if not exists block_group uuid;

create index if not exists availability_slots_block_group_idx
  on public.availability_slots (block_group);
