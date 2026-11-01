'use client';

import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from '@/lib/env';

/**
 * Client Supabase côté navigateur — clé publishable uniquement.
 * Aucun agrégat financier ne doit être calculé ici : ils viennent du serveur.
 */
export function supabaseBrowser() {
  const { url, publishableKey } = supabaseEnv();
  return createBrowserClient(url, publishableKey);
}
