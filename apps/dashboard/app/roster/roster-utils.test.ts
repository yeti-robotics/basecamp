import type { RosterMember, RosterSeason } from '@/lib/roster';
import {
  createRosterCsv,
  defaultRosterFilters,
  filterRosterMembers,
  getRosterStatistics,
} from './roster-utils';

// Sample members covering different roles, experience levels, and statuses.
const rookie: RosterMember = {
  id: 1,
  userId: 'member-1',
  name: 'Alex Morgan',
  preferredName: 'Alex Rivers',
  image: null,
  role: 'student',
  studentExperience: 'rookie',
  state: 'active',
};

const veteran: RosterMember = {
  id: 2,
  userId: 'member-2',
  name: 'Sam Wilson',
  image: null,
  role: 'student_leader',
  studentExperience: 'veteran',
  state: 'active',
};

const mentor: RosterMember = {
  id: 3,
  userId: 'member-3',
  name: 'Taylor Smith',
  image: null,
  role: 'mentor',
  studentExperience: null,
  state: 'active',
};

const removed: RosterMember = {
  ...veteran,
  id: 4,
  userId: 'member-4',
  name: 'Jordan Lee',
  state: 'removed',
};

const suspended: RosterMember = {
  ...rookie,
  id: 5,
  userId: 'member-5',
  name: 'Casey Brown',
  preferredName: null,
  suspended: true,
};

const members = [rookie, veteran, mentor, removed, suspended];

const season: RosterSeason = {
  id: 1,
  name: '2026-27',
  startsOn: '2026-05-15',
  endsOn: '2027-05-14',
};

// Verify that roster filters work independently and together.
describe('filterRosterMembers', () => {
  it('returns all members when filters are empty', () => {
    expect(filterRosterMembers(members, defaultRosterFilters)).toEqual(members);
  });

  it('searches names regardless of capitalization and whitespace', () => {
    expect(
      filterRosterMembers(members, {
        ...defaultRosterFilters,
        search: '  MORGAN   alex  ',
      }),
    ).toEqual([rookie]);
  });

  it('searches preferred names', () => {
    expect(
      filterRosterMembers(members, {
        ...defaultRosterFilters,
        search: 'Rivers',
      }),
    ).toEqual([rookie]);
  });

  it('returns all members when search contains only whitespace', () => {
    expect(
      filterRosterMembers(members, {
        ...defaultRosterFilters,
        search: '   ',
      }),
    ).toEqual(members);
  });

  it('filters rookies', () => {
    expect(
      filterRosterMembers(members, {
        ...defaultRosterFilters,
        experience: 'rookie',
      }),
    ).toEqual([rookie, suspended]);
  });

  it('filters veterans', () => {
    expect(
      filterRosterMembers(members, {
        ...defaultRosterFilters,
        experience: 'veteran',
      }),
    ).toEqual([veteran, removed]);
  });

  it('filters members without student experience', () => {
    expect(
      filterRosterMembers(members, {
        ...defaultRosterFilters,
        experience: null,
      }),
    ).toEqual([mentor]);
  });

  it('filters by role', () => {
    expect(
      filterRosterMembers(members, {
        ...defaultRosterFilters,
        role: 'mentor',
      }),
    ).toEqual([mentor]);
  });

  it('filters active memberships', () => {
    expect(
      filterRosterMembers(members, {
        ...defaultRosterFilters,
        status: 'active',
      }),
    ).toEqual([rookie, veteran, mentor, suspended]);
  });

  it('filters removed memberships', () => {
    expect(
      filterRosterMembers(members, {
        ...defaultRosterFilters,
        status: 'removed',
      }),
    ).toEqual([removed]);
  });

  it('filters suspended accounts', () => {
    expect(
      filterRosterMembers(members, {
        ...defaultRosterFilters,
        status: 'suspended',
      }),
    ).toEqual([suspended]);
  });

  it('combines search, role, experience and status filters', () => {
    expect(
      filterRosterMembers(members, {
        search: 'Sam',
        role: 'student_leader',
        experience: 'veteran',
        status: 'active',
      }),
    ).toEqual([veteran]);
  });

  it('returns an empty array when filters do not match', () => {
    expect(
      filterRosterMembers(members, {
        ...defaultRosterFilters,
        role: 'mentor',
        experience: 'rookie',
      }),
    ).toEqual([]);
  });

  it('handles an empty roster', () => {
    expect(filterRosterMembers([], defaultRosterFilters)).toEqual([]);
  });
});

// Verify statistics for the entire season.
describe('getRosterStatistics', () => {
  it('calculates season-wide membership statistics', () => {
    expect(getRosterStatistics(members)).toEqual({
      total: 5,
      active: 4,
      rookies: 2,
      veterans: 1,
      mentors: 1,
      removed: 1,
    });
  });

  it('returns zero counts for an empty roster', () => {
    expect(getRosterStatistics([])).toEqual({
      total: 0,
      active: 0,
      rookies: 0,
      veterans: 0,
      mentors: 0,
      removed: 0,
    });
  });

  it('does not count removed members as active students', () => {
    expect(getRosterStatistics([removed])).toEqual({
      total: 1,
      active: 0,
      rookies: 0,
      veterans: 0,
      mentors: 0,
      removed: 1,
    });
  });
});

// Verify that CSV exports contain the correct data.
describe('createRosterCsv', () => {
  const expectedHeaders =
    '"Preferred Name","Discord Name","Role","Experience","Membership Status","Account Suspended","Season"';

  it('includes all expected column headers', () => {
    expect(createRosterCsv([], season)).toBe(expectedHeaders);
  });

  it('includes preferred and Discord names', () => {
    const csv = createRosterCsv([rookie], season);

    expect(csv).toContain('"Alex Rivers","Alex Morgan","student","rookie","active","No","2026-27"');
  });

  it('exports only the supplied members', () => {
    const csv = createRosterCsv([rookie], season);

    expect(csv).toContain('Alex Morgan');
    expect(csv).not.toContain('Sam Wilson');
    expect(csv).not.toContain('Taylor Smith');
  });

  it('exports members matching the active filters', () => {
    const filtered = filterRosterMembers(members, {
      ...defaultRosterFilters,
      experience: 'veteran',
      status: 'active',
    });

    const csv = createRosterCsv(filtered, season);

    expect(csv).toContain('Sam Wilson');
    expect(csv).not.toContain('Jordan Lee');
    expect(csv).not.toContain('Alex Morgan');
  });

  it('falls back to the Discord name when preferred name is missing', () => {
    const csv = createRosterCsv([veteran], season);

    expect(csv).toContain('"Sam Wilson","Sam Wilson"');
  });

  it('handles members without student experience', () => {
    const csv = createRosterCsv([mentor], season);

    expect(csv).toContain('"Taylor Smith","Taylor Smith","mentor","","active","No","2026-27"');
  });

  it('includes removed membership status', () => {
    const csv = createRosterCsv([removed], season);

    expect(csv).toContain('"veteran","removed","No"');
  });

  it('includes suspended account status', () => {
    const csv = createRosterCsv([suspended], season);

    expect(csv).toContain('"active","Yes"');
  });

  it('includes the selected season name', () => {
    const csv = createRosterCsv([rookie], {
      ...season,
      name: '2025-26',
    });

    expect(csv).toContain('"2025-26"');
    expect(csv).not.toContain('"2026-27"');
  });

  it('does not expose internal member identifiers', () => {
    const csv = createRosterCsv(members, season);

    for (const member of members) {
      expect(csv).not.toContain(member.userId);
    }
  });

  it('neutralizes spreadsheet formulas in preferred names', () => {
    const unsafeMember: RosterMember = {
      ...rookie,
      preferredName: '=1+1',
    };

    const csv = createRosterCsv([unsafeMember], season);

    expect(csv).toContain(`"'=1+1"`);
  });

  it('neutralizes spreadsheet formulas in Discord names', () => {
    const unsafeMember: RosterMember = {
      ...rookie,
      name: '@SUM(A1:A2)',
    };

    const csv = createRosterCsv([unsafeMember], season);

    expect(csv).toContain(`"'@SUM(A1:A2)"`);
  });

  it('properly escapes commas and quotation marks in names', () => {
    const member: RosterMember = {
      ...rookie,
      preferredName: 'Morgan, "Ace"',
    };

    const csv = createRosterCsv([member], season);

    expect(csv).toContain('"Morgan, ""Ace"""');
  });

  it('generates one data row for each member', () => {
    const csv = createRosterCsv(members, season);

    // The extra row contains the column headers.
    expect(csv.split('\r\n')).toHaveLength(members.length + 1);
  });

  it('returns only headers when no members are supplied', () => {
    expect(createRosterCsv([], season).split('\r\n')).toHaveLength(1);
  });
});
