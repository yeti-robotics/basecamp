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

export function RosterTable({
  season,
  members,
  ownMember,
  seasons = [],
  selectedSeasonId,
  canManage,
}: RosterTableProps) {
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

      {season?.readOnly && <p className="mt-6 text-sm text-amber-300">Past season · read only</p>}
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
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3 font-medium">{member.name}</td>
                  <td className="px-4 py-3">{roleLabels[member.role]}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {experienceLabel(member.studentExperience) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {member.state === 'active' ? 'Active' : 'Removed'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
