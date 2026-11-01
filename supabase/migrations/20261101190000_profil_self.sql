-- =============================================================================
-- Un utilisateur doit pouvoir lire sa propre ligne de profils
-- -----------------------------------------------------------------------------
-- Défaut révélé par l'interface : le pied de sidebar affichait « — » comme rôle.
-- La policy profils_lecture est réservée aux admins, donc un gestionnaire ne
-- pouvait pas lire son propre profil. On ajoute une lecture de soi, sans
-- élargir l'accès aux autres lignes.
-- =============================================================================

drop policy if exists profils_self on public.profils;

create policy profils_self on public.profils
  for select to authenticated
  using (user_id = auth.uid());

comment on policy profils_self on public.profils is
  'Chaque utilisateur lit sa propre ligne ; les autres restent réservées à l''admin.';
