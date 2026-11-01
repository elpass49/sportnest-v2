#!/usr/bin/env node
/**
 * Exécute le test de bout en bout (adhésion → cours → dossier → paiement →
 * facture) contre la base Supabase locale.
 *
 * Prérequis : `npm run db:start` (ou `supabase start`).
 * Le test est transactionnel et se termine par ROLLBACK : il ne laisse rien.
 *
 * Usage : npm run db:test
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const suites = [
  { file: 'supabase/tests/flux_complet.sql', label: 'Flux métier complet' },
  { file: 'supabase/tests/securite.sql', label: 'Sécurité (RLS, rôles)' },
];

let containerId = '';
try {
  containerId = execSync('docker ps -qf name=supabase_db', { encoding: 'utf8' }).trim();
} catch {
  console.error('✖ Docker injoignable. Lance Docker Desktop, puis `npm run db:start`.');
  process.exit(1);
}

if (!containerId) {
  console.error('✖ Aucun conteneur Supabase local. Lance `npm run db:start` d’abord.');
  process.exit(1);
}

let failed = false;

for (const suite of suites) {
  const sql = readFileSync(join(root, suite.file), 'utf8');
  const result = spawnSync(
    'docker',
    ['exec', '-i', containerId, 'psql', '-U', 'postgres', '-d', 'postgres',
     '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'],
    { input: sql, encoding: 'utf8' },
  );

  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const errors = out.split('\n').filter((l) => /ERROR|ASSERTION ÉCHOUÉE/.test(l));

  if (result.status !== 0 || errors.length > 0) {
    for (const line of errors) console.error('  ' + line);
    console.error(`✖ ${suite.label} : ÉCHEC`);
    failed = true;
  } else {
    console.log(`✔ ${suite.label} : OK`);
  }
}

if (failed) process.exit(1);

console.log('  (25 assertions métier + 16 assertions de sécurité, transactions annulées)');
