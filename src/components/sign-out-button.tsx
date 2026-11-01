'use client';

import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.push('/login');
        router.refresh();
      }}
      className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#7F7A96] transition hover:bg-[#221D33] hover:text-white"
    >
      Déconnexion
    </button>
  );
}
