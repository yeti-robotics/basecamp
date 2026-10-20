# Basecamp Team Roster

This context describes how one self-hosted Basecamp installation represents an FRC team's people, seasons, assignments, and access. Attendance and outreach goal calculations and the team calendar are separate follow-up work; the approved [seasons and roster design](docs/superpowers/specs/2026-10-15-seasons-and-self-joining-roster-design.md) records those boundaries.

## Language

### Identity and season

**Team**: The FRC team served by one Basecamp installation.
_Avoid_: Tenant, when discussing the team's domain identity.

**Installation**: A self-hosted Basecamp deployment configured for exactly one team.
_Avoid_: Organization, unless referring to a separate external organization.

**Person**: A human who can join one or more seasons under a persistent Basecamp identity.
_Avoid_: Member, when the person has not joined a season yet.

**Basecamp user**: The persistent local identity for a person across sign-in and seasons.
_Avoid_: Account, when referring to the human or their season membership.

**Linked identity**: An external provider identity, such as a Discord account, connected to a Basecamp user for sign-in.
_Avoid_: Basecamp user.

**Season**: A team year with configurable inclusive start and end dates; May 15 through May 14 is the default.
_Avoid_: Calendar year.

**Season membership**: A person's assignment to one season, including their season role, applicable student experience, and active or removed state.
_Avoid_: Account role, global role.

### Season assignments

**Season role**: A person's team responsibility for one season: Team Admin, Mentor, Student Leader, or Student.
_Avoid_: Role, when the scope could be confused with an authentication role.

**Team Admin**: A season role authorized to manage seasons and the roster.

**Mentor**: An adult season role that can read the roster and has no student attendance or outreach goals; mentors may serve as the adult present at a future outreach event.

**Student Leader**: A student season role with leadership responsibilities and a higher meeting attendance target than Student; its outreach target is based on student experience, like Student's.

**Student**: A student season role without the additional Student Leader meeting target.

**Student experience**: The Rookie or Veteran designation for a Student or Student Leader, independent of that person's season role and used to determine their outreach target.
_Avoid_: Role, year-in-school.

**Rookie**: A Student or Student Leader who has not advanced to Veteran under the season progression rule, or whose assignment an admin has corrected to Rookie.

**Veteran**: A Student or Student Leader who was active as a Rookie in the immediately preceding season or whose experience an admin has corrected to Veteran.

### Access and history

**Season removal**: Changing one season membership to Removed, which prevents self-joining that same season while preserving its history.
_Avoid_: Account removal, kick, when the scope is only one season.

**Account suspension**: Disabling a person's Basecamp access across the installation, revoking sessions, and preserving all season history.
_Avoid_: Season removal.

**Admission rule**: The installation's check for who may sign in; YETI currently requires membership in its configured Discord server.
_Avoid_: Season role; admission and roster assignment are separate decisions.

## Relationships

- One **Installation** serves exactly one **Team**.
- A **Team** can have zero or more **Seasons**.
- One **Person** is represented by one **Basecamp user**, which may have one or more **Linked identities**, and may have zero or more **Season memberships**.
- A **Season** contains zero or more **Season memberships**; each membership belongs to exactly one person and one season, with at most one membership for a person in a season.
- Each **Season membership** has one **Season role** and an active or removed state.
- A Student or Student Leader membership has one **Student experience**; Mentor and Team Admin memberships have none.
- **Account suspension** applies across the installation; **Season removal** applies to one membership.

## Example dialogue

> **Dev:** “Alex was removed from this season, then signs in again next year. Should the account stay blocked?”
> **Domain expert:** “No. Season removal affects only the season where it happened. Alex can join a later season; account suspension is the separate action that blocks Basecamp sign-in across seasons.”

## Flagged ambiguities

- “Role” can mean Better Auth's global authentication field or a team's season assignment. Say **season role** for Team Admin, Mentor, Student Leader, and Student; do not use Better Auth's global field as the team's source of truth.
- “Account” can mean a human's local Basecamp user or an external provider identity. Say **Basecamp user** for the local identity and **linked identity** for Discord or another provider.
- “Member” can mean a person or a season membership. Use **Person** before a season join and **season membership** for the season-specific assignment.
- “Removed” and “suspended” have different scope. Say **removed from the season** or **account suspended** in UI and documentation.
