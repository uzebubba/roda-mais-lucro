-- ============================================================================
-- CORREÇÃO DE SEGURANÇA: Adicionar search_path a funções existentes
-- ============================================================================

-- Corrigir função handle_new_user
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

  return new;
end;
$function$;

-- Corrigir função handle_updated_user
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