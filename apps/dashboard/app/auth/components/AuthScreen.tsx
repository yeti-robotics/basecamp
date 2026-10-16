import { ArrowUpRight, Clock3, HandHeart, Layers3 } from 'lucide-react';
import { Brand } from '@/components/Brand';
import { SignInForm } from './SignInForm';

type AuthScreenProps = {
  authError?: string;
  redirectUrl?: string;
};

export function AuthScreen({ authError, redirectUrl }: AuthScreenProps) {
  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="border-b px-6 py-5 sm:px-10">
        <Brand />
      </header>
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-6 py-14 md:grid-cols-2 md:gap-20 md:py-24">
        <section aria-labelledby="welcome-heading" className="hidden md:block">
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            YETI Robotics / Team 3506
          </p>
          <h1
            id="welcome-heading"
            className="max-w-md text-5xl font-semibold leading-[1.15] tracking-tight"
          >
            Big ideas.
            <br />
            Real teamwork.
            <br />
            <span className="text-muted-foreground">Every hour counts.</span>
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">
            Your home base for the season. Keep track of the time you put in and the impact you
            make.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {[
              { icon: Clock3, label: 'Attendance' },
              { icon: HandHeart, label: 'Outreach' },
              { icon: Layers3, label: 'Season progress' },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground"
              >
                <Icon aria-hidden="true" className="size-3.5" />
                {label}
              </span>
            ))}
          </div>
        </section>
        <section
          className="mx-auto min-w-0 w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm sm:p-8"
          aria-labelledby="sign-in-heading"
        >
          <span className="mb-6 inline-flex size-10 items-center justify-center rounded-lg border bg-muted/40">
            <ArrowUpRight aria-hidden="true" className="size-5" />
          </span>
          <h2 id="sign-in-heading" className="text-2xl font-semibold tracking-tight">
            Welcome to Basecamp
          </h2>
          <p className="mb-7 mt-2 text-sm leading-6 text-muted-foreground">
            Sign in with your Discord account to see your team dashboard.
          </p>
          {authError ? (
            <p
              className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              Discord sign-in was not completed. Please try again.
            </p>
          ) : null}
          <SignInForm redirectUrl={redirectUrl} />
          <p className="mt-6 border-t pt-5 text-center text-xs leading-6 text-muted-foreground">
            One team. One home base.
          </p>
        </section>
      </div>
      <footer className="flex flex-wrap justify-between gap-3 border-t px-6 py-5 text-[11px] text-muted-foreground sm:px-10">
        <p>YETI Robotics Platform</p>
        <p>Basecamp / 3506</p>
      </footer>
    </main>
  );
}
