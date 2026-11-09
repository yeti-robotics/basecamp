CREATE TYPE "public"."attendance_status" AS ENUM('normal', 'manual', 'excused');--> statement-breakpoint
CREATE TABLE "attendance_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"attendance_id" integer NOT NULL,
	"actor_user_id" text,
	"subject_user_id" text,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "status" "attendance_status" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_audit" ADD CONSTRAINT "attendance_audit_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_audit" ADD CONSTRAINT "attendance_audit_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_audit" ADD CONSTRAINT "attendance_audit_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_audit_attendance_id_idx" ON "attendance_audit" USING btree ("attendance_id");