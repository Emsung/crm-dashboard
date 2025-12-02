CREATE TABLE "conversions" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" varchar(100) NOT NULL,
	"member_since" timestamp NOT NULL,
	"membership_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "conversions_member_id_idx" ON "conversions" USING btree ("member_id");