import { Separator } from '@/components/ui/separator';
import { typographyVariants } from '@/components/ui/typography';
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
          <h1 className={typographyVariants({ variant: 'h1' })}>Basecamp</h1>
          <p className={typographyVariants({ variant: 'muted', className: 'mt-3' })}>
            Yeti Robotics <span aria-hidden="true">·</span> 3506
          </p>
        </header>

        <div className="w-full space-y-5">
          <div className="text-center">
            <h2
              id="sign-in-heading"
              className={typographyVariants({ variant: 'h3', className: 'text-balance' })}
            >
              Sign in to your account
            </h2>
            <p className={typographyVariants({ variant: 'muted', className: 'mt-2 leading-6' })}>
              Continue to Basecamp
            </p>
          </div>

          {authError && (
            <p
              className={typographyVariants({
                variant: 'p',
                className:
                  'rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive',
              })}
              role="alert"
            >
              Discord sign-in was not completed. Please try again.
            </p>
          )}

          <SignInForm redirectUrl={redirectUrl} />
        </div>

        <footer
          className={typographyVariants({
            variant: 'muted',
            className: 'flex items-center gap-2 whitespace-nowrap',
          })}
        >
          <Separator className="w-8" />
          <p>YETI Robotics Platform</p>
          <Separator className="w-8" />
        </footer>
      </section>
    </main>
  );
}
