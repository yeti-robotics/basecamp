import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { BootstrapService } from '../access/bootstrap.service.js';
import { type AppDatabase, DatabaseService } from '../database/database.service.js';
import { rosterAudit, seasons } from '../database/schema/index.js';
import { SeasonAuthorizationService } from './season-authorization.service.js';
import { defaultSeasonDates, isCurrentSeason } from './season-dates.js';
import { localDateInTimeZone, localMidnightInTimeZone } from './season-timezone.js';

export interface SeasonInput {
  name: string;
  startsOn: string;
  endsOn: string;
}

export interface Season {
  id: number;
  name: string;
  startsOn: string;
  endsOn: string;
}

export type SeasonPeriod = 'past' | 'current' | 'upcoming';

type SeasonTransaction = Pick<AppDatabase, 'select' | 'insert' | 'update' | 'execute'>;

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class SeasonsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
    private readonly authorization: SeasonAuthorizationService,
    private readonly bootstrap: BootstrapService,
  ) {}

  async list(): Promise<Season[]> {
    const rows = await this.database.db
      .select({
        id: seasons.id,
        name: seasons.name,
        startsOn: seasons.starts_on,
        endsOn: seasons.ends_on,
      })
      .from(seasons)
      .orderBy(seasons.starts_on);
    return rows;
  }

  async current(now: Date): Promise<Season | null> {
    const localToday = localDateInTimeZone(now, this.timeZone());
    const seasons = await this.list();
    return seasons.find((season) => isCurrentSeason(season, localToday)) ?? null;
  }

  async suggestedDates(): Promise<{ startsOn: string; endsOn: string }> {
    const rows = await this.list();
    const localToday = localDateInTimeZone(new Date(), this.timeZone());
    let year = Number(localToday.slice(0, 4));
    if (localToday < `${year}-05-15`) year -= 1;
    let proposal = defaultSeasonDates(year + 1);
    const latestEnd = rows.reduce(
      (latest, season) => (season.endsOn > latest ? season.endsOn : latest),
      '0000-01-01',
    );
    if (latestEnd >= proposal.startsOn) {
      const latestYear = Number(latestEnd.slice(0, 4));
      proposal = defaultSeasonDates(
        latestEnd >= `${latestYear}-05-15` ? latestYear + 1 : latestYear,
      );
    }
    return proposal;
  }

  async viewFor(userId: string) {
    const access = await this.authorization.accessFor(userId);
    if (!access.canView)
      throw new ForbiddenException('Season access is limited to Team Admins and Mentors');
    const [seasonList, currentSeason, suggestedDates] = await Promise.all([
      this.list(),
      this.current(new Date()),
      this.suggestedDates(),
    ]);
    const localToday = localDateInTimeZone(new Date(), this.timeZone());
    return {
      seasons: seasonList.map((season) => ({
        ...season,
        period:
          localToday < season.startsOn
            ? 'upcoming'
            : localToday > season.endsOn
              ? 'past'
              : 'current',
      })),
      currentSeasonId: currentSeason?.id ?? null,
      ...access,
      suggestedDates,
    };
  }

  async create(input: SeasonInput, actorId: string): Promise<Season> {
    const access = await this.authorization.accessFor(actorId);
    if (!access.canManage && !access.canBootstrap)
      throw new ForbiddenException('Team Admin access is required');
    const normalized = this.validate(input);
    const bootstrapDiscordId = access.canBootstrap
      ? await this.bootstrap.bootstrapDiscordIdForUser(actorId)
      : null;
    if (access.canBootstrap && !bootstrapDiscordId) {
      throw new ForbiddenException('First-admin setup is no longer available');
    }

    return this.database.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('basecamp-season-dates'))`);
      await this.assertNoOverlap(tx, normalized);
      const [created] = await tx
        .insert(seasons)
        .values({
          name: normalized.name,
          starts_on: normalized.startsOn,
          ends_on: normalized.endsOn,
          started_at: localMidnightInTimeZone(normalized.startsOn, this.timeZone()),
          ended_at: localMidnightInTimeZone(addDays(normalized.endsOn, 1), this.timeZone()),
        })
        .returning({
          id: seasons.id,
          name: seasons.name,
          startsOn: seasons.starts_on,
          endsOn: seasons.ends_on,
        });
      if (!created) throw new Error('Season insert did not return a row');
      if (bootstrapDiscordId) {
        await this.bootstrap.completeFirstSeasonInTransaction(
          tx,
          actorId,
          created.id,
          bootstrapDiscordId,
        );
      }
      await tx.insert(rosterAudit).values({
        actor_user_id: actorId,
        subject_user_id: actorId,
        season_id: created.id,
        action: 'season_created',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async update(id: number, input: SeasonInput, actorId: string): Promise<Season> {
    const access = await this.authorization.accessFor(actorId);
    if (!access.canManage) throw new ForbiddenException('Team Admin access is required');
    const normalized = this.validate(input);

    return this.database.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('basecamp-season-dates'))`);
      const [before] = await tx
        .select({
          id: seasons.id,
          name: seasons.name,
          startsOn: seasons.starts_on,
          endsOn: seasons.ends_on,
        })
        .from(seasons)
        .where(eq(seasons.id, id))
        .limit(1);
      if (!before) throw new NotFoundException('Season not found');
      await this.assertNoOverlap(tx, normalized, id);
      const [updated] = await tx
        .update(seasons)
        .set({
          name: normalized.name,
          starts_on: normalized.startsOn,
          ends_on: normalized.endsOn,
          started_at: localMidnightInTimeZone(normalized.startsOn, this.timeZone()),
          ended_at: localMidnightInTimeZone(addDays(normalized.endsOn, 1), this.timeZone()),
        })
        .where(eq(seasons.id, id))
        .returning({
          id: seasons.id,
          name: seasons.name,
          startsOn: seasons.starts_on,
          endsOn: seasons.ends_on,
        });
      if (!updated) throw new NotFoundException('Season not found');
      await tx.insert(rosterAudit).values({
        actor_user_id: actorId,
        subject_user_id: actorId,
        season_id: id,
        action: 'season_updated',
        before,
        after: updated,
      });
      return updated;
    });
  }

  private validate(input: SeasonInput): SeasonInput {
    if (!input || typeof input !== 'object')
      throw new BadRequestException('Season details are required');
    if (
      typeof input.name !== 'string' ||
      typeof input.startsOn !== 'string' ||
      typeof input.endsOn !== 'string'
    ) {
      throw new BadRequestException('Season name, start date, and end date are required');
    }
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Season name is required');
    if (!validDate(input.startsOn) || !validDate(input.endsOn)) {
      throw new BadRequestException('Start and end dates must be valid YYYY-MM-DD dates');
    }
    if (input.endsOn < input.startsOn) {
      throw new BadRequestException('End date must be on or after start date');
    }
    return { name, startsOn: input.startsOn, endsOn: input.endsOn };
  }

  private async assertNoOverlap(
    tx: SeasonTransaction,
    candidate: SeasonInput,
    excludeId?: number,
  ): Promise<void> {
    const conditions = [
      lte(seasons.starts_on, candidate.endsOn),
      gte(seasons.ends_on, candidate.startsOn),
    ];
    if (excludeId !== undefined) conditions.push(ne(seasons.id, excludeId));
    const overlaps = await tx
      .select({ id: seasons.id })
      .from(seasons)
      .where(and(...conditions))
      .limit(1);
    if (overlaps.length) throw new ConflictException('Season dates overlap an existing season');
  }

  private timeZone(): string {
    return this.config.get<string>('BASECAMP_TIME_ZONE') ?? 'UTC';
  }
}
