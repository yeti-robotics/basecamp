import { redirect } from 'next/navigation';
import { getAttendanceOverview } from '@/lib/attendance';
import { getSession } from '@/lib/auth';
import { DashboardOverview } from './DashboardOverview';

export default async function HomePage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/auth');
  }

  const attendance = await getAttendanceOverview();
  return <DashboardOverview user={session.user} attendance={attendance} />;
}
