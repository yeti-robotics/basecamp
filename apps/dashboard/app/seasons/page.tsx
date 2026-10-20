import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSeasons } from '@/lib/seasons';
import { SeasonManager } from './SeasonManager';

export default async function SeasonsPage() {
  const session = await getSession();
  if (!session?.user) redirect('/auth');

  const view = await getSeasons();
  if (!view) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-white">
        <h1 className="text-3xl font-semibold">Seasons</h1>
        <p className="mt-4 text-zinc-400">
          Season management is available to Team Admins and Mentors.
        </p>
      </main>
    );
  }

  return <SeasonManager {...view} />;
}
