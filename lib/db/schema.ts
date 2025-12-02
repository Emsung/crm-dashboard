import { pgTable, index, serial, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const trialBookings = pgTable("trial_bookings", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	firstName: varchar("first_name", { length: 100 }),
	lastName: varchar("last_name", { length: 100 }),
	city: varchar({ length: 100 }).notNull(),
	country: varchar({ length: 10 }).notNull(),
	classId: integer("class_id").notNull(),
	className: varchar("class_name", { length: 255 }),
	classDate: timestamp("class_date", { mode: 'string' }),
	classTime: varchar("class_time", { length: 100 }),
	isNewMember: boolean("is_new_member").default(false),
	memberId: varchar("member_id", { length: 100 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	attended: boolean().default(false),
}, (table) => [
	index("trial_bookings_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
]);

export const conversions = pgTable("conversions", {
	id: serial("id").primaryKey().notNull(),
	memberId: varchar("member_id", { length: 100 }).notNull(),
	memberSince: timestamp("member_since", { mode: 'string' }).notNull(),
	membershipType: varchar("membership_type", { length: 50 }).notNull(), // 'flex', 'loyalty', or 'course' (beginners package)
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("conversions_member_id_idx").using("btree", table.memberId),
]);
