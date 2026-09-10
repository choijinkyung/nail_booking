-- 결제 안내의 첫 줄도 사장님이 직접 고칠 수 있게 한다. 비우면 기본 문구.
alter table public.settings
  add column if not exists msg_payment text not null default '';
