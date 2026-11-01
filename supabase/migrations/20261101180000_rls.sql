-- =============================================================================
-- SportNest V2 — sécurité au niveau des lignes (RLS)
-- -----------------------------------------------------------------------------
-- Constat : les tables du schéma public étaient créées sans RLS. Dans Supabase,
-- le schéma public est exposé par PostgREST : sans RLS, tout dépend de grants
-- qui peuvent être ajoutés demain. Une base « saine » ne laisse pas ce choix
-- au hasard.
--
-- Modèle :
--   · anon          : aucun droit (aucune policy, aucun grant)
--   · authenticated : policies uniquement, selon le rôle lu dans profils
--   · lecture       : select
--   · gestionnaire  : select + insert + update (jamais delete sur l'argent)
--   · admin         : idem + les tables de référentiel
--   · aucune policy DELETE n'existe sur les tables financières
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fonctions de rôle (SECURITY DEFINER : elles lisent profils sans récursion)
-- -----------------------------------------------------------------------------
create or replace function public.fn_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profils p
  where p.user_id = auth.uid() and p.actif
  limit 1;
$$;

create or replace function public.fn_peut_lire()
returns boolean language sql stable security definer set search_path = public
as $$ select public.fn_role() in ('admin', 'gestionnaire', 'lecture'); $$;

create or replace function public.fn_peut_ecrire()
returns boolean language sql stable security definer set search_path = public
as $$ select public.fn_role() in ('admin', 'gestionnaire'); $$;

create or replace function public.fn_est_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.fn_role() = 'admin'; $$;

-- -----------------------------------------------------------------------------
-- 2. RLS + policies par table
--    niveau_lecture : 'lecture' (tous rôles actifs) ou 'admin'
--    niveau_ecriture : 'ecriture', 'admin' ou 'aucune'
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      -- table            lecture   ecriture
      ('saisons',         'lecture', 'admin'),
      ('tarifs',          'lecture', 'admin'),
      ('professeurs',     'lecture', 'admin'),
      ('familles',        'lecture', 'ecriture'),
      ('cours',           'lecture', 'admin'),
      ('membres',         'lecture', 'ecriture'),
      ('inscriptions',    'lecture', 'ecriture'),
      ('dossiers',        'lecture', 'ecriture'),
      ('lignes_dossier',  'lecture', 'ecriture'),
      ('paiements',       'lecture', 'ecriture'),
      ('remboursements',  'lecture', 'ecriture'),
      ('factures',        'lecture', 'ecriture'),
      ('journal',         'admin',   'aucune'),
      ('profils',         'admin',   'admin')
    ) as t(tbl, niveau_lecture, niveau_ecriture)
  loop
    execute format('alter table public.%I enable row level security', r.tbl);

    -- lecture
    execute format('drop policy if exists %I on public.%I', r.tbl || '_lecture', r.tbl);
    if r.niveau_lecture = 'admin' then
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.fn_est_admin())',
        r.tbl || '_lecture', r.tbl);
    else
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.fn_peut_lire())',
        r.tbl || '_lecture', r.tbl);
    end if;

    -- écriture (insert + update), jamais de policy DELETE sur les tables métier
    execute format('drop policy if exists %I on public.%I', r.tbl || '_insert', r.tbl);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_update', r.tbl);

    if r.niveau_ecriture = 'admin' then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (public.fn_est_admin())',
        r.tbl || '_insert', r.tbl);
      execute format(
        'create policy %I on public.%I for update to authenticated using (public.fn_est_admin()) with check (public.fn_est_admin())',
        r.tbl || '_update', r.tbl);
    elsif r.niveau_ecriture = 'ecriture' then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (public.fn_peut_ecrire())',
        r.tbl || '_insert', r.tbl);
      execute format(
        'create policy %I on public.%I for update to authenticated using (public.fn_peut_ecrire()) with check (public.fn_peut_ecrire())',
        r.tbl || '_update', r.tbl);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Privilèges bruts : anon n'a rien, authenticated n'a que ce que la RLS filtre
-- -----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Les vues s'appuient sur security_invoker : l'utilisateur doit pouvoir lire
-- les tables sous-jacentes, ce qui est le cas via les policies ci-dessus.
grant select on public.v_dossiers, public.v_kpis, public.v_cours_occupation, public.v_membres
  to authenticated;

comment on function public.fn_role() is
  'Rôle applicatif de l''utilisateur connecté, lu dans profils. SECURITY DEFINER.';
