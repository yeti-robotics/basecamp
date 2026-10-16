import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { seasons, season_memberships } from './seasons.js';

describe('season schema', () => {
  it('stores inclusive calendar dates for seasons', () => {
    expect(seasons.starts_on.name).toBe('starts_on');
    expect(seasons.starts_on.getSQLType()).toBe('date');
    expect(seasons.ends_on.getSQLType()).toBe('date');
  });

  it('stores required season assignments and a unique season-user pair', () => {
    expect(season_memberships.season_id.notNull).toBe(true);
    expect(season_memberships.user_id.notNull).toBe(true);
    expect(season_memberships.role.name).toBe('role');
    expect(season_memberships.student_experience.name).toBe('student_experience');
    expect(season_memberships.state.name).toBe('state');
    expect(season_memberships.joined_at.name).toBe('joined_at');
    expect(season_memberships.removed_at.name).toBe('removed_at');
    expect(season_memberships.legacy_status.name).toBe('legacy_status');
    const uniqueColumns = getTableConfig(season_memberships)
      .indexes.filter((index) => index.config.unique)
      .map((index) => index.config.columns.map((column) => column.name));
    expect(uniqueColumns).toContainEqual(['season_id', 'user_id']);
  });
});
