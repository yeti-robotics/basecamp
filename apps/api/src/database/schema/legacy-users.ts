import { pgTable, serial, timestamp, unique, varchar } from 'drizzle-orm/pg-core';

// Retained from the first database migration so later Drizzle generation does not drop it.
// New application accounts use the Better Auth `user` table.
export const usersFirstMigration = pgTable(
  'users_first_migration',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique('users_first_migration_email_unique').on(table.email)],
);
