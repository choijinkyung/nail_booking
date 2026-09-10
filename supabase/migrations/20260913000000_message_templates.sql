-- 손님에게 보내는 문구를 사장님이 직접 고칠 수 있게 한다.
-- 비워두면 앱 기본 문구를 쓴다.
alter table public.settings
  add column if not exists msg_invite text not null default '',
  add column if not exists msg_confirmed text not null default '',
  add column if not exists msg_changed text not null default '',
  add column if not exists msg_declined text not null default '',
  add column if not exists msg_cancelled text not null default '';
