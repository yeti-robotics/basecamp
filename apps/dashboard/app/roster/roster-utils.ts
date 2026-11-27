import { toCsv } from '@/lib/csv';
import type { RosterMember, RosterSeason } from '@/lib/roster';

// Define the available filters using existing roster types.
export interface RosterFilters {
  search: string;
  role: RosterMember['role'] | 'all';
  experience: RosterMember['studentExperience'] | 'all';
  status: RosterMember['state'] | 'all' | 'suspended';
}

// Initially, no filters are applied.
export const defaultRosterFilters: RosterFilters = {
  search: '',
  role: 'all',
  experience: 'all',
  status: 'all',
};

// Return members that satisfy every active filter.
export function filterRosterMembers(
  members: RosterMember[],
  filters: RosterFilters,
): RosterMember[] {
  // Normalize search input to ignore capitalization and extra spaces.
  const searchWords = filters.search.trim().toLowerCase().split(/\s+/);

  return members.filter((member) => {
    // Support searching by both Discord and preferred names.
    const memberName = `${member.name} ${member.preferredName ?? ''}`.toLowerCase();

    const matchesSearch = searchWords.every((word) => memberName.includes(word));

    const matchesRole = filters.role === 'all' || member.role === filters.role;

    const matchesExperience =
      filters.experience === 'all' || member.studentExperience === filters.experience;

    // Account suspension is separate from season membership status.
    const matchesStatus =
      filters.status === 'all' ||
      (filters.status === 'suspended'
        ? Boolean(member.suspended)
        : member.state === filters.status);

    // All active filters must match for a member to be displayed.
    return matchesSearch && matchesRole && matchesExperience && matchesStatus;
  });
}

// Calculate statistics for the entire selected season.
export function getRosterStatistics(members: RosterMember[]) {
  const activeMembers = members.filter((member) => member.state === 'active');

  return {
    total: members.length,
    active: activeMembers.length,
    rookies: activeMembers.filter((member) => member.studentExperience === 'rookie').length,
    veterans: activeMembers.filter((member) => member.studentExperience === 'veteran').length,
    mentors: activeMembers.filter((member) => member.role === 'mentor').length,
    removed: members.filter((member) => member.state === 'removed').length,
  };
}

// Generate a CSV report containing the supplied roster members.
export function createRosterCsv(members: RosterMember[], season: RosterSeason): string {
  return toCsv([
    [
      'Preferred Name',
      'Discord Name',
      'Role',
      'Experience',
      'Membership Status',
      'Account Suspended',
      'Season',
    ],
    ...members.map((member) => [
      // Fall back to the Discord name when no preferred name exists.
      member.preferredName || member.name,
      member.name,
      member.role,
      member.studentExperience ?? '',
      member.state,
      member.suspended ? 'Yes' : 'No',
      season.name,
    ]),
  ]);
}
