import { headers } from 'next/headers';

export type AttendanceOverview = {
  season: { id: number; name: string } | null;
  hours: { meeting: number; outreach: number; total: number };
  /** `meeting` is the target that applies to this member; `track` says which one it is. */
  requirements: {
    meeting: number | null;
    outreach: number | null;
    track?: 'member' | 'leadership';
  } | null;
  /** Finished meetings this season compared with the member's attendance. */
  progress?: {
    completedMeetings: number;
    attendedMeetings: number;
    excusedMeetings: number;
    missedMeetings: number;
    completedMeetingHours: number;
    scheduledMeetingHours: number;
    expectedHours: { member: number | null; leadership: number | null };
  } | null;
  recentActivity: {
    id: number;
    category: 'meeting' | 'outreach';
    status?: 'normal' | 'manual' | 'excused';
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
