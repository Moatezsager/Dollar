-- Read-only verification of the current shared Telegram aggregate schema.
-- The former per-visit schema was for SQLite, not this Supabase table.
-- Access controls are managed by Worker/supabase_security_hardening.sql.
select id, visits_count, last_entry_at
from public.telegram_visits
where id = 0;

select to_regprocedure('public.increment_telegram_visits(text,text,text)') is not null
  as visit_counter_function_exists;
