import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getMemberProfile } from '@/lib/roster';
import { ProfileSetup } from './profile-setup';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session?.user) redirect('/auth');
  const profile = await getMemberProfile();
  if (profile?.preferredName) redirect('/');
  return <ProfileSetup initialName={profile?.preferredName ?? ''} />;
}
