import { getAttendanceOverview } from '@/lib/attendance';
import { requireMember } from '@/lib/require-member';
import { DashboardOverview } from './DashboardOverview';

export default async function HomePage() {
  const { session, profile } = await requireMember();
  const attendance = await getAttendanceOverview();
  return (
    <DashboardOverview
      user={{ ...session.user, name: profile.preferredName }}
      attendance={attendance}
    />
  );
}
