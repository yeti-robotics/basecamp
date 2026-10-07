import { CalendarDays, Clock3, MapPin, Megaphone, TrendingUp } from 'lucide-react';
import type { SessionUser } from '@/lib/auth';
import { SignOutButton } from './SignOutButton';

type DashboardOverviewProps = {
  user: SessionUser;
};

const metrics = [
  {
    label: 'Meeting hours',
    value: '42.5',
    helper: '71% of your season goal',
    icon: Clock3,
    accent: 'bg-sky-500/10 text-sky-400',
  },
  {
    label: 'Outreach hours',
    value: '12.0',
    helper: '6 events attended',
    icon: Megaphone,
    accent: 'bg-violet-500/10 text-violet-400',
  },
  {
    label: 'Total hours',
    value: '54.5',
    helper: 'Across all activities',
    icon: TrendingUp,
    accent: 'bg-emerald-500/10 text-emerald-400',
  },
] as const;

const recentActivity = [
  {
    name: 'Tuesday Build Meeting',
    detail: 'The Zone',
    date: 'Oct 6',
    hours: '3.0 hrs',
    category: 'Meeting',
  },
  {
    name: 'STEM Night',
    detail: 'Riverbend Elementary',
    date: 'Oct 3',
    hours: '2.5 hrs',
    category: 'Outreach',
  },
  {
    name: 'Saturday Build Session',
    detail: 'The Zone',
    date: 'Sep 30',
    hours: '5.0 hrs',
    category: 'Meeting',
  },
] as const;

function ProgressRow({
  label,
  completed,
  required,
  accent,
}: {
  label: string;
  completed: number;
  required: number;
  accent: string;
}) {
  const percentage = Math.min(Math.round((completed / required) * 100), 100);

  return (
    <div className="rounded-xl bg-background/60 p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{percentage}% complete</p>
        </div>
        <p className="shrink-0 text-sm">
          <span className="font-semibold">{completed}</span>
          <span className="text-muted-foreground"> / {required} hrs</span>
        </p>
      </div>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemax={required}
        aria-valuemin={0}
        aria-valuenow={completed}
      >
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function DashboardOverview({ user }: DashboardOverviewProps) {
  const firstName = user.name.trim().split(/\s+/)[0] || 'there';

  return (
    <main className="min-h-svh bg-background px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              YETI Robotics <span aria-hidden="true">·</span> 3506
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight">Basecamp</p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
            <div className="min-w-0 sm:text-right">
              <p className="truncate text-sm font-medium">{user.name || 'Team member'}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <SignOutButton className="mt-0 sm:w-auto" />
          </div>
        </header>

        <section className="py-8 sm:py-10" aria-labelledby="dashboard-heading">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-muted-foreground">Member dashboard</p>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-amber-300">
              Preview data
            </span>
          </div>
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

        <section className="grid gap-4 md:grid-cols-3" aria-label="Hours overview">
          {metrics.map(({ label, value, helper, icon: Icon, accent }) => (
            <article
              key={label}
              className="rounded-2xl border border-white/10 bg-card p-5 shadow-lg shadow-black/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">
                    {value}
                    <span className="ml-1 text-base font-normal text-muted-foreground">hrs</span>
                  </p>
                </div>
                <span className={`rounded-xl p-2.5 ${accent}`}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{helper}</p>
            </article>
          ))}
        </section>

        <div className="mt-4 grid gap-4 md:grid-cols-5">
          <section
            className="rounded-2xl border border-white/10 bg-card p-5 shadow-lg shadow-black/10 sm:p-6 md:col-span-3"
            aria-labelledby="progress-heading"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 id="progress-heading" className="text-lg font-semibold">
                  Season progress
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  See how your hours compare with this season&apos;s requirements.
                </p>
              </div>
              <span className="mt-2 w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:mt-0">
                Current season
              </span>
            </div>

            <div className="mt-7 space-y-6">
              <ProgressRow
                label="Meeting attendance"
                completed={42.5}
                required={60}
                accent="bg-sky-400"
              />
              <ProgressRow
                label="Outreach participation"
                completed={12}
                required={20}
                accent="bg-violet-400"
              />
            </div>
          </section>

          <section
            className="rounded-2xl border border-white/10 bg-card p-5 shadow-lg shadow-black/10 sm:p-6 md:col-span-2"
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
            <div className="mt-5 divide-y divide-border">
              {recentActivity.map((activity) => (
                <article key={`${activity.name}-${activity.date}`} className="py-4 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{activity.name}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3" aria-hidden="true" />
                        <span className="truncate">{activity.detail}</span>
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">{activity.hours}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{activity.category}</span>
                    <time>{activity.date}</time>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
