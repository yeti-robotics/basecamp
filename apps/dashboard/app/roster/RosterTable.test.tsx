import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RosterMember } from '@/lib/roster';
import { RosterTable } from './RosterTable';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

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
  expect(screen.getByText('Student Leader')).toBeInTheDocument();
  expect(screen.getByText('Veteran')).toBeInTheDocument();
  expect(screen.getByText('Morgan Mentor')).toBeInTheDocument();
  expect(screen.getByText('Mentor')).toBeInTheDocument();
});

it('shows an explicit empty state for a new season roster', () => {
  render(<RosterTable season={season} members={[]} ownMember={null} seasons={[]} canManage />);
  expect(screen.getByText('No one has joined this season yet.')).toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.queryByText('No members match your search')).not.toBeInTheDocument();
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
  fireEvent.click(screen.getByText('Access actions'));
  fireEvent.click(screen.getByRole('button', { name: 'Restore account access' }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/access/users/member-10/restore',
      expect.objectContaining({ method: 'POST' }),
    ),
  );
});
