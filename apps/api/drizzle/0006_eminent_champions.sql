-- Renaming status to legacy_status kept the original NOT NULL. New memberships,
-- including the first Team Admin, do not set this retired column.
ALTER TABLE "season_memberships" ALTER COLUMN "legacy_status" DROP NOT NULL;