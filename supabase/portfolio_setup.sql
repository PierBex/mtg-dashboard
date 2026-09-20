-- Run this once in Supabase: SQL Editor -> New query -> paste this file -> Run.
-- It creates the portfolio area only. The price crawler and its SQLite database
-- stay exactly as they are.

create extension if not exists pgcrypto;

create table if not exists public.portfolio_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id bigint not null,
  set_name text not null,
  product_name text not null,
  product_type text not null,
  quantity integer not null check (quantity > 0),
  purchase_price numeric(12, 2) not null check (purchase_price >= 0),
  purchased_on date not null default current_date,
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists portfolio_lots_user_id_created_at_idx
  on public.portfolio_lots (user_id, created_at desc);

alter table public.portfolio_lots enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.portfolio_lots to authenticated;

drop policy if exists "Users manage only their own portfolio lots" on public.portfolio_lots;
create policy "Users manage only their own portfolio lots"
  on public.portfolio_lots
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
