import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trialBookings, conversions } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { getCountryFromCity, getPerfectGymConfig, getAllMembersWithContracts, getAllMemberProducts, mapMembershipType } from '@/lib/perfectgym-utils';

export async function syncTrials(options: { dryRun?: boolean }): Promise<NextResponse> {
  const { dryRun = true } = options;
  const startTime = Date.now();
  console.log('[Sync Trials] Starting sync...');
  
  try {
    // Get all trial bookings that have a memberId but no conversion yet
    // We need to check by both memberId and city since memberId can be duplicate between portals
    console.log('[Sync Trials] Fetching existing conversions...');
    const existingConversions = await db.select({ 
      memberId: conversions.memberId,
      city: conversions.city 
    })
      .from(conversions);

    // Create a set of memberId+city combinations to check against
    const existingMemberCitySet = new Set(
      existingConversions
        .filter(c => c.memberId && c.city)
        .map(c => `${c.memberId}:${c.city}`)
    );
    console.log(`[Sync Trials] Found ${existingMemberCitySet.size} existing conversions (by memberId+city)`);

    console.log('[Sync Trials] Fetching trials to check...');
    const allTrials = await db.select()
      .from(trialBookings)
      .where(isNotNull(trialBookings.memberId));

    // Filter out trials that already have conversions (by memberId+city combination)
    const trialsToCheck = allTrials.filter(trial => {
      if (!trial.memberId || !trial.city) return false;
      const key = `${trial.memberId}:${trial.city}`;
      return !existingMemberCitySet.has(key);
    });

    console.log(`[Sync Trials] Found ${trialsToCheck.length} trials to check (filtered from ${allTrials.length} total)`);

    if (trialsToCheck.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No trials to check',
        conversionsFound: 0,
        conversionsCreated: 0,
      });
    }

    // Limit processing to prevent timeouts (process max 999 at a time)
    const maxTrials = 999;
    const trialsToProcess = trialsToCheck.slice(0, maxTrials);
    
    if (trialsToCheck.length > maxTrials) {
      console.log(`[Sync Trials] Limiting to first ${maxTrials} trials (out of ${trialsToCheck.length})`);
    }

    // Group trials by country for bulk API calls
    const trialsByCountry = new Map<string, typeof trialsToProcess>();
    for (const trial of trialsToProcess) {
      if (!trial.memberId || !trial.city) continue;
      
      const country = getCountryFromCity(trial.city);
      if (!country) {
        console.warn(`[Sync Trials] Could not determine country from city: ${trial.city} (memberId: ${trial.memberId})`);
        continue;
      }
      
      if (!trialsByCountry.has(country)) {
        trialsByCountry.set(country, []);
      }
      trialsByCountry.get(country)!.push(trial);
    }

    console.log(`[Sync Trials] Grouped trials by country: ${Array.from(trialsByCountry.entries()).map(([c, t]) => `${c}: ${t.length}`).join(', ')}`);

    let conversionsFound = 0;
    let conversionsCreated = 0;
    const errors: string[] = [];

    // Process each country
    for (const [country, countryTrials] of trialsByCountry.entries()) {
      console.log(`[Sync Trials] Processing ${countryTrials.length} trials for country ${country}`);
      
      const config = await getPerfectGymConfig(country);
      if (!config) {
        errors.push(`No API config found for country: ${country}`);
        continue;
      }

      // Bulk fetch: Get all members with contracts (memberships)
      console.log(`[Sync Trials] Fetching all members with contracts for ${country}...`);
      const membersWithContracts = await getAllMembersWithContracts(config);
      
      // Create map of memberId -> { contractStartDate, membershipType }
      const membersMap = new Map<string, { startDate: string; membershipType: string }>();
      for (const member of membersWithContracts) {
        if (member.contracts && member.contracts.length > 0) {
          const newestContract = member.contracts[0];
          if (newestContract && newestContract.startDate) {
            const paymentPlanName = newestContract.paymentPlanName || '';
            const membershipType = mapMembershipType(paymentPlanName);
            membersMap.set(String(member.id), {
              startDate: newestContract.startDate,
              membershipType: membershipType,
            });
          }
        }
      }
      console.log(`[Sync Trials] Found ${membersMap.size} members with contracts for ${country}`);

      // Bulk fetch: Get all member products (course packages)
      console.log(`[Sync Trials] Fetching all member products for ${country}...`);
      const memberProducts = await getAllMemberProducts(config);
      
      // Create map of memberId -> { purchaseDate, productName } (newest purchase per member)
      const purchasesMap = new Map<string, { purchaseDate: string; productName: string }>();
      for (const product of memberProducts) {
        const memberId = String(product.memberId);
        const existing = purchasesMap.get(memberId);
        
        // Only include products with initialQuantity 10 or 16 (course packages)
        if (product.initialQuantity === 10 || product.initialQuantity === 16) {
          if (!existing || (product.purchaseDate && existing.purchaseDate < product.purchaseDate)) {
            purchasesMap.set(memberId, {
              purchaseDate: product.purchaseDate || new Date().toISOString(),
              productName: 'Beginners Package',
            });
          }
        }
      }
      console.log(`[Sync Trials] Found ${purchasesMap.size} course package purchases for ${country}`);

      // Process each trial for this country
      for (const trial of countryTrials) {
        if (!trial.memberId || !trial.city) {
          continue;
        }

        // Check for existing conversions (can have both course and membership)
        // Filter by both memberId and city to differentiate between portals
        const existingConversions = await db.select({
          id: conversions.id,
          memberId: conversions.memberId,
          city: conversions.city,
          membershipType: conversions.membershipType,
        })
          .from(conversions)
          .where(and(
            eq(conversions.memberId, trial.memberId),
            eq(conversions.city, trial.city)
          ));

        const hasCourseConversion = existingConversions.some(c => c.membershipType === 'course');
        const hasMembershipConversion = existingConversions.some(c => c.membershipType === 'flex' || c.membershipType === 'loyalty');

        // If they already have a membership, skip entirely (fully converted)
        if (hasMembershipConversion) {
          continue;
        }

        // Check for membership first (highest priority - everyone should become a member)
        // This handles: Trial → Member OR Course → Member
        const contractData = membersMap.get(trial.memberId);
        
        if (contractData) {
          conversionsFound++;
          if (!dryRun) {
            try {
              // Check if there's an existing 'course' conversion (Trial → Course → Member)
              if (hasCourseConversion) {
                // Find the course conversion record to update it
                const courseConversion = existingConversions.find(
                  c => c.memberId === trial.memberId && c.membershipType === 'course'
                );
                
                if (courseConversion) {
                  // Update the existing course conversion to membership
                  // This is Trial → Course → Member, so hadCourseStep = true
                  await db.update(conversions)
                    .set({
                      memberSince: contractData.startDate,
                      membershipType: contractData.membershipType,
                      source: 'trial',
                      hadCourseStep: true, // Had course step before membership
                    })
                    .where(eq(conversions.id, courseConversion.id));
                  conversionsCreated++;
                  console.log(`[Sync Trials] Updated course conversion to membership for ${trial.memberId} (Trial → Course → Member)`);
                } else {
                  // Course conversion exists but we can't find the record, create new one
                  await db.insert(conversions).values({
                    memberId: trial.memberId,
                    city: trial.city,
                    memberSince: contractData.startDate,
                    membershipType: contractData.membershipType,
                    source: 'trial',
                    hadCourseStep: true,
                  });
                  conversionsCreated++;
                  console.log(`[Sync Trials] Created membership conversion for course participant ${trial.memberId} (Course → Member)`);
                }
              } else {
                // Direct Trial → Member conversion
                await db.insert(conversions).values({
                  memberId: trial.memberId,
                  city: trial.city,
                  memberSince: contractData.startDate,
                  membershipType: contractData.membershipType,
                  source: 'trial',
                  hadCourseStep: false, // Direct conversion, no course step
                });
                conversionsCreated++;
                console.log(`[Sync Trials] Created membership conversion for ${trial.memberId} (Trial → Member)`);
              }
            } catch (error) {
              errors.push(`Failed to create conversion for membership ${trial.memberId}: ${error}`);
            }
          }
          continue; // Skip course check if membership found
        }

        // If no membership and no course conversion yet, check for purchase (beginners package)
        // Once someone has a course conversion, we only check for membership (course → member)
        if (!hasCourseConversion) {
          const purchaseData = purchasesMap.get(trial.memberId);
          
          if (purchaseData && purchaseData.purchaseDate) {
            conversionsFound++;
            if (!dryRun) {
              try {
                // For purchase conversions (beginners package), use the purchase date
                // and set membershipType to 'course' to distinguish from direct memberships
                // This is Trial → Course, so source is 'trial' and hadCourseStep is false (this IS the course step)
                await db.insert(conversions).values({
                  memberId: trial.memberId,
                  city: trial.city,
                  memberSince: purchaseData.purchaseDate,
                  membershipType: 'course', // Course participant (beginners package purchase) - Trial → Course
                  source: 'trial',
                  hadCourseStep: false, // This is the course step itself, not a step before membership
                });
                conversionsCreated++;
                console.log(`[Sync Trials] Created course conversion for ${trial.memberId} (Trial → Course)`);
              } catch (error) {
                errors.push(`Failed to create conversion for purchase ${trial.memberId}: ${error}`);
              }
            }
          }
        } else {
          // They have a course conversion but no membership yet
          // We already checked for membership above, so nothing more to do
          // Next sync will check again for course → member upgrade
          console.log(`[Sync Trials] Member ${trial.memberId} has course conversion, waiting for membership upgrade`);
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Sync Trials] Completed in ${duration}s - Found: ${conversionsFound}, Created: ${conversionsCreated}`);
    
    return NextResponse.json({
      success: true,
      dryRun,
      message: `Checked ${trialsToProcess.length} trials${trialsToCheck.length > maxTrials ? ` (${trialsToCheck.length - maxTrials} remaining)` : ''}`,
      conversionsFound,
      conversionsCreated,
      trialsChecked: trialsToProcess.length,
      trialsRemaining: Math.max(0, trialsToCheck.length - maxTrials),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[Sync Trials] Error after ${duration}s:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

