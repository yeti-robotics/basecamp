# Seasons and self-joining roster

## Intent

Basecamp is an open-source, single-team FRC application distributed for teams to self-host. YETI is the first installation. A team's roster changes substantially each season, and a person may have a different role in different seasons. Members should be able to join the current roster themselves while access to the installation stays limited to the team. Team Admins need to manage seasons, correct assignments, and remove or suspend members without erasing history.

This design covers seasons, admission, season membership, and roster management. It establishes role and student-experience data for a later dashboard and goals feature; it does not calculate attendance or outreach progress.

## Goals

- A Team Admin can create and edit seasons, with one current season at a time and past seasons retained.
- An admitted person appears on the current season roster when they sign in. A new season does not copy the prior roster wholesale.
- New people start as Students with rookie status. Returning people carry their latest eligible role; student experience advances under the rule below. Team Admins can correct both.
- Team Admins and Mentors can see the full roster. Team Admins can change roles and student experience, remove and restore memberships, and suspend and restore account access.
- Roles and roster history belong to seasons. Changes in one season do not rewrite another season.
- The first Team Admin can be established on a fresh self-hosted installation without a public first-user-wins flow.

## Non-goals and anti-goals

- No hosted multi-team service, team creation flow, shared team directory, or storage of another team's data.
- No calendar UI, meeting scheduling, cancellations, excused-absence workflow, attendance percentage, outreach goal calculation, outreach credit collection, event signup, or mentor-assisted sign-in/out in this body of work. Those are separate features. Mentor permissions for these future actions must not be inferred from the current roster UI.
- No migration of the existing Google Sheet attendance history in this feature.
- Do not grant admin rights merely because someone is the first person to sign in, or allow a removed member to immediately rejoin the same season by signing in again.
- Do not treat Discord nicknames or email addresses as durable member identifiers, or make a Discord ID the primary key for a person.

## Constraints and decisions

### Installation and identity

Each installation represents one team. Keep the application model free of a tenant/team table for this release; self-hosting provides the data boundary. Better Auth continues to own the `user`, `account`, and `session` records and Discord OAuth sign-in. The stable Basecamp user ID identifies a person across seasons, and the linked Discord provider account supplies the Discord ID. Because a person joins the roster only after sign-in, the existing `season_memberships.user_id -> user.id` relationship is appropriate; a separate pre-account person table is unnecessary for this design.

YETI's initial admission rule is verified membership in its configured Discord server. YETI's server ID is `408711970305474560`; it is a deployment setting, not an application constant, so another installation can supply its own ID. Verify membership during the OAuth sign-in flow before provisioning a new account or issuing a returning session. A public Discord login button alone is not admission. Do not make the admission rule part of the season membership schema, so a future self-hosted team can replace Discord admission and sign-in with a web-based path. Invite links are not the default path for YETI. Suspended accounts are denied regardless of Discord membership. If Discord cannot confirm membership, fail closed with an understandable message; do not create a membership on an uncertain result.

The exact Better Auth and Discord integration point is a builder choice to verify against the installed versions. Better Auth's OAuth user-validation boundary and Discord's guild-membership APIs are candidates, but the design requires the behavior, not a specific hook.

### Seasons

A season has a name, start date, and end date. Offer May 15 through the following May 14 as the default, with both dates editable because a season may run longer when the team qualifies for Worlds. Use the installation's configured local timezone when interpreting dates. Exactly one season may be current on a date: reject overlapping ranges and invalid ranges. Preserve past seasons and their memberships. Creation of a future season does not enroll anyone. Season dates may be corrected by a Team Admin; validation must prevent overlap after an edit.

When no season is current, ordinary members can sign in but do not receive a new season membership. A Team Admin from the latest eligible season can still create the next season. On a fresh installation, the bootstrap rule below supplies that ability. A Team Admin may edit season metadata; deleting a season with memberships is outside this design.

### Joining and carrying assignments

After an admitted, unsuspended user signs in during a current season, create one membership for that user and season if none exists. If their session spans a season boundary, perform that check on their first authenticated visit after the new season becomes current, without requiring them to sign out and back in. Recheck Discord admission before creating the new season membership; an uncertain result does not enroll the person. Repeated visits and sign-ins do not create duplicates or overwrite an admin correction. A first-time member gets role `Student` and experience `Rookie`. This existing-session behavior is a design call.

For a returning member, inspect their most recent prior season membership and copy its role if it was not removed. `Team Admin`, `Mentor`, `Student Leader`, and `Student` are the four season roles. If the most recent prior membership was removed, do not search further back for an older role: the person starts as a Student if they return in a later season, until an admin reassigns them. An account suspension prevents joining entirely.

Student experience is separate from role. Students and Student Leaders are either `Rookie` or `Veteran`; Mentors and Team Admins do not have student experience. A rookie in the immediately preceding season becomes a veteran when joining the new season if that membership was not removed. Veterans remain veterans. A removed rookie or a rookie who skipped the immediately preceding season remains a rookie until an admin adjusts them. These removal and gap rules are design calls because the stated automatic progression applies to a rookie in the previous season. An admin can correct experience or role during the current season without changing earlier seasons.

Membership joins at sign-in time. Earlier people do not appear in the new roster until they sign in. A role may be changed during a season; this feature stores the current role for that season and an audit record of the change. Goal treatment for rare mid-season role changes belongs to the later goals feature.

### Roster actions and access

The current roster shows joined members, their season role, and rookie/veteran designation where applicable. Team Admins and Mentors can view the complete current roster; Students and Student Leaders can view only their own season membership. Team Admins can view past season rosters. Assignment corrections for a past season require an explicit admin action and an audit record; ordinary current-season edits do not rewrite the past. The roster UI exposes removal, restoration, and account access actions from the current roster; season removal remains season-scoped, while account suspension remains account-wide.

Removing someone from the current roster marks that season membership removed rather than deleting it. The person cannot self-rejoin that same season. A Team Admin can restore a mistaken removal. Suspension is a separate account-wide action for someone who is no longer allowed to use Basecamp, even if they are still in Discord. It blocks sign-in, revokes active sessions, and leaves season and attendance history intact. A Team Admin can reverse it. The UI must distinguish removal from suspension and make their scope clear. Preserve an actor and timestamp for role, experience, removal, restoration, suspension, and reinstatement changes; a short reason is optional.

Do not allow the last effective Team Admin to remove, suspend, or demote themselves or another admin into leaving the installation without an admin. A self-hosted recovery command is the fallback if an operator nevertheless loses access. Team Admin authorization is checked by Basecamp's server-side application logic using the current season role, or the latest eligible season role when there is no current season. Mentor authorization grants roster read access only in this feature. Do not expose Better Auth's broad admin API to Team Admins solely to implement these roster operations.

### Bootstrap

An installation operator configures one or more Discord IDs for initial Team Admin bootstrap. On their first admitted sign-in, Basecamp grants enough temporary authority to create the first season and then records their Team Admin membership there. If a current season already exists, grant that membership directly. Treat the environment value as a one-time bootstrap mechanism, not a perpetual permission override: after a Team Admin membership exists, the configured IDs no longer grant authority, and in-app assignments control access. Document removing the bootstrap setting afterward. Provide an operator recovery command that can restore Team Admin access to a known local account without opening a public promotion path. The exact command interface is left to the builder.

## Data implications of the current repository

- `seasons` already holds a name and timestamps, but has no checks for ordered or nonoverlapping date ranges. Prefer date-oriented semantics for the proposed UX.
- `season_memberships` already links users to seasons, but its foreign keys are nullable and there is no uniqueness constraint for a user/season pair. Its current `status` enum (`rookie`, `veteran`, `alumni`, `mentor`) mixes experience and role and cannot express Team Admin or Student Leader. Replace it with separate season role and student-experience fields, a membership state that preserves removal, and uniqueness/integrity rules. Preserve existing data through a deliberate migration if any installation has it; do not reset the database.
- Better Auth's `user.role` is global to an account. It must not be the source of truth for season role. The installed admin plugin has broad user-management permissions, so application-specific actions need a narrow server-side authorization path.
- Existing attendance and events tables do not yet establish required meetings or goal denominators. They are deliberately outside this design, as is the current dashboard's requirement lookup.

## User-facing flow

1. An operator configures Discord admission and bootstrap IDs. The initial admin signs in and creates the first season, accepting or adjusting suggested dates.
2. A member signs in through Discord. If admitted, they join the current roster once. Their role and student experience derive from the rules above; the roster was otherwise empty at season creation.
3. A Team Admin reviews the current roster and corrects roles or experience. Mentors can see the roster but cannot edit it in this feature.
4. A Team Admin creates the next season when ready. Members appear there as they return and sign in. Historical roster views remain available.
5. A Team Admin removes a member from a season or suspends access, with separate restore paths.

## What the builder may decide

The builder may choose API shapes, table and column names, audit-table structure, the exact OAuth callback integration, recovery-command syntax, and UI component layout. They should keep the flows and permission boundaries above. Deliver the feature in manageable, reviewable PRs; the detailed PR sequence belongs in the implementation plan after this design is approved.

## Separate follow-up: goals and calendar

The later goals design should use only elapsed required meetings in the denominator, subtract a member's excused required meeting hours, and count optional meeting attendance as extra-credit numerator. Required schedules change across off-season and build season; weather and holidays may cancel occurrences for everyone. Student and Student Leader meeting targets are 75% and 85%. Rookie and Veteran outreach targets are 50 and 100 hours regardless of leadership. Competitions do not count toward either goal. Mentor and Team Admin have no personal goals. The method for collecting outreach credit is outside this design. These notes preserve context; they are not acceptance criteria for the seasons-and-roster feature.
