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
	index("trial_bookings_member_id_idx").using("btree", table.memberId),
	index("trial_bookings_created_at_idx").using("btree", table.createdAt.desc()),
]);

export const conversions = pgTable("conversions", {
	id: serial("id").primaryKey().notNull(),
	memberId: varchar("member_id", { length: 100 }).notNull(),
	city: varchar("city", { length: 100 }), // City to differentiate between portals (memberId can be duplicate)
	memberSince: timestamp("member_since", { mode: 'string' }).notNull(),
	membershipType: varchar("membership_type", { length: 50 }).notNull(), // 'flex', 'loyalty', or 'course' (beginners package)
	source: varchar("source", { length: 50 }), // 'trial', 'guest', 'direct' - tracks where the conversion came from
	hadCourseStep: boolean("had_course_step").default(false), // indicates if there was a course package step before membership
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("conversions_member_id_idx").using("btree", table.memberId),
	index("conversions_city_idx").using("btree", table.city),
	index("conversions_created_at_idx").using("btree", table.createdAt.desc()),
]);

export const guests = pgTable("guests", {
	id: serial("id").primaryKey().notNull(),
	memberId: varchar("member_id", { length: 100 }).notNull().unique(),
	creditsLeft: integer("credits_left").notNull(),
	city: varchar({ length: 100 }),
	startDate: timestamp("start_date", { mode: 'string' }),
	packageSize: integer("package_size").notNull(), // 10 or 16 credits
	convertedAt: timestamp("converted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("guests_member_id_idx").using("btree", table.memberId),
	index("guests_created_at_idx").using("btree", table.createdAt.desc()),
	index("guests_converted_at_idx").using("btree", table.convertedAt.desc()),
]);
