import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DiscordIcon } from './AuthIcons';

function signInUrl(provider: 'discord' | 'passkey', redirectUrl?: string) {
  const params = new URLSearchParams();

  if (redirectUrl?.startsWith('/') && !redirectUrl.startsWith('//')) {
    params.set('callbackURL', redirectUrl);
  }

  const query = params.toString();
  return `/api/auth/sign-in/${provider}${query ? `?${query}` : ''}`;
}

export function SignInForm({ redirectUrl }: { redirectUrl?: string }) {
  return (
    <div>
      <Button asChild className="h-12 w-full bg-[#5d67e8] text-base text-white hover:bg-[#6872f0]">
        <a href={signInUrl('discord', redirectUrl)}>
          <DiscordIcon className="size-5" />
          Sign in with Discord
        </a>
      </Button>

      <div
        className="my-4 flex items-center gap-5 text-sm text-muted-foreground"
        aria-hidden="true"
      >
        <Separator className="flex-1" />
        <span>or</span>
        <Separator className="flex-1" />
      </div>

      <Button asChild variant="outline" className="h-12 w-full bg-card/50 text-base">
        <a href={signInUrl('passkey', redirectUrl)}>
          <KeyRound className="size-5" />
          Sign in with Passkey
        </a>
      </Button>
    </div>
  );
}
