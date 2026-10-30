'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Brand } from '@/components/Brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ProfileSetup({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/roster/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredName: name }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(typeof result.message === 'string' ? result.message : 'Could not save your name.');
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Could not save your name. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background px-5 py-12">
      <div className="w-full max-w-md">
        <Brand />
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>What should we call you?</CardTitle>
            <CardDescription>
              Share the name you use with the team so admins can identify you on the roster.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submit}>
              <Label className="grid gap-2">
                Preferred name
                <Input
                  autoComplete="name"
                  autoFocus
                  maxLength={80}
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Label>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save and continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
