CREATE TABLE "guests" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" varchar(100) NOT NULL,
	"credits_left" integer NOT NULL,
	"city" varchar(100),
	"start_date" timestamp,
	"package_size" integer NOT NULL,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guests_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE INDEX "guests_member_id_idx" ON "guests" USING btree ("member_id");