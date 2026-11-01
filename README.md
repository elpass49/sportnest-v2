# SportNest V2

Nouvelle application de gestion de club — **lecture seule** sur la base Supabase
existante, pendant que la V1 continue de tourner sans être modifiée.

## Règles du projet (non négociables)

1. **La V1 n'est pas touchée** : aucun commit sur `elpass49/sportnest-abo-manager`,
   aucune publication Lovable, aucun réglage modifié côté Lovable.
2. **Aucune écriture en base** : la V2 ne fait que lire, via le contrat SQL
   `supabase/v2-contract.sql` (`v2_ledger`, `v2_ledger_kpis`, `v2_kpis()`).
   Contrôle mécanique : `npm run lint:readonly`.
3. **Un seul chiffre par indicateur** : tous les montants viennent de
   `computeKpis()` (`src/lib/ledger.ts`) ou de la RPC `v2_kpis()`. Aucun composant
   ne fait d'addition de montants lui-même.
4. **Un seul formateur monétaire** : `eur()` (`src/lib/money.ts`).
5. **Aucune clé privée** dans ce projet : pas de `service_role`, pas de token
   Airtable.

## Démarrage

```bash
cp .env.example .env.local     # renseigner URL + clé publishable
npm install
npm run dev                    # http://localhost:3000
```

## Vérifications

```bash
npm run test            # tests unitaires du grand livre et du formatage
npm run lint            # ESLint
npm run lint:readonly   # échoue si un .insert/.update/.upsert/.delete apparaît
npm run build           # build de production

npm run db:start        # base Supabase locale (Docker)
npm run db:test         # flux complet : adhésion → cours → dossier → paiement → facture
npm run db:stop         # arrêt de la base locale
```

## État d'avancement

| Phase | État |
|---|---|
| 0 — dépôt, socle | ✅ dépôt privé, Next 16, garde lecture seule, 12 tests unitaires |
| 1 — base saine | ✅ schéma + invariants + 25 assertions de bout en bout (local Docker) |
| 2 — auth + coquille | à faire |
| 3 — écrans (dashboard, dossiers, suivi, comptabilité) | à faire |
| 4 — parité V1/V2 | à faire |
| 5 — pilote et bascule | à faire |
| 5 bis — import des données V1 | à faire (export → import → réconciliation au centime) |

### La base en une phrase

Aucun total n'est stocké : `v_dossiers` et `v_kpis` recalculent tout à partir
des lignes et des paiements, et les règles métier (capacité, surpaiement,
remboursement, gel après facture, idempotence) sont des **triggers et
contraintes**, pas des contrôles côté front.

## Invariant financier

```
facture = encaisse + reste
```

Vérifié par les tests (`isBalanced`) et affiché à l'écran sur chaque page qui
présente des montants.

## Contexte

- Base : projet Supabase existant, **lecture seule**
- Auth : comptes managers existants (même projet, donc même session)
- V1 : `elpass49/sportnest-abo-manager`, publiée par Lovable depuis `main`
- Plan détaillé : `PLAN_V2_projet_neuf.md`
