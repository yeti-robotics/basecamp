import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { AppDatabase } from '../database/database.service.js';
import { season_memberships, seasons } from '../database/schema/index.js';

export async function ensureSeasonMembership(
  database: AppDatabase,
  userId: string,
  asOfDate: Date = new Date(),
): Promise<boolean> {
  return database.transaction(async (transaction) => {
    const [activeSeason] = await transaction
      .select({ id: seasons.id })
      .from(seasons)
      .where(
        and(
          lte(seasons.started_at, asOfDate),
          gte(seasons.ended_at, asOfDate),
        ),
      )
      .orderBy(desc(seasons.started_at))
      .limit(1);

    if (!activeSeason) {
      return false;
    }

    const [currentMembership] = await transaction
      .select({ id: season_memberships.id })
      .from(season_memberships)
      .where(
        and(
          eq(season_memberships.user_id, userId),
          eq(season_memberships.season_id, activeSeason.id),
        ),
      )
      .limit(1);

    if (currentMembership) {
      return true;
    }

    const [previousMembership] = await transaction
      .select({ id: season_memberships.id })
      .from(season_memberships)
      .where(eq(season_memberships.user_id, userId))
      .limit(1);

    await transaction
      .insert(season_memberships)
      .values({
        season_id: activeSeason.id,
        user_id: userId,
        role: 'student',
        student_experience: previousMembership ? 'veteran' : 'rookie',
      })
      .onConflictDoNothing();

    return true;
  });
}