-- Manual migration: app_users — Clerk auth -> username/password auth
--
-- WHY THIS IS MANUAL:
-- The schema diff that drizzle-kit auto-generates would `TRUNCATE app_users CASCADE`
-- because it adds NOT-NULL columns (`id`, `password_hash`) without defaults and
-- renames `clerk_user_id` -> `username` (which would also break the implicit
-- ownership references in `conversations.owner_user_id` and
-- `router_profiles.owner_user_id`, since those hold the old clerk_user_id values).
--
-- This script preserves all existing rows and ownership references by:
--   * using the old clerk_user_id value as the new `id` PK
--   * seeding `username` from clerk_user_id (admin can rename later via the app)
--   * setting `password_hash = ''` as a "must reset" sentinel
--
-- HOW TO APPLY:
-- Run this against the PRODUCTION database BEFORE clicking Republish. Once the
-- production schema matches the Drizzle schema, the publish flow will detect no
-- destructive changes and proceed cleanly.

BEGIN;

-- 1. Add new columns nullable so existing rows survive.
ALTER TABLE "app_users" ADD COLUMN "id"            text;
ALTER TABLE "app_users" ADD COLUMN "username"      text;
ALTER TABLE "app_users" ADD COLUMN "password_hash" text;
ALTER TABLE "app_users" ADD COLUMN "created_by"    text;

-- 2. Backfill from the old clerk_user_id.
--    id       = clerk_user_id  -> keeps owner_user_id refs in conversations/router_profiles intact
--    username = clerk_user_id  -> guaranteed unique; admin can rename via the app afterwards
--    password_hash = ''        -> sentinel: server should treat empty hash as "must reset"
UPDATE "app_users"
   SET "id"            = "clerk_user_id",
       "username"      = "clerk_user_id",
       "password_hash" = '';

-- 3. Drop the old primary key + column.
ALTER TABLE "app_users" DROP CONSTRAINT "app_users_pkey";
ALTER TABLE "app_users" DROP COLUMN "clerk_user_id";

-- 4. Apply the new constraints.
ALTER TABLE "app_users" ALTER COLUMN "id"            SET NOT NULL;
ALTER TABLE "app_users" ALTER COLUMN "username"      SET NOT NULL;
ALTER TABLE "app_users" ALTER COLUMN "password_hash" SET NOT NULL;
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "app_users_username_idx" ON "app_users" USING btree ("username");

COMMIT;
