import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseEnv } from '@/lib/env';

/**
 * Client Supabase côté serveur (Server Components, Route Handlers).
 * Les cookies Supabase sont relayés pour que la session manager soit partagée
 * avec la V1 — même projet, donc mêmes comptes.
 */
export async function supabaseServer() {
  const { url, publishableKey } = supabaseEnv();
  const store = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all) => {
        try {
          for (const { name, value, options } of all) {
            store.set(name, value, options);
          }
        } catch {
          // Un Server Component ne peut pas écrire de cookie : le middleware s'en charge.
        }
      },
    },
  });
}
