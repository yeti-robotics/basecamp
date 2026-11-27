'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TeamEvent } from '@/lib/events';
import { generateCalendarDays, getEventsForDay, getTeamDateKey } from './calendar-utils';

// Data received from the parent component.
interface EventCalendarProps {
  events: TeamEvent[];
  now: string;
}

// Allow filtering by a specific event type or all events.
type EventFilter = TeamEvent['eventType'] | 'all';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const eventLabels: Record<TeamEvent['eventType'], string> = {
  meeting: 'Meeting',
  extra_meeting: 'Extra meeting',
  outreach: 'Outreach',
  other: 'Other',
};

const hourLabels: Record<TeamEvent['hourCategory'], string> = {
  meeting: 'Meeting hours',
  outreach: 'Outreach hours',
  none: 'No hours',
};

// Each event type receives a different visual style.
const eventColors: Record<TeamEvent['eventType'], string> = {
  meeting: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  extra_meeting: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  outreach: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  other: 'bg-muted text-muted-foreground',
};

// Include the date and time so overnight events are displayed correctly.
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
});

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export function EventCalendar({ events, now }: EventCalendarProps) {
  // Determine today's date using the team's timezone.
  const today = getTeamDateKey(now);
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7)) - 1;
  const todayDay = Number(today.slice(8, 10));

  // Store the currently displayed month and year.
  const [currentMonth, setCurrentMonth] = useState({
    year: todayYear,
    month: todayMonth,
  });

  // Store the selected date and active filters.
  const [selectedDay, setSelectedDay] = useState(todayDay);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [seasonFilter, setSeasonFilter] = useState('all');

  const { year, month } = currentMonth;

  // Generate calendar cells for the current month.
  const calendarDays = generateCalendarDays(year, month);

  // Map each unique season ID to its display name.
  // Using a Map prevents duplicate seasons in the dropdown.
  const seasonOptions = Array.from(
    new Map(events.map((event) => [event.seasonId, event.seasonName])),
  );

  // An event must match both the type and season filters.
  const filteredEvents = events.filter((event) => {
    const matchesType = eventFilter === 'all' || event.eventType === eventFilter;

    const matchesSeason = seasonFilter === 'all' || String(event.seasonId) === seasonFilter;

    return matchesType && matchesSeason;
  });

  // Retrieve matching events for the selected calendar date.
  const selectedEvents = getEventsForDay(filteredEvents, year, month, selectedDay);

  const monthLabel = monthFormatter.format(new Date(Date.UTC(year, month, 1)));

  // Navigate between months, including transitions between years.
  function changeMonth(direction: number) {
    setCurrentMonth((previous) => {
      const nextDate = new Date(Date.UTC(previous.year, previous.month + direction, 1));

      return {
        year: nextDate.getUTCFullYear(),
        month: nextDate.getUTCMonth(),
      };
    });

    // Reset selection because the new month may have fewer days.
    setSelectedDay(1);
  }

  // Return to today's month and select today's date.
  function goToToday() {
    setCurrentMonth({
      year: todayYear,
      month: todayMonth,
    });

    setSelectedDay(todayDay);
  }

  return (
    <section aria-label="Team calendar" className="mt-8 space-y-6">
      {/* Calendar heading and navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>

          <h2 className="min-w-36 text-center text-lg font-semibold">{monthLabel}</h2>

          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>

        {/* Calendar controls and filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>

          {/* Filter events by their type */}
          <select
            aria-label="Filter event type"
            className="h-8 rounded-lg border bg-background px-2 text-sm"
            value={eventFilter}
            onChange={(event) => setEventFilter(event.target.value as EventFilter)}
          >
            <option value="all">All events</option>

            {Object.entries(eventLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {/* Filter events by their associated season */}
          <select
            aria-label="Filter season"
            className="h-8 rounded-lg border bg-background px-2 text-sm"
            value={seasonFilter}
            onChange={(event) => setSeasonFilter(event.target.value)}
          >
            <option value="all">All seasons</option>

            {seasonOptions.map(([id, name]) => (
              <option key={id} value={String(id)}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Keep the calendar horizontally scrollable on small screens. */}
      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-[560px]">
          {/* Seven columns, one for each weekday. */}
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {weekdays.map((weekday) => (
              <div key={weekday} className="p-3 text-center text-xs text-muted-foreground">
                {weekday}
              </div>
            ))}
          </div>

          {/* Render every generated calendar cell. */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              // Empty cells fill space outside the current month.
              if (day === null) {
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Stateless calendar placeholder.
                  <div key={`empty-${index}`} className="min-h-24 border-b border-r bg-muted/20" />
                );
              }

              // Find events matching this date and the active filters.
              const dayEvents = getEventsForDay(filteredEvents, year, month, day);

              const isSelected = selectedDay === day;

              const isToday = year === todayYear && month === todayMonth && day === todayDay;

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  aria-label={`${monthLabel} day ${day}`}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-24 min-w-0 border-b border-r p-2 text-left transition-colors ${
                    isSelected ? 'bg-muted' : 'hover:bg-muted/50'
                  }`}
                >
                  <span
                    className={`inline-flex size-6 items-center justify-center rounded-full text-sm ${
                      isToday ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    {day}
                  </span>

                  {/* Display up to two events inside each cell. */}
                  <span className="mt-1 block space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className={`block truncate rounded px-1 py-0.5 text-xs ${
                          event.status === 'cancelled'
                            ? 'bg-muted text-muted-foreground line-through'
                            : eventColors[event.eventType]
                        }`}
                      >
                        {event.name}
                      </span>
                    ))}

                    {/* Indicate when additional events are available. */}
                    {dayEvents.length > 2 && (
                      <span className="block text-xs text-muted-foreground">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend explaining the calendar event colors. */}
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(eventLabels).map(([value, label]) => (
          <span
            key={value}
            className={`rounded px-2 py-1 text-xs ${eventColors[value as TeamEvent['eventType']]}`}
          >
            {label}
          </span>
        ))}

        <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground line-through">
          Cancelled
        </span>
      </div>

      {/* Detailed events for the currently selected date. */}
      <div className="space-y-3 rounded-lg border p-4">
        <h3 className="font-semibold">
          {dayFormatter.format(new Date(Date.UTC(year, month, selectedDay)))}
        </h3>

        {selectedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events scheduled for this date.</p>
        ) : (
          selectedEvents.map((event) => (
            <article key={event.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-medium">{event.name}</h4>

                <Badge variant="outline">{eventLabels[event.eventType]}</Badge>

                {event.status === 'cancelled' && <Badge variant="destructive">Cancelled</Badge>}
              </div>

              {/* Display complete timestamps for multi-day events. */}
              <p className="text-sm text-muted-foreground">
                <time dateTime={event.startsAt}>
                  {dateTimeFormatter.format(new Date(event.startsAt))}
                </time>
                {' – '}
                <time dateTime={event.endsAt}>
                  {dateTimeFormatter.format(new Date(event.endsAt))}
                </time>
                {' ET'}
              </p>

              <p className="text-sm">{event.location}</p>

              {event.description && (
                <p className="text-sm text-muted-foreground">{event.description}</p>
              )}

              {/* Cancelled events have no scheduled hour contribution. */}
              <p className="text-xs text-muted-foreground">
                {event.seasonName}
                {' · '}
                {event.status === 'cancelled'
                  ? 'No attendance hours'
                  : hourLabels[event.hourCategory]}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
