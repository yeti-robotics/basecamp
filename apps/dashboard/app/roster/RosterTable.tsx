'use client';

import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Brand } from '@/components/Brand';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { typographyVariants } from '@/components/ui/typography';
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

const selectClassName =
  'h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50';
const dateLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

function formatDate(value: string) {
  return dateLabel.format(new Date(`${value}T12:00:00Z`));
}

function experienceLabel(experience: RosterMember['studentExperience']) {
  return experience === 'rookie' ? 'Rookie' : experience === 'veteran' ? 'Veteran' : null;
}

function MembershipSummary({ member }: { member: RosterMember }) {
  return (
    <Card className="mt-8 max-w-lg">
      <CardHeader>
        <CardTitle>Your current membership</CardTitle>
        <CardDescription>Your assignment for this season.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{roleLabels[member.role]}</Badge>
        {experienceLabel(member.studentExperience) && (
          <Badge variant="outline">{experienceLabel(member.studentExperience)}</Badge>
        )}
        {member.state === 'removed' && <Badge variant="outline">Removed from this season</Badge>}
      </CardContent>
    </Card>
  );
}

function MemberRow({
  member,
  canManage,
  readOnly,
  seasonId,
  hidden,
}: {
  member: RosterMember;
  canManage: boolean;
  readOnly: boolean;
  seasonId: number;
  hidden: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<RosterMember['role']>(member.role);
  const [experience, setExperience] = useState<RosterMember['studentExperience']>(
    member.studentExperience,
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);

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
    setPending(true);
    try {
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
    } catch {
      setError('The change could not be saved. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  const assignmentPath = readOnly
    ? `/api/roster/seasons/${seasonId}/members/${member.id}`
    : `/api/roster/members/${member.id}`;
  const canEditAssignment = canManage && member.state === 'active';

  return (
    <tr hidden={hidden} className="border-b last:border-0 hover:bg-muted/20">
      <td className="px-5 py-4 font-medium sm:px-6">
        <div className="flex items-center gap-3">
          <Avatar aria-hidden="true">
            {member.image && <AvatarImage src={member.image} alt="" />}
            <AvatarFallback className="font-mono text-xs">
              {member.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-32 break-words">{member.name}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <Badge variant="secondary">{roleLabels[member.role]}</Badge>
      </td>
      <td className="px-4 py-4 text-muted-foreground">
        {experienceLabel(member.studentExperience) ?? '—'}
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{member.state === 'active' ? 'Active' : 'Removed'}</Badge>
          {member.suspended && <Badge variant="destructive">Account suspended</Badge>}
        </div>
      </td>
      {canManage && (
        <td className="px-5 py-4 text-right sm:px-6">
          <Button
            variant="outline"
            size="sm"
            aria-label={`Edit member ${member.name}`}
            aria-expanded={editing}
            aria-controls={`member-editor-${member.id}`}
            onClick={() => setEditing(!editing)}
          >
            <Settings2 aria-hidden="true" /> Edit member
          </Button>
          <div
            id={`member-editor-${member.id}`}
            hidden={!editing}
            className="mt-3 min-w-64 rounded-lg border bg-background p-3 text-left"
          >
            <fieldset disabled={pending} className="space-y-3">
              {canEditAssignment && (
                <form
                  className="grid gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void mutate(assignmentPath, 'PATCH', { role, studentExperience: experience });
                  }}
                >
                  <Label className="grid gap-2 text-xs text-muted-foreground">
                    Role
                    <select
                      aria-label={`Role for ${member.name}`}
                      value={role}
                      onChange={(event) => updateRole(event.target.value as RosterMember['role'])}
                      className={selectClassName}
                    >
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Label>
                  {(role === 'student' || role === 'student_leader') && (
                    <Label className="grid gap-2 text-xs text-muted-foreground">
                      Experience
                      <select
                        aria-label={`Experience for ${member.name}`}
                        value={experience ?? 'rookie'}
                        onChange={(event) =>
                          setExperience(event.target.value as 'rookie' | 'veteran')
                        }
                        className={selectClassName}
                      >
                        <option value="rookie">Rookie</option>
                        <option value="veteran">Veteran</option>
                      </select>
                    </Label>
                  )}
                  <Button type="submit" size="sm">
                    {pending ? 'Saving…' : 'Save assignment'}
                  </Button>
                </form>
              )}
              {!readOnly && member.state === 'removed' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void mutate(`/api/roster/members/${member.id}/restore`, 'POST')}
                >
                  Restore to season
                </Button>
              )}
              {!readOnly && (
                <details className="group rounded-lg border p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
                    Access actions{' '}
                    <ChevronDown
                      aria-hidden="true"
                      className="size-3.5 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Season removal affects this season only. Account suspension blocks sign-in
                    across Basecamp.
                  </p>
                  <Label className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    Optional reason
                    <Input
                      aria-label={`Reason for ${member.name}`}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </Label>
                  {member.state === 'active' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() =>
                        void mutate(`/api/roster/members/${member.id}/remove`, 'POST', { reason })
                      }
                    >
                      Remove from season
                    </Button>
                  )}
                  {member.suspended ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() =>
                        void mutate(`/api/access/users/${member.userId}/restore`, 'POST')
                      }
                    >
                      Restore account access
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() =>
                        void mutate(`/api/access/users/${member.userId}/suspend`, 'POST', {
                          reason,
                        })
                      }
                    >
                      Suspend account access
                    </Button>
                  )}
                </details>
              )}
            </fieldset>
            {error && (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
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
  const searchWords = search.trim().toLowerCase().split(/\s+/);
  const filteredMembers = members.filter((member) =>
    searchWords.every((word) => member.name.toLowerCase().includes(word)),
  );
  const pastSeasons = seasons.filter((item) => item.readOnly);
  const matchingMemberIds = new Set(filteredMembers.map((member) => member.id));
  const summary = [
    {
      label: 'Total members',
      value: members.length,
      icon: Users,
    },
    {
      label: 'Active memberships',
      value: members.filter((member) => member.state === 'active').length,
      icon: ShieldCheck,
    },
    {
      label: 'Mentors',
      value: members.filter((member) => member.role === 'mentor' && member.state === 'active')
        .length,
      icon: Users,
    },
  ];

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Brand />
          <Button asChild variant="ghost" size="sm">
            <a href="/">
              <ArrowLeft aria-hidden="true" />
              Dashboard
            </a>
          </Button>
        </div>
        <nav
          aria-label="Team navigation"
          className="mx-auto flex max-w-7xl gap-6 px-5 text-sm sm:px-8"
        >
          <a href="/" className="py-3 text-muted-foreground hover:text-foreground">
            Overview
          </a>
          <a
            href="/roster"
            aria-current="page"
            className="border-b-2 border-foreground py-3 font-medium"
          >
            Roster
          </a>
          {canManage && (
            <a href="/seasons" className="py-3 text-muted-foreground hover:text-foreground">
              Seasons
            </a>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className={typographyVariants({ variant: 'h2' })}>Roster</h1>
          </div>
          {season && (
            <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
              <div>
                <h2 className="text-sm font-medium">{season.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  <time dateTime={season.startsOn}>{formatDate(season.startsOn)}</time> –{' '}
                  <time dateTime={season.endsOn}>{formatDate(season.endsOn)}</time>
                </p>
              </div>
            </div>
          )}
        </div>

        {season?.readOnly && (
          <Alert className="mt-6">
            <CalendarDays aria-hidden="true" />
            <AlertDescription>
              Past season · admins can correct historical assignments
            </AlertDescription>
          </Alert>
        )}
        {!season && !ownMember && (
          <Card className="mt-8">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarDays aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No active season is configured yet.</EmptyTitle>
                <EmptyDescription>
                  A roster will be available once a current season is set up.
                </EmptyDescription>
              </EmptyHeader>
              {canManage && (
                <Button asChild variant="outline">
                  <a href="/seasons">Manage seasons</a>
                </Button>
              )}
            </Empty>
          </Card>
        )}

        {ownMember ? (
          <MembershipSummary member={ownMember} />
        ) : season && members.length === 0 ? (
          <Card className="mt-8">
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No one has joined this season yet.</EmptyTitle>
                <EmptyDescription>
                  Members will appear here when they join the current season.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : season ? (
          <section aria-label="Season roster" className="mt-8 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {summary.map(({ label, value, icon: Icon }) => (
                <Card key={label} size="sm" className="gap-4 p-5">
                  <div className="flex items-center justify-between gap-3 text-muted-foreground">
                    <p className="text-xs font-medium">{label}</p>
                    <Icon aria-hidden="true" className="size-4" />
                  </div>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
                </Card>
              ))}
            </div>
            <Card className="gap-0 py-0">
              <CardHeader className="flex flex-wrap items-center justify-between gap-4 border-b py-5 sm:flex-row">
                <div>
                  <CardTitle>
                    <h2>Season members</h2>
                  </CardTitle>
                </div>
                <div className="w-full sm:max-w-xs">
                  <Label htmlFor="roster-search" className="sr-only">
                    Search members
                  </Label>
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="roster-search"
                      type="search"
                      placeholder="Search by name…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="h-9 pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
                    />
                    {search && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Clear search"
                        className="absolute top-1/2 right-1.5 -translate-y-1/2"
                        onClick={() => setSearch('')}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto px-0">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">Members of {season.name}</caption>
                  <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium sm:px-6">
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
                        <th scope="col" className="px-5 py-3 text-right font-medium sm:px-6">
                          Admin actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <MemberRow
                        key={member.id}
                        hidden={!matchingMemberIds.has(member.id)}
                        member={member}
                        canManage={canManage}
                        readOnly={Boolean(season.readOnly)}
                        seasonId={season.id}
                      />
                    ))}
                    {filteredMembers.length === 0 && (
                      <tr>
                        <td
                          colSpan={canManage ? 5 : 4}
                          className="px-5 py-14 text-center text-muted-foreground"
                        >
                          <Search aria-hidden="true" className="mx-auto mb-3 size-5" />
                          <p className="text-sm font-medium text-foreground">
                            No members match your search
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
              <CardFooter className="flex-wrap justify-between gap-2 py-3 text-xs text-muted-foreground">
                <p role="status" aria-live="polite">
                  Showing {filteredMembers.length} of {members.length} members
                </p>
                <span>{canManage ? 'Team Admin access' : 'View access'}</span>
              </CardFooter>
            </Card>
          </section>
        ) : null}

        {canManage && pastSeasons.length > 0 && (
          <nav aria-label="Past season rosters" className="mt-10 border-t pt-6">
            <h2 className="text-sm font-medium">Past seasons</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {pastSeasons.map((item) => (
                <Button
                  key={item.id}
                  asChild
                  variant={selectedSeasonId === item.id ? 'secondary' : 'outline'}
                  size="sm"
                >
                  <a
                    key={item.id}
                    href={`/roster?seasonId=${item.id}`}
                    aria-current={selectedSeasonId === item.id ? 'page' : undefined}
                  >
                    {item.name}
                  </a>
                </Button>
              ))}
            </div>
          </nav>
        )}

        {canManage && seasons.length > 0 && selectedSeasonId !== undefined && (
          <Button asChild variant="link" className="mt-6 px-0">
            <a href="/roster">Return to current roster</a>
          </Button>
        )}
      </main>
    </div>
  );
}
