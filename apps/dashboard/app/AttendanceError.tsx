import { TriangleAlert } from 'lucide-react';
import { ErrorToast } from '@/components/ErrorToast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function AttendanceError() {
  return (
    <Alert className="mb-6" role="status">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>Attendance could not be loaded.</AlertTitle>
      <AlertDescription className="gap-3">
        <p>Your hours are temporarily unavailable. Reload to try again.</p>
        <Button asChild variant="outline" size="sm">
          <a href="/">Try again</a>
        </Button>
      </AlertDescription>
      <ErrorToast
        id="attendance-unavailable"
        message="Attendance could not be loaded"
        description="Reload the dashboard to try again."
      />
    </Alert>
  );
}
