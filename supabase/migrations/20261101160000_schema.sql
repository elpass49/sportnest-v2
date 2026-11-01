-- =============================================================================
-- SportNest V2 — schéma métier
-- -----------------------------------------------------------------------------
-- Base neuve, conçue pour qu'un flux complet (adhésion → inscription → dossier
-- → paiement → facture → comptabilité) ne puisse pas produire d'incohérence.
--
-- Principes :
--   · aucun montant stocké deux fois : les totaux sont des VUES, pas des colonnes
--   · les règles métier sont des CONTRAINTES, pas des espoirs côté client
--   · numeric(12,2) partout : pas de flottant sur de l'argent
--   · soft-delete interdit sur l'argent : on rembourse, on ne supprime pas
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Référentiel
-- -----------------------------------------------------------------------------
create table public.saisons (
  id        uuid primary key default gen_random_uuid(),
  libelle   text not null unique,                    -- '2025-2026'
  debut     date not null,
  fin       date not null,
  statut    text not null default 'preparee'
            check (statut in ('preparee', 'ouverte', 'fermee', 'archivee')),
  constraint saison_dates_valides check (fin > debut)
);

create table public.professeurs (
  id    uuid primary key default gen_random_uuid(),
  nom   text not null,
  email text,
  constraint prof_email_valide check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Le tarif dépend de la saison : on ne réécrit jamais un tarif passé.
create table public.tarifs (
  id        uuid primary key default gen_random_uuid(),
  saison_id uuid not null references public.saisons(id) on delete restrict,
  code      text not null,                            -- 'adhesion_individuelle', 'adhesion_famille'
  libelle   text not null,
  montant   numeric(12,2) not null check (montant >= 0),
  unique (saison_id, code)
);

create table public.familles (
  id        uuid primary key default gen_random_uuid(),
  saison_id uuid not null references public.saisons(id) on delete restrict,
  nom       text not null,
  unique (saison_id, nom)
);

create table public.membres (
  id             uuid primary key default gen_random_uuid(),
  saison_id      uuid not null references public.saisons(id) on delete restrict,
  famille_id     uuid references public.familles(id) on delete set null,
  nom            text not null check (length(trim(nom)) > 1),
  prenom         text not null check (length(trim(prenom)) > 1),
  date_naissance date not null,
  email          text,
  telephone      text,
  cree_le        timestamptz not null default now(),
  -- unicité de l'e-mail par saison : plus de doublons d'adhérent
  unique (saison_id, email),
  constraint membre_naissance_realiste check (date_naissance > '1900-01-01')
);

create index membres_famille_idx on public.membres (famille_id);
create index membres_nom_idx     on public.membres (nom, prenom);

-- -----------------------------------------------------------------------------
-- Activités
-- -----------------------------------------------------------------------------
create table public.cours (
  id            uuid primary key default gen_random_uuid(),
  saison_id     uuid not null references public.saisons(id) on delete restrict,
  nom           text not null,
  style         text not null,
  professeur_id uuid references public.professeurs(id) on delete set null,
  jour          smallint not null check (jour between 1 and 7),   -- 1 = lundi
  heure_debut   time not null,
  duree_min     smallint not null check (duree_min between 15 and 240),
  capacite      smallint not null check (capacite > 0),
  salle         text,
  tarif_cours   numeric(12,2) not null check (tarif_cours >= 0),
  -- deux cours ne peuvent pas occuper le même créneau dans la même salle
  unique (saison_id, salle, jour, heure_debut),
  unique (saison_id, nom, jour, heure_debut)
);

create table public.inscriptions (
  id        uuid primary key default gen_random_uuid(),
  membre_id uuid not null references public.membres(id) on delete cascade,
  cours_id  uuid not null references public.cours(id) on delete restrict,
  cree_le   timestamptz not null default now(),
  -- une seule inscription d'un membre à un cours donné
  unique (membre_id, cours_id)
);

create index inscriptions_cours_idx on public.inscriptions (cours_id);

-- -----------------------------------------------------------------------------
-- Facturation
-- -----------------------------------------------------------------------------
create table public.dossiers (
  id            uuid primary key default gen_random_uuid(),
  saison_id     uuid not null references public.saisons(id) on delete restrict,
  famille_id    uuid references public.familles(id) on delete restrict,
  beneficiaire  uuid references public.membres(id) on delete restrict,
  numero        text not null unique,
  cree_le       timestamptz not null default now(),
  -- un dossier appartient soit à une famille, soit à une personne
  constraint dossier_porteur check (
    (famille_id is not null and beneficiaire is null) or
    (famille_id is null and beneficiaire is not null)
  )
);

create table public.lignes_dossier (
  id         uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete restrict,
  membre_id  uuid references public.membres(id) on delete restrict,
  cours_id   uuid references public.cours(id) on delete restrict,
  type       text not null check (type in ('adhesion', 'cours', 'remise', 'frais')),
  libelle    text not null,
  montant    numeric(12,2) not null,
  -- seules les remises sont négatives ; tout le reste est positif ou nul
  constraint ligne_signe_coherent check (
    (type = 'remise' and montant <= 0) or (type <> 'remise' and montant >= 0)
  )
);

create index lignes_dossier_idx on public.lignes_dossier (dossier_id);

create table public.paiements (
  id               uuid primary key default gen_random_uuid(),
  dossier_id       uuid not null references public.dossiers(id) on delete restrict,
  montant          numeric(12,2) not null check (montant > 0),
  moyen            text not null check (moyen in ('cb', 'sepa', 'especes', 'cheque', 'helloasso', 'virement')),
  encaisse_le      date not null default current_date,
  operateur        text not null,
  -- empêche un double encaissement sur rejeu de requête
  cle_idempotence  text unique,
  annule_le        timestamptz,
  cree_le          timestamptz not null default now()
);

create index paiements_dossier_idx on public.paiements (dossier_id);

create table public.remboursements (
  id           uuid primary key default gen_random_uuid(),
  paiement_id  uuid not null references public.paiements(id) on delete restrict,
  montant      numeric(12,2) not null check (montant > 0),
  motif        text not null,
  decide_le    date not null default current_date,
  cree_le      timestamptz not null default now()
);

create table public.factures (
  id         uuid primary key default gen_random_uuid(),
  dossier_id uuid not null unique references public.dossiers(id) on delete restrict,
  numero     text not null unique,
  montant    numeric(12,2) not null check (montant >= 0),
  -- empreinte des lignes au moment de l'émission : toute modification devient détectable
  empreinte  text not null,
  emise_le   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Journal d'audit
-- -----------------------------------------------------------------------------
create table public.journal (
  id        bigserial primary key,
  acteur    text not null,
  action    text not null,
  entite    text not null,
  entite_id uuid,
  avant     jsonb,
  apres     jsonb,
  cree_le   timestamptz not null default now()
);

create index journal_entite_idx on public.journal (entite, entite_id);

-- -----------------------------------------------------------------------------
-- Rôles applicatifs (séparé des membres : un manager n'est pas un adhérent)
-- -----------------------------------------------------------------------------
create table public.profils (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  email     text not null,
  role      text not null check (role in ('admin', 'gestionnaire', 'lecture')),
  actif     boolean not null default true,
  cree_le   timestamptz not null default now()
);
