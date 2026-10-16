import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const [userId, seasonIdText] = process.argv.slice(2);
const seasonId = Number(seasonIdText);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set');
if (!userId || !Number.isSafeInteger(seasonId) || seasonId < 1) {
  throw new Error('Usage: node scripts/recover-admin.mjs <userId> <seasonId>');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('basecamp-roster-admins'))");
  const target = await client.query('SELECT id, banned FROM "user" WHERE id = $1', [userId]);
  if (target.rowCount !== 1) throw new Error(`Local account ${userId} was not found`);
  if (target.rows[0].banned) {
    await client.query(
      'UPDATE "user" SET banned = false, ban_reason = NULL, ban_expires = NULL WHERE id = $1',
      [userId],
    );
    await client.query(
      `INSERT INTO roster_audit (actor_user_id, subject_user_id, action, before, after, reason)
       VALUES (NULL, $1, 'account_restored', '{"banned":true}'::jsonb, '{"banned":false}'::jsonb, 'Operator recovery command')`,
      [userId],
    );
  }
  const season = await client.query('SELECT id FROM seasons WHERE id = $1', [seasonId]);
  if (season.rowCount !== 1) throw new Error(`Season ${seasonId} was not found`);

  const existing = await client.query(
    'SELECT role, student_experience, state FROM season_memberships WHERE season_id = $1 AND user_id = $2 FOR UPDATE',
    [seasonId, userId],
  );
  const before = existing.rows[0] ?? null;
  if (before) {
    await client.query(
      `UPDATE season_memberships
       SET role = 'team_admin', student_experience = NULL, state = 'active', removed_at = NULL, ended_at = NULL
       WHERE season_id = $1 AND user_id = $2`,
      [seasonId, userId],
    );
  } else {
    await client.query(
      `INSERT INTO season_memberships (season_id, user_id, role, student_experience, state)
       VALUES ($1, $2, 'team_admin', NULL, 'active')`,
      [seasonId, userId],
    );
  }
  await client.query(
    `INSERT INTO roster_audit (actor_user_id, subject_user_id, season_id, action, before, after, reason)
     VALUES (NULL, $1, $2, 'admin_recovery', $3::jsonb, $4::jsonb, 'Operator recovery command')`,
    [
      userId,
      seasonId,
      before ? JSON.stringify(before) : null,
      JSON.stringify({ role: 'team_admin', studentExperience: null, state: 'active' }),
    ],
  );
  await client.query('COMMIT');
  console.log(`Granted Team Admin access to ${userId} for season ${seasonId}.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
