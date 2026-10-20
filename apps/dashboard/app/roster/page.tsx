import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getRosterView } from '@/lib/roster';
import { RosterTable } from './RosterTable';

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ seasonId?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect('/auth');
  const params = await searchParams;
  const parsedSeasonId = params.seasonId ? Number(params.seasonId) : undefined;
  const seasonId =
    parsedSeasonId && Number.isSafeInteger(parsedSeasonId) ? parsedSeasonId : undefined;
  const view = await getRosterView(seasonId);

  if (!view) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 text-white">
        <h1 className="text-3xl font-semibold">Roster</h1>
        <p className="mt-4 text-zinc-400">The roster could not be loaded. Reload to try again.</p>
      </main>
    );
  }

  const ownMember = view.ownMember
    ? { ...view.ownMember, name: session.user.name, image: session.user.image ?? null }
    : null;
  return <RosterTable {...view} ownMember={ownMember} />;
}
