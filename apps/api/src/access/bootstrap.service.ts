import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DISCORD_ADMISSION } from '../auth/auth.module.js';
import type { DiscordAdmissionService } from '../auth/discord-admission.service.js';
import type { AppDatabase } from '../database/database.service.js';
import { DatabaseService } from '../database/database.service.js';
import { account } from '../database/schema/auth.js';
import { rosterAudit, season_memberships } from '../database/schema/index.js';

const snowflakePattern = /^\d{17,20}$/;
export type BootstrapTransaction = Pick<AppDatabase, 'select' | 'insert' | 'execute'>;

@Injectable()
export class BootstrapService {
  private readonly configuredDiscordIds: Set<string>;

  constructor(
    private readonly database: DatabaseService,
    config: ConfigService,
    @Inject(DISCORD_ADMISSION) private readonly admission: DiscordAdmissionService,
  ) {
    this.configuredDiscordIds = new Set(
      (config.get<string>('BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS') ?? '')
        .split(',')
        .map((discordId) => discordId.trim())
        .filter((discordId) => snowflakePattern.test(discordId)),
    );
  }

  async mayCreateFirstSeason(userId: string, discordId: string): Promise<boolean> {
    if (!this.configuredDiscordIds.has(discordId)) return false;
    if ((await this.admission.verifyWithAdmissionBot(discordId)) !== 'allowed') return false;
    if (!(await this.hasLinkedConfiguredIdentity(userId, [discordId]))) return false;
    return !(await this.hasTeamAdmin());
  }

  async bootstrapDiscordIdForUser(userId: string): Promise<string | null> {
    if (await this.hasTeamAdmin()) return null;
    const linkedIdentity = await this.database.db
      .select({ discordId: account.accountId })
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, 'discord'),
          inArray(account.accountId, [...this.configuredDiscordIds]),
        ),
      )
      .limit(1);
    const discordId = linkedIdentity[0]?.discordId;
    if (!discordId || (await this.admission.verifyWithAdmissionBot(discordId)) !== 'allowed') {
      return null;
    }
    return discordId;
  }

  async completeFirstSeason(userId: string, seasonId: number): Promise<void> {
    if (await this.hasTeamAdmin()) throw new Error('A Team Admin already exists');
    const discordId = await this.bootstrapDiscordIdForUser(userId);
    if (!discordId) {
      throw new Error('A configured Discord identity could not be verified for bootstrap');
    }

    await this.database.db.transaction((tx) =>
      this.completeFirstSeasonInTransaction(tx, userId, seasonId, discordId),
    );
  }

  async completeFirstSeasonInTransaction(
    tx: BootstrapTransaction,
    userId: string,
    seasonId: number,
    discordId: string,
  ): Promise<void> {
    if (!this.configuredDiscordIds.has(discordId)) {
      throw new Error('A configured Discord identity could not be verified for bootstrap');
    }
    const linked = await tx
      .select({ id: account.id })
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, 'discord'),
          eq(account.accountId, discordId),
        ),
      )
      .limit(1);
    if (!linked.length) {
      throw new Error('A configured Discord identity could not be verified for bootstrap');
    }

    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('basecamp-first-admin-bootstrap'))`);
    const admins = await tx
      .select({ id: season_memberships.id })
      .from(season_memberships)
      .where(eq(season_memberships.role, 'team_admin'))
      .limit(1);
    if (admins.length) throw new Error('A Team Admin already exists');

    await tx.insert(season_memberships).values({
      season_id: seasonId,
      user_id: userId,
      role: 'team_admin',
      student_experience: null,
      state: 'active',
      joined_at: new Date(),
    });
    await tx.insert(rosterAudit).values({
      actor_user_id: userId,
      subject_user_id: userId,
      season_id: seasonId,
      action: 'bootstrap_admin',
      before: null,
      after: { role: 'team_admin', state: 'active' },
    });
  }

  private async hasLinkedConfiguredIdentity(
    userId: string,
    discordIds: string[],
  ): Promise<boolean> {
    if (!discordIds.length) return false;
    const linked = await this.database.db
      .select({ id: account.id })
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, 'discord'),
          inArray(account.accountId, discordIds),
        ),
      )
      .limit(1);
    return linked.length > 0;
  }

  private async hasTeamAdmin(): Promise<boolean> {
    const admins = await this.database.db
      .select({ id: season_memberships.id })
      .from(season_memberships)
      .where(eq(season_memberships.role, 'team_admin'))
      .limit(1);
    return admins.length > 0;
  }
}
