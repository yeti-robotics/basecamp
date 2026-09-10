import { date, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const orders = pgTable("orders", {
    id: serial("id").primaryKey(),
    part_id: integer("part_id").references(() => parts.id),
    seller: text("seller").notNull(),
    date: date("date").notNull(),
    quantity: integer("quantity").notNull(),
    requester_id: text("requester_id").references(() => user.id),
    additional_information: text("additional_information"),
    order_state: text("order_state").notNull(),
});

export const parts = pgTable("parts", {
    id: serial("id").primaryKey(),
    upc_code: text("upc_code").notNull(),
    name: text("name").notNull()
});

export const inventory_movements = pgTable("inventory_movements", {
    id: serial("id").primaryKey(),
    part_id: integer("part_id").references(() => parts.id),
    quantity_delta: integer("quantity_delta").notNull(),
    reason: text("reason").notNull(),
    occured_at: timestamp("occured_at").notNull().defaultNow(),
    user_id: text("user_id").references(() => user.id),
});