import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div
      className="min-h-svh bg-background"
      role="status"
      aria-label="Loading dashboard"
      aria-busy="true"
    >
      <span className="sr-only">Loading your dashboard…</span>
      <div aria-hidden="true">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
            <span className="font-semibold tracking-tight">Basecamp</span>
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="mx-auto flex max-w-7xl gap-6 px-5 py-4 sm:px-8">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-14" />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
          <div className="mb-8 space-y-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full max-w-96" />
            <Skeleton className="h-5 w-full max-w-lg" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {['meeting', 'outreach', 'total'].map((key) => (
              <Card key={key}>
                <CardHeader>
                  <Skeleton className="h-4 w-28" />
                </CardHeader>
                <CardContent className="space-y-5">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-3 w-44 max-w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader className="border-b">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-44 max-w-full" />
              </CardHeader>
              <CardContent className="space-y-8">
                {['meeting', 'outreach'].map((key) => (
                  <div key={key} className="space-y-4">
                    <Skeleton className="h-9 w-40 max-w-full" />
                    <Skeleton className="h-1.5 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader className="border-b">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-3 w-56 max-w-full" />
              </CardHeader>
              <CardContent className="space-y-6">
                {['first', 'second', 'third', 'fourth'].map((key) => (
                  <div key={key} className="flex items-center gap-4">
                    <Skeleton className="size-9 shrink-0 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
