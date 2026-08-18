-- Amplia o cadastro de autoria, os dados copiáveis dos chamados e atualiza a conta Kelly.

alter table failure_portal_private.allowed_accounts
  drop constraint if exists failure_portal_allowed_accounts_normalized_email_check;

alter table failure_portal_private.allowed_accounts
  add constraint failure_portal_allowed_accounts_normalized_email_check
    check (
      email = lower(trim(email))
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    );

do $$
declare
  v_kelly_id uuid;
begin
  select id into v_kelly_id
  from auth.users
  where lower(email) = 'kelly.lira@claro.com.br';

  if exists (
    select 1 from auth.users
    where lower(email) = 'kellylira@live.com'
      and id is distinct from v_kelly_id
  ) then
    raise exception 'O e-mail kellylira@live.com já pertence a outra conta';
  end if;

  update failure_portal_private.allowed_accounts
  set email = 'kellylira@live.com'
  where email = 'kelly.lira@claro.com.br';

  if v_kelly_id is not null then
    update auth.users
    set email = 'kellylira@live.com', updated_at = now()
    where id = v_kelly_id;

    update auth.identities
    set identity_data = jsonb_set(identity_data, '{email}', to_jsonb('kellylira@live.com'::text), true),
        updated_at = now()
    where user_id = v_kelly_id
      and provider = 'email';
  end if;
end;
$$;

alter table public.failure_portal_tickets
  add column event_description text not null default 'NÃO INFORMADA';

alter table public.failure_portal_tickets
  add constraint failure_portal_tickets_event_description_check
    check (char_length(trim(event_description)) between 1 and 500);

update public.failure_portal_reports
set reporter_name = 'Equipe Madrugada'
where reporter_name ilike '%anônimo%';

update public.failure_portal_tickets
set reporter_name = 'Equipe Madrugada'
where reporter_name ilike '%anônimo%';

create or replace function failure_portal_private.set_submission_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_display_name text;
  v_requested_name text;
begin
  select m.role, a.display_name
    into v_role, v_display_name
  from public.failure_portal_memberships m
  join auth.users u on u.id = m.user_id
  join failure_portal_private.allowed_accounts a on a.email = lower(u.email)
  where m.user_id = v_user_id;

  if v_role is null then
    raise exception 'Conta não autorizada para o Comunicador de Falhas';
  end if;

  new.reporter_id := v_user_id;
  if v_role = 'admin' then
    new.reporter_name := v_display_name;
    return new;
  end if;

  v_requested_name := lower(trim(coalesce(new.reporter_name, 'Equipe Madrugada')));
  new.reporter_name := case v_requested_name
    when 'alan' then 'Alan'
    when 'raissa' then 'Raissa'
    when 'thiago' then 'Thiago'
    when 'cristiane' then 'Cristiane'
    when 'leonardo' then 'Leonardo'
    when 'maristella' then 'Maristella'
    when 'equipe madrugada' then 'Equipe Madrugada'
    else null
  end;

  if new.reporter_name is null then
    raise exception 'Nome inválido no campo Reportado por';
  end if;
  return new;
end;
$$;

revoke all on function failure_portal_private.set_submission_identity()
  from public, anon, authenticated;

grant insert (reporter_name)
  on public.failure_portal_reports to authenticated;

grant select (event_description), insert (event_description)
  on public.failure_portal_tickets to authenticated;
