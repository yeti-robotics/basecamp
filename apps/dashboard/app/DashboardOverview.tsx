import { CalendarDays, Clock3, Megaphone, TrendingUp } from 'lucide-react';
import type { SessionUser } from '@/lib/auth';
import { SignOutButton } from './SignOutButton';

type DashboardOverviewProps = {
  user: SessionUser;
};

const metrics = [
  { label: 'Meeting hours', value: '0.0', helper: 'This season', icon: Clock3 },
  { label: 'Outreach hours', value: '0.0', helper: 'This season', icon: Megaphone },
  { label: 'Total hours', value: '0.0', helper: 'Across all activities', icon: TrendingUp },
] as const;

function ProgressRow({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-background/40 p-4 sm:p-5">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">0 hours recorded</span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={0}
      >
        <div className="h-full w-0 bg-primary" />
      </div>
    </div>
  );
}

export function DashboardOverview({ user }: DashboardOverviewProps) {
  const firstName = user.name.trim().split(/\s+/)[0] || 'there';

  return (
    <main className="min-h-svh bg-background px-5 pb-10 pt-6 sm:px-8 sm:pb-12 sm:pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              YETI Robotics <span aria-hidden="true">·</span> 3506
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight">Basecamp</p>
          </div>

          <div className="flex w-full flex-col gap-4 rounded-xl border bg-card p-4 sm:w-auto sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
            <div className="min-w-0 sm:max-w-64 sm:text-right">
              <p className="truncate text-sm font-medium">{user.name || 'Team member'}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <SignOutButton className="mt-0 sm:w-auto" />
          </div>
        </header>

        <section className="py-9 sm:py-12" aria-labelledby="dashboard-heading">
          <p className="text-sm font-medium text-muted-foreground">Member dashboard</p>
          <h1
            id="dashboard-heading"
            className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Welcome back, {firstName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Track your meeting attendance and outreach progress for the current season.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-3" aria-label="Hours overview">
          {metrics.map(({ label, value, helper, icon: Icon }) => (
            <article
              key={label}
              className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">
                    {value}
                    <span className="ml-1 text-base font-normal text-muted-foreground">hrs</span>
                  </p>
                </div>
                <span className="rounded-xl bg-muted p-2.5 text-muted-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{helper}</p>
            </article>
          ))}
        </section>

        <div className="mt-7 grid gap-5 sm:mt-8 md:grid-cols-5">
          <section
            className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-7 md:col-span-3"
            aria-labelledby="progress-heading"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div>
                <h2 id="progress-heading" className="text-lg font-semibold">
                  Season progress
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Requirements will appear when your season membership is configured.
                </p>
              </div>
              <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Current season
              </span>
            </div>

            <div className="mt-7 space-y-4">
              <ProgressRow label="Meeting attendance" />
              <ProgressRow label="Outreach participation" />
            </div>
          </section>

          <section
            className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-7 md:col-span-2"
            aria-labelledby="activity-heading"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-muted p-2 text-muted-foreground">
                <CalendarDays className="size-5" aria-hidden="true" />
              </span>
              <h2 id="activity-heading" className="text-lg font-semibold">
                Recent activity
              </h2>
            </div>
            <div className="mt-7 rounded-xl border border-dashed px-5 py-10 text-center">
              <p className="text-sm font-medium">No attendance recorded yet</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Your latest meetings and outreach events will show up here.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
