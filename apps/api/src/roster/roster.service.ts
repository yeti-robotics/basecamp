import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import { DISCORD_ADMISSION } from '../auth/auth.module.js';
import type { DiscordAdmissionService } from '../auth/discord-admission.service.js';
import { DatabaseService } from '../database/database.service.js';
import { account } from '../database/schema/auth.js';
import { rosterAudit, season_memberships, seasons } from '../database/schema/index.js';
import { deriveAssignment } from '../seasons/assignment.js';
import { localDateInTimeZone } from '../seasons/season-timezone.js';

@Injectable()
export class RosterService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
    @Inject(DISCORD_ADMISSION) private readonly admission: DiscordAdmissionService,
  ) {}

  async ensureCurrentMembership(userId: string, now: Date) {
    const localToday = localDateInTimeZone(now, this.timeZone());
    const currentSeasons = await this.database.db
      .select({
        id: seasons.id,
        name: seasons.name,
        startsOn: seasons.starts_on,
        endsOn: seasons.ends_on,
      })
      .from(seasons)
      .where(and(lte(seasons.starts_on, localToday), gte(seasons.ends_on, localToday)))
      .limit(1);
    const currentSeason = currentSeasons[0];
    if (!currentSeason) return null;

    return this.database.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`${userId}:${currentSeason.id}`}))`,
      );
      const existing = await tx
        .select()
        .from(season_memberships)
        .where(
          and(
            eq(season_memberships.season_id, currentSeason.id),
            eq(season_memberships.user_id, userId),
          ),
        )
        .limit(1);
      if (existing[0]) return existing[0];

      const linkedAccounts = await tx
        .select({ discordId: account.accountId })
        .from(account)
        .where(and(eq(account.userId, userId), eq(account.providerId, 'discord')))
        .limit(1);
      const discordId = linkedAccounts[0]?.discordId;
      if (!discordId)
        throw new ForbiddenException('A linked Discord identity is required to join the roster');

      const admission = await this.admission.verify(discordId);
      if (admission === 'denied') {
        throw new ForbiddenException(
          'Discord server membership is required to join the current roster',
        );
      }
      if (admission === 'unavailable') {
        throw new ServiceUnavailableException(
          'Discord membership could not be verified; try again later',
        );
      }

      const precedingSeasons = await tx
        .select({ id: seasons.id })
        .from(seasons)
        .where(lt(seasons.ends_on, currentSeason.startsOn))
        .orderBy(desc(seasons.starts_on))
        .limit(1);
      const immediatelyPreviousSeasonId = precedingSeasons[0]?.id;
      const priorMemberships = await tx
        .select({
          seasonId: season_memberships.season_id,
          role: season_memberships.role,
          studentExperience: season_memberships.student_experience,
          state: season_memberships.state,
        })
        .from(season_memberships)
        .innerJoin(seasons, eq(season_memberships.season_id, seasons.id))
        .where(
          and(
            eq(season_memberships.user_id, userId),
            lt(seasons.starts_on, currentSeason.startsOn),
          ),
        )
        .orderBy(desc(seasons.starts_on))
        .limit(1);
      const prior = priorMemberships[0];
      const assignment = deriveAssignment(
        prior
          ? {
              role: prior.role,
              studentExperience: prior.studentExperience,
              state: prior.state,
              immediatelyPrevious: prior.seasonId === immediatelyPreviousSeasonId,
            }
          : null,
      );
      const joinedAt = new Date(now);
      const inserted = await tx
        .insert(season_memberships)
        .values({
          season_id: currentSeason.id,
          user_id: userId,
          role: assignment.role,
          student_experience: assignment.studentExperience,
          state: 'active',
          joined_at: joinedAt,
          started_at: joinedAt,
          ended_at: null,
        })
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) {
        await tx.insert(rosterAudit).values({
          actor_user_id: userId,
          subject_user_id: userId,
          season_id: currentSeason.id,
          action: 'member_joined',
          before: null,
          after: {
            role: assignment.role,
            studentExperience: assignment.studentExperience,
            state: 'active',
          },
        });
        return inserted[0];
      }

      const afterConflict = await tx
        .select()
        .from(season_memberships)
        .where(
          and(
            eq(season_memberships.season_id, currentSeason.id),
            eq(season_memberships.user_id, userId),
          ),
        )
        .limit(1);
      if (afterConflict[0]) return afterConflict[0];
      throw new ConflictException('Season membership could not be created');
    });
  }

  async getOwnCurrent(userId: string, now: Date) {
    const localToday = localDateInTimeZone(now, this.timeZone());
    const currentSeasons = await this.database.db
      .select({ id: seasons.id })
      .from(seasons)
      .where(and(lte(seasons.starts_on, localToday), gte(seasons.ends_on, localToday)))
      .limit(1);
    const currentSeasonId = currentSeasons[0]?.id;
    if (currentSeasonId === undefined) return null;

    const memberships = await this.database.db
      .select()
      .from(season_memberships)
      .where(
        and(
          eq(season_memberships.season_id, currentSeasonId),
          eq(season_memberships.user_id, userId),
        ),
      )
      .limit(1);
    return memberships[0] ?? null;
  }

  private timeZone(): string {
    return this.config.get<string>('BASECAMP_TIME_ZONE') ?? 'UTC';
  }
}
