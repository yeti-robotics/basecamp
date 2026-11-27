import { redirect } from 'next/navigation';
import { type AuthSession, getSession } from './auth';
import { getMemberProfile, type MemberProfile } from './roster';

export async function requireMember(): Promise<{
  session: AuthSession;
  profile: MemberProfile & { preferredName: string };
}> {
  const session = await getSession();
  if (!session?.user) redirect('/auth');

  const profile = await getMemberProfile();
  if (!profile?.preferredName) redirect('/profile');

  return { session, profile: { ...profile, preferredName: profile.preferredName ?? '' } }; // fix the build error here
}
