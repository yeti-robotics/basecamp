import { headers } from 'next/headers';

const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:8000';

export interface TeamEvent {
  id: number;
  seasonId: number;
  seasonName: string;
  name: string;
  description: string | null;
  location: string;
  startsAt: string;
  endsAt: string;
  eventType: 'meeting' | 'extra_meeting' | 'outreach' | 'other';
  hourCategory: 'meeting' | 'outreach' | 'none';
  status: 'scheduled' | 'cancelled';
}

export async function getEvents(): Promise<TeamEvent[] | null> {
  const cookie = (await headers()).get('cookie');
  if (!cookie) return null;

  try {
    const response = await fetch(`${apiInternalUrl}/api/events`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as TeamEvent[];
  } catch (error) {
    console.error('Failed to load events:', error);
    return null;
  }
}
