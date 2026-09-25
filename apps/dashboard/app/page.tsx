import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/auth');
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background px-4">
      <section className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          YETI Robotics · 3506
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome to Basecamp</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Signed in as {session.user.name || session.user.email}
        </p>
      </section>
    </main>
  );
}
