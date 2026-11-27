// Import only the TypeScript type, not the server-side API functions.
import type { TeamEvent } from '@/lib/events';

// Use the team's timezone instead of the user's browser timezone.
const TEAM_TIME_ZONE = 'America/New_York';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TEAM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Returns the number of days in a month.
// JavaScript months start at 0 (January) and end at 11 (December).
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Returns the weekday of the first day of the month.
// Sunday = 0, Monday = 1, ..., Saturday = 6.
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// Generates the calendar cells, including empty spaces.
// null represents a cell outside the current month.
export function generateCalendarDays(year: number, month: number): (number | null)[] {
  const totalDays = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const cells: (number | null)[] = [];

  // Add empty cells before the first day.
  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }

  // Add every numbered day of the month.
  for (let day = 1; day <= totalDays; day++) {
    cells.push(day);
  }

  // Complete the final week with empty cells.
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

// Converts a timestamp into a YYYY-MM-DD date in Eastern Time.
export function getTeamDateKey(timestamp: string): string {
  const parts = dateFormatter.formatToParts(new Date(timestamp));

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

// Returns events occurring on a selected calendar date.
export function getEventsForDay(
  events: TeamEvent[],
  year: number,
  month: number,
  day: number,
): TeamEvent[] {
  const monthString = String(month + 1).padStart(2, '0');
  const dayString = String(day).padStart(2, '0');

  const dateKey = `${year}-${monthString}-${dayString}`;

  return events.filter((event) => {
    const start = getTeamDateKey(event.startsAt);
    const end = getTeamDateKey(event.endsAt);

    // Include events that span multiple calendar dates.
    // An event ending exactly at midnight does not occupy the next day.
    const lastInstant = new Date(new Date(event.endsAt).getTime() - 1).toISOString();

    return start <= dateKey && dateKey <= end && dateKey <= getTeamDateKey(lastInstant);
  });
}
