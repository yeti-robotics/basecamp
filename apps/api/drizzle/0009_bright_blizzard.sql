CREATE TYPE "public"."event_hour_category" AS ENUM('meeting', 'outreach', 'none');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('meeting', 'extra_meeting', 'outreach', 'other');--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "event_type" SET DATA TYPE "public"."event_type" USING "event_type"::text::"public"."event_type";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "season_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "hour_category" "event_hour_category" NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "status" "event_status" DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;