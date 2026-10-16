import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { RosterTable } from './RosterTable';

const season = { id: 4, name: '2027–28', startsOn: '2027-05-15', endsOn: '2028-05-14' };

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
});

it('links administrators to prior seasons and marks their view read-only', () => {
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
  expect(screen.getByText('Past season · read only')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '2026–27' })).toHaveAttribute(
    'href',
    '/roster?seasonId=3',
  );
});
