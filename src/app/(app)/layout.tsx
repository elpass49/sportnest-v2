import type { ReactNode } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/sign-out-button';

const NAV = [
  { label: 'Tableau de bord', href: '/dashboard', actif: true },
  { label: 'Dossiers', href: '/dossiers', actif: false },
  { label: 'Adhérents', href: '/adherents', actif: false },
  { label: 'Cours', href: '/cours', actif: false },
  { label: 'Comptabilité', href: '/comptabilite', actif: false },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = await supabase
    .from('profils')
    .select('role, email')
    .eq('user_id', user?.id ?? '')
    .maybeSingle();

  const role = (profil as { role?: string } | null)?.role ?? '—';
  const email = user?.email ?? '—';

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="flex flex-col bg-[#14121C] text-[#C9C5DC] md:sticky md:top-0 md:h-screen md:overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-[15px] font-extrabold text-white">
            SN
          </div>
          <div>
            <div className="text-[14.5px] font-semibold leading-tight text-white">SportNest</div>
            <div className="text-[11px] tracking-wide text-[#7F7A96]">Gestion de club</div>
          </div>
        </div>

        <div className="mx-3 mb-3 rounded-xl border border-[#2A2540] bg-[#1F1B2E] px-3 py-2.5">
          <div className="text-[10.5px] uppercase tracking-widest text-[#7F7A96]">Saison</div>
          <div className="text-[13px] font-semibold text-white">2025 · 2026</div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
          {NAV.map((item) =>
            item.actif ? (
              <a
                key={item.href}
                href={item.href}
                className="mb-0.5 flex items-center gap-2.5 rounded-lg bg-[#6D28D9] px-2.5 py-2 text-[13.5px] font-semibold text-white"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {item.label}
              </a>
            ) : (
              <span
                key={item.href}
                aria-disabled="true"
                title="Écran à venir"
                className="mb-0.5 flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-[#4E4966]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {item.label}
                <span className="ml-auto whitespace-nowrap pr-0.5 text-[9.5px] uppercase tracking-wide">à venir</span>
              </span>
            ),
          )}
        </nav>

        <div className="border-t border-[#241F38] p-3">
          <div className="mb-2 flex items-center gap-2.5 px-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#A855F7] to-[#6D28D9] text-[11px] font-bold text-white">
              {email.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold text-white">{email}</div>
              <div className="text-[11px] capitalize text-[#7F7A96]">{role}</div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="min-w-0 bg-[#F6F6FA]">{children}</main>
    </div>
  );
}
