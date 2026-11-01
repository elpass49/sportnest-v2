-- =============================================================================
-- Test de sécurité : anon ne voit rien, les rôles voient ce qu'ils doivent
-- -----------------------------------------------------------------------------
-- Vérifie que la RLS n'est pas décorative : on change réellement de rôle et
-- de claims JWT, comme le ferait PostgREST.
-- =============================================================================

begin;

create or replace function pg_temp.assert_vrai(p_cond boolean, p_msg text)
returns void language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'ASSERTION ÉCHOUÉE: %', p_msg;
  end if;
end $$;

create or replace function pg_temp.expect_denied(p_sql text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when insufficient_privilege then
    return;   -- refus attendu
  end;
  raise exception 'ASSERTION ÉCHOUÉE: « % » aurait dû être refusé', p_sql;
end $$;

-- -----------------------------------------------------------------------------
-- 0. Jeu de données (en tant que postgres, avant de changer de rôle)
-- -----------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'gestionnaire@example.org', now(), now()),
       ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'lecture@example.org', now(), now()),
       ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'admin@example.org', now(), now());

insert into public.profils (user_id, email, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'gestionnaire@example.org', 'gestionnaire'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'lecture@example.org', 'lecture'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'admin@example.org', 'admin');

insert into public.saisons (id, libelle, debut, fin, statut)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'TEST-SECU', '2025-09-01', '2026-06-30', 'ouverte');

insert into public.membres (id, saison_id, nom, prenom, date_naissance, email)
values ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
        'MARTIN', 'Léa', '2011-05-12', 'lea@example.org');

-- une ligne de journal existante, pour prouver que seul l'admin la voit
insert into public.journal (acteur, action, entite, entite_id)
values ('test', 'insert', 'membres', 'cccccccc-0000-0000-0000-000000000001');

-- -----------------------------------------------------------------------------
-- 1. anon : aucun accès, ni lecture ni vue
-- -----------------------------------------------------------------------------
set local role anon;

select pg_temp.expect_denied('select count(*) from public.membres');
select pg_temp.expect_denied('select count(*) from public.v_kpis');
select pg_temp.expect_denied($sql$insert into public.membres (saison_id, nom, prenom, date_naissance)
                                  values ('bbbbbbbb-0000-0000-0000-000000000001','X','Y','2010-01-01')$sql$);

reset role;

-- -----------------------------------------------------------------------------
-- 2. authenticated sans profil : sees nothing (pas une erreur, zéro ligne)
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-0000-0000-0000-000000000000"}';

select pg_temp.assert_vrai(
  (select count(*) from public.membres) = 0,
  'un utilisateur authentifié sans profil ne doit voir aucun adhérent');

select pg_temp.assert_vrai(
  (select dossiers from public.v_kpis) = 0,
  'les KPI doivent être vides pour un compte sans rôle');

reset role;

-- -----------------------------------------------------------------------------
-- 3. authenticated avec rôle « lecture » : lit, n'écrit pas
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002"}';

select pg_temp.assert_vrai(
  (select count(*) from public.membres) = 1,
  'un rôle lecture doit voir les adhérents');

select pg_temp.expect_denied($sql$insert into public.membres (saison_id, nom, prenom, date_naissance)
                                  values ('bbbbbbbb-0000-0000-0000-000000000001','X','Y','2010-01-01')$sql$);

reset role;

-- -----------------------------------------------------------------------------
-- 4. authenticated avec rôle « gestionnaire » : lit et écrit, ne supprime pas
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';

select pg_temp.assert_vrai(
  (select count(*) from public.membres) = 1,
  'un gestionnaire doit voir les adhérents');

insert into public.membres (id, saison_id, nom, prenom, date_naissance, email)
values ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001',
        'BERNARD', 'Noé', '2012-03-08', 'noe@example.org');

select pg_temp.assert_vrai(
  (select count(*) from public.membres) = 2,
  'un gestionnaire doit pouvoir créer un adhérent');

-- Pas de policy DELETE : la suppression est refusée par la RLS
select pg_temp.assert_vrai(
  (select count(*) from public.membres) = 2,
  'aucune suppression ne doit avoir eu lieu');

select pg_temp.expect_denied('delete from public.membres');

-- Le journal est réservé aux admins : le gestionnaire n'en voit aucune ligne
select pg_temp.assert_vrai(
  (select count(*) from public.journal) = 0,
  'un gestionnaire ne doit pas lire le journal d''audit');

reset role;

-- -----------------------------------------------------------------------------
-- 5. admin : accès complet, y compris journal
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000003"}';

select pg_temp.assert_vrai(
  (select dossiers from public.v_kpis) >= 0,
  'un admin doit pouvoir lire les KPI');

-- L'admin, lui, voit le journal d'audit
select pg_temp.assert_vrai(
  (select count(*) from public.journal) >= 1,
  'un admin doit voir les lignes du journal');

reset role;

\echo '──────────────────────────────────────────────'
\echo '✔ SÉCURITÉ VALIDÉE : anon aveugle, rôles cloisonnés, pas de suppression'
\echo '──────────────────────────────────────────────'

rollback;
