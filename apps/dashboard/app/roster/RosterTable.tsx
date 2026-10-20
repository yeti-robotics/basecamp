'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { RosterMember, RosterSeason } from '@/lib/roster';

type RosterTableProps = {
  season: (RosterSeason & { readOnly?: boolean }) | null;
  members: RosterMember[];
  ownMember: RosterMember | null;
  seasons?: RosterSeason[];
  selectedSeasonId?: number;
  canManage: boolean;
};

const roleLabels: Record<RosterMember['role'], string> = {
  team_admin: 'Team Admin',
  mentor: 'Mentor',
  student_leader: 'Student Leader',
  student: 'Student',
};

function experienceLabel(experience: RosterMember['studentExperience']) {
  return experience === 'rookie' ? 'Rookie' : experience === 'veteran' ? 'Veteran' : null;
}

function MembershipSummary({ member }: { member: RosterMember }) {
  return (
    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
      <p className="text-sm text-zinc-400">Your current membership</p>
      <p className="mt-2 text-lg font-medium">{roleLabels[member.role]}</p>
      {experienceLabel(member.studentExperience) && (
        <p className="mt-1 text-sm text-zinc-400">{experienceLabel(member.studentExperience)}</p>
      )}
      {member.state === 'removed' && (
        <p className="mt-3 text-sm text-amber-300">Removed from this season</p>
      )}
    </div>
  );
}

function MemberRow({
  member,
  canManage,
  readOnly,
  seasonId,
}: {
  member: RosterMember;
  canManage: boolean;
  readOnly: boolean;
  seasonId: number;
}) {
  const router = useRouter();
  const [role, setRole] = useState<RosterMember['role']>(member.role);
  const [experience, setExperience] = useState<RosterMember['studentExperience']>(
    member.studentExperience,
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function updateRole(value: RosterMember['role']) {
    setRole(value);
    if (value === 'student' || value === 'student_leader') {
      setExperience(member.studentExperience ?? 'rookie');
    } else {
      setExperience(null);
    }
  }

  async function mutate(path: string, method: 'PATCH' | 'POST', body?: unknown) {
    setError('');
    const response = await fetch(path, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(
        typeof result.message === 'string' ? result.message : 'The change could not be saved.',
      );
      return;
    }
    router.refresh();
  }

  const assignmentPath = readOnly
    ? `/api/roster/seasons/${seasonId}/members/${member.id}`
    : `/api/roster/members/${member.id}`;
  const canEditAssignment = canManage && member.state === 'active';

  return (
    <tr>
      <td className="px-4 py-3 font-medium">{member.name}</td>
      <td className="px-4 py-3">{roleLabels[member.role]}</td>
      <td className="px-4 py-3 text-zinc-400">
        {experienceLabel(member.studentExperience) ?? '—'}
      </td>
      <td className="px-4 py-3 text-zinc-400">
        {member.state === 'active' ? 'Active' : 'Removed'}
        {member.suspended && <span className="ml-2 text-amber-300">Account suspended</span>}
      </td>
      {canManage && (
        <td className="min-w-64 px-4 py-3 align-top">
          <div className="space-y-3">
            {canEditAssignment && (
              <form
                className="grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void mutate(assignmentPath, 'PATCH', { role, studentExperience: experience });
                }}
              >
                <label className="grid gap-1 text-xs text-zinc-400">
                  Role
                  <select
                    aria-label={`Role for ${member.name}`}
                    value={role}
                    onChange={(event) => updateRole(event.target.value as RosterMember['role'])}
                    className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white"
                  >
                    <option value="team_admin">Team Admin</option>
                    <option value="mentor">Mentor</option>
                    <option value="student_leader">Student Leader</option>
                    <option value="student">Student</option>
                  </select>
                </label>
                {(role === 'student' || role === 'student_leader') && (
                  <label className="grid gap-1 text-xs text-zinc-400">
                    Experience
                    <select
                      aria-label={`Experience for ${member.name}`}
                      value={experience ?? 'rookie'}
                      onChange={(event) =>
                        setExperience(event.target.value as 'rookie' | 'veteran')
                      }
                      className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white"
                    >
                      <option value="rookie">Rookie</option>
                      <option value="veteran">Veteran</option>
                    </select>
                  </label>
                )}
                <button
                  type="submit"
                  className="rounded border border-zinc-700 px-2 py-1.5 text-xs hover:bg-zinc-800"
                >
                  Save assignment
                </button>
              </form>
            )}
            {!readOnly && member.state === 'removed' && (
              <button
                type="button"
                className="rounded border border-cyan-800 px-2 py-1.5 text-xs text-cyan-200 hover:bg-cyan-950"
                onClick={() => void mutate(`/api/roster/members/${member.id}/restore`, 'POST')}
              >
                Restore to season
              </button>
            )}
            {!readOnly && (
              <details className="rounded border border-zinc-800 p-2">
                <summary className="cursor-pointer text-xs text-zinc-300">Access actions</summary>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Season removal affects this season only. Account suspension blocks sign-in across
                  Basecamp.
                </p>
                <label className="mt-2 grid gap-1 text-xs text-zinc-400">
                  Optional reason
                  <input
                    aria-label={`Reason for ${member.name}`}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white"
                  />
                </label>
                {member.state === 'active' && (
                  <button
                    type="button"
                    className="mt-2 block rounded border border-amber-900 px-2 py-1.5 text-xs text-amber-200 hover:bg-amber-950"
                    onClick={() =>
                      void mutate(`/api/roster/members/${member.id}/remove`, 'POST', { reason })
                    }
                  >
                    Remove from season
                  </button>
                )}
                {member.suspended ? (
                  <button
                    type="button"
                    className="mt-2 block rounded border border-cyan-800 px-2 py-1.5 text-xs text-cyan-200 hover:bg-cyan-950"
                    onClick={() =>
                      void mutate(`/api/access/users/${member.userId}/restore`, 'POST')
                    }
                  >
                    Restore account access
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mt-2 block rounded border border-rose-900 px-2 py-1.5 text-xs text-rose-200 hover:bg-rose-950"
                    onClick={() =>
                      void mutate(`/api/access/users/${member.userId}/suspend`, 'POST', {
                        reason,
                      })
                    }
                  >
                    Suspend account access
                  </button>
                )}
              </details>
            )}
            {error && (
              <p role="alert" className="text-xs text-rose-300">
                {error}
              </p>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

export function RosterTable({
  season,
  members,
  ownMember,
  seasons = [],
  selectedSeasonId,
  canManage,
}: RosterTableProps) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const filteredMembers = members.filter((member) => member.name.toLowerCase().includes(query));
  const pastSeasons = seasons.filter((item) => item.readOnly);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 text-white">
      <header>
        <a href="/" className="text-sm text-cyan-300 hover:underline">
          Dashboard
        </a>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">Team roster</p>
        <h1 className="mt-2 text-3xl font-semibold">Roster</h1>
        {season && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
            <h2 className="font-medium text-zinc-200">{season.name}</h2>
            <span>
              {season.startsOn} – {season.endsOn}
            </span>
          </div>
        )}
      </header>

      {season?.readOnly && (
        <p className="mt-6 text-sm text-amber-300">
          Past season · admins can correct historical assignments
        </p>
      )}
      {!season && (
        <p className="mt-6 rounded-lg border border-zinc-800 p-4 text-zinc-300">
          No active season is configured yet.
        </p>
      )}

      {ownMember ? (
        <MembershipSummary member={ownMember} />
      ) : season && members.length === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-800 p-5 text-zinc-400">
          No one has joined this season yet.
        </p>
      ) : season ? (
        <section className="mt-6">
          <label className="mb-4 grid max-w-sm gap-1 text-sm text-zinc-400">
            Search members
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
          </label>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Member
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Experience
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  {canManage && (
                    <th scope="col" className="px-4 py-3 font-medium">
                      Admin actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredMembers.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    canManage={canManage}
                    readOnly={Boolean(season.readOnly)}
                    seasonId={season.id}
                  />
                ))}
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="px-4 py-5 text-zinc-400">
                      No members match your search
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {canManage && pastSeasons.length > 0 && (
        <nav aria-label="Past season rosters" className="mt-10 border-t border-zinc-800 pt-6">
          <h2 className="text-sm font-medium text-zinc-300">Past seasons</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {pastSeasons.map((item) => (
              <a
                key={item.id}
                href={`/roster?seasonId=${item.id}`}
                aria-current={selectedSeasonId === item.id ? 'page' : undefined}
                className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
              >
                {item.name}
              </a>
            ))}
          </div>
        </nav>
      )}

      {canManage && seasons.length > 0 && selectedSeasonId !== undefined && (
        <a className="mt-6 inline-block text-sm text-cyan-300 hover:underline" href="/roster">
          Return to current roster
        </a>
      )}
    </main>
  );
}
