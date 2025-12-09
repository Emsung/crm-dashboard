-- Add performance indexes for faster queries
CREATE INDEX IF NOT EXISTS "trial_bookings_member_id_idx" ON "trial_bookings" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trial_bookings_created_at_idx" ON "trial_bookings" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversions_created_at_idx" ON "conversions" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guests_created_at_idx" ON "guests" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guests_converted_at_idx" ON "guests" USING btree ("converted_at" DESC);

