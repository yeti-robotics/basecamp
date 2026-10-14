'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { CodeDisplay } from './CodeDisplay';

type DisplaySeed = { secret: string; expiresAt: number };

const basePath = '/api/attendance-display';

async function readSeed(): Promise<DisplaySeed | null> {
  const response = await fetch(`${basePath}/seed`, { credentials: 'include', cache: 'no-store' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Could not load the display. Try again.');
  return response.json() as Promise<DisplaySeed>;
}

export default function DisplayPage() {
  const [seed, setSeed] = useState<DisplaySeed | null>(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'checking' | 'locked' | 'unlocking' | 'unlocked'>(
    'checking',
  );
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void readSeed()
      .then((result) => {
        if (!active) return;
        setSeed(result);
        setStatus(result ? 'unlocked' : 'locked');
      })
      .catch(() => {
        if (!active) return;
        setError('Could not reach Basecamp. Try reloading the page.');
        setStatus('locked');
      });
    return () => {
      active = false;
    };
  }, []);

  const expire = useCallback(() => {
    setSeed(null);
    setStatus('locked');
    setError('Display session expired. Enter the password to continue.');
  }, []);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('unlocking');
    setError('');
    try {
      const response = await fetch(`${basePath}/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? 'Too many attempts. Wait a few minutes and try again.'
            : 'Incorrect display password.',
        );
        setStatus('locked');
        return;
      }
      const result = await readSeed();
      if (!result) throw new Error('Could not start the display session.');
      setPassword('');
      setSeed(result);
      setStatus('unlocked');
    } catch {
      setError('Could not reach Basecamp. Try again.');
      setStatus('locked');
    }
  }

  async function logout() {
    setSeed(null);
    setStatus('locked');
    setError('');
    try {
      await fetch(`${basePath}/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      setError('Could not contact Basecamp. Reload before using this display again.');
    }
  }

  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-[#08151c] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(31,154,176,0.18),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(245,184,63,0.11),transparent_45%)]"
      />
      <header className="relative flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-10">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-xl border border-amber-300/30 bg-amber-300/10 font-mono text-lg font-bold text-amber-200">
            3506
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">YETI Basecamp</p>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/45">
              Facility attendance
            </p>
          </div>
        </div>
        {status === 'unlocked' && (
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/75 hover:border-white/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            Log out
          </button>
        )}
      </header>

      <section className="relative flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-4xl">
          {status === 'checking' ? (
            <p className="text-center text-white/60">Checking display session…</p>
          ) : status === 'unlocked' && seed ? (
            <CodeDisplay secret={seed.secret} expiresAt={seed.expiresAt} onExpired={expire} />
          ) : (
            <div className="mx-auto max-w-md rounded-3xl border border-white/15 bg-white/[0.06] p-8 shadow-2xl shadow-black/30 sm:p-10">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/70">
                Facility display
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight">Unlock attendance</h1>
              <p className="mt-3 text-sm leading-6 text-white/60">
                A mentor can unlock this screen for members at the facility.
              </p>
              <form onSubmit={unlock} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="display-password"
                    className="block text-sm font-medium text-white/85"
                  >
                    Display password
                  </label>
                  <input
                    id="display-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300"
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-amber-200">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={status === 'unlocking'}
                  className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-[#09202a] hover:bg-cyan-200 disabled:opacity-60"
                >
                  {status === 'unlocking' ? 'Unlocking…' : 'Unlock display'}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
      <footer className="relative px-6 pb-6 text-center font-mono text-xs uppercase tracking-[0.16em] text-white/35">
        Keep this screen inside the facility
      </footer>
    </main>
  );
}
