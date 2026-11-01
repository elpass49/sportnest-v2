'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('gestionnaire@example.org');
  const [password, setPassword] = useState('demo1234');
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);

    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });

    if (error) {
      setErreur('Identifiants refusés. Vérifie l’adresse et le mot de passe.');
      setChargement(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center bg-[#F6F6FA] px-6">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-3 mb-8">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#6D28D9] text-white font-bold">
            SN
          </div>
          <div>
            <div className="font-semibold text-[#17151F] leading-tight">SportNest</div>
            <div className="text-xs text-[#6B6880]">Gestion de club · V2</div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E8E7F0] bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-[#17151F]">Connexion</h1>
          <p className="mt-1 text-sm text-[#6B6880]">
            Accès réservé aux gestionnaires et administrateurs du club.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-[#3D3A4D]">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[#E8E7F0] bg-white px-3 py-2 text-sm text-[#17151F] outline-none focus:border-[#6D28D9] focus:ring-4 focus:ring-[#EDE9FE]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-medium text-[#3D3A4D]">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#E8E7F0] bg-white px-3 py-2 text-sm text-[#17151F] outline-none focus:border-[#6D28D9] focus:ring-4 focus:ring-[#EDE9FE]"
              />
            </div>

            {erreur && (
              <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]">
                {erreur}
              </p>
            )}

            <button
              type="submit"
              disabled={chargement}
              className="w-full rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#7C3AED] disabled:opacity-60"
            >
              {chargement ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[#918EA6]">
          Compte de démonstration : gestionnaire@example.org / demo1234
        </p>
      </div>
    </main>
  );
}
