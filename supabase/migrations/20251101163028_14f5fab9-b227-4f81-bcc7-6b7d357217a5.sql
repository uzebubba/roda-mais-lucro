-- ============================================================================
-- CORREÇÃO DE SEGURANÇA: Adicionar search_path nas funções existentes
-- ============================================================================

-- Atualizar função handle_new_user() com search_path seguro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  profile_email text;
  profile_full_name text;
begin
  profile_email := coalesce(new.email, new.raw_user_meta_data->>'email');
  profile_full_name := new.raw_user_meta_data->>'full_name';

  if profile_email is null then
    raise exception 'User email is required to create profile.';
  end if;

  insert into public.user_profiles (id, email, full_name, metadata, last_sign_in_at)
  values (
    new.id,
    profile_email,
    profile_full_name,
    coalesce(new.raw_user_meta_data, '{}'::jsonb),
    new.last_sign_in_at
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        metadata = excluded.metadata,
        last_sign_in_at = excluded.last_sign_in_at,
        updated_at = now();

  -- Criar role padrão para novo usuário na tabela segura
  insert into public.user_roles (user_id, role)
  values (new.id, 'driver'::app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$function$;

-- Atualizar função handle_updated_user() com search_path seguro
CREATE OR REPLACE FUNCTION public.handle_updated_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  profile_email text;
  profile_full_name text;
begin
  profile_email := coalesce(new.email, new.raw_user_meta_data->>'email');
  profile_full_name := new.raw_user_meta_data->>'full_name';

  update public.user_profiles
  set email = coalesce(profile_email, email),
      full_name = coalesce(profile_full_name, full_name),
      metadata = coalesce(new.raw_user_meta_data, metadata),
      last_sign_in_at = greatest(coalesce(new.last_sign_in_at, last_sign_in_at), last_sign_in_at),
      updated_at = now()
  where id = new.id;

  return new;
end;
$function$;

-- Comentário de segurança
COMMENT ON FUNCTION public.handle_new_user() IS 'Cria profile e role padrão para novos usuários - protegido com search_path';
COMMENT ON FUNCTION public.handle_updated_user() IS 'Atualiza profile quando usuário é atualizado - protegido com search_path';