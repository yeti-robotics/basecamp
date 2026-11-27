'use client';

import { CalendarDays, List } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { TeamEvent } from '@/lib/events';
import type { Season } from '@/lib/seasons';
import { EventsList } from '../EventsList';
import { EventCalendar } from './EventCalendar';

// Information passed down from the server component.
interface EventsViewProps {
  events: TeamEvent[];
  now: string;
  canManage: boolean;
  seasons: Season[];
}

// Restrict the available views to these two values.
type ViewMode = 'calendar' | 'list';

export function EventsView({ events, now, canManage, seasons }: EventsViewProps) {
  // Start with the calendar as the default view.
  const [view, setView] = useState<ViewMode>('calendar');

  return (
    <div className="mt-8 space-y-4">
      {/* Buttons allow the user to switch between views. */}
      <fieldset className="flex gap-2">
        <legend className="sr-only">Event view</legend>
        <Button
          type="button"
          variant={view === 'calendar' ? 'default' : 'outline'}
          aria-pressed={view === 'calendar'}
          onClick={() => setView('calendar')}
        >
          <CalendarDays aria-hidden="true" />
          Calendar
        </Button>

        <Button
          type="button"
          variant={view === 'list' ? 'default' : 'outline'}
          aria-pressed={view === 'list'}
          onClick={() => setView('list')}
        >
          <List aria-hidden="true" />
          Event list
        </Button>
      </fieldset>

      {/* Hide inactive views without destroying their state. */}
      <div hidden={view !== 'calendar'}>
        <EventCalendar events={events} now={now} />
      </div>

      <div hidden={view !== 'list'}>
        <EventsList events={events} now={now} canManage={canManage} seasons={seasons} />
      </div>
    </div>
  );
}
