import { headers } from 'next/headers';

const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:8000';

export interface RosterSeason {
  id: number;
  name: string;
  startsOn: string;
  endsOn: string;
  readOnly?: boolean;
}

export interface RosterMember {
  id: number;
  userId: string;
  name: string;
  preferredName?: string | null;
  image: string | null;
  role: 'team_admin' | 'mentor' | 'student_leader' | 'student';
  studentExperience: 'rookie' | 'veteran' | null;
  state: 'active' | 'removed';
  suspended?: boolean;
  joinedAt?: string | Date;
  removedAt?: string | Date | null;
}

export interface RosterView {
  season: RosterSeason | null;
  members: RosterMember[];
  canManage: boolean;
  seasons: RosterSeason[];
  ownMember: RosterMember | null;
  selectedSeasonId?: number;
}

export interface MemberProfile {
  name: string;
  preferredName: string | null;
}

async function apiRequest(path: string, cookie: string) {
  return fetch(`${apiInternalUrl}/api/roster${path}`, {
    headers: { cookie },
    cache: 'no-store',
  });
}

export async function getMemberProfile(): Promise<MemberProfile | null> {
  const cookie = (await headers()).get('cookie');
  if (!cookie) return null;
  try {
    const response = await apiRequest('/profile', cookie);
    return response.ok ? ((await response.json()) as MemberProfile | null) : null;
  } catch {
    return null;
  }
}

export async function getRosterView(selectedSeasonId?: number): Promise<RosterView | null> {
  const cookie = (await headers()).get('cookie');
  if (!cookie) return null;

  try {
    const response = await apiRequest('/current', cookie);
    if (response.status === 403) {
      const ownResponse = await apiRequest('/me', cookie);
      if (!ownResponse.ok) return null;
      return {
        season: null,
        members: [],
        canManage: false,
        seasons: [],
        ownMember: (await ownResponse.json()) as RosterMember | null,
      };
    }
    if (!response.ok) return null;
    let current = (await response.json()) as Omit<RosterView, 'ownMember'>;
    if (current.canManage) {
      const withRemoved = await apiRequest('/current?includeRemoved=true', cookie);
      if (withRemoved.ok) {
        current = (await withRemoved.json()) as Omit<RosterView, 'ownMember'>;
      }
    }
    if (selectedSeasonId && current.canManage) {
      const historical = await apiRequest(
        `/seasons/${selectedSeasonId}?includeRemoved=true`,
        cookie,
      );
      if (historical.ok) {
        const past = (await historical.json()) as Pick<RosterView, 'season' | 'members'>;
        return { ...current, ...past, ownMember: null, selectedSeasonId };
      }
    }
    return { ...current, ownMember: null };
  } catch (error) {
    console.error('Failed to load roster:', error);
    return null;
  }
}
