import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { BootstrapService } from '../access/bootstrap.service.js';
import { DatabaseService } from '../database/database.service.js';
import {
  type MembershipState,
  type SeasonRole,
  season_memberships,
  seasons,
} from '../database/schema/index.js';
import { localDateInTimeZone } from './season-timezone.js';

export interface SeasonAccess {
  canView: boolean;
  canManage: boolean;
  canBootstrap: boolean;
}

@Injectable()
export class SeasonAuthorizationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly bootstrap: BootstrapService,
    private readonly config: ConfigService,
  ) {}

  async accessFor(userId: string): Promise<SeasonAccess> {
    const seasonRows = await this.database.db
      .select({ id: seasons.id, startsOn: seasons.starts_on, endsOn: seasons.ends_on })
      .from(seasons)
      .orderBy(desc(seasons.starts_on));
    const now = new Date();
    const current = seasonRows.find((season) => {
      const localToday = localDateInTimeZone(now, this.timeZone());
      return season.startsOn <= localToday && localToday <= season.endsOn;
    });
    const previousSeason = seasonRows.find(
      (season) => season.endsOn < localDateInTimeZone(now, this.timeZone()),
    );
    const relevantSeason = current ?? previousSeason ?? seasonRows.at(-1);

    let membership: { role: SeasonRole; state: MembershipState } | undefined;
    if (relevantSeason) {
      const currentRows = await this.database.db
        .select({ role: season_memberships.role, state: season_memberships.state })
        .from(season_memberships)
        .where(
          and(
            eq(season_memberships.season_id, relevantSeason.id),
            eq(season_memberships.user_id, userId),
          ),
        )
        .limit(1);
      membership = currentRows[0];
      // A missing row means the new season has not enrolled the person yet. A present removed
      // row is authoritative and must never fall back to an older permission.
    }
    if (!membership && relevantSeason?.id !== previousSeason?.id) {
      if (previousSeason) {
        const previousRows = await this.database.db
          .select({ role: season_memberships.role, state: season_memberships.state })
          .from(season_memberships)
          .where(
            and(
              eq(season_memberships.season_id, previousSeason.id),
              eq(season_memberships.user_id, userId),
            ),
          )
          .limit(1);
        membership = previousRows[0];
      }
    }

    const active = membership?.state === 'active';
    const canManage = active && membership?.role === 'team_admin';
    const canView = canManage || (active && membership?.role === 'mentor');
    const canBootstrap =
      !canManage && !canView && (await this.bootstrap.bootstrapDiscordIdForUser(userId)) !== null;
    return {
      canView: Boolean(canView || canBootstrap),
      canManage: Boolean(canManage),
      canBootstrap,
    };
  }

  async current(now: Date, timeZone: string) {
    const localToday = localDateInTimeZone(now, timeZone);
    const rows = await this.database.db
      .select({
        id: seasons.id,
        name: seasons.name,
        startsOn: seasons.starts_on,
        endsOn: seasons.ends_on,
      })
      .from(seasons)
      .where(and(lte(seasons.starts_on, localToday), gte(seasons.ends_on, localToday)))
      .limit(1);
    return rows[0] ?? null;
  }

  private timeZone(): string {
    return this.config.get<string>('BASECAMP_TIME_ZONE') ?? 'UTC';
  }
}
