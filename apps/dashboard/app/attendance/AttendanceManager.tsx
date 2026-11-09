'use client';

import { ClipboardList, History, Pencil, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, Fragment, useState } from 'react';
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
import type {
  AttendanceHistoryEntry,
  AttendanceRecord,
  AttendanceRecordSearch,
  AttendanceRecordSnapshot,
  AttendanceStatus,
} from '@/lib/attendance-records';
import type { TeamEvent } from '@/lib/events';

export type AttendanceMember = { userId: string; name: string };

type MentorStatus = Exclude<AttendanceStatus, 'normal'>;

type RecordForm = {
  userId: string;
  eventId: string;
  checkedInAt: string;
  checkedOutAt: string;
  category: AttendanceRecord['category'];
  status: MentorStatus | '';
  reason: string;
};

const statusLabels: Record<AttendanceStatus, string> = {
  normal: 'Signed in',
  manual: 'Added by mentor',
  excused: 'Excused',
};

const categoryLabels: Record<AttendanceRecord['category'], string> = {
  meeting: 'Meeting',
  outreach: 'Outreach',
};

const fieldLabels: Record<keyof AttendanceRecordSnapshot, string> = {
  userId: 'Member',
  checkedInAt: 'Start',
  checkedOutAt: 'End',
  category: 'Category',
  eventId: 'Event',
  status: 'Status',
};

const selectClassName =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30';

const recordDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/New_York',
});
const recordTime = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
});
const historyDate = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/New_York',
});

function localDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function emptyForm(): RecordForm {
  return {
    userId: '',
    eventId: '',
    checkedInAt: '',
    checkedOutAt: '',
    category: 'meeting',
    status: 'excused',
    reason: '',
  };
}

function formFor(record: AttendanceRecord): RecordForm {
  return {
    userId: record.userId ?? '',
    eventId: record.eventId === null ? '' : String(record.eventId),
    checkedInAt: localDateTime(record.checkedInAt),
    checkedOutAt: record.checkedOutAt ? localDateTime(record.checkedOutAt) : '',
    category: record.category,
    status: record.status === 'normal' ? '' : record.status,
    reason: '',
  };
}

async function errorMessage(response: Response, fallback: string) {
  const result = await response.json().catch(() => ({}));
  return typeof result.message === 'string' ? result.message : fallback;
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  if (status === 'normal') return <span className="text-muted-foreground">Signed in</span>;
  return (
    <Badge variant={status === 'excused' ? 'secondary' : 'outline'}>{statusLabels[status]}</Badge>
  );
}

function HistoryPanel({
  entries,
  members,
  events,
}: {
  entries: AttendanceHistoryEntry[];
  members: AttendanceMember[];
  events: TeamEvent[];
}) {
  function describe(field: keyof AttendanceRecordSnapshot, value: unknown) {
    if (value === null || value === undefined) return '—';
    if (field === 'checkedInAt' || field === 'checkedOutAt') {
      return historyDate.format(new Date(String(value)));
    }
    if (field === 'status') return statusLabels[value as AttendanceStatus] ?? String(value);
    if (field === 'category') return categoryLabels[value as AttendanceRecord['category']];
    if (field === 'eventId') {
      return events.find((event) => event.id === value)?.name ?? `Event #${value}`;
    }
    if (field === 'userId') return members.find((member) => member.userId === value)?.name ?? '—';
    return String(value);
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No changes have been made to this record.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const fields = (Object.keys(fieldLabels) as (keyof AttendanceRecordSnapshot)[]).filter(
          (field) =>
            entry.action === 'record_updated' && entry.before?.[field] !== entry.after?.[field],
        );
        return (
          <li key={entry.id} className="space-y-1 text-sm">
            <p>
              <span className="font-medium">
                {entry.action === 'record_created' ? 'Added' : 'Edited'}
              </span>{' '}
              by {entry.actorName ?? 'an unknown user'} ·{' '}
              <time dateTime={entry.createdAt}>
                {historyDate.format(new Date(entry.createdAt))}
              </time>
            </p>
            <p className="text-muted-foreground">Reason: {entry.reason}</p>
            {fields.length > 0 && (
              <ul className="text-xs text-muted-foreground">
                {fields.map((field) => (
                  <li key={field}>
                    {fieldLabels[field]}: {describe(field, entry.before?.[field])} →{' '}
                    {describe(field, entry.after?.[field])}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function AttendanceManager({
  records,
  truncated,
  members,
  events,
  search,
}: {
  records: AttendanceRecord[];
  truncated: boolean;
  members: AttendanceMember[];
  events: TeamEvent[];
  search: AttendanceRecordSearch;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RecordForm>(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [historyFor, setHistoryFor] = useState<number | null>(null);
  const [history, setHistory] = useState<AttendanceHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState('');
  const filtered = Boolean(search.q || search.from || search.to || search.status);

  function updateField<K extends keyof RecordForm>(field: K, value: RecordForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function revealForm() {
    setError('');
    setShowForm(true);
    requestAnimationFrame(() => {
      document
        .getElementById('attendance-record-form')
        ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  }

  function startCreate() {
    setEditing(null);
    setForm(emptyForm());
    revealForm();
  }

  function startEdit(record: AttendanceRecord) {
    setEditing(record);
    setForm(formFor(record));
    revealForm();
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setError('');
  }

  function chooseEvent(eventId: string) {
    const event = events.find((item) => String(item.id) === eventId);
    setForm((current) => ({
      ...current,
      eventId,
      ...(event && !editing
        ? {
            checkedInAt: localDateTime(event.startsAt),
            checkedOutAt: localDateTime(event.endsAt),
            category: event.hourCategory === 'outreach' ? 'outreach' : 'meeting',
          }
        : {}),
    }));
  }

  function changes(record: AttendanceRecord) {
    const original = formFor(record);
    const body: Record<string, unknown> = {};
    if (form.checkedInAt !== original.checkedInAt) {
      body.checkedInAt = new Date(form.checkedInAt).toISOString();
    }
    if (form.checkedOutAt !== original.checkedOutAt) {
      body.checkedOutAt = new Date(form.checkedOutAt).toISOString();
    }
    if (form.category !== original.category) body.category = form.category;
    if (form.eventId !== original.eventId)
      body.eventId = form.eventId ? Number(form.eventId) : null;
    if (form.status && form.status !== original.status) body.status = form.status;
    return body;
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    let body: Record<string, unknown>;
    if (editing) {
      body = changes(editing);
      if (Object.keys(body).length === 0) {
        setError('Change at least one field before saving.');
        return;
      }
      body.reason = form.reason;
    } else {
      body = {
        userId: form.userId,
        eventId: form.eventId ? Number(form.eventId) : null,
        checkedInAt: new Date(form.checkedInAt).toISOString(),
        checkedOutAt: new Date(form.checkedOutAt).toISOString(),
        category: form.category,
        status: form.status,
        reason: form.reason,
      };
    }

    setPending(true);
    try {
      const response = await fetch(
        editing ? `/api/attendance/records/${editing.id}` : '/api/attendance/records',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        setError(await errorMessage(response, 'The record could not be saved.'));
        return;
      }
      if (editing && historyFor === editing.id) setHistoryFor(null);
      closeForm();
      router.refresh();
    } catch {
      setError('The record could not be saved. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function toggleHistory(record: AttendanceRecord) {
    if (historyFor === record.id) {
      setHistoryFor(null);
      return;
    }
    setHistoryFor(record.id);
    setHistory(null);
    setHistoryError('');
    try {
      const response = await fetch(`/api/attendance/records/${record.id}/history`);
      if (!response.ok) {
        setHistoryError(await errorMessage(response, 'History could not be loaded.'));
        return;
      }
      setHistory((await response.json()) as AttendanceHistoryEntry[]);
    } catch {
      setHistoryError('History could not be loaded. Check your connection and try again.');
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <form
        method="get"
        action="/attendance"
        aria-label="Filter attendance records"
        className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end"
      >
        <div className="space-y-2">
          <Label htmlFor="attendance-search">Member</Label>
          <Input
            id="attendance-search"
            name="q"
            type="search"
            placeholder="Search by name"
            defaultValue={search.q ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attendance-from">From</Label>
          <Input id="attendance-from" name="from" type="date" defaultValue={search.from ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attendance-to">To</Label>
          <Input id="attendance-to" name="to" type="date" defaultValue={search.to ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attendance-status">Status</Label>
          <select
            id="attendance-status"
            name="status"
            className={selectClassName}
            defaultValue={search.status ?? ''}
          >
            <option value="">All records</option>
            <option value="normal">Signed in</option>
            <option value="manual">Added by mentor</option>
            <option value="excused">Excused</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            <Search aria-hidden="true" /> Search
          </Button>
          {filtered && (
            <Button asChild variant="ghost">
              <a href="/attendance">Clear</a>
            </Button>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Every change needs a reason and is kept in the record&apos;s history.
        </p>
        <Button onClick={startCreate} disabled={pending || members.length === 0}>
          <Plus aria-hidden="true" /> Add record
        </Button>
      </div>

      {showForm && (
        <Card id="attendance-record-form" className="scroll-mt-6">
          <CardHeader>
            <CardTitle>
              {editing ? `Edit ${editing.memberName ?? 'record'}` : 'Add an attendance record'}
            </CardTitle>
            <CardDescription>
              {editing
                ? 'Times are entered in your local time. The reason is saved to the record history.'
                : 'Use this for a missed sign-in or an excused absence. Excused time counts toward hours.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="border-t pt-5">
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveRecord}>
              {!editing && (
                <div className="space-y-2">
                  <Label htmlFor="record-member">Member</Label>
                  <select
                    id="record-member"
                    className={selectClassName}
                    required
                    value={form.userId}
                    onChange={(event) => updateField('userId', event.target.value)}
                  >
                    <option value="" disabled>
                      Select a member
                    </option>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="record-event">Event (optional)</Label>
                <select
                  id="record-event"
                  className={selectClassName}
                  value={form.eventId}
                  onChange={(event) => chooseEvent(event.target.value)}
                >
                  <option value="">No event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name} · {recordDate.format(new Date(event.startsAt))}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="record-starts-at">Start time</Label>
                <Input
                  id="record-starts-at"
                  type="datetime-local"
                  required
                  value={form.checkedInAt}
                  onChange={(event) => updateField('checkedInAt', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="record-ends-at">End time</Label>
                <Input
                  id="record-ends-at"
                  type="datetime-local"
                  required={!editing || editing.checkedOutAt !== null}
                  value={form.checkedOutAt}
                  onChange={(event) => updateField('checkedOutAt', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="record-category">Category</Label>
                <select
                  id="record-category"
                  className={selectClassName}
                  value={form.category}
                  onChange={(event) =>
                    updateField('category', event.target.value as RecordForm['category'])
                  }
                >
                  <option value="meeting">Meeting</option>
                  <option value="outreach">Outreach</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="record-status">Status</Label>
                <select
                  id="record-status"
                  className={selectClassName}
                  value={form.status}
                  onChange={(event) =>
                    updateField('status', event.target.value as RecordForm['status'])
                  }
                >
                  {editing?.status === 'normal' && <option value="">Signed in (unchanged)</option>}
                  <option value="manual">Added by mentor</option>
                  <option value="excused">Excused</option>
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="record-reason">Reason</Label>
                <textarea
                  id="record-reason"
                  required
                  maxLength={500}
                  value={form.reason}
                  onChange={(event) => updateField('reason', event.target.value)}
                  placeholder={
                    editing ? 'e.g. Forgot to sign out' : 'e.g. Excused for a school band concert'
                  }
                  className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                />
              </div>
              {error && (
                <Alert variant="destructive" className="sm:col-span-2">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? 'Saving…' : editing ? 'Save changes' : 'Add record'}
                </Button>
                <Button type="button" variant="outline" disabled={pending} onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {records.length === 0 ? (
        <Empty className="min-h-64 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No attendance records</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? 'No records match these filters.'
                : 'Records will appear here when members sign in.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section aria-labelledby="attendance-records-heading" className="space-y-3">
          <h2 id="attendance-records-heading" className="text-lg font-medium">
            Records
          </h2>
          {truncated && (
            <p className="text-sm text-muted-foreground">
              Showing the 200 most recent matches. Narrow the dates or search to see older records.
            </p>
          )}
          <div className="relative overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Member
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Time
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Hours
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const checkedInAt = new Date(record.checkedInAt);
                  return (
                    <Fragment key={record.id}>
                      <tr className="border-b last:border-b-0">
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{record.memberName ?? 'Unknown member'}</p>
                          <p className="text-xs text-muted-foreground">
                            {categoryLabels[record.category]}
                            {record.eventName ? ` · ${record.eventName}` : ''}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <time dateTime={record.checkedInAt}>
                            {recordDate.format(checkedInAt)}
                          </time>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {recordTime.format(checkedInAt)} –{' '}
                          {record.checkedOutAt ? (
                            recordTime.format(new Date(record.checkedOutAt))
                          ) : (
                            <span className="text-muted-foreground">no sign-out</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {record.hours.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={record.status} />
                            {record.edited && <Badge variant="outline">Edited</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => startEdit(record)}
                              aria-label={`Edit record for ${record.memberName ?? 'member'}`}
                            >
                              <Pencil aria-hidden="true" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-expanded={historyFor === record.id}
                              onClick={() => void toggleHistory(record)}
                              aria-label={`History for ${record.memberName ?? 'member'}`}
                            >
                              <History aria-hidden="true" /> History
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {historyFor === record.id && (
                        <tr className="border-b bg-muted/20 last:border-b-0">
                          <td colSpan={6} className="px-3 py-3">
                            {historyError ? (
                              <p className="text-sm text-destructive">{historyError}</p>
                            ) : history === null ? (
                              <p className="text-sm text-muted-foreground">Loading history…</p>
                            ) : (
                              <HistoryPanel entries={history} members={members} events={events} />
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
