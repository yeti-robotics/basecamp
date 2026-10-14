import { typographyVariants } from '@/components/ui/typography';
import type { AttendanceOverview } from '@/lib/attendance';
import type { SessionUser } from '@/lib/auth';
import { SignOutButton } from './SignOutButton';

type DashboardOverviewProps = {
  user: SessionUser;
  attendance: AttendanceOverview | null;
};

function ProgressRow({
  label,
  hours,
  required,
}: {
  label: string;
  hours: number;
  required: number | null;
}) {
  const percentage =
    required !== null && required > 0 ? Math.min(100, (hours / required) * 100) : null;
  return (
    <div className="rounded-xl border bg-background/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={typographyVariants({ variant: 'small' })}>{label}</span>
        <span className={typographyVariants({ variant: 'muted' })}>
          {hours.toFixed(1)}
          {required === null ? ' hours recorded' : ` / ${required} hrs`}
        </span>
      </div>
      {percentage !== null ? (
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`${label} progress`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percentage}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
        </div>
      ) : (
        <p className={typographyVariants({ variant: 'muted', className: 'mt-3 leading-6' })}>
          {required === 0 ? 'No hours required' : 'No requirement configured'}
        </p>
      )}
    </div>
  );
}

export function DashboardOverview({ user, attendance }: DashboardOverviewProps) {
  const metrics = [
    { label: 'Meeting hours', value: attendance?.hours.meeting },
    { label: 'Outreach hours', value: attendance?.hours.outreach },
    { label: 'Total hours', value: attendance?.hours.total },
  ];
  const firstName = user.name.trim().split(/\s+/)[0] || 'there';

  return (
    <main className="min-h-svh bg-background px-5 pb-10 pt-6 sm:px-8 sm:pb-12 sm:pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={typographyVariants({ variant: 'muted' })}>
              YETI Robotics <span aria-hidden="true">·</span> 3506
            </p>
            <p className={typographyVariants({ variant: 'large', className: 'mt-1' })}>Basecamp</p>
          </div>

          <div className="flex w-full flex-col gap-4 rounded-xl border bg-card p-4 sm:w-auto sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
            <div className="min-w-0 sm:max-w-64 sm:text-right">
              <p className={typographyVariants({ variant: 'small', className: 'truncate' })}>
                {user.name || 'Team member'}
              </p>
              <p className={typographyVariants({ variant: 'muted', className: 'mt-1 truncate' })}>
                {user.email}
              </p>
            </div>
            <SignOutButton className="mt-0 sm:w-auto" />
          </div>
        </header>

        <section className="py-8 sm:py-10" aria-labelledby="dashboard-heading">
          <p
            className={typographyVariants({ variant: 'small', className: 'text-muted-foreground' })}
          >
            Member dashboard
          </p>
          <h1
            id="dashboard-heading"
            className={typographyVariants({ variant: 'h1', className: 'mt-2 text-balance' })}
          >
            Welcome back, {firstName}
          </h1>
          <p
            className={typographyVariants({
              variant: 'lead',
              className: 'mt-4 max-w-2xl leading-7',
            })}
          >
            Track your meeting attendance and outreach progress for the current season.
          </p>
        </section>

        {!attendance ? (
          <div
            role="status"
            className={typographyVariants({
              variant: 'muted',
              className: 'mb-6 rounded-xl border p-4 leading-6',
            })}
          >
            Attendance could not be loaded.{' '}
            <a href="/" className="font-medium text-foreground underline underline-offset-4">
              Try again
            </a>
          </div>
        ) : !attendance.season ? (
          <p
            className={typographyVariants({
              variant: 'muted',
              className: 'mb-6 rounded-xl border p-4 leading-6',
            })}
          >
            No active season is configured yet.
          </p>
        ) : null}

        <section className="grid gap-6 md:grid-cols-3" aria-label="Hours overview">
          {metrics.map(({ label, value }) => (
            <article
              key={label}
              className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
            >
              <p
                className={typographyVariants({
                  variant: 'small',
                  className: 'text-muted-foreground',
                })}
              >
                {label}
              </p>
              <p className={typographyVariants({ variant: 'h2', className: 'mt-3 tabular-nums' })}>
                {value?.toFixed(1) ?? '—'}
                <span className="ml-1 text-base font-normal text-muted-foreground">hrs</span>
              </p>
              <p className={typographyVariants({ variant: 'muted', className: 'mt-4' })}>
                {attendance?.season?.name ?? (attendance ? 'No active season' : 'Unavailable')}
              </p>
            </article>
          ))}
        </section>

        <div className="mt-6 grid items-start gap-6 md:grid-cols-3">
          <section
            className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
            aria-labelledby="progress-heading"
          >
            <div className="flex flex-col items-start gap-3">
              <div>
                <h2 id="progress-heading" className={typographyVariants({ variant: 'h3' })}>
                  Season progress
                </h2>
                <p
                  className={typographyVariants({ variant: 'muted', className: 'mt-2 leading-6' })}
                >
                  {attendance
                    ? attendance.requirements
                      ? 'Your recorded hours toward season requirements.'
                      : 'Requirements appear once your season membership is configured.'
                    : 'Season progress is currently unavailable.'}
                </p>
              </div>
              <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {attendance?.season?.name ?? 'Current season'}
              </span>
            </div>

            <div className="mt-7 space-y-4">
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
                  />
                </>
              ) : (
                <p className={typographyVariants({ variant: 'muted', className: 'leading-6' })}>
                  Try reloading to see your progress.
                </p>
              )}
            </div>
          </section>

          <section
            className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-6 md:col-span-2"
            aria-labelledby="activity-heading"
          >
            <h2 id="activity-heading" className={typographyVariants({ variant: 'h3' })}>
              Recent activity
            </h2>
            {attendance && attendance.recentActivity.length > 0 ? (
              <ul className="mt-6 divide-y">
                {attendance.recentActivity.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p
                        className={typographyVariants({ variant: 'small', className: 'truncate' })}
                      >
                        {activity.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <time dateTime={activity.checkedInAt}>
                          {new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            timeZone: 'America/New_York',
                          }).format(new Date(activity.checkedInAt))}
                        </time>
                        {' · '}
                        {activity.category === 'meeting' ? 'Meeting' : 'Outreach'}
                      </p>
                    </div>
                    <span
                      className={typographyVariants({
                        variant: 'small',
                        className: 'shrink-0 tabular-nums',
                      })}
                    >
                      {activity.checkedOutAt ? `${activity.hours.toFixed(1)} hrs` : 'In progress'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed px-5 py-8 text-center">
                <p className={typographyVariants({ variant: 'small' })}>
                  {attendance ? 'No attendance recorded this season' : 'Activity unavailable'}
                </p>
                <p
                  className={typographyVariants({ variant: 'muted', className: 'mt-2 leading-6' })}
                >
                  {attendance
                    ? 'Your latest meetings and outreach events will show up here after you attend.'
                    : 'Try reloading to see your latest meetings and outreach events.'}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
