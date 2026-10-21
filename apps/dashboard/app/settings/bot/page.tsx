import { redirect } from 'next/navigation';
import { Brand } from '@/components/Brand';
import { getSession } from '@/lib/auth';
import { getBotStatus } from '@/lib/bot-settings';
import { SignOutButton } from '../../SignOutButton';
import { BotSettings } from './BotSettings';

export default async function BotSettingsPage() {
  const session = await getSession();
  if (!session?.user) redirect('/auth');

  const status = await getBotStatus();
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-5">
            <Brand />
            <span className="hidden text-sm text-muted-foreground sm:block">Settings</span>
          </div>
          <SignOutButton className="mt-0" />
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-5 py-9 sm:px-8 sm:py-12">
        <div>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Dashboard
          </a>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Discord bot settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage the interactive bot connection for this Basecamp installation.
          </p>
        </div>
        {status ? (
          <BotSettings initialStatus={status} />
        ) : (
          <section className="rounded-xl border bg-card p-6" aria-labelledby="unavailable-heading">
            <h2 id="unavailable-heading" className="font-medium">
              Settings unavailable
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You may not have permission to manage Discord settings, or the service could not be
              reached. Contact a Team Admin if you need access.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
