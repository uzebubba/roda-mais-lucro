set search_path = public;

create or replace function public.validate_transaction()
returns trigger
language plpgsql
as $$
begin
  if new.amount < 0 then
    raise exception 'Amount must be positive';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_transaction_before_insert on public.transactions;

create trigger validate_transaction_before_insert
before insert on public.transactions
for each row
execute function public.validate_transaction();

