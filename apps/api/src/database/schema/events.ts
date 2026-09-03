import { pgTable, timestamp, serial, text } from "drizzle-orm/pg-core";
import { eventCategory } from "./enums";
import { user } from "./auth";

export const events = pgTable("events", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    location: text("location").notNull(),
    starts_at: timestamp("starts_at").notNull(),
    ends_at: timestamp("ends_at").notNull(),
    category: eventCategory("event_type").notNull(),
    created_by: text("created_by").references(() => user.id),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull()
});
