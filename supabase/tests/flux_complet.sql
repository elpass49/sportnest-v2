-- =============================================================================
-- Test de bout en bout : adhésion → cours → dossier → paiement → facture
-- -----------------------------------------------------------------------------
-- Exécution :
--   docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f /dev/stdin < supabase/tests/flux_complet.sql
--
-- Le script tourne dans UNE transaction terminée par ROLLBACK : il ne laisse
-- aucune donnée derrière lui, on peut le rejouer à volonté.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Helpers d'assertion
-- -----------------------------------------------------------------------------
create or replace function pg_temp.assert_vrai(p_cond boolean, p_msg text)
returns void language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'ASSERTION ÉCHOUÉE: %', p_msg;
  end if;
end $$;

create or replace function pg_temp.expect_error(p_sql text, p_code text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like p_code || '%' then
      raise exception 'ASSERTION ÉCHOUÉE: erreur « % » au lieu de « % % »', sqlerrm, p_code, '…';
    end if;
    return;   -- erreur attendue : test réussi
  end;
  raise exception 'ASSERTION ÉCHOUÉE: aucune erreur levée, « % » était attendu', p_code;
end $$;

-- -----------------------------------------------------------------------------
-- 0. Jeu de données minimal
-- -----------------------------------------------------------------------------
insert into public.saisons (id, libelle, debut, fin, statut)
values ('11111111-1111-1111-1111-111111111111', 'TEST-E2E', '2025-09-01', '2026-06-30', 'ouverte');

insert into public.tarifs (saison_id, code, libelle, montant) values
  ('11111111-1111-1111-1111-111111111111', 'adhesion_individuelle', 'Adhésion individuelle', 15.00);

insert into public.professeurs (id, nom) values ('22222222-2222-2222-2222-222222222222', 'Léna Dubois');

-- capacité 2 volontairement petite pour tester le blocage
insert into public.cours (id, saison_id, nom, style, professeur_id, jour, heure_debut, duree_min, capacite, salle, tarif_cours)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
        'Jazz ado 1', 'Jazz', '22222222-2222-2222-2222-222222222222', 3, '14:00', 75, 2, 'Studio 1', 195.00);

insert into public.membres (id, saison_id, nom, prenom, date_naissance, email) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'MARTIN', 'Léa', '2011-05-12', 'lea@example.org'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'MARTIN', 'Noé', '2012-03-08', 'noe@example.org'),
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'BERNARD', 'Zoé', '2011-11-30', 'zoe@example.org');

-- -----------------------------------------------------------------------------
-- 1. Inscriptions : la capacité est une contrainte, pas un conseil
-- -----------------------------------------------------------------------------
insert into public.inscriptions (membre_id, cours_id) values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333');

-- Doublon testé AVANT que le cours soit complet : le trigger de capacité se
-- déclenche avant les contraintes, il masquerait l'erreur d'unicité.
select pg_temp.expect_error(
  $sql$ insert into public.inscriptions (membre_id, cours_id)
        values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333') $sql$,
  'duplicate key');

insert into public.inscriptions (membre_id, cours_id) values
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333');

select pg_temp.assert_vrai(
  (select inscrits from public.v_cours_occupation where id = '33333333-3333-3333-3333-333333333333') = 2,
  'deux inscriptions doivent être enregistrées');

select pg_temp.assert_vrai(
  (select places_restantes from public.v_cours_occupation where id = '33333333-3333-3333-3333-333333333333') = 0,
  'le cours doit être complet');

select pg_temp.expect_error(
  $sql$ insert into public.inscriptions (membre_id, cours_id)
        values ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333') $sql$,
  'COURS_COMPLET');

-- -----------------------------------------------------------------------------
-- 2. Dossier familial : adhésions + deux cours
-- -----------------------------------------------------------------------------
insert into public.familles (id, saison_id, nom)
values ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'MARTIN');

insert into public.dossiers (id, saison_id, famille_id, numero)
values ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111',
        '77777777-7777-7777-7777-777777777777', 'DOS-TEST-0001');

insert into public.lignes_dossier (dossier_id, membre_id, cours_id, type, libelle, montant) values
  ('88888888-8888-8888-8888-888888888888', '44444444-4444-4444-4444-444444444444', null, 'adhesion', 'Adhésion Léa', 15.00),
  ('88888888-8888-8888-8888-888888888888', '55555555-5555-5555-5555-555555555555', null, 'adhesion', 'Adhésion Noé', 15.00),
  ('88888888-8888-8888-8888-888888888888', '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'cours', 'Jazz ado 1 — Léa', 195.00),
  ('88888888-8888-8888-8888-888888888888', '55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'cours', 'Jazz ado 1 — Noé', 195.00),
  ('88888888-8888-8888-8888-888888888888', null, null, 'remise', 'Remise fratrie', -30.00);

select pg_temp.assert_vrai(
  (select facture from public.v_dossiers where id = '88888888-8888-8888-8888-888888888888') = 390.00,
  'facture attendue = 15 + 15 + 195 + 195 - 30 = 390 €');

select pg_temp.assert_vrai(
  (select statut from public.v_dossiers where id = '88888888-8888-8888-8888-888888888888') = 'impaye',
  'un dossier sans paiement est impayé');

-- Une deuxième adhésion pour Léa doit être refusée
select pg_temp.expect_error(
  $sql$ insert into public.lignes_dossier (dossier_id, membre_id, type, libelle, montant)
        values ('88888888-8888-8888-8888-888888888888',
                '44444444-4444-4444-4444-444444444444', 'adhesion', 'Adhésion en double', 15) $sql$,
  'duplicate key');

-- -----------------------------------------------------------------------------
-- 3. Paiement partiel → acompte
-- -----------------------------------------------------------------------------
insert into public.paiements (dossier_id, montant, moyen, operateur, cle_idempotence)
values ('88888888-8888-8888-8888-888888888888', 200.00, 'cb', 'JY Chopin', 'e2e-acompte-1');

select pg_temp.assert_vrai(
  (select statut from public.v_dossiers where id = '88888888-8888-8888-8888-888888888888') = 'acompte',
  'après 200 € sur 390 €, le dossier doit être en acompte');

select pg_temp.assert_vrai(
  (select reste from public.v_dossiers where id = '88888888-8888-8888-8888-888888888888') = 190.00,
  'reste attendu = 190 €');

-- Rejeu du même paiement : absorbé silencieusement (idempotence), pas d'erreur
insert into public.paiements (dossier_id, montant, moyen, operateur, cle_idempotence)
values ('88888888-8888-8888-8888-888888888888', 200.00, 'cb', 'JY Chopin', 'e2e-acompte-1');

select pg_temp.assert_vrai(
  (select count(*) from public.paiements where dossier_id = '88888888-8888-8888-8888-888888888888') = 1,
  'le rejeu ne doit pas créer un second paiement');

select pg_temp.assert_vrai(
  (select encaisse from public.v_dossiers where id = '88888888-8888-8888-8888-888888888888') = 200.00,
  'le rejeu ne doit pas modifier l''encaissé');

-- -----------------------------------------------------------------------------
-- 4. Surpaiement refusé
-- -----------------------------------------------------------------------------
select pg_temp.expect_error(
  $sql$ insert into public.paiements (dossier_id, montant, moyen, operateur)
        values ('88888888-8888-8888-8888-888888888888', 250.00, 'cb', 'JY Chopin') $sql$,
  'SURPAIEMENT');

-- -----------------------------------------------------------------------------
-- 5. Solde → dossier soldé
-- -----------------------------------------------------------------------------
insert into public.paiements (dossier_id, montant, moyen, operateur)
values ('88888888-8888-8888-8888-888888888888', 190.00, 'sepa', 'JY Chopin');

select pg_temp.assert_vrai(
  (select statut from public.v_dossiers where id = '88888888-8888-8888-8888-888888888888') = 'solde',
  'le dossier doit être soldé après 390 € encaissés');

select pg_temp.assert_vrai(
  (select reste from public.v_dossiers where id = '88888888-8888-8888-8888-888888888888') = 0,
  'le reste doit être nul');

-- -----------------------------------------------------------------------------
-- 6. Facture : émission puis gel du dossier
-- -----------------------------------------------------------------------------
insert into public.factures (dossier_id, numero, montant, empreinte)
select id, 'FA-TEST-0001', facture, md5(facture::text)
from public.v_dossiers where id = '88888888-8888-8888-8888-888888888888';

select pg_temp.expect_error(
  $sql$ update public.lignes_dossier set montant = 100
        where dossier_id = '88888888-8888-8888-8888-888888888888' and type = 'cours' $sql$,
  'DOSSIER_FACTURE');

select pg_temp.expect_error(
  $sql$ insert into public.lignes_dossier (dossier_id, type, libelle, montant)
        values ('88888888-8888-8888-8888-888888888888', 'frais', 'Frais ajoutés après facture', 10) $sql$,
  'DOSSIER_FACTURE');

-- L'argent ne se supprime pas
select pg_temp.expect_error(
  $sql$ delete from public.paiements where dossier_id = '88888888-8888-8888-8888-888888888888' $sql$,
  'SUPPRESSION_INTERDITE');

select pg_temp.expect_error(
  $sql$ delete from public.factures where dossier_id = '88888888-8888-8888-8888-888888888888' $sql$,
  'SUPPRESSION_INTERDITE');

-- -----------------------------------------------------------------------------
-- 7. Remboursement borné
-- -----------------------------------------------------------------------------
insert into public.remboursements (paiement_id, montant, motif)
select id, 40.00, 'Trop-perçu sur cours annulé'
from public.paiements
where dossier_id = '88888888-8888-8888-8888-888888888888' and montant = 190.00;

select pg_temp.assert_vrai(
  (select encaisse from public.v_dossiers where id = '88888888-8888-8888-8888-888888888888') = 350.00,
  'après remboursement de 40 €, encaissé attendu = 350 €');

select pg_temp.assert_vrai(
  (select statut from public.v_dossiers where id = '88888888-8888-8888-8888-888888888888') = 'acompte',
  'un remboursement rouvre le dossier (350 € < 390 €)');

select pg_temp.expect_error(
  $sql$ insert into public.remboursements (paiement_id, montant, motif)
        select id, 999.00, 'Trop' from public.paiements
        where dossier_id = '88888888-8888-8888-8888-888888888888' and montant = 190.00 $sql$,
  'REMBOURSEMENT_EXCESSIF');

-- -----------------------------------------------------------------------------
-- 8. Invariant global : facturé = encaissé + reste
-- -----------------------------------------------------------------------------
select pg_temp.assert_vrai(
  (select facture = encaisse + reste from public.v_kpis),
  'invariant cassé : facturé ≠ encaissé + reste');

-- Journal d'audit alimenté
select pg_temp.assert_vrai(
  (select count(*) from public.journal where entite = 'paiements') >= 2,
  'les paiements doivent être journalisés');

\echo '──────────────────────────────────────────────'
\echo '✔ FLUX COMPLET VALIDÉ : adhésion → cours → dossier → paiement → facture'
\echo '──────────────────────────────────────────────'

rollback;
