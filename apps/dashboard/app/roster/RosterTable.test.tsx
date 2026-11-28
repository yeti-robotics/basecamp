import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { RosterMember } from '@/lib/roster';
import { downloadCsv } from '../../lib/csv';
import { RosterTable } from './RosterTable';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

jest.mock('../../lib/csv', () => ({
  ...jest.requireActual('../../lib/csv'),
  downloadCsv: jest.fn(),
}));

const season = { id: 4, name: '2027–28', startsOn: '2027-05-15', endsOn: '2028-05-14' };
const searchableMembers: RosterMember[] = [
  {
    id: 1,
    userId: 'member-1',
    name: 'Alex Member',
    image: null,
    role: 'student',
    studentExperience: 'rookie',
    state: 'active',
  },
  {
    id: 2,
    userId: 'mentor-1',
    name: 'Morgan Mentor',
    image: null,
    role: 'mentor',
    studentExperience: null,
    state: 'active',
  },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock;
  mockRefresh.mockClear();
  jest.mocked(downloadCsv).mockClear();
});

it('shows the current season and roster roles with student experience', () => {
  render(
    <RosterTable
      season={season}
      members={[
        {
          id: 1,
          userId: 'member-1',
          name: 'Alex Member',
          image: null,
          role: 'student_leader',
          studentExperience: 'veteran',
          state: 'active',
        },
        {
          id: 2,
          userId: 'mentor-1',
          name: 'Morgan Mentor',
          image: null,
          role: 'mentor',
          studentExperience: null,
          state: 'active',
        },
      ]}
      ownMember={null}
      seasons={[]}
      canManage={false}
    />,
  );

  expect(screen.getByRole('heading', { name: '2027–28' })).toBeInTheDocument();
  expect(screen.getByText('Alex Member')).toBeInTheDocument();
  expect(
    within(screen.getByRole('table')).getByRole('cell', { name: /^Student Leader$/ }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('table')).getByRole('cell', { name: /^Veteran$/ }),
  ).toBeInTheDocument();
  expect(screen.getByText('Morgan Mentor')).toBeInTheDocument();
  expect(
    within(screen.getByRole('table')).getByRole('cell', { name: /^Mentor$/ }),
  ).toBeInTheDocument();
});

it('shows preferred names with Discord identity and searches either name', () => {
  render(
    <RosterTable
      season={season}
      members={[{ ...searchableMembers[0]!, preferredName: 'Sam Rivers' }]}
      ownMember={null}
      seasons={[]}
      canManage={false}
    />,
  );

  expect(screen.getByText('Sam Rivers')).toBeInTheDocument();
  expect(screen.getByText('Discord: Alex Member')).toBeInTheDocument();
  expect(screen.getByText('SR')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Sam' } });
  expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 1 members');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Alex' } });
  expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 1 members');
});

it('shows an explicit empty state for a new season roster', () => {
  render(<RosterTable season={season} members={[]} ownMember={null} seasons={[]} canManage />);
  expect(screen.getByText('No one has joined this season yet.')).toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.queryByText('No members match your search')).not.toBeInTheDocument();
});

it('updates the season, member names, and result count from new API props', () => {
  const { rerender } = render(
    <RosterTable season={season} members={searchableMembers} ownMember={null} canManage={false} />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 2 members');
  rerender(
    <RosterTable
      season={{ id: 9, name: 'Updated season', startsOn: '2029-01-01', endsOn: '2029-12-31' }}
      members={[{ ...searchableMembers[0]!, name: 'New database name' }]}
      ownMember={null}
      canManage={false}
    />,
  );
  expect(screen.getByRole('heading', { name: 'Updated season' })).toBeVisible();
  expect(screen.getByText('New database name')).toBeVisible();
  expect(screen.queryByText('Morgan Mentor')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 1 members');
  expect(screen.getByText('Jan 1, 2029')).toHaveAttribute('datetime', '2029-01-01');
});

it('clears search without losing an open member editor or its draft', () => {
  render(<RosterTable season={season} members={searchableMembers} ownMember={null} canManage />);
  const edit = screen.getByRole('button', { name: 'Edit member Alex Member' });
  expect(edit).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('combobox', { name: 'Role for Alex Member' })).not.toBeInTheDocument();
  fireEvent.click(edit);
  fireEvent.change(screen.getByLabelText('Role for Alex Member'), {
    target: { value: 'student_leader' },
  });
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Morgan' } });
  expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 2 members');
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByLabelText('Role for Alex Member')).toBeVisible();
  expect(screen.getByLabelText('Role for Alex Member')).toHaveValue('student_leader');
  expect(edit).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 2 members');
});

it('shows a recoverable error when saving cannot reach the API', async () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
  render(<RosterTable season={season} members={searchableMembers} ownMember={null} canManage />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit member Alex Member' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Check your connection and try again.',
  );
  expect(screen.getByRole('button', { name: 'Save assignment' })).toBeEnabled();
  expect(mockRefresh).not.toHaveBeenCalled();
});

it('filters by partial member name ignoring capitalization and surrounding whitespace', () => {
  render(
    <RosterTable season={season} members={searchableMembers} ownMember={null} canManage={false} />,
  );
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search members' }), {
    target: { value: '  oRgAn  ' },
  });
  expect(screen.getByText('Morgan Mentor')).toBeInTheDocument();
  expect(screen.getByText('Alex Member')).not.toBeVisible();
  expect(screen.queryByRole('button', { name: 'Save assignment' })).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

it.each(['Mentor Morgan', '  mEnToR   Morgan  ', 'Morgan\tMentor'])(
  'matches all search words regardless of order and whitespace (%j)',
  (value) => {
    render(
      <RosterTable
        season={season}
        members={searchableMembers}
        ownMember={null}
        canManage={false}
      />,
    );
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search members' }), {
      target: { value },
    });
    expect(screen.getByText('Morgan Mentor')).toBeVisible();
    expect(screen.queryByRole('cell', { name: 'Alex Member' })).not.toBeInTheDocument();
  },
);

it('requires every search word to match the member name', () => {
  render(
    <RosterTable season={season} members={searchableMembers} ownMember={null} canManage={false} />,
  );
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search members' }), {
    target: { value: 'Morgan Alex' },
  });
  expect(screen.getByText('No members match your search')).toBeVisible();
});

it.each(['', '   '])('shows all members for an empty or whitespace-only search (%j)', (value) => {
  render(
    <RosterTable season={season} members={searchableMembers} ownMember={null} canManage={false} />,
  );
  const input = screen.getByRole('searchbox', { name: 'Search members' });
  fireEvent.change(input, { target: { value: 'Alex' } });
  expect(screen.getByText('Morgan Mentor')).not.toBeVisible();
  fireEvent.change(input, { target: { value } });
  expect(screen.getByText('Alex Member')).toBeInTheDocument();
  expect(screen.getByText('Morgan Mentor')).toBeInTheDocument();
});

it.each([false, true])('shows no matches and recovers when cleared (canManage=%s)', (canManage) => {
  render(
    <RosterTable
      season={season}
      members={searchableMembers}
      ownMember={null}
      canManage={canManage}
    />,
  );
  const input = screen.getByRole('searchbox', { name: 'Search members' });
  fireEvent.change(input, { target: { value: 'Nobody' } });
  expect(screen.getByRole('cell', { name: 'No members match your search' })).toHaveAttribute(
    'colspan',
    canManage ? '5' : '4',
  );
  expect(screen.getByText('Alex Member')).not.toBeVisible();
  expect(screen.getByText('Morgan Mentor')).not.toBeVisible();
  expect(screen.queryByText('No one has joined this season yet.')).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: '' } });
  expect(screen.getByText('Alex Member')).toBeInTheDocument();
  expect(screen.getByText('Morgan Mentor')).toBeInTheDocument();
  expect(screen.queryByText('No members match your search')).not.toBeInTheDocument();
});

it('preserves administrator member actions after filtering', async () => {
  render(<RosterTable season={season} members={searchableMembers} ownMember={null} canManage />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search members' }), {
    target: { value: 'Morgan' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Edit member Morgan Mentor' }));
  fireEvent.click(
    within(screen.getByText('Morgan Mentor').closest('tr')!).getByText('Access actions'),
  );
  expect(screen.getByRole('button', { name: 'Remove from season' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Suspend account access' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/roster/members/2',
      expect.objectContaining({ method: 'PATCH' }),
    ),
  );
});

it('keeps unsaved role, experience, and reason when search hides a member', async () => {
  render(<RosterTable season={season} members={searchableMembers} ownMember={null} canManage />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit member Alex Member' }));
  fireEvent.change(screen.getByLabelText('Role for Alex Member'), {
    target: { value: 'student_leader' },
  });
  fireEvent.change(screen.getByLabelText('Experience for Alex Member'), {
    target: { value: 'veteran' },
  });
  fireEvent.click(screen.getAllByText('Access actions')[0]!);
  fireEvent.change(screen.getByLabelText('Reason for Alex Member'), {
    target: { value: 'Left the team' },
  });

  const search = screen.getByRole('searchbox', { name: 'Search members' });
  fireEvent.change(search, { target: { value: 'Morgan' } });
  expect(screen.getByText('Alex Member')).not.toBeVisible();
  expect(screen.queryByRole('combobox', { name: 'Role for Alex Member' })).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: 'Nobody' } });
  expect(screen.getByText('No members match your search')).toBeVisible();
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.change(search, { target: { value: 'Alex' } });

  expect(screen.getByLabelText('Role for Alex Member')).toHaveValue('student_leader');
  expect(screen.getByLabelText('Experience for Alex Member')).toHaveValue('veteran');
  expect(screen.getByLabelText('Reason for Alex Member')).toHaveValue('Left the team');
  fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/roster/members/1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ role: 'student_leader', studentExperience: 'veteran' }),
      }),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove from season' }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/roster/members/1/remove',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Left the team' }),
      }),
    ),
  );
});

it('shows a member their own assignment without exposing the roster', () => {
  render(
    <RosterTable
      season={season}
      members={[]}
      ownMember={{
        id: 1,
        userId: 'member-1',
        name: 'Alex Member',
        image: null,
        role: 'student',
        studentExperience: 'rookie',
        state: 'active',
      }}
      seasons={[]}
      canManage={false}
    />,
  );
  expect(screen.getByText('Your current membership')).toBeInTheDocument();
  expect(screen.getByText('Rookie')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
});

it('does not offer search when there is no season', () => {
  render(<RosterTable season={null} members={[]} ownMember={null} canManage={false} />);
  expect(screen.getByText('No active season is configured yet.')).toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
});

it('links administrators to prior seasons and explains historical correction access', () => {
  render(
    <RosterTable
      season={{ ...season, readOnly: true }}
      members={[]}
      ownMember={null}
      seasons={[
        { id: 3, name: '2026–27', startsOn: '2026-05-15', endsOn: '2027-05-14', readOnly: true },
      ]}
      selectedSeasonId={4}
      canManage
    />,
  );
  expect(
    screen.getByText('Past season · admins can correct historical assignments'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '2026–27' })).toHaveAttribute(
    'href',
    '/roster?seasonId=3',
  );
  expect(screen.queryByRole('button', { name: 'Save assignment' })).not.toBeInTheDocument();
});

it('sends explicit historical assignment corrections to the selected season route', async () => {
  render(
    <RosterTable
      season={{ ...season, id: 3, readOnly: true }}
      members={[
        {
          id: 11,
          userId: 'member-11',
          name: 'Jordan Member',
          image: null,
          role: 'student',
          studentExperience: 'rookie',
          state: 'active',
        },
      ]}
      ownMember={null}
      seasons={[]}
      selectedSeasonId={3}
      canManage
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit member Jordan Member' }));
  fireEvent.change(screen.getByLabelText('Role for Jordan Member'), {
    target: { value: 'student_leader' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/roster/seasons/3/members/11',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ role: 'student_leader', studentExperience: 'rookie' }),
      }),
    ),
  );
  expect(screen.queryByRole('button', { name: 'Remove from season' })).not.toBeInTheDocument();
});

it('saves role corrections with student experience for student roles', async () => {
  render(
    <RosterTable
      season={season}
      members={[
        {
          id: 8,
          userId: 'member-8',
          name: 'Riley Member',
          image: null,
          role: 'mentor',
          studentExperience: null,
          state: 'active',
        },
      ]}
      ownMember={null}
      seasons={[]}
      canManage
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit member Riley Member' }));
  fireEvent.change(screen.getByLabelText('Role for Riley Member'), {
    target: { value: 'student' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/roster/members/8',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ role: 'student', studentExperience: 'rookie' }),
      }),
    ),
  );
  expect(mockRefresh).toHaveBeenCalled();
});

it('keeps season removal and account suspension as distinct actions', async () => {
  render(
    <RosterTable
      season={season}
      members={[
        {
          id: 9,
          userId: 'member-9',
          name: 'Casey Member',
          image: null,
          role: 'student',
          studentExperience: 'rookie',
          state: 'active',
        },
      ]}
      ownMember={null}
      seasons={[]}
      canManage
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit member Casey Member' }));
  fireEvent.click(screen.getByText('Access actions'));
  fireEvent.change(screen.getByLabelText('Reason for Casey Member'), {
    target: { value: 'Left the team' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Remove from season' }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/roster/members/9/remove',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Left the team' }),
      }),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Suspend account access' }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/access/users/member-9/suspend',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Left the team' }),
      }),
    ),
  );
});

it('offers account restoration for a suspended member', async () => {
  render(
    <RosterTable
      season={season}
      members={[
        {
          id: 10,
          userId: 'member-10',
          name: 'Taylor Member',
          image: null,
          role: 'student',
          studentExperience: 'veteran',
          state: 'active',
          suspended: true,
        },
      ]}
      ownMember={null}
      seasons={[]}
      canManage
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit member Taylor Member' }));
  fireEvent.click(screen.getByText('Access actions'));
  fireEvent.click(screen.getByRole('button', { name: 'Restore account access' }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/access/users/member-10/restore',
      expect.objectContaining({ method: 'POST' }),
    ),
  );
});

// The filter controls must work together and preserve the existing member editor.
it('combines experience, role, status, and name filters', () => {
  render(<RosterTable season={season} members={searchableMembers} ownMember={null} canManage />);

  fireEvent.change(screen.getByRole('combobox', { name: /^Experience$/ }), {
    target: { value: 'rookie' },
  });
  expect(screen.getByText('Alex Member')).toBeVisible();
  expect(screen.getByText('Morgan Mentor')).not.toBeVisible();

  fireEvent.change(screen.getByRole('combobox', { name: /^Role$/ }), {
    target: { value: 'mentor' },
  });
  expect(screen.getByRole('status')).toHaveTextContent('Showing 0 of 2 members');
  expect(screen.getByText('No members match your search')).toBeVisible();

  fireEvent.change(screen.getByRole('combobox', { name: /^Role$/ }), {
    target: { value: 'student' },
  });
  fireEvent.change(screen.getByLabelText('Membership or account status'), {
    target: { value: 'active' },
  });
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Alex' } });
  expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 2 members');
  expect(screen.getByText('Alex Member')).toBeVisible();
});

it('filters members without student experience', () => {
  render(
    <RosterTable season={season} members={searchableMembers} ownMember={null} canManage={false} />,
  );
  fireEvent.change(screen.getByLabelText('Experience', { selector: '#roster-experience' }), {
    target: { value: 'none' },
  });
  expect(screen.getByText('Morgan Mentor')).toBeVisible();
  expect(screen.getByText('Alex Member')).not.toBeVisible();
});

it('filters removed memberships separately from suspended accounts', () => {
  const members: RosterMember[] = [
    { ...searchableMembers[0]!, state: 'removed' },
    { ...searchableMembers[1]!, suspended: true },
  ];
  render(<RosterTable season={season} members={members} ownMember={null} canManage />);
  const status = screen.getByLabelText('Membership or account status');
  fireEvent.change(status, { target: { value: 'removed' } });
  expect(screen.getByText('Alex Member')).toBeVisible();
  expect(screen.getByText('Morgan Mentor')).not.toBeVisible();
  fireEvent.change(status, { target: { value: 'suspended' } });
  expect(screen.getByText('Alex Member')).not.toBeVisible();
  expect(screen.getByText('Morgan Mentor')).toBeVisible();
});

it('resets every filter and restores all members', () => {
  render(<RosterTable season={season} members={searchableMembers} ownMember={null} canManage />);
  const search = screen.getByRole('searchbox');
  const role = screen.getByRole('combobox', { name: /^Role$/ });
  const experience = screen.getByRole('combobox', { name: /^Experience$/ });
  const status = screen.getByLabelText('Membership or account status');
  fireEvent.change(search, { target: { value: 'Alex' } });
  fireEvent.change(role, { target: { value: 'student' } });
  fireEvent.change(experience, { target: { value: 'rookie' } });
  fireEvent.change(status, { target: { value: 'active' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(search).toHaveValue('');
  expect(role).toHaveValue('all');
  expect(experience).toHaveValue('all');
  expect(status).toHaveValue('all');
  expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 2 members');
  expect(screen.getByText('Alex Member')).toBeVisible();
  expect(screen.getByText('Morgan Mentor')).toBeVisible();
});

it('preserves unsaved editor values when an experience filter hides a member', () => {
  render(<RosterTable season={season} members={searchableMembers} ownMember={null} canManage />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit member Alex Member' }));
  fireEvent.change(screen.getByLabelText('Experience for Alex Member'), {
    target: { value: 'veteran' },
  });
  const experience = screen.getByRole('combobox', { name: /^Experience$/ });
  fireEvent.change(experience, { target: { value: 'none' } });
  expect(screen.getByText('Alex Member')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByLabelText('Experience for Alex Member')).toHaveValue('veteran');
  expect(screen.getByLabelText('Experience for Alex Member')).toBeVisible();
});

it('keeps season-wide statistics unchanged when filtering', () => {
  render(<RosterTable season={season} members={searchableMembers} ownMember={null} canManage />);
  const total = screen.getByText('Total members').parentElement?.parentElement;
  if (!total) throw new Error('Missing total members card');
  expect(within(total).getByText('2')).toBeVisible();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Alex' } });
  expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 2 members');
  expect(within(total).getByText('2')).toBeVisible();
});

it('exports only the matching members in the selected season', () => {
  render(<RosterTable season={season} members={searchableMembers} ownMember={null} canManage />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Alex' } });
  fireEvent.click(screen.getByRole('button', { name: 'Export filtered CSV' }));
  expect(downloadCsv).toHaveBeenCalledTimes(1);
  expect(downloadCsv).toHaveBeenCalledWith(
    'roster-season-4.csv',
    expect.stringContaining(
      '"Alex Member","Alex Member","student","rookie","active","No","2027–28"',
    ),
  );
  expect(downloadCsv).toHaveBeenCalledWith(
    expect.any(String),
    expect.not.stringContaining('Morgan Mentor'),
  );
  expect(global.fetch).not.toHaveBeenCalled();
});

it('disables export when no members match', () => {
  render(<RosterTable season={season} members={searchableMembers} ownMember={null} canManage />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Nobody' } });
  const button = screen.getByRole('button', { name: 'Export filtered CSV' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(downloadCsv).not.toHaveBeenCalled();
});

it('does not expose administrator-only roster export or removed membership options to viewers', () => {
  render(
    <RosterTable season={season} members={searchableMembers} ownMember={null} canManage={false} />,
  );
  expect(screen.queryByRole('button', { name: 'Export filtered CSV' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Removed membership' })).not.toBeInTheDocument();
  expect(screen.queryByText('Removed memberships')).not.toBeInTheDocument();
});

it('uses the historical season ID when exporting a past roster', () => {
  render(
    <RosterTable
      season={{ ...season, id: 3, readOnly: true }}
      members={searchableMembers}
      ownMember={null}
      canManage
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Export filtered CSV' }));
  expect(downloadCsv).toHaveBeenCalledWith(
    'roster-season-3.csv',
    expect.stringContaining('Alex Member'),
  );
});
