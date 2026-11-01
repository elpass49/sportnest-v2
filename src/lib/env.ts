/**
 * Accès aux variables d'environnement Supabase — et garde-fou.
 *
 * La V2 est en LECTURE SEULE : aucune clé service_role n'a sa place ici.
 * Si elle apparaît un jour, c'est une erreur d'architecture, pas une commodité.
 */

export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

export function supabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
        'Voir .env.example. Aucun fallback silencieux : une app sans base doit échouer bruyamment.',
    );
  }

  if (publishableKey.startsWith('sbp_') || publishableKey.length > 200) {
    throw new Error(
      'La clé fournie ressemble à une clé privée. La V2 en lecture seule utilise la clé publishable.',
    );
  }

  return { url, publishableKey };
}
