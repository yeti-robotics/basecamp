import { redirect } from 'next/navigation';
import { getAttendanceOverview } from '@/lib/attendance';
import { getSession } from '@/lib/auth';
import { getMemberProfile } from '@/lib/roster';
import { DashboardOverview } from './DashboardOverview';

export default async function HomePage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/auth');
  }

  const profile = await getMemberProfile();
  if (profile && !profile.preferredName) redirect('/profile');

  const attendance = await getAttendanceOverview();
  return (
    <DashboardOverview
      user={{ ...session.user, name: profile?.preferredName ?? session.user.name }}
      attendance={attendance}
    />
  );
}
