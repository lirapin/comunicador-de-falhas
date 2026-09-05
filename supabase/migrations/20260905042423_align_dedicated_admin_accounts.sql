-- O Comunicador agora usa um projeto Supabase dedicado. Mantemos somente o
-- endereço administrativo atualmente informado para Kelly.
insert into failure_portal_private.allowed_accounts (email, display_name, role)
values
  ('kelly.lira@claro.com.br', 'Kelly Lira', 'admin'),
  ('nelson.soares@claro.com.br', 'Nelson Soares', 'admin'),
  ('madrugada@comunicador.invalid', 'Equipe Madrugada', 'team')
on conflict (email) do update
set display_name = excluded.display_name,
    role = excluded.role;

delete from failure_portal_private.allowed_accounts
where email = 'kellylira@live.com';
