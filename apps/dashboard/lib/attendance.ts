import { headers } from 'next/headers';

export type AttendanceOverview = {
  season: { id: number; name: string } | null;
  hours: { meeting: number; outreach: number; total: number };
  requirements: { meeting: number | null; outreach: number | null } | null;
  recentActivity: {
    id: number;
    category: 'meeting' | 'outreach';
    name: string;
    checkedInAt: string;
    checkedOutAt: string | null;
    hours: number;
  }[];
};

export async function getAttendanceOverview(): Promise<AttendanceOverview | null> {
  const cookie = (await headers()).get('cookie');
  if (!cookie) return null;
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? 'http://localhost:8000'}/api/attendance/overview`,
      {
        headers: { cookie },
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as AttendanceOverview;
  } catch {
    return null;
  }
}
