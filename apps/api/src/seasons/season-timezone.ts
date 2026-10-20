function dateParts(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function localDateInTimeZone(date: Date, timeZone: string): string {
  return dateParts(date, timeZone);
}

export function localMidnightInTimeZone(date: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day);
  let instant = targetAsUtc;

  // Offset-at-date iteration handles both standard and daylight offsets, including DST edges.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = dateParts(new Date(instant), timeZone);
    const [observedYear, observedMonth, observedDay] = observed.split('-').map(Number);
    const observedAsUtc = Date.UTC(observedYear, observedMonth - 1, observedDay);
    const correction = targetAsUtc - observedAsUtc;
    if (correction === 0) break;
    instant += correction;
  }

  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant));
  const [hour, minute, second] = formatted.split(':').map(Number);
  instant -= ((hour ?? 0) * 60 + (minute ?? 0)) * 60_000 + (second ?? 0) * 1_000;
  return new Date(instant);
}
