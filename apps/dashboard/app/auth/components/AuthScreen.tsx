import { Separator } from '@/components/ui/separator';
import { SignInForm } from './SignInForm';

export function AuthScreen() {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-5 py-10">
      <div className="pointer-events-none absolute -right-44 -top-64 size-[540px] rounded-full bg-primary/[0.035] blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-60 -left-40 size-[440px] rounded-full bg-primary/[0.025] blur-[110px]" />

      <section
        className="relative z-10 flex w-full max-w-[400px] flex-col items-center gap-10 sm:gap-12"
        aria-labelledby="sign-in-heading"
      >
        <header className="text-center">
          <h1 className="font-mono text-[clamp(1.7rem,3vw,2rem)] font-bold uppercase leading-none tracking-[-0.065em]">
            Basecamp
          </h1>
          <p className="mt-2.5 font-mono text-[0.82rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Yeti Robotics <span aria-hidden="true">·</span> 3506
          </p>
        </header>

        <div className="w-full">
          <div className="text-center">
            <h2 id="sign-in-heading" className="text-xl font-semibold tracking-tight">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">Continue to basecamp &amp; data</p>
          </div>
          <SignInForm />
        </div>

        <footer className="flex items-center gap-4 text-sm text-muted-foreground/50">
          <Separator className="w-12" />
          <p>FRC Platform</p>
          <Separator className="w-12" />
        </footer>
      </section>
    </main>
  );
}
