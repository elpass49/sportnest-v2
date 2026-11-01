#!/usr/bin/env node
/**
 * Garde « la V2 n'écrit pas ».
 *
 * La V2 tourne en lecture seule sur la base de production. Ce script échoue si
 * un appel d'écriture Supabase apparaît dans src/ hors fichiers de test.
 *
 * Usage : npm run lint:readonly
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const WRITE_CALL = /\.(insert|update|upsert|delete)\s*\(/g;

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const violations = [];
for (const file of walk(ROOT)) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    WRITE_CALL.lastIndex = 0;
    if (WRITE_CALL.test(line)) {
      violations.push(`${relative(process.cwd(), file)}:${i + 1}  ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error('✖ Écriture détectée dans la V2 (lecture seule) :');
  for (const v of violations) console.error('  ' + v);
  console.error('\nLa V2 ne doit jamais écrire avant la Phase 6, et seulement après validation.');
  process.exit(1);
}

console.log('✔ Aucune écriture dans src/ — la V2 est bien en lecture seule.');
