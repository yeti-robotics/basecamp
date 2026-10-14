'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { typographyVariants } from '@/components/ui/typography';
import { authClient } from '@/lib/auth-client';
import { navigateAfterAuth } from '@/lib/auth-navigation';
import { cn } from '@/lib/utils';

export function SignOutButton({ className }: { className?: string }) {
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function signOut() {
    setError(undefined);
    setIsPending(true);

    try {
      const { data, error: signOutError } = await authClient.signOut();

      if (signOutError) {
        throw new Error(signOutError.message ?? 'Sign out failed. Please try again.');
      }

      if (!data?.success) throw new Error('Sign out failed. Please try again.');

      navigateAfterAuth('/auth');
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Sign out failed.');
      setIsPending(false);
    }
  }

  return (
    <div className={cn('mt-6', className)}>
      <Button
        className="w-full"
        disabled={isPending}
        onClick={signOut}
        type="button"
        variant="outline"
      >
        {isPending ? 'Signing out…' : 'Sign out'}
      </Button>
      {error ? (
        <p
          className={typographyVariants({
            variant: 'p',
            className: 'mt-3 text-sm text-destructive',
          })}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
