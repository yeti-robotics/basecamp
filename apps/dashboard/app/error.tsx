'use client';

import { TriangleAlert } from 'lucide-react';
import { ErrorToast } from '@/components/ErrorToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-svh place-items-center px-5 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <TriangleAlert aria-hidden="true" className="mb-3 size-5 text-muted-foreground" />
          <CardTitle>Something couldn’t be loaded</CardTitle>
          <CardDescription>
            Your dashboard is temporarily unavailable. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        </CardContent>
      </Card>
      <ErrorToast
        id="dashboard-error"
        message="Dashboard could not be loaded"
        description="Please try again."
      />
    </main>
  );
}
