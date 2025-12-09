'use server';

import { db } from '@/lib/db';
import { trialBookings, conversions, guests } from '@/lib/db/schema';
import { sql, eq, desc, and, gte, lte, gt, isNull, isNotNull, or, inArray } from 'drizzle-orm';

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

    // Match conversions to trials: match on memberId
    // If both have city, they should match, but if one is NULL, still match on memberId
    // This is more flexible and handles backwards compatibility
    // Simplified: match on memberId, and if both have city, they must match
    const matchedConversions = await db.select({ count: sql<number>`count(*)` })
        .from(conversions)
        .innerJoin(trialBookings, eq(conversions.memberId, trialBookings.memberId))
        .where(
            or(
                // Both have city and they match
                and(
                    isNotNull(conversions.city),
                    isNotNull(trialBookings.city),
                    eq(conversions.city, trialBookings.city)
                ),
                // At least one has no city (match on memberId only)
                isNull(conversions.city),
                isNull(trialBookings.city)
            )
        );

    // Get all leads for statistics (no limit - tables are not shown)
    const allLeads = await db.select()
        .from(trialBookings)
        .orderBy(desc(trialBookings.createdAt));

    // Get conversions with member details from trial_bookings
    // No limit - tables are not shown, only used for statistics
    // Match on memberId, and if both have city, they should match
    const allConversionsWithDetailsRaw = await db.select({
        id: conversions.id,
        memberId: conversions.memberId,
        city: conversions.city,
        memberSince: conversions.memberSince,
        membershipType: conversions.membershipType,
        createdAt: conversions.createdAt,
        firstName: trialBookings.firstName,
        lastName: trialBookings.lastName,
        trialCity: trialBookings.city,
        trialDate: trialBookings.createdAt, // Trial date for time-to-convert calculation
    })
        .from(conversions)
        .leftJoin(trialBookings, eq(conversions.memberId, trialBookings.memberId))
        .orderBy(desc(conversions.createdAt));
    
    // Filter in application: if both have city, they must match
    const allConversionsWithDetails = allConversionsWithDetailsRaw
        .filter(conv => {
            // If conversion has no city, match any trial
            if (!conv.city) return true;
            // If trial has no city, match any conversion
            if (!conv.trialCity) return true;
            // Both have city, they must match
            return conv.city.toLowerCase() === conv.trialCity.toLowerCase();
        })
        .map(({ trialCity, ...rest }) => ({
            ...rest,
            trialDate: rest.trialDate,
        }));

    // Get all conversions for statistics (no limit - tables are not shown)
    const allConversions = await db.select()
        .from(conversions)
        .orderBy(desc(conversions.createdAt));

    return {
        activeLeads: activeLeadsCount[0].count,
        totalConversions: conversionsCount[0].count,
        conversionRate: totalTrials[0].count > 0 ? (matchedConversions[0].count / totalTrials[0].count) * 100 : 0,
        recentConversions: allConversionsWithDetails.slice(0, 5),
        allConversions: allConversionsWithDetails,
        leads: allLeads,
    };
}

export async function getGuestsData() {
    // Optimize: Calculate counts in database instead of loading all records
    const totalGuestsCount = await db.select({ count: sql<number>`count(*)` })
        .from(guests);
    
    const activeGuestsCount = await db.select({ count: sql<number>`count(*)` })
        .from(guests)
        .where(and(
            isNull(guests.convertedAt),
            gt(guests.creditsLeft, 0)
        ));
    
    const lowCreditsGuestsCount = await db.select({ count: sql<number>`count(*)` })
        .from(guests)
        .where(and(
            isNull(guests.convertedAt),
            gt(guests.creditsLeft, 0),
            lte(guests.creditsLeft, 3)
        ));
    
    const convertedGuestsCount = await db.select({ count: sql<number>`count(*)` })
        .from(guests)
        .where(isNotNull(guests.convertedAt));
    
    // Package breakdown - calculate in database
    const package10Count = await db.select({ count: sql<number>`count(*)` })
        .from(guests)
        .where(eq(guests.packageSize, 10));
    
    const package16Count = await db.select({ count: sql<number>`count(*)` })
        .from(guests)
        .where(eq(guests.packageSize, 16));
    
    // Average credits and total credits - only fetch active guests for calculation
    const activeGuestsData = await db.select({
        creditsLeft: guests.creditsLeft,
    })
        .from(guests)
        .where(and(
            isNull(guests.convertedAt),
            gt(guests.creditsLeft, 0)
        ));
    
    // Get all guests for statistics (no limit - tables are not shown)
    const allGuests = await db.select()
        .from(guests)
        .orderBy(desc(guests.createdAt));

    // Active guests (not converted, still have credits) - from limited set
    const activeGuests = allGuests.filter(g => !g.convertedAt && g.creditsLeft > 0);

    // Guests with low credits (≤3 credits)
    const lowCreditsGuests = activeGuests.filter(g => g.creditsLeft <= 3);

    // Converted guests (have converted_at timestamp)
    const convertedGuests = allGuests.filter(g => g.convertedAt !== null);

    // Get conversions for guests to calculate conversion rate (only flex/loyalty memberships)
    const guestConversions = await db.select()
        .from(conversions)
        .innerJoin(guests, eq(conversions.memberId, guests.memberId))
        .where(and(
            isNotNull(guests.convertedAt),
            or(
                eq(conversions.membershipType, 'flex'),
                eq(conversions.membershipType, 'loyalty')
            )
        ));

    // Calculate metrics using database counts
    const totalGuests = totalGuestsCount[0].count;
    const activeGuestsCountValue = activeGuestsCount[0].count;
    const convertedGuestsCountValue = convertedGuestsCount[0].count;
    const conversionRate = totalGuests > 0 ? (convertedGuestsCountValue / totalGuests) * 100 : 0;

    // Package breakdown from database
    const package10CountValue = package10Count[0].count;
    const package16CountValue = package16Count[0].count;

    // Average credits per active guest
    const avgCredits = activeGuestsData.length > 0
        ? activeGuestsData.reduce((sum, g) => sum + g.creditsLeft, 0) / activeGuestsData.length
        : 0;

    // Total credits in use
    const totalCreditsInUse = activeGuestsData.reduce((sum, g) => sum + g.creditsLeft, 0);

    // Get guests with conversion details (for time-to-convert calculation)
    // Only include guests converted to flex/loyalty memberships
    // No limit - tables are not shown, only used for statistics
    const guestsWithConversionDetails = await db.select({
        id: guests.id,
        memberId: guests.memberId,
        creditsLeft: guests.creditsLeft,
        city: guests.city,
        startDate: guests.startDate,
        packageSize: guests.packageSize,
        convertedAt: guests.convertedAt,
        createdAt: guests.createdAt,
        memberSince: conversions.memberSince,
        membershipType: conversions.membershipType,
    })
        .from(guests)
        .leftJoin(conversions, eq(guests.memberId, conversions.memberId))
        .where(and(
            isNotNull(guests.convertedAt),
            or(
                eq(conversions.membershipType, 'flex'),
                eq(conversions.membershipType, 'loyalty')
            )
        ))
        .orderBy(desc(guests.convertedAt));

    return {
        totalGuests,
        activeGuests: activeGuestsCountValue,
        convertedGuests: convertedGuestsCountValue,
        lowCreditsGuests: lowCreditsGuestsCount[0].count,
        conversionRate,
        package10Count: package10CountValue,
        package16Count: package16CountValue,
        avgCredits: Math.round(avgCredits * 100) / 100,
        totalCreditsInUse,
        allGuests,
        activeGuestsList: activeGuests,
        lowCreditsGuestsList: lowCreditsGuests,
        convertedGuestsList: convertedGuests,
        guestsWithConversionDetails,
    };
}
