'use client';

import { CalendarDays, Pencil, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TeamEvent } from '@/lib/events';
import type { Season } from '@/lib/seasons';

type EventForm = {
  seasonId: string;
  name: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  eventType: TeamEvent['eventType'];
  hourCategory: TeamEvent['hourCategory'];
};

const emptyForm = (seasonId: string): EventForm => ({
  seasonId,
  name: '',
  description: '',
  location: '',
  startsAt: '',
  endsAt: '',
  eventType: 'meeting',
  hourCategory: 'meeting',
});

const eventTypeLabels: Record<TeamEvent['eventType'], string> = {
  meeting: 'Meeting',
  extra_meeting: 'Extra meeting',
  outreach: 'Outreach',
  other: 'Other',
};

const hourCategoryLabels: Record<TeamEvent['hourCategory'], string> = {
  meeting: 'Meeting hours',
  outreach: 'Outreach hours',
  none: 'No hours',
};

const eventDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/New_York',
});
const eventTime = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
});

function localDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function EventCard({
  event,
  canManage,
  isPast,
  pending,
  onEdit,
  onCancel,
}: {
  event: TeamEvent;
  canManage: boolean;
  isPast: boolean;
  pending: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const startsAt = new Date(event.startsAt);
  const endsAt = new Date(event.endsAt);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{event.name}</CardTitle>
            <CardDescription className="mt-1">{event.seasonName}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{eventTypeLabels[event.eventType]}</Badge>
            {event.status === 'cancelled' && <Badge variant="destructive">Cancelled</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-2">
          <p>
            <time dateTime={event.startsAt}>
              {eventDate.format(startsAt)} · {eventTime.format(startsAt)}
            </time>
            {' – '}
            <time dateTime={event.endsAt}>{eventTime.format(endsAt)}</time>
          </p>
          <p className="text-muted-foreground">{event.location}</p>
          {event.description && <p className="text-muted-foreground">{event.description}</p>}
          <p className="text-xs text-muted-foreground">{hourCategoryLabels[event.hourCategory]}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button variant="outline" size="sm" disabled={pending} onClick={onEdit}>
              <Pencil aria-hidden="true" /> Edit
            </Button>
            {event.status !== 'cancelled' && !isPast && (
              <Button variant="outline" size="sm" disabled={pending} onClick={onCancel}>
                <X aria-hidden="true" /> Cancel event
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EventsList({
  events,
  canManage,
  seasons,
  now,
}: {
  events: TeamEvent[];
  canManage: boolean;
  seasons: Season[];
  now: string;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventForm>(() =>
    emptyForm(
      String(seasons.find((season) => season.period === 'current')?.id ?? seasons[0]?.id ?? ''),
    ),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const currentTime = new Date(now).getTime();
  const upcoming = events
    .filter(
      (event) => event.status === 'scheduled' && new Date(event.startsAt).getTime() >= currentTime,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const previous = events
    .filter(
      (event) => event.status === 'cancelled' || new Date(event.startsAt).getTime() < currentTime,
    )
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  function startCreate() {
    const currentSeasonId =
      seasons.find((season) => season.period === 'current')?.id ?? seasons[0]?.id;
    setEditingId(null);
    setForm(emptyForm(String(currentSeasonId ?? '')));
    setError('');
    setShowForm(true);
  }

  function startEdit(event: TeamEvent) {
    setEditingId(event.id);
    setForm({
      seasonId: String(event.seasonId),
      name: event.name,
      description: event.description ?? '',
      location: event.location,
      startsAt: localDateTime(event.startsAt),
      endsAt: localDateTime(event.endsAt),
      eventType: event.eventType,
      hourCategory: event.hourCategory,
    });
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError('');
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch(
        editingId === null ? '/api/events' : `/api/events/${editingId}`,
        {
          method: editingId === null ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            seasonId: Number(form.seasonId),
            description: form.description.trim() || null,
            startsAt: new Date(form.startsAt).toISOString(),
            endsAt: new Date(form.endsAt).toISOString(),
          }),
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(
          typeof result.message === 'string' ? result.message : 'The event could not be saved.',
        );
        return;
      }
      closeForm();
      router.refresh();
    } catch {
      setError('The event could not be saved. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function cancelEvent(event: TeamEvent) {
    if (!window.confirm(`Cancel “${event.name}”? It will remain visible as cancelled.`)) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/events/${event.id}/cancel`, { method: 'POST' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(
          typeof result.message === 'string' ? result.message : 'The event could not be cancelled.',
        );
        return;
      }
      router.refresh();
    } catch {
      setError('The event could not be cancelled. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  function updateField<K extends keyof EventForm>(field: K, value: EventForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function renderEvents(items: TeamEvent[]) {
    return items.map((event) => (
      <EventCard
        key={event.id}
        event={event}
        canManage={canManage}
        isPast={new Date(event.startsAt).getTime() < currentTime}
        pending={pending}
        onEdit={() => startEdit(event)}
        onCancel={() => void cancelEvent(event)}
      />
    ));
  }

  return (
    <div className="mt-8 max-w-3xl space-y-8">
      {canManage && (
        <section className="space-y-4" aria-label="Event management">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              As a Team Admin, you can add, edit, and cancel events.
            </p>
            <Button onClick={startCreate} disabled={pending || seasons.length === 0}>
              <Plus aria-hidden="true" /> Add event
            </Button>
          </div>
          {seasons.length === 0 && (
            <Alert>
              <AlertDescription>Create a season before scheduling an event.</AlertDescription>
            </Alert>
          )}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingId === null ? 'Add an event' : 'Edit event'}</CardTitle>
                <CardDescription>
                  Times are entered in your local time and displayed in Eastern time.
                </CardDescription>
              </CardHeader>
              <CardContent className="border-t pt-5">
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveEvent}>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="event-name">Name</Label>
                    <Input
                      id="event-name"
                      required
                      value={form.name}
                      onChange={(event) => updateField('name', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-season">Season</Label>
                    <select
                      id="event-season"
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      required
                      value={form.seasonId}
                      onChange={(event) => updateField('seasonId', event.target.value)}
                    >
                      <option value="" disabled>
                        Select a season
                      </option>
                      {seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-type">Type</Label>
                    <select
                      id="event-type"
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      value={form.eventType}
                      onChange={(event) =>
                        updateField('eventType', event.target.value as TeamEvent['eventType'])
                      }
                    >
                      {Object.entries(eventTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-hour-category">Hour contribution</Label>
                    <select
                      id="event-hour-category"
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      value={form.hourCategory}
                      onChange={(event) =>
                        updateField('hourCategory', event.target.value as TeamEvent['hourCategory'])
                      }
                    >
                      {Object.entries(hourCategoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-location">Location</Label>
                    <Input
                      id="event-location"
                      required
                      value={form.location}
                      onChange={(event) => updateField('location', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-starts-at">Start time</Label>
                    <Input
                      id="event-starts-at"
                      type="datetime-local"
                      required
                      value={form.startsAt}
                      onChange={(event) => updateField('startsAt', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-ends-at">End time</Label>
                    <Input
                      id="event-ends-at"
                      type="datetime-local"
                      required
                      value={form.endsAt}
                      onChange={(event) => updateField('endsAt', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="event-description">Description (optional)</Label>
                    <textarea
                      id="event-description"
                      value={form.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  </div>
                  {error && (
                    <Alert variant="destructive" className="sm:col-span-2">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex gap-2 sm:col-span-2">
                    <Button type="submit" disabled={pending || seasons.length === 0}>
                      {pending ? 'Saving…' : editingId === null ? 'Create event' : 'Save event'}
                    </Button>
                    <Button type="button" variant="outline" disabled={pending} onClick={closeForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </section>
      )}
      {error && !showForm && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {events.length === 0 ? (
        <Empty className="min-h-64">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No events scheduled</EmptyTitle>
            <EmptyDescription>Team events will appear here when they are added.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming-events-heading" className="space-y-3">
              <h2 id="upcoming-events-heading" className="text-lg font-medium">
                Upcoming events
              </h2>
              {renderEvents(upcoming)}
            </section>
          )}
          {previous.length > 0 && (
            <section aria-labelledby="previous-events-heading" className="space-y-3">
              <h2 id="previous-events-heading" className="text-lg font-medium">
                Past and cancelled events
              </h2>
              {renderEvents(previous)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
