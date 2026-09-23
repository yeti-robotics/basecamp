import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DiscordIcon } from './AuthIcons';

export function SignInForm() {
  return (
    <div className="mt-7">
      <Button asChild className="h-12 w-full bg-[#5d67e8] text-base text-white hover:bg-[#6872f0]">
        <a href="/api/auth/sign-in/discord">
          <DiscordIcon className="size-5" />
          Sign in with Discord
        </a>
      </Button>

      <div
        className="my-5 flex items-center gap-5 text-sm text-muted-foreground"
        aria-hidden="true"
      >
        <Separator className="flex-1" />
        <span>or</span>
        <Separator className="flex-1" />
      </div>

      <Button asChild variant="outline" className="h-12 w-full bg-card/50 text-base">
        <a href="/api/auth/sign-in/passkey">
          <KeyRound className="size-5" />
          Sign in with Passkey
        </a>
      </Button>
    </div>
  );
}
