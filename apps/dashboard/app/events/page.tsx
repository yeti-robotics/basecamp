import { redirect } from 'next/navigation';
import { Brand } from '@/components/Brand';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getEvents } from '@/lib/events';
import { getSession } from '@/lib/auth';
import { getSeasons } from '@/lib/seasons';
import { EventsList } from '../EventsList';

export default async function EventsPage() {
  const session = await getSession();
  if (!session?.user) redirect('/auth');

  const now = new Date().toISOString();
  const [events, seasonView] = await Promise.all([getEvents(), getSeasons()]);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Brand />
          <Button asChild variant="ghost" size="sm">
            <a href="/">Dashboard</a>
          </Button>
        </div>
      </header>
      <main className="mx-auto min-h-svh max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            YETI Robotics
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Events</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Meetings, outreach, and other team events across seasons.
          </p>
        </header>
        {events ? (
          <EventsList
            events={events}
            now={now}
            canManage={seasonView?.canManage ?? false}
            seasons={seasonView?.seasons ?? []}
          />
        ) : (
          <Alert className="mt-8">
            <AlertTitle>Events could not be loaded</AlertTitle>
            <AlertDescription>Reload the page to try again.</AlertDescription>
          </Alert>
        )}
      </main>
    </div>
  );
}
