import { redirect } from 'next/navigation';
import { Brand } from '@/components/Brand';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { type AttendanceRecordSearch, getAttendanceRecords } from '@/lib/attendance-records';
import { getSession } from '@/lib/auth';
import { getEvents } from '@/lib/events';
import { getRosterView } from '@/lib/roster';
import { AttendanceManager } from './AttendanceManager';

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<AttendanceRecordSearch>;
}) {
  const session = await getSession();
  if (!session?.user) redirect('/auth');

  const params = await searchParams;
  const search: AttendanceRecordSearch = {
    q: typeof params.q === 'string' ? params.q : undefined,
    from: typeof params.from === 'string' ? params.from : undefined,
    to: typeof params.to === 'string' ? params.to : undefined,
    status: typeof params.status === 'string' ? params.status : undefined,
  };
  const result = await getAttendanceRecords(search);
  const [roster, events] =
    result && result !== 'forbidden'
      ? await Promise.all([getRosterView(), getEvents()])
      : [null, null];
  const members = (roster?.members ?? [])
    .filter((member) => member.state === 'active')
    .map((member) => ({ userId: member.userId, name: member.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Brand />
          <Button asChild variant="ghost" size="sm">
            <a href="/">Dashboard</a>
          </Button>
        </div>
      </header>
      <main className="mx-auto min-h-svh max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            YETI Robotics
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Attendance</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Find and correct attendance, add missed sign-ins, and excuse absences.
          </p>
        </header>
        {result === 'forbidden' ? (
          <Alert className="mt-8">
            <AlertTitle>Attendance management is for mentors</AlertTitle>
            <AlertDescription>
              Only active mentors and Team Admins can view and correct team attendance. Your own
              hours are on the dashboard.
            </AlertDescription>
          </Alert>
        ) : result ? (
          <AttendanceManager
            records={result.records}
            truncated={result.truncated}
            members={members}
            events={events ?? []}
            search={search}
          />
        ) : (
          <Alert className="mt-8">
            <AlertTitle>Attendance could not be loaded</AlertTitle>
            <AlertDescription>Reload the page to try again.</AlertDescription>
          </Alert>
        )}
      </main>
    </div>
  );
}
