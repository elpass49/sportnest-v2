-- =============================================================================
-- SportNest V2 — invariants métier
-- -----------------------------------------------------------------------------
-- Chaque règle qui compte est ici, dans la base. Le front ne « garantit » rien :
-- il propose, la base dispose.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Calculs de référence (jamais stockés en colonne : aucune dérive possible)
-- -----------------------------------------------------------------------------
create or replace function public.fn_facture_dossier(p_dossier uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(montant), 0)::numeric(12,2)
  from public.lignes_dossier
  where dossier_id = p_dossier;
$$;

-- Encaissé net = paiements non annulés − remboursements
create or replace function public.fn_encaisse_dossier(p_dossier uuid)
returns numeric
language sql
stable
as $$
  select (
    select coalesce(sum(p.montant), 0)
    from public.paiements p
    where p.dossier_id = p_dossier and p.annule_le is null
  )::numeric(12,2)
  -
  (
    select coalesce(sum(r.montant), 0)
    from public.remboursements r
    join public.paiements pp on pp.id = r.paiement_id
    where pp.dossier_id = p_dossier
  )::numeric(12,2);
$$;

create or replace function public.fn_statut_dossier(p_facture numeric, p_encaisse numeric)
returns text
language sql
immutable
as $$
  select case
    when p_facture <= 0 then 'vide'
    when p_encaisse >= p_facture then 'solde'
    when p_encaisse = 0 then 'impaye'
    else 'acompte'
  end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Capacité d'un cours : impossible de dépasser, même en concurrence
-- -----------------------------------------------------------------------------
create or replace function public.fn_check_capacite()
returns trigger
language plpgsql
as $$
declare
  v_capacite smallint;
  v_inscrits integer;
begin
  -- verrouille la ligne du cours : deux inscriptions simultanées se sérialisent
  select capacite into v_capacite
  from public.cours
  where id = new.cours_id
  for update;

  if v_capacite is null then
    raise exception 'COURS_INEXISTANT: %', new.cours_id using errcode = 'P0001';
  end if;

  select count(*) into v_inscrits
  from public.inscriptions
  where cours_id = new.cours_id;

  if v_inscrits >= v_capacite then
    raise exception 'COURS_COMPLET: le cours % est complet (%/% places)',
      new.cours_id, v_inscrits, v_capacite using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger trg_capacite_cours
before insert on public.inscriptions
for each row execute function public.fn_check_capacite();

-- -----------------------------------------------------------------------------
-- 3. Un dossier ne peut pas être sur-encaissé
-- -----------------------------------------------------------------------------
create or replace function public.fn_check_paiement()
returns trigger
language plpgsql
as $$
declare
  v_facture  numeric(12,2);
  v_encaisse numeric(12,2);
begin
  -- sérialise les paiements d'un même dossier
  perform 1 from public.dossiers where id = new.dossier_id for update;

  v_facture  := public.fn_facture_dossier(new.dossier_id);
  v_encaisse := public.fn_encaisse_dossier(new.dossier_id);

  -- en mise à jour, retirer la contribution de la ligne courante avant de
  -- réintégrer la nouvelle valeur (sinon changer un moyen de paiement échoue)
  if tg_op = 'UPDATE' and old.annule_le is null then
    v_encaisse := v_encaisse - old.montant;
  end if;

  if v_encaisse + new.montant > v_facture then
    raise exception 'SURPAIEMENT: encaissé % + % dépasse la facture % du dossier %',
      v_encaisse, new.montant, v_facture, new.dossier_id using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger trg_check_paiement
before insert or update on public.paiements
for each row execute function public.fn_check_paiement();

-- -----------------------------------------------------------------------------
-- 4. Un remboursement ne peut pas dépasser le paiement d'origine
-- -----------------------------------------------------------------------------
create or replace function public.fn_check_remboursement()
returns trigger
language plpgsql
as $$
declare
  v_montant_paiement numeric(12,2);
  v_deja_rembourse   numeric(12,2);
begin
  select montant into v_montant_paiement
  from public.paiements where id = new.paiement_id for update;

  select coalesce(sum(montant), 0) into v_deja_rembourse
  from public.remboursements where paiement_id = new.paiement_id;

  if v_deja_rembourse + new.montant > v_montant_paiement then
    raise exception 'REMBOURSEMENT_EXCESSIF: % déjà remboursé + % demandé > paiement %',
      v_deja_rembourse, new.montant, v_montant_paiement using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger trg_check_remboursement
before insert on public.remboursements
for each row execute function public.fn_check_remboursement();

-- -----------------------------------------------------------------------------
-- 5. Une fois facturé, un dossier est figé
-- -----------------------------------------------------------------------------
create or replace function public.fn_check_ligne_gele()
returns trigger
language plpgsql
as $$
declare
  v_dossier uuid;
begin
  if tg_op = 'DELETE' then
    v_dossier := old.dossier_id;
  else
    v_dossier := new.dossier_id;
  end if;

  if exists (select 1 from public.factures where dossier_id = v_dossier) then
    raise exception 'DOSSIER_FACTURE: le dossier % a une facture émise, ses lignes sont figées',
      v_dossier using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_ligne_gele
before insert or update or delete on public.lignes_dossier
for each row execute function public.fn_check_ligne_gele();

-- Une seule adhésion facturée par membre et par saison
create unique index if not exists uniq_adhesion_membre
  on public.lignes_dossier (membre_id)
  where type = 'adhesion' and membre_id is not null;

-- -----------------------------------------------------------------------------
-- 6. L'argent ne se supprime pas
-- -----------------------------------------------------------------------------
create or replace function public.fn_interdire_suppression()
returns trigger
language plpgsql
as $$
begin
  raise exception 'SUPPRESSION_INTERDITE: utilisez une annulation ou un remboursement (%)', tg_table_name
    using errcode = 'P0001';
end;
$$;

create trigger trg_no_delete_paiements
before delete on public.paiements
for each row execute function public.fn_interdire_suppression();

create trigger trg_no_delete_factures
before delete on public.factures
for each row execute function public.fn_interdire_suppression();

-- -----------------------------------------------------------------------------
-- 7. Journalisation automatique
-- -----------------------------------------------------------------------------
create or replace function public.fn_journaliser()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acteur text := coalesce(current_setting('app.acteur', true), 'system');
  v_id     uuid;
begin
  v_id := case when tg_op = 'DELETE' then old.id else new.id end;

  insert into public.journal (acteur, action, entite, entite_id, avant, apres)
  values (
    v_acteur,
    lower(tg_op),
    tg_table_name,
    v_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger trg_journal_lignes
after insert or update or delete on public.lignes_dossier
for each row execute function public.fn_journaliser();

create trigger trg_journal_paiements
after insert or update or delete on public.paiements
for each row execute function public.fn_journaliser();

create trigger trg_journal_factures
after insert or update or delete on public.factures
for each row execute function public.fn_journaliser();

create trigger trg_journal_inscriptions
after insert or delete on public.inscriptions
for each row execute function public.fn_journaliser();

-- -----------------------------------------------------------------------------
-- 8. Vues de lecture — la seule source des chiffres
-- -----------------------------------------------------------------------------
create or replace view public.v_dossiers
with (security_invoker = true) as
select
  d.id,
  d.numero,
  d.saison_id,
  d.famille_id,
  d.beneficiaire,
  d.cree_le,
  f.facture,
  e.encaisse,
  (f.facture - e.encaisse) as reste,
  public.fn_statut_dossier(f.facture, e.encaisse) as statut
from public.dossiers d
cross join lateral (select public.fn_facture_dossier(d.id) as facture) f
cross join lateral (select public.fn_encaisse_dossier(d.id) as encaisse) e;

create or replace view public.v_kpis
with (security_invoker = true) as
select
  count(*)                                        as dossiers,
  count(*) filter (where statut = 'solde')        as dossiers_soldes,
  count(*) filter (where statut in ('acompte', 'impaye')) as dossiers_ouverts,
  count(*) filter (where statut = 'impaye')       as dossiers_impayes,
  coalesce(sum(facture), 0)::numeric(12,2)        as facture,
  coalesce(sum(encaisse), 0)::numeric(12,2)       as encaisse,
  coalesce(sum(reste), 0)::numeric(12,2)          as reste,
  case when coalesce(sum(facture), 0) = 0 then 0
       else round(coalesce(sum(encaisse), 0) / sum(facture), 6)
  end                                             as taux_recouvrement
from public.v_dossiers;

create or replace view public.v_cours_occupation
with (security_invoker = true) as
select
  c.id,
  c.nom,
  c.style,
  c.jour,
  c.heure_debut,
  c.duree_min,
  c.capacite,
  c.tarif_cours,
  coalesce(i.inscrits, 0)                    as inscrits,
  c.capacite - coalesce(i.inscrits, 0)       as places_restantes,
  (coalesce(i.inscrits, 0) >= c.capacite)    as complet
from public.cours c
left join (select cours_id, count(*) as inscrits from public.inscriptions group by cours_id) i
  on i.cours_id = c.id;

create or replace view public.v_membres
with (security_invoker = true) as
select
  m.*,
  x.age,
  x.categorie,
  coalesce(nb.nb_cours, 0) as nb_cours
from public.membres m
cross join lateral (
  select
    date_part('year', age(current_date, m.date_naissance))::int as age,
    case when age(current_date, m.date_naissance) < interval '18 years'
         then 'mineur' else 'adulte' end as categorie
) x
left join (select membre_id, count(*) as nb_cours from public.inscriptions group by membre_id) nb
  on nb.membre_id = m.id;
