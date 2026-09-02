import { pgEnum } from "drizzle-orm/pg-core";

export const memberStatus = pgEnum("member_status", [ "rookie", "veteran", "alumni", "mentor",]);

export const eventCategory = pgEnum("event_category", ["meeting", "outreach"]);