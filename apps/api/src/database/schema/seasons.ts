import { date, integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { memberStatus } from "./enums";
import { user } from "./auth";

export const seasons = pgTable("seasons", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    started_at: timestamp("started_at").notNull(),
    ended_at: timestamp("ended_at").notNull()
});

export const season_memberships = pgTable("season_memberships", {
    id: serial("id").primaryKey(),
    season_id: integer("season_id").references(() => seasons.id),
    user_id: text("user_id").references(() => user.id),
    status: memberStatus("status").notNull(),
    started_at: timestamp("started_at").defaultNow().notNull(),
    ended_at: timestamp("ended_at"),
    status_override: text("status_override")
});