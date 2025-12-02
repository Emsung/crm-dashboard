'use server';

import { db } from '@/lib/db';
import { trialBookings, conversions } from '@/lib/db/schema';
import { sql, eq, desc, and, gte } from 'drizzle-orm';

export async function getDashboardData() {
    // 1. Total Active Leads (Trials in the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeLeadsCount = await db.select({ count: sql<number>`count(*)` })
        .from(trialBookings)
        .where(gte(trialBookings.createdAt, thirtyDaysAgo.toISOString()));

    // 2. Total Conversions (All time for now, or match time range)
    const conversionsCount = await db.select({ count: sql<number>`count(*)` })
        .from(conversions);

    // 3. Conversion Rate Calculation
    // We need to match trials to conversions. 
    // Ideally, we match by email or member_id if available.
    // trial_bookings has member_id, conversions has member_id.

    const totalTrials = await db.select({ count: sql<number>`count(*)` }).from(trialBookings);

    const matchedConversions = await db.select({ count: sql<number>`count(*)` })
        .from(conversions)
        .innerJoin(trialBookings, eq(conversions.memberId, trialBookings.memberId));

    const allLeads = await db.select().from(trialBookings).orderBy(desc(trialBookings.createdAt));

    // Get conversions with member details from trial_bookings
    // Include trial date (createdAt from trialBookings) for time-to-convert calculation
    const allConversionsWithDetails = await db.select({
        id: conversions.id,
        memberId: conversions.memberId,
        memberSince: conversions.memberSince,
        membershipType: conversions.membershipType,
        createdAt: conversions.createdAt,
        firstName: trialBookings.firstName,
        lastName: trialBookings.lastName,
        city: trialBookings.city,
        trialDate: trialBookings.createdAt, // Trial date for time-to-convert calculation
    })
        .from(conversions)
        .leftJoin(trialBookings, eq(conversions.memberId, trialBookings.memberId))
        .orderBy(desc(conversions.createdAt));

    const allConversions = await db.select().from(conversions).orderBy(desc(conversions.createdAt));

    return {
        activeLeads: activeLeadsCount[0].count,
        totalConversions: conversionsCount[0].count,
        conversionRate: totalTrials[0].count > 0 ? (matchedConversions[0].count / totalTrials[0].count) * 100 : 0,
        recentConversions: allConversionsWithDetails.slice(0, 5),
        allConversions: allConversionsWithDetails,
        leads: allLeads,
    };
}
