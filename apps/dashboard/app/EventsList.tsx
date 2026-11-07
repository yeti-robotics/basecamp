import { CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import type { TeamEvent } from '@/lib/events';

const eventTypeLabels: Record<TeamEvent['eventType'], string> = {
  meeting: 'Meeting',
  extra_meeting: 'Extra meeting',
  outreach: 'Outreach',
  other: 'Other',
};

const hourCategoryLabels: Record<TeamEvent['hourCategory'], string> = {
  meeting: 'Counts toward meeting hours',
  outreach: 'Counts toward outreach hours',
  none: 'Does not count toward hours',
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

function EventCard({ event }: { event: TeamEvent }) {
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
      <CardContent className="space-y-2 text-sm">
        <p>
          <time dateTime={event.startsAt}>
            {eventDate.format(startsAt)} · {eventTime.format(startsAt)}
          </time>
          {' – '}
          <time dateTime={event.endsAt}>{eventTime.format(endsAt)}</time>
        </p>
        <p className="text-muted-foreground">{event.location}</p>
        {event.description && <p className="text-muted-foreground">{event.description}</p>}
        <p className="pt-1 text-xs text-muted-foreground">
          {hourCategoryLabels[event.hourCategory]}
        </p>
      </CardContent>
    </Card>
  );
}

export function EventsList({ events }: { events: TeamEvent[] }) {
  const now = Date.now();
  const upcoming = events
    .filter((event) => event.status === 'scheduled' && new Date(event.startsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const previous = events
    .filter((event) => event.status === 'cancelled' || new Date(event.startsAt).getTime() < now)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  if (events.length === 0) {
    return (
      <Empty className="mt-8 min-h-64">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDays aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No events scheduled</EmptyTitle>
          <EmptyDescription>Team events will appear here when they are added.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-events-heading" className="space-y-3">
          <h2 id="upcoming-events-heading" className="text-lg font-medium">
            Upcoming events
          </h2>
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </section>
      )}
      {previous.length > 0 && (
        <section aria-labelledby="previous-events-heading" className="space-y-3">
          <h2 id="previous-events-heading" className="text-lg font-medium">
            Past and cancelled events
          </h2>
          {previous.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </section>
      )}
    </div>
  );
}
