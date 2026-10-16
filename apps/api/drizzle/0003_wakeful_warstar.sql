CREATE TYPE "public"."membership_state" AS ENUM('active', 'removed');--> statement-breakpoint
CREATE TYPE "public"."season_role" AS ENUM('team_admin', 'mentor', 'student_leader', 'student');--> statement-breakpoint
CREATE TYPE "public"."student_experience" AS ENUM('rookie', 'veteran');--> statement-breakpoint
CREATE TABLE "roster_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"subject_user_id" text NOT NULL,
	"season_id" integer,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "season_memberships" WHERE "season_id" IS NULL OR "user_id" IS NULL) THEN
		RAISE EXCEPTION 'Cannot migrate season_memberships with missing season or user references; repair those rows and retry';
	END IF;
	IF EXISTS (
		SELECT 1 FROM "season_memberships" GROUP BY "season_id", "user_id" HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot add one-membership-per-season constraint while duplicate season/user rows exist; reconcile duplicates and retry';
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "season_memberships" RENAME COLUMN "status" TO "legacy_status";--> statement-breakpoint
ALTER TABLE "season_memberships" ADD COLUMN "role" "season_role";--> statement-breakpoint
ALTER TABLE "season_memberships" ADD COLUMN "student_experience" "student_experience";--> statement-breakpoint
ALTER TABLE "season_memberships" ADD COLUMN "state" "membership_state";--> statement-breakpoint
ALTER TABLE "season_memberships" ADD COLUMN "joined_at" timestamp;--> statement-breakpoint
ALTER TABLE "season_memberships" ADD COLUMN "removed_at" timestamp;--> statement-breakpoint
UPDATE "season_memberships" SET
	"role" = CASE WHEN "legacy_status" = 'mentor' THEN 'mentor'::"season_role" ELSE 'student'::"season_role" END,
	"student_experience" = CASE
		WHEN "legacy_status" = 'veteran' THEN 'veteran'::"student_experience"
		WHEN "legacy_status" IN ('rookie', 'alumni') THEN 'rookie'::"student_experience"
		ELSE NULL
	END,
	"state" = CASE WHEN "legacy_status" = 'alumni' THEN 'removed'::"membership_state" ELSE 'active'::"membership_state" END,
	"joined_at" = "started_at",
	"removed_at" = CASE WHEN "legacy_status" = 'alumni' THEN COALESCE("ended_at", "started_at") ELSE NULL END;
--> statement-breakpoint
ALTER TABLE "season_memberships" ALTER COLUMN "season_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "season_memberships" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "season_memberships" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "season_memberships" ALTER COLUMN "state" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "season_memberships" ALTER COLUMN "state" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "season_memberships" ALTER COLUMN "joined_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "season_memberships" ALTER COLUMN "joined_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "starts_on" date;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "ends_on" date;--> statement-breakpoint
UPDATE "seasons" SET "starts_on" = "started_at"::date, "ends_on" = "ended_at"::date;--> statement-breakpoint
ALTER TABLE "seasons" ALTER COLUMN "starts_on" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ALTER COLUMN "ends_on" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "roster_audit" ADD CONSTRAINT "roster_audit_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_audit" ADD CONSTRAINT "roster_audit_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_audit" ADD CONSTRAINT "roster_audit_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "season_memberships_season_user_uidx" ON "season_memberships" USING btree ("season_id","user_id");
