import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, sql } from 'drizzle-orm';
import { type AppDatabase, DatabaseService } from '../database/database.service.js';
import { account, session, user } from '../database/schema/auth.js';
import { rosterAudit, season_memberships, seasons } from '../database/schema/index.js';
import { localDateInTimeZone } from '../seasons/season-timezone.js';

type AccessTransaction = Pick<AppDatabase, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

@Injectable()
export class AccessService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async isSuspended(userId: string): Promise<boolean> {
    const rows = await this.database.db
      .select({ banned: user.banned })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0]?.banned === true;
  }

  async isDiscordIdentitySuspended(discordId: string): Promise<boolean> {
    const rows = await this.database.db
      .select({ banned: user.banned })
      .from(account)
      .innerJoin(user, eq(account.userId, user.id))
      .where(and(eq(account.providerId, 'discord'), eq(account.accountId, discordId)))
      .limit(1);
    return rows[0]?.banned === true;
  }

  async suspend(actorId: string, userId: string, reason?: string): Promise<void> {
    const normalizedReason = reason?.trim() || null;
    if (normalizedReason && normalizedReason.length > 500) {
      throw new BadRequestException('Suspension reason must be 500 characters or fewer');
    }
    await this.database.db.transaction(async (tx) => {
      await tx.execute(this.rosterLock());
      await this.assertTeamAdmin(tx, actorId, new Date());
      const [target] = await tx
        .select({ id: user.id, banned: user.banned })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      if (!target) throw new NotFoundException('Account not found');
      if (target.banned) return;

      await tx
        .update(user)
        .set({ banned: true, banReason: normalizedReason, banExpires: null })
        .where(eq(user.id, userId));
      await tx.delete(session).where(eq(session.userId, userId));
      await this.assertEffectiveAdminRemains(tx, new Date());
      await tx.insert(rosterAudit).values({
        actor_user_id: actorId,
        subject_user_id: userId,
        season_id: null,
        action: 'account_suspended',
        before: { banned: false },
        after: { banned: true },
        reason: normalizedReason,
      });
    });
  }

  async restore(actorId: string, userId: string): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      await tx.execute(this.rosterLock());
      await this.assertTeamAdmin(tx, actorId, new Date());
      const [target] = await tx
        .select({ id: user.id, banned: user.banned })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      if (!target) throw new NotFoundException('Account not found');
      if (!target.banned) return;

      await tx
        .update(user)
        .set({ banned: false, banReason: null, banExpires: null })
        .where(eq(user.id, userId));
      await tx.insert(rosterAudit).values({
        actor_user_id: actorId,
        subject_user_id: userId,
        season_id: null,
        action: 'account_restored',
        before: { banned: true },
        after: { banned: false },
      });
    });
  }

  async assertEffectiveAdminRemains(tx: AccessTransaction, now: Date): Promise<void> {
    if ((await this.effectiveAdminCount(tx, now)) === 0) {
      throw new ConflictException(
        'This action would leave the installation without an active Team Admin',
      );
    }
  }

  async assertTeamAdmin(tx: AccessTransaction, userId: string, now: Date): Promise<void> {
    const [accountRow] = await tx
      .select({ banned: user.banned })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!accountRow || accountRow.banned) {
      throw new ForbiddenException('An active Team Admin account is required');
    }

    const seasonRows = await tx
      .select({ id: seasons.id, startsOn: seasons.starts_on, endsOn: seasons.ends_on })
      .from(seasons)
      .orderBy(desc(seasons.starts_on));
    const localToday = localDateInTimeZone(now, this.timeZone());
    const current = seasonRows.find(
      (season) => season.startsOn <= localToday && localToday <= season.endsOn,
    );
    const previous = seasonRows.find((season) => season.endsOn < localToday);
    const relevant = current ?? previous ?? seasonRows.at(-1);
    if (!relevant) throw new ForbiddenException('An active Team Admin assignment is required');

    const [membership] = await tx
      .select({ role: season_memberships.role, state: season_memberships.state })
      .from(season_memberships)
      .where(
        and(eq(season_memberships.season_id, relevant.id), eq(season_memberships.user_id, userId)),
      )
      .limit(1);
    let effective = membership;
    if (!effective && relevant.id !== previous?.id && previous) {
      const [fallback] = await tx
        .select({ role: season_memberships.role, state: season_memberships.state })
        .from(season_memberships)
        .where(
          and(
            eq(season_memberships.season_id, previous.id),
            eq(season_memberships.user_id, userId),
          ),
        )
        .limit(1);
      effective = fallback;
    }
    if (effective?.role !== 'team_admin' || effective.state !== 'active') {
      throw new ForbiddenException('An active Team Admin assignment is required');
    }
  }

  private async effectiveAdminCount(tx: AccessTransaction, now: Date): Promise<number> {
    const seasonRows = await tx
      .select({ id: seasons.id, startsOn: seasons.starts_on, endsOn: seasons.ends_on })
      .from(seasons)
      .orderBy(desc(seasons.starts_on));
    const localToday = localDateInTimeZone(now, this.timeZone());
    const current = seasonRows.find(
      (season) => season.startsOn <= localToday && localToday <= season.endsOn,
    );
    const previous = seasonRows.find((season) => season.endsOn < localToday);
    const relevant = current ?? previous ?? seasonRows.at(-1);
    if (!relevant) return 0;

    const relevantRows = await tx
      .select({
        userId: season_memberships.user_id,
        role: season_memberships.role,
        state: season_memberships.state,
        banned: user.banned,
      })
      .from(season_memberships)
      .innerJoin(user, eq(season_memberships.user_id, user.id))
      .where(eq(season_memberships.season_id, relevant.id));
    const effectiveByUser = new Map(relevantRows.map((row) => [row.userId, row]));
    let count = relevantRows.filter(
      (row) => row.role === 'team_admin' && row.state === 'active' && !row.banned,
    ).length;

    if (current && previous && relevant.id !== previous.id) {
      const priorRows = await tx
        .select({
          userId: season_memberships.user_id,
          role: season_memberships.role,
          state: season_memberships.state,
          banned: user.banned,
        })
        .from(season_memberships)
        .innerJoin(user, eq(season_memberships.user_id, user.id))
        .where(eq(season_memberships.season_id, previous.id));
      count += priorRows.filter(
        (row) =>
          !effectiveByUser.has(row.userId) &&
          row.role === 'team_admin' &&
          row.state === 'active' &&
          !row.banned,
      ).length;
    }
    return count;
  }

  private rosterLock() {
    return sql`SELECT pg_advisory_xact_lock(hashtext('basecamp-roster-admins'))`;
  }

  private timeZone(): string {
    return this.config.get<string>('BASECAMP_TIME_ZONE') ?? 'UTC';
  }
}
