import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  HandHeart,
  Layers3,
  Radio,
  TriangleAlert,
} from 'lucide-react';
import { Brand } from '@/components/Brand';
import type { AttendanceOverview } from '@/lib/attendance';
import type { SessionUser } from '@/lib/auth';
import { SignOutButton } from './SignOutButton';

type DashboardOverviewProps = {
  user: SessionUser;
  attendance: AttendanceOverview | null;
};

const activityDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'America/New_York',
});

function ProgressRow({
  label,
  hours,
  required,
  outreach = false,
}: {
  label: string;
  hours: number;
  required: number | null;
  outreach?: boolean;
}) {
  const percentage =
    required !== null && required > 0 ? Math.max(0, Math.min(100, (hours / required) * 100)) : null;
  const complete = required !== null && hours >= required;
  const Icon = outreach ? HandHeart : Clock3;
  return (
    <div className="py-6 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">{label}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {hours.toFixed(1)}
            {required === null ? ' hours recorded' : ` / ${required} hrs`}
          </p>
        </div>
        {complete ? (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Check aria-hidden="true" className="size-3.5" />
            Met
          </span>
        ) : percentage !== null ? (
          <span className="font-mono text-xs text-muted-foreground">{Math.floor(percentage)}%</span>
        ) : null}
      </div>
      {percentage !== null ? (
        <>
          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={`${label} progress`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percentage}
            aria-valuetext={`${hours.toFixed(1)} of ${required} hours`}
          >
            <div
              className={`h-full rounded-full ${outreach ? 'bg-violet-400' : 'bg-blue-400'}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">
            {complete
              ? 'Season requirement completed'
              : `${Math.max(0, (required ?? 0) - hours).toFixed(1)} hours to go`}
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {required === 0 ? 'No hours required' : 'No requirement configured'}
        </p>
      )}
    </div>
  );
}

export function DashboardOverview({ user, attendance }: DashboardOverviewProps) {
  const metrics = [
    {
      label: 'Meeting hours',
      value: attendance?.hours.meeting,
      icon: Clock3,
      detail: 'Time spent building together',
      color: 'text-blue-400',
    },
    {
      label: 'Outreach hours',
      value: attendance?.hours.outreach,
      icon: HandHeart,
      detail: 'Making an impact beyond the shop',
      color: 'text-violet-400',
    },
    {
      label: 'Total hours',
      value: attendance?.hours.total,
      icon: Layers3,
      detail: 'Your contribution this season',
      color: 'text-emerald-400',
    },
  ];
  const firstName = user.name.trim().split(/\s+/)[0] || 'there';
  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((name) => name[0])
      .join('') || 'TM';

  return (
    <div className="min-h-svh bg-background">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only"
      >
        Skip to content
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-5">
            <Brand />
            <span aria-hidden="true" className="hidden text-2xl font-light text-border sm:block">
              /
            </span>
            <span className="hidden text-sm text-muted-foreground sm:block">YETI Robotics</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="hidden size-8 items-center justify-center rounded-full border bg-muted font-mono text-xs sm:flex"
              aria-hidden="true"
            >
              {initials}
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-40 truncate text-xs font-medium">{user.name || 'Team member'}</p>
              <p className="mt-0.5 max-w-48 truncate text-[11px] text-muted-foreground">
                {user.email}
              </p>
            </div>
            <SignOutButton className="mt-0" />
          </div>
        </div>
        <nav aria-label="Dashboard" className="mx-auto flex max-w-7xl gap-6 px-5 text-sm sm:px-8">
          <a
            href="#main-content"
            aria-current="page"
            className="border-b-2 border-foreground py-3 font-medium"
          >
            Overview
          </a>
          <a
            href="#progress"
            className="py-3 text-muted-foreground transition-colors hover:text-foreground"
          >
            Season progress
          </a>
          <a
            href="#activity"
            className="py-3 text-muted-foreground transition-colors hover:text-foreground"
          >
            Activity
          </a>
        </nav>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl scroll-mt-6 px-5 py-9 sm:px-8 sm:py-12">
        <section
          aria-labelledby="dashboard-heading"
          className="mb-8 flex flex-wrap items-end justify-between gap-5"
        >
          <div>
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-blue-400" aria-hidden="true" />
              Member dashboard
            </p>
            <h1
              id="dashboard-heading"
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Welcome back, {firstName}
              <span className="text-muted-foreground">.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Every hour moves the team forward. Here’s your season at a glance.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
            <span
              className={`size-1.5 rounded-full ${attendance?.season ? 'bg-emerald-400' : 'bg-muted-foreground'}`}
              aria-hidden="true"
            />
            {attendance?.season?.name ?? (attendance ? 'No active season' : 'Season unavailable')}
          </span>
        </section>

        {!attendance ? (
          <div
            role="status"
            className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-400/25 bg-amber-400/5 p-4 text-sm"
          >
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-amber-400" />
            <p className="flex-1 text-muted-foreground">Attendance could not be loaded.</p>
            <a href="/" className="font-medium underline underline-offset-4">
              Try again
            </a>
          </div>
        ) : !attendance.season ? (
          <p className="mb-6 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            No active season is configured yet.
          </p>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3" aria-label="Hours overview">
          {metrics.map(({ label, value, icon: Icon, detail, color }) => (
            <article
              key={label}
              className="min-w-0 rounded-xl border bg-card p-5 transition-colors hover:border-white/20 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm text-muted-foreground">{label}</h2>
                <Icon aria-hidden="true" className={`size-4 ${color}`} />
              </div>
              <p className="mt-6 text-4xl font-medium tracking-tight tabular-nums">
                {value?.toFixed(1) ?? '—'}
                <span className="ml-2 text-sm font-normal tracking-normal text-muted-foreground">
                  hrs
                </span>
              </p>
              <p className="mt-4 text-xs text-muted-foreground">{detail}</p>
            </article>
          ))}
        </section>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
          <section
            id="progress"
            aria-labelledby="progress-heading"
            className="scroll-mt-6 overflow-hidden rounded-xl border bg-card"
          >
            <div className="border-b px-5 py-5 sm:px-6">
              <h2 id="progress-heading" className="text-sm font-medium">
                Season progress
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {attendance
                  ? attendance.requirements
                    ? 'Small steps. A stronger season.'
                    : 'Requirements appear once your season membership is configured.'
                  : 'Season progress is currently unavailable.'}
              </p>
            </div>
            <div className="divide-y p-5 sm:p-6">
              {attendance ? (
                <>
                  <ProgressRow
                    label="Meeting attendance"
                    hours={attendance.hours.meeting}
                    required={attendance.requirements?.meeting ?? null}
                  />
                  <ProgressRow
                    label="Outreach participation"
                    hours={attendance.hours.outreach}
                    required={attendance.requirements?.outreach ?? null}
                    outreach
                  />
                </>
              ) : (
                <p className="py-6 text-sm leading-6 text-muted-foreground">
                  Try reloading to see your progress.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 border-t bg-muted/20 px-5 py-3.5 text-[11px] text-muted-foreground sm:px-6">
              <Layers3 aria-hidden="true" className="size-3.5 shrink-0" />
              Hours count toward your current season.
            </div>
          </section>

          <section
            id="activity"
            aria-labelledby="activity-heading"
            className="scroll-mt-6 overflow-hidden rounded-xl border bg-card lg:col-span-2"
          >
            <div className="flex items-center justify-between gap-4 border-b px-5 py-5 sm:px-6">
              <div>
                <h2 id="activity-heading" className="text-sm font-medium">
                  Recent activity
                </h2>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  Your latest meetings and outreach events.
                </p>
              </div>
              <span className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                {attendance ? `${attendance.recentActivity.length} records` : 'Unavailable'}
              </span>
            </div>
            {attendance && attendance.recentActivity.length > 0 ? (
              <ul className="divide-y">
                {attendance.recentActivity.map((activity) => {
                  const open = !activity.checkedOutAt;
                  return (
                    <li
                      key={activity.id}
                      className="flex items-center gap-3 px-5 py-5 sm:gap-4 sm:px-6"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
                        {activity.category === 'meeting' ? (
                          <ArrowDownLeft aria-hidden="true" className="size-4" />
                        ) : (
                          <ArrowUpRight aria-hidden="true" className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium">{activity.name}</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          <time dateTime={activity.checkedInAt}>
                            {activityDate.format(new Date(activity.checkedInAt))}
                          </time>
                          <span aria-hidden="true"> · </span>
                          {activity.category === 'meeting' ? 'Meeting' : 'Outreach'}
                        </p>
                      </div>
                      <span
                        className={`flex shrink-0 items-center gap-1.5 text-xs tabular-nums ${open ? 'text-emerald-400' : 'text-foreground'}`}
                      >
                        {open ? (
                          <>
                            <Radio aria-hidden="true" className="size-3.5" />
                            In progress
                          </>
                        ) : (
                          `${activity.hours.toFixed(1)} hrs`
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
                <span className="mb-4 flex size-11 items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
                  <Clock3 aria-hidden="true" className="size-5" />
                </span>
                <p className="text-sm font-medium">
                  {attendance ? 'No attendance recorded this season' : 'Activity unavailable'}
                </p>
                <p className="mt-2 max-w-xs text-xs leading-6 text-muted-foreground">
                  {attendance
                    ? 'Your latest meetings and outreach events will show up here after you attend.'
                    : 'Try reloading to see your latest meetings and outreach events.'}
                </p>
              </div>
            )}
            <div className="flex items-center gap-1 border-t bg-muted/20 px-5 py-3.5 text-[11px] text-muted-foreground sm:px-6">
              Your attendance, all in one place
              <ChevronRight aria-hidden="true" className="size-3" />
            </div>
          </section>
        </div>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-[11px] text-muted-foreground">
          <p>
            Basecamp <span className="mx-1 text-border">/</span> YETI Robotics 3506
          </p>
          <p>Built for the team. Powered by your effort.</p>
        </footer>
      </main>
    </div>
  );
}
