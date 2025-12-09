ALTER TABLE "conversions" ADD COLUMN "source" varchar(50);--> statement-breakpoint
ALTER TABLE "conversions" ADD COLUMN "had_course_step" boolean DEFAULT false;