'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Season } from '@/lib/seasons';

type SeasonManagerProps = {
  seasons: Season[];
  currentSeasonId: number | null;
  canManage: boolean;
  canBootstrap: boolean;
  suggestedDates: { startsOn: string; endsOn: string };
  refresh?: () => void;
};

const dateLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
function formatDate(value: string) {
  return dateLabel.format(new Date(`${value}T12:00:00.000Z`));
}

export function SeasonManager({
  seasons,
  currentSeasonId,
  canManage,
  canBootstrap,
  suggestedDates,
  refresh,
}: SeasonManagerProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState(suggestedDates.startsOn);
  const [endsOn, setEndsOn] = useState(suggestedDates.endsOn);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const canCreate = canManage || canBootstrap;

  function beginEdit(season: Season) {
    setEditingId(season.id);
    setName(season.name);
    setStartsOn(season.startsOn);
    setEndsOn(season.endsOn);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const editing = editingId !== null;
    const response = await fetch(editing ? `/api/seasons/${editingId}` : '/api/seasons', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, startsOn, endsOn }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage(typeof body.message === 'string' ? body.message : 'Season could not be saved.');
      return;
    }
    setEditingId(null);
    setName('');
    setStartsOn(suggestedDates.startsOn);
    setEndsOn(suggestedDates.endsOn);
    refresh?.();
    router.refresh();
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-white">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">Team setup</p>
        <h1 className="mt-2 text-3xl font-semibold">Seasons</h1>
        <p className="mt-2 text-zinc-400">
          Manage the date range for each team year. Roster assignments are recorded separately for
          every season.
        </p>
      </header>

      {seasons.length === 0 && (
        <p className="mt-8 rounded-lg border border-zinc-700 p-4 text-zinc-300">
          No season is active today.
        </p>
      )}

      <section aria-label="Season history" className="mt-8 space-y-3">
        {seasons.map((season) => (
          <article key={season.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-medium">{season.name}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      season.id === currentSeasonId
                        ? 'bg-cyan-950 text-cyan-200'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {season.period === 'past'
                      ? 'Past season'
                      : season.period === 'upcoming'
                        ? 'Upcoming season'
                        : 'Current season'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  {formatDate(season.startsOn)} – {formatDate(season.endsOn)}
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  className="rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800"
                  onClick={() => beginEdit(season)}
                >
                  Edit
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      {canCreate && (
        <section className="mt-10 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-xl font-medium">
            {editingId === null ? 'Add a season' : 'Edit season'}
          </h2>
          <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-zinc-300 sm:col-span-2">
              Season name
              <input
                required
                aria-label="Season name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              />
            </label>
            <label className="grid gap-2 text-sm text-zinc-300">
              Start date
              <input
                required
                aria-label="Start date"
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              />
            </label>
            <label className="grid gap-2 text-sm text-zinc-300">
              End date
              <input
                required
                aria-label="End date"
                type="date"
                value={endsOn}
                onChange={(event) => setEndsOn(event.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              />
            </label>
            {message && (
              <p role="alert" className="text-sm text-rose-300 sm:col-span-2">
                {message}
              </p>
            )}
            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-cyan-700 px-4 py-2 font-medium hover:bg-cyan-600"
              >
                {editingId === null ? 'Create season' : 'Save season'}
              </button>
              {editingId !== null && (
                <button
                  type="button"
                  className="rounded-md border border-zinc-700 px-4 py-2"
                  onClick={() => {
                    setEditingId(null);
                    setName('');
                    setStartsOn(suggestedDates.startsOn);
                    setEndsOn(suggestedDates.endsOn);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
