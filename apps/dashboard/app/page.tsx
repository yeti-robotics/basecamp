import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { DashboardOverview } from './DashboardOverview';

export default async function HomePage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/auth');
  }

  return <DashboardOverview user={session.user} />;
}
