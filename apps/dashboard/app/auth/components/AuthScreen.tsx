import { Separator } from '@/components/ui/separator';
import { SignInForm } from './SignInForm';

type AuthScreenProps = {
  authError?: string;
  redirectUrl?: string;
};

export function AuthScreen({ authError, redirectUrl }: AuthScreenProps) {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute -right-44 -top-64 size-[540px] rounded-full bg-primary/[0.035] blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-60 -left-40 size-[440px] rounded-full bg-primary/[0.025] blur-[110px]" />

      <section
        className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8"
        aria-labelledby="sign-in-heading"
      >
        <header className="text-center">
          <h1 className="font-mono text-3xl font-bold uppercase leading-none tracking-tight">
            Basecamp
          </h1>
          <p className="mt-2 font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Yeti Robotics <span aria-hidden="true">·</span> 3506
          </p>
        </header>

        <div className="w-full space-y-5">
          <div className="text-center">
            <h2 id="sign-in-heading" className="text-lg font-medium">
              Sign in to your account
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Continue to Basecamp</p>
          </div>

          {authError && (
            <p
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              Discord sign-in was not completed. Please try again.
            </p>
          )}

          <SignInForm redirectUrl={redirectUrl} />
        </div>

        <footer className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground/50">
          <Separator className="w-8" />
          <p>YETI Robotics Platform</p>
          <Separator className="w-8" />
        </footer>
      </section>
    </main>
  );
}
