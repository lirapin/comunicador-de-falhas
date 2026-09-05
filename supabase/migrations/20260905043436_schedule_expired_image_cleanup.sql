create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'cleanup-failure-portal-images-daily';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;

select cron.schedule(
  'cleanup-failure-portal-images-daily',
  '23 3 * * *',
  $cleanup$
    select net.http_post(
      url := 'https://htxlzznodyxwipbobzqm.supabase.co/functions/v1/cleanup-expired-images',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'failure_portal_cleanup_api_key'
        )
      ),
      body := jsonb_build_object('source', 'pg_cron', 'requested_at', now())
    ) as request_id;
  $cleanup$
);
