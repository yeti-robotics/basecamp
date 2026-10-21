'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { BotStatus } from '@/lib/bot-settings';

export type { BotStatus };

function safeBotStatus(value: unknown): BotStatus | null {
  if (typeof value !== 'object' || value === null) return null;
  const status = value as Record<string, unknown>;
  if (
    typeof status.desiredEnabled !== 'boolean' ||
    typeof status.tokenConfigured !== 'boolean' ||
    !['off', 'connecting', 'connected', 'failed'].includes(String(status.connection))
  ) {
    return null;
  }
  return {
    desiredEnabled: status.desiredEnabled,
    tokenConfigured: status.tokenConfigured,
    connection: status.connection as BotStatus['connection'],
  };
}

const connectionLabels: Record<BotStatus['connection'], string> = {
  off: 'Off',
  connecting: 'Connecting',
  connected: 'Connected',
  failed: 'Connection failed',
};

export function BotSettings({ initialStatus }: { initialStatus: BotStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [token, setToken] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const pendingRequests = useRef(new Set<string>());

  useEffect(() => {
    const waitingForStartup = status.desiredEnabled && status.connection === 'off';
    if (
      status.connection !== 'connecting' &&
      status.connection !== 'failed' &&
      !waitingForStartup
    ) {
      return;
    }
    const controller = new AbortController();
    const poll = async () => {
      try {
        const response = await fetch('/api/settings/bot', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.ok) {
          const next = safeBotStatus(await response.json());
          if (next) setStatus(next);
        }
      } catch {
        // A later poll can recover without exposing a server or Discord error.
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 1000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [status.connection, status.desiredEnabled]);

  async function updateEnabled(enabled: boolean) {
    const requestKey = `enabled:${enabled}`;
    if (pendingRequests.current.has(requestKey)) return;
    pendingRequests.current.add(requestKey);
    setPending(true);
    setError(null);
    setSaved(false);
    setStatus((current) => ({
      ...current,
      desiredEnabled: enabled,
      connection: enabled ? 'connecting' : 'off',
    }));
    try {
      const response = await fetch('/api/settings/bot/enabled', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('request failed');
      const next = safeBotStatus(await response.json());
      if (!next) throw new Error('invalid status');
      setStatus(next);
    } catch {
      setError('The bot setting could not be updated. Try again.');
      try {
        const response = await fetch('/api/settings/bot', { cache: 'no-store' });
        if (response.ok) {
          const next = safeBotStatus(await response.json());
          if (next) setStatus(next);
        }
      } catch {
        // Keep the neutral error if status could not be reloaded.
      }
    } finally {
      pendingRequests.current.delete(requestKey);
      setPending(pendingRequests.current.size > 0);
    }
  }

  async function saveToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRequests.current.has('token') || !token.trim()) return;
    pendingRequests.current.add('token');
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch('/api/settings/bot/token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error('request failed');
      const next = safeBotStatus(await response.json());
      if (!next) throw new Error('invalid status');
      setStatus(next);
      setToken('');
      setSaved(true);
    } catch {
      setError('The token could not be saved. Check the encryption key and try again.');
    } finally {
      pendingRequests.current.delete('token');
      setPending(pendingRequests.current.size > 0);
    }
  }

  const isOn = status.desiredEnabled;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Interactive Discord bot</CardTitle>
            <CardDescription>
              Control the bot connection used for Discord commands. The Basecamp portal and API
              remain available when the bot is off.
            </CardDescription>
          </div>
          <Badge variant={status.connection === 'failed' ? 'destructive' : 'outline'}>
            {connectionLabels[status.connection]}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="bot-enabled">Bot connection</Label>
            <p className="text-sm text-muted-foreground">
              {isOn
                ? 'The bot is set to start and will reconnect after an API restart.'
                : 'The bot is disabled and will stay off after an API restart.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{isOn ? 'Enabled' : 'Disabled'}</span>
            <Switch
              id="bot-enabled"
              aria-label="Enable Discord bot"
              checked={isOn}
              disabled={!status.tokenConfigured}
              onCheckedChange={(checked) => void updateEnabled(checked)}
            />
          </div>
        </CardContent>
        {status.connection === 'failed' && isOn ? (
          <CardContent className="border-t pt-4">
            <Alert variant="destructive">
              <AlertTitle>Discord could not connect</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                Check the saved bot token, then retry the connection.
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => void updateEnabled(true)}
                >
                  Retry connection
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bot token</CardTitle>
          <CardDescription>
            The token is encrypted before it is stored. It cannot be viewed after saving; enter a
            replacement token to rotate it.
          </CardDescription>
        </CardHeader>
        <CardContent className="border-t pt-5">
          <form className="space-y-4" onSubmit={saveToken}>
            <div className="space-y-2">
              <Label htmlFor="bot-token">Discord bot token</Label>
              <Input
                id="bot-token"
                type="password"
                autoComplete="new-password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder={
                  status.tokenConfigured ? 'Enter a replacement token' : 'Paste bot token'
                }
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                {status.tokenConfigured ? 'Token saved' : 'No token saved'}
              </p>
            </div>
            <Button type="submit" disabled={pending || !token.trim()}>
              {pending ? 'Saving…' : 'Save token'}
            </Button>
            {saved ? (
              <p role="status" className="text-sm text-muted-foreground">
                Token saved.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save changes</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
