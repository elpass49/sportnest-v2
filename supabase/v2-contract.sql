-- =============================================================================
-- SportNest V2 — contrat de lecture
-- -----------------------------------------------------------------------------
-- ADDITIF UNIQUEMENT. Ce fichier ne modifie aucune table existante :
--   · trois objets créés : deux vues + une fonction
--   · aucune colonne ajoutée, renommée ou supprimée
--   · aucun DROP, aucun ALTER sur public.payments
--
-- À appliquer d'abord sur STAGING, puis sur la prod après validation explicite.
-- Rollback : drop view public.v2_ledger_kpis; drop view public.v2_ledger;
--            drop function public.v2_kpis();
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Le grand livre : une ligne par dossier de paiement.
--    `security_invoker = true` => la RLS de public.payments s'applique à
--    l'appelant. Sans cela, la vue contournerait les 225 policies existantes.
-- -----------------------------------------------------------------------------
create or replace view public.v2_ledger
with (security_invoker = true) as
select
  p.id                                     as payment_id,
  p.member_id                              as member_id,
  p.member_name                            as titulaire,
  p.payment_date                           as date_reglement,
  coalesce(p.total_amount, 0)::numeric     as facture,
  coalesce(p.received_amount, 0)::numeric  as encaisse,
  (coalesce(p.total_amount, 0) - coalesce(p.received_amount, 0))::numeric as reste,
  case
    when coalesce(p.total_amount, 0) - coalesce(p.received_amount, 0) <= 0 then 'solde'
    when coalesce(p.received_amount, 0) = 0                               then 'impaye'
    else 'acompte'
  end                                      as statut
from public.payments p
-- Décision documentée : les dossiers annulés ou en échec ne sont pas facturés.
-- C'est un écart assumé avec la V1, expliqué par scripts/parity.ts.
where p.status not in ('cancelled', 'failed');

comment on view public.v2_ledger is
  'V2 — source unique des montants par dossier. Lecture seule, RLS de payments appliquée.';

-- -----------------------------------------------------------------------------
-- 2. Les indicateurs agrégés : une seule ligne, un seul chiffre par KPI.
--    Aucun écran ne doit additionner des montants lui-même.
-- -----------------------------------------------------------------------------
create or replace view public.v2_ledger_kpis
with (security_invoker = true) as
select
  count(*)                                  as dossiers,
  count(*) filter (where statut = 'solde')  as dossiers_soldes,
  count(*) filter (where statut <> 'solde') as dossiers_ouverts,
  coalesce(sum(facture), 0)                 as facture,
  coalesce(sum(encaisse), 0)                as encaisse,
  coalesce(sum(reste), 0)                   as reste
from public.v2_ledger;

comment on view public.v2_ledger_kpis is
  'V2 — agrégats financiers. Invariant : facture = encaisse + reste.';

-- -----------------------------------------------------------------------------
-- 3. Point d'entrée appelable en RPC depuis le serveur Next.js.
-- -----------------------------------------------------------------------------
create or replace function public.v2_kpis()
returns table (
  dossiers        bigint,
  dossiers_soldes bigint,
  dossiers_ouverts bigint,
  facture         numeric,
  encaisse        numeric,
  reste           numeric
)
language sql
stable
security invoker
as $$
  select dossiers, dossiers_soldes, dossiers_ouverts, facture, encaisse, reste
  from public.v2_ledger_kpis;
$$;

comment on function public.v2_kpis() is
  'V2 — RPC lecture seule des KPI financiers. Aucune écriture.';
