import { redirect } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { typographyVariants } from '@/components/ui/typography';
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
      <main className="mx-auto min-h-svh max-w-7xl px-5 py-12 sm:px-8">
        <h1 className={typographyVariants({ variant: 'h2' })}>Roster</h1>
        <Alert className="mt-6">
          <AlertTitle>The roster could not be loaded</AlertTitle>
          <AlertDescription>Reload to try again.</AlertDescription>
        </Alert>
        <div className="mt-4 flex gap-3">
          <Button asChild>
            <a href="/roster">Reload roster</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/">Dashboard</a>
          </Button>
        </div>
      </main>
    );
  }

  const ownMember = view.ownMember
    ? { ...view.ownMember, name: session.user.name, image: session.user.image ?? null }
    : null;
  return <RosterTable {...view} ownMember={ownMember} />;
}
