-- =============================================================================
-- SportNest V2 — jeu de démonstration (LOCAL UNIQUEMENT)
-- -----------------------------------------------------------------------------
-- Aucune donnée réelle : noms génériques, e-mails en @example.org.
-- Rejouable : vide les tables métier avant de réinsérer.
-- =============================================================================

truncate table
  public.remboursements,
  public.factures,
  public.paiements,
  public.lignes_dossier,
  public.dossiers,
  public.inscriptions,
  public.membres,
  public.familles,
  public.cours,
  public.professeurs,
  public.tarifs,
  public.saisons,
  public.journal
restart identity cascade;

-- -----------------------------------------------------------------------------
-- Référentiel
-- -----------------------------------------------------------------------------
insert into public.saisons (id, libelle, debut, fin, statut)
values ('a0000000-0000-0000-0000-000000000001', '2025-2026', '2025-09-01', '2026-06-30', 'ouverte');

insert into public.tarifs (saison_id, code, libelle, montant) values
  ('a0000000-0000-0000-0000-000000000001', 'adhesion_individuelle', 'Adhésion individuelle', 15.00),
  ('a0000000-0000-0000-0000-000000000001', 'adhesion_famille',      'Adhésion famille',      20.00);

insert into public.professeurs (nom, email) values
  ('Léna Dubois',   'lena@example.org'),
  ('Sofia Benali',  'sofia@example.org'),
  ('Amélie Roux',   'amelie@example.org'),
  ('Malik Traoré',  'malik@example.org'),
  ('Chloé Marchand','chloe@example.org'),
  ('Priya Nair',    'priya@example.org'),
  ('JY Chopin',     'jy@example.org');

insert into public.cours (saison_id, nom, style, professeur_id, jour, heure_debut, duree_min, capacite, salle, tarif_cours)
select 'a0000000-0000-0000-0000-000000000001', v.nom, v.style, p.id, v.jour, v.heure::time, v.duree, v.cap, v.salle, v.tarif
from (values
  ('Éveil 4-5 ans',       'Éveil',        'Chloé Marchand', 6::smallint, '10:00', 45::smallint, 30::smallint, 'Studio 1', 160.00),
  ('Éveil 6-7 ans',       'Éveil',        'Chloé Marchand', 6, '11:00', 45, 30, 'Studio 1', 165.00),
  ('Jazz 8-9 ans',        'Jazz',         'Léna Dubois',    1, '17:00', 60, 30, 'Studio 2', 180.00),
  ('Jazz ado 1',          'Jazz',         'Sofia Benali',   3, '14:00', 75, 30, 'Studio 1', 195.00),
  ('Jazz adulte débutant','Jazz',         'JY Chopin',      1, '19:00', 75, 30, 'Studio 2', 210.00),
  ('Classique 8-10 ans',  'Classique',    'Amélie Roux',    2, '18:00', 60, 30, 'Studio 3', 190.00),
  ('Hip-hop ado',         'Hip-hop',      'Malik Traoré',   6, '14:00', 60, 30, 'Studio 2', 185.00),
  ('Zumba',               'Bien-être',    'Malik Traoré',   2, '20:00', 60, 40, 'Studio 1', 175.00)
) as v(nom, style, prof, jour, heure, duree, cap, salle, tarif)
join public.professeurs p on p.nom = v.prof;

-- -----------------------------------------------------------------------------
-- 120 adhérents
-- -----------------------------------------------------------------------------
insert into public.membres (saison_id, nom, prenom, date_naissance, email, telephone)
select
  'a0000000-0000-0000-0000-000000000001',
  (array['MARTIN','BERNARD','DUBOIS','ROBERT','RICHARD','PETIT','DURAND','LEROY',
         'MOREAU','SIMON','LAURENT','LEFEBVRE','MICHEL','GARCIA','DAVID','BERTRAND',
         'ROUX','VINCENT','FOURNIER','MOREL'])[1 + (i % 20)],
  (array['Léa','Noé','Zoé','Hugo','Emma','Nathan','Chloé','Enzo','Manon','Théo',
         'Inès','Louis','Jade','Gabriel','Louise','Raphaël','Alice','Arthur','Rose','Jules'])[1 + (i % 20)],
  (date '2019-01-01' - ((i * 211) % 9000 || ' days')::interval)::date,
  'membre' || (i + 1) || '@example.org',
  '06 •• •• •• ' || lpad(((i * 7) % 90 + 10)::text, 2, '0')
from generate_series(0, 119) as i;

-- -----------------------------------------------------------------------------
-- Inscriptions + dossiers + paiements
-- -----------------------------------------------------------------------------
do $$
declare
  v_saison  uuid := 'a0000000-0000-0000-0000-000000000001';
  v_cours   uuid[];
  v_membres uuid[];
  v_nb      int;
  v_id      uuid;
  v_cid     uuid;
  v_m       uuid;
  v_dossier uuid;
  v_montant numeric(12,2);
  i         int;
begin
  select array_agg(id order by nom) into v_cours from public.cours where saison_id = v_saison;
  select array_agg(id order by email) into v_membres from public.membres where saison_id = v_saison;
  v_nb := array_length(v_membres, 1);

  for i in 1..v_nb loop
    v_m := v_membres[i];

    insert into public.dossiers (saison_id, beneficiaire, numero)
    values (v_saison, v_m, 'DOS-2026-' || lpad(i::text, 4, '0'))
    returning id into v_dossier;

    insert into public.lignes_dossier (dossier_id, membre_id, type, libelle, montant)
    values (v_dossier, v_m, 'adhesion', 'Adhésion individuelle', 15.00);

    -- cours principal (répartition en round-robin)
    v_cid := v_cours[1 + ((i - 1) % array_length(v_cours, 1))];
    insert into public.inscriptions (membre_id, cours_id) values (v_m, v_cid);
    insert into public.lignes_dossier (dossier_id, membre_id, cours_id, type, libelle, montant)
    select v_dossier, v_m, c.id, 'cours', c.nom, c.tarif_cours from public.cours c where c.id = v_cid;

    -- second cours pour un adhérent sur quatre
    if i % 4 = 0 then
      v_cid := v_cours[1 + (i % array_length(v_cours, 1))];
      begin
        insert into public.inscriptions (membre_id, cours_id) values (v_m, v_cid);
        insert into public.lignes_dossier (dossier_id, membre_id, cours_id, type, libelle, montant)
        select v_dossier, v_m, c.id, 'cours', c.nom, c.tarif_cours from public.cours c where c.id = v_cid;
      exception when unique_violation or others then
        null;  -- capacité atteinte ou doublon : on ignore ce second cours
      end;
    end if;

    v_montant := public.fn_facture_dossier(v_dossier);

    -- 70 % soldés, 20 % acomptes, 10 % impayés
    if i % 10 <= 6 then
      insert into public.paiements (dossier_id, montant, moyen, operateur, cle_idempotence)
      values (v_dossier, v_montant, (array['cb','sepa','virement','helloasso'])[1 + (i % 4)], 'demo', 'seed-' || i);
    elsif i % 10 <= 8 then
      insert into public.paiements (dossier_id, montant, moyen, operateur, cle_idempotence)
      values (v_dossier, round(v_montant * 0.6, 2), 'sepa', 'demo', 'seed-' || i);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Compte de démonstration : gestionnaire@example.org / demo1234
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  -- GoTrue scanne ces colonnes en string : NULL provoque une 500 au login
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'f0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'gestionnaire@example.org',
  crypt('demo1234', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', '', '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
values (
  gen_random_uuid(), 'f0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001', 'email',
  '{"sub":"f0000000-0000-0000-0000-000000000001","email":"gestionnaire@example.org"}',
  now(), now(), now()
) on conflict do nothing;

insert into public.profils (user_id, email, role)
values ('f0000000-0000-0000-0000-000000000001', 'gestionnaire@example.org', 'gestionnaire')
on conflict (user_id) do update set role = excluded.role;

-- Récapitulatif
select 'adhérents' as quoi, count(*)::text as valeur from public.membres
union all select 'inscriptions', count(*)::text from public.inscriptions
union all select 'dossiers', count(*)::text from public.dossiers
union all select 'paiements', count(*)::text from public.paiements
union all select 'facturé', to_char((select facture from public.v_kpis), 'FM999G999D99')
union all select 'encaissé', to_char((select encaisse from public.v_kpis), 'FM999G999D99')
union all select 'reste', to_char((select reste from public.v_kpis), 'FM999G999D99');
