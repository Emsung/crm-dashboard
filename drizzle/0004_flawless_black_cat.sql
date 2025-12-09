-- Step 1: Add city column as nullable
ALTER TABLE "conversions" ADD COLUMN "city" varchar(100);--> statement-breakpoint

-- Step 2: Update existing conversions with city from trial_bookings
UPDATE "conversions" 
SET "city" = (
    SELECT "trial_bookings"."city" 
    FROM "trial_bookings" 
    WHERE "trial_bookings"."member_id" = "conversions"."member_id" 
    LIMIT 1
)
WHERE "city" IS NULL;--> statement-breakpoint

-- Step 3: Update remaining conversions with city from guests
UPDATE "conversions" 
SET "city" = (
    SELECT "guests"."city"
    FROM "guests" 
    WHERE "guests"."member_id" = "conversions"."member_id" 
    LIMIT 1
)
WHERE "city" IS NULL;--> statement-breakpoint

-- Step 4: Create index
CREATE INDEX "conversions_city_idx" ON "conversions" USING btree ("city");