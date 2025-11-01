set check_function_bodies = off;
set search_path = public;

alter table if exists public.transactions replica identity full;
alter table if exists public.fixed_expenses replica identity full;
alter table if exists public.fuel_entries replica identity full;
alter table if exists public.vehicle_states replica identity full;
alter table if exists public.oil_reminders replica identity full;
alter table if exists public.work_sessions replica identity full;
alter table if exists public.user_profiles replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.transactions;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.fixed_expenses;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.fuel_entries;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.vehicle_states;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.oil_reminders;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.work_sessions;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.user_profiles;
  exception
    when duplicate_object then null;
  end;
end;
$$;

