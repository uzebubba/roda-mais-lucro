-- Criar tabela para usuários com acesso vitalício
create table public.lifetime_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text not null,
  granted_at timestamp with time zone default now(),
  notes text,
  created_at timestamp with time zone default now()
);

-- Habilitar RLS
alter table public.lifetime_access enable row level security;

-- Política: Apenas service role pode gerenciar
create policy "Service role manages lifetime access"
on public.lifetime_access
for all
using (auth.role() = 'service_role');

-- Política: Usuários podem ver seu próprio acesso
create policy "Users can view own lifetime access"
on public.lifetime_access
for select
using (auth.uid() = user_id);

-- Inserir o usuário emerson@hotmail.com com acesso vitalício
-- User ID obtido dos logs: 5f364334-39c4-4b92-a555-32069b31cf2e
insert into public.lifetime_access (user_id, email, notes)
values (
  '5f364334-39c4-4b92-a555-32069b31cf2e',
  'emerson@hotmail.com',
  'Acesso vitalício concedido pelo proprietário do projeto'
);