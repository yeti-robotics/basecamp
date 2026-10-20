import { headers } from 'next/headers';

const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:8000';

export interface Season {
  id: number;
  name: string;
  startsOn: string;
  endsOn: string;
  period?: 'past' | 'current' | 'upcoming';
}

export interface SeasonView {
  seasons: Season[];
  currentSeasonId: number | null;
  canManage: boolean;
  canBootstrap: boolean;
  canView: boolean;
  suggestedDates: { startsOn: string; endsOn: string };
}

export async function getSeasons(): Promise<SeasonView | null> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get('cookie');
  if (!cookie) return null;

  try {
    const response = await fetch(`${apiInternalUrl}/api/seasons`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error(`Season request failed (${response.status})`);
    return (await response.json()) as SeasonView;
  } catch (error) {
    console.error('Failed to load seasons:', error);
    return null;
  }
}
