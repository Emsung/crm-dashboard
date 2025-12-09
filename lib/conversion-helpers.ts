// Helper functions for determining conversion source and tracking

import { db } from '@/lib/db';
import { guests, trialBookings, conversions } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { getCountryFromCity } from '@/lib/perfectgym-utils';

export interface ConversionSource {
  source: 'trial' | 'guest' | 'direct';
  hadCourseStep: boolean;
  city: string | null;
}

/**
 * Determines the source of a conversion and whether there was a course step
 * Also determines the city from guest/trial records
 * @param memberId - The member ID to check
 * @returns ConversionSource with source, hadCourseStep, and city
 */
export async function determineConversionSource(memberId: string): Promise<ConversionSource> {
  let city: string | null = null;

  // Check if member exists in guests table
  const guestRecord = await db.select()
    .from(guests)
    .where(eq(guests.memberId, memberId))
    .limit(1);

  if (guestRecord.length > 0) {
    // Member was a guest (course participant)
    // Get city from guest record
    city = guestRecord[0].city || null;
    return {
      source: 'guest',
      hadCourseStep: false, // Guests already had course, so no intermediate step
      city: city,
    };
  }

  // Check if member exists in trialBookings table
  const trialRecord = await db.select()
    .from(trialBookings)
    .where(eq(trialBookings.memberId, memberId))
    .limit(1);

  if (trialRecord.length > 0) {
    // Member came from trial
    // Get city from trial record
    city = trialRecord[0].city || null;
    
    // Check if they have a 'course' conversion (Trial → Course → Member)
    const courseConversion = await db.select()
      .from(conversions)
      .where(and(
        eq(conversions.memberId, memberId),
        eq(conversions.membershipType, 'course')
      ))
      .limit(1);

    return {
      source: 'trial',
      hadCourseStep: courseConversion.length > 0, // Had course step if course conversion exists
      city: city,
    };
  }

  // No trial or guest record found - direct conversion
  // Try to find city from existing conversion records
  const existingConversion = await db.select()
    .from(conversions)
    .where(eq(conversions.memberId, memberId))
    .limit(1);
  
  if (existingConversion.length > 0 && existingConversion[0].city) {
    city = existingConversion[0].city;
  }

  return {
    source: 'direct',
    hadCourseStep: false,
    city: city,
  };
}

