-- =============================================================================
-- Idempotence réelle des encaissements
-- -----------------------------------------------------------------------------
-- Constat du test de bout en bout : un rejeu du même paiement déclenchait
-- SURPAIEMENT avant d'atteindre la contrainte d'unicité. Le client recevait
-- donc une erreur incompréhensible au lieu d'un no-op idempotent.
--
-- Correction : le trigger absorbe le rejeu (RETURN NULL ⇒ aucune ligne insérée),
-- ce qui rend l'API réessayable sans risque de double encaissement.
-- =============================================================================

create or replace function public.fn_check_paiement()
returns trigger
language plpgsql
as $$
declare
  v_facture  numeric(12,2);
  v_encaisse numeric(12,2);
begin
  -- 1. Idempotence : une clé déjà utilisée ⇒ le rejeu est ignoré, sans erreur.
  if tg_op = 'INSERT' and new.cle_idempotence is not null then
    if exists (
      select 1 from public.paiements
      where cle_idempotence = new.cle_idempotence
    ) then
      return null;   -- aucune ligne insérée, aucun dégât
    end if;
  end if;

  -- 2. Sérialise les paiements d'un même dossier
  perform 1 from public.dossiers where id = new.dossier_id for update;

  v_facture  := public.fn_facture_dossier(new.dossier_id);
  v_encaisse := public.fn_encaisse_dossier(new.dossier_id);

  -- En mise à jour, retirer la contribution de la ligne courante
  if tg_op = 'UPDATE' and old.annule_le is null then
    v_encaisse := v_encaisse - old.montant;
  end if;

  -- 3. Interdit le sur-encaissement
  if v_encaisse + new.montant > v_facture then
    raise exception 'SURPAIEMENT: encaissé % + % dépasse la facture % du dossier %',
      v_encaisse, new.montant, v_facture, new.dossier_id using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.fn_check_paiement() is
  'V2 — idempotence par cle_idempotence (rejeu absorbé) + refus du sur-encaissement.';
