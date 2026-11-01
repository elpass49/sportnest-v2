-- =============================================================================
-- Anonymisation du STAGING uniquement.
-- -----------------------------------------------------------------------------
-- À exécuter EXCLUSIVEMENT sur la base de développement.
-- Garde-fou en tête de script : refuse de tourner si l'URL ne contient pas
-- "staging" (à compléter avec le ref du projet de staging).
--
-- JAMAIS sur la production (projet xhrgpiucyxushkunlexz).
-- =============================================================================

do $$
begin
  if current_setting('app.env', true) is distinct from 'staging' then
    raise exception
      'Anonymisation refusée : exécuter avec SET app.env = ''staging''; en préambule.';
  end if;
end $$;

set app.env = 'staging';

-- Adhérents : e-mails et téléphones neutralisés, noms remplacés.
update public.members
set email = 'membre' || substr(md5(id::text), 1, 8) || '@example.org',
    phone = null
where email is not null
   or phone is not null;

update public.adherents_n
set nom_adh = 'NOM' || substr(md5(id::text), 1, 4),
    prenom_adh = 'PRENOM' || substr(md5(id::text), 5, 4)
where nom_adh is not null;

-- Contrôles de sortie
select count(*) as emails_non_anonymises
from public.members
where email is not null and email not like '%@example.org';
