'use client';

import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { authClient } from '@/lib/auth-client';
import { DiscordIcon } from './AuthIcons';

function safeRedirectUrl(redirectUrl?: string) {
  return redirectUrl?.startsWith('/') && !redirectUrl.startsWith('//') ? redirectUrl : '/';
}

export function SignInForm({ redirectUrl }: { redirectUrl?: string }) {
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function signInDiscord() {
    setError(undefined);
    setIsPending(true);

    try {
      const { error: signInError } = await authClient.signIn.social({
        provider: 'discord',
        callbackURL: safeRedirectUrl(redirectUrl),
        errorCallbackURL: '/auth?error=oauth',
      });

      if (signInError) {
        throw new Error(signInError.message ?? 'Discord sign-in could not be started.');
      }
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Discord sign-in failed.');
      setIsPending(false);
    }
  }

  return (
    <div>
      <Button
        className="h-12 w-full bg-[#5865f2] text-base text-white hover:bg-[#4752c4]"
        disabled={isPending}
        onClick={signInDiscord}
        type="button"
      >
        <DiscordIcon className="size-5" />
        {isPending ? 'Connecting to Discord…' : 'Sign in with Discord'}
      </Button>

      {error && (
        <p className="mt-3 text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div
        className="my-4 flex items-center gap-5 text-sm text-muted-foreground"
        aria-hidden="true"
      >
        <Separator className="flex-1" />
        <span>or</span>
        <Separator className="flex-1" />
      </div>

      <Button className="h-12 w-full bg-card/50 text-base" disabled type="button" variant="outline">
        <KeyRound className="size-5" />
        Sign in with Passkey — coming soon
      </Button>
    </div>
  );
}
