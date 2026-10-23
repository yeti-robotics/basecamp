import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

config({
  path: ['../.env.local', '../.env'].map((path) => fileURLToPath(new URL(path, import.meta.url))),
  quiet: true,
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const target = new URL(databaseUrl);
if (
  process.env.NODE_ENV === 'production' ||
  !['postgres:', 'postgresql:'].includes(target.protocol) ||
  !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
  target.searchParams.has('host') ||
  target.searchParams.has('hostaddr')
) {
  throw new Error('db:seed only accepts a local, non-production PostgreSQL database');
}

const names = [
  'Alex Morgan',
  'Morgan Chen',
  'Jordan Patel',
  'Taylor Rivera',
  'Casey Johnson',
  'Sam Williams',
  'Jamie Kim',
  'Riley Garcia',
  'Avery Thompson',
  'Quinn Davis',
  'Cameron Lee',
  'Drew Wilson',
  'Parker Nguyen',
  'Reese Martinez',
  'Rowan Clark',
  'Skyler Lewis',
  'Charlie Walker',
  'Emerson Hall',
  'Finley Allen',
  'Harper Young',
  'Logan Scott',
  'Sage Robinson',
  'Dakota King',
  'Phoenix Wright',
];

const timeZone = process.env.BASECAMP_TIME_ZONE || 'America/New_York';
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000 });
const db = drizzle(pool);

try {
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('basecamp-local-roster-seed'))`);
    const { rows: dates } = await tx.execute(sql`
      SELECT (CURRENT_TIMESTAMP AT TIME ZONE ${timeZone})::date::text AS today
    `);
    const today = dates[0].today;
    const { rows: currentSeasons } = await tx.execute(sql`
      SELECT id, name FROM seasons
      WHERE starts_on <= ${today}::date AND ends_on >= ${today}::date
      ORDER BY starts_on
    `);
    if (currentSeasons.length > 1)
      throw new Error('Multiple current seasons exist; fix their dates first');
    let season = currentSeasons[0];
    if (!season) {
      let year = Number(today.slice(0, 4));
      if (today < `${year}-05-15`) year -= 1;
      const startsOn = `${year}-05-15`;
      const endsOn = `${year + 1}-05-14`;
      const { rows: overlaps } = await tx.execute(sql`
        SELECT id FROM seasons WHERE starts_on <= ${endsOn}::date AND ends_on >= ${startsOn}::date
      `);
      if (overlaps.length) {
        throw new Error(
          'The default seed season overlaps an existing season; configure a current season first',
        );
      }
      const { rows } = await tx.execute(sql`
        INSERT INTO seasons (name, starts_on, ends_on, started_at, ended_at)
        VALUES (
          ${`${year}–${String(year + 1).slice(-2)}`}, ${startsOn}::date, ${endsOn}::date,
          (${startsOn}::date::timestamp AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC',
          ((${endsOn}::date + 1)::timestamp AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC'
        ) RETURNING id, name
      `);
      season = rows[0];
    }

    let usersAdded = 0;
    let membershipsAdded = 0;
    for (const [index, name] of names.entries()) {
      const userId = `local-roster-seed-${String(index + 1).padStart(2, '0')}`;
      const banned = index === 21;
      const removed = index >= 22;
      const role = index < 4 ? 'mentor' : index < 8 ? 'student_leader' : 'student';
      const experience = role === 'mentor' ? null : index % 2 === 0 ? 'rookie' : 'veteran';
      const userResult = await tx.execute(sql`
        INSERT INTO "user" (id, name, email, banned, ban_reason)
        VALUES (${userId}, ${name}, ${`${userId}@example.invalid`}, ${banned},
          ${banned ? 'Local demo suspension' : null})
        ON CONFLICT (id) DO NOTHING
      `);
      usersAdded += userResult.rowCount;
      const membershipResult = await tx.execute(sql`
        INSERT INTO season_memberships
          (season_id, user_id, role, student_experience, state, removed_at, ended_at)
        VALUES (${season.id}, ${userId}, ${role}, ${experience},
          ${removed ? 'removed' : 'active'},
          ${removed ? new Date().toISOString() : null}::timestamp,
          ${removed ? new Date().toISOString() : null}::timestamp)
        ON CONFLICT (season_id, user_id) DO NOTHING
      `);
      membershipsAdded += membershipResult.rowCount;
    }
    return { season, usersAdded, membershipsAdded };
  });
  console.log(`Seeded local database ${target.pathname.slice(1)} at ${target.hostname}.`);
  console.log(`Season: ${result.season.name} (ID ${result.season.id}).`);
  console.log(
    `Added ${result.usersAdded} fake users and ${result.membershipsAdded} roster memberships.`,
  );
  console.log(
    'Refresh /roster to try member search. Reruns preserve existing users and assignments.',
  );
} finally {
  await pool.end();
}
