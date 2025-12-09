import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guests, conversions, trialBookings } from '@/lib/db/schema';
import { eq, and, isNull, or } from 'drizzle-orm';
import { getPerfectGymConfig, getAllMemberProducts, getAllMembersWithContracts, getCountryFromCity, getCityFromHomeClubId, mapMembershipType } from '@/lib/perfectgym-utils';

// Map country parameter to country code
const countryParamMap: Record<string, string> = {
  'nl': 'NL',
  'de': 'DE',
  'ch': 'CH',
  'at': 'AT',
};

export async function syncGuests(options: { country: string; dryRun?: boolean }): Promise<NextResponse> {
  const { country: countryParam, dryRun = true } = options;
  
  try {
    const country = countryParamMap[countryParam.toLowerCase()];
    
    if (!country) {
      return NextResponse.json(
        { error: `Invalid country parameter. Must be one of: nl, de, ch, at` },
        { status: 400 }
      );
    }

    // Get PerfectGym config for this country
    const config = await getPerfectGymConfig(country);
    if (!config) {
      return NextResponse.json(
        { error: `No PerfectGym configuration found for country: ${country}` },
        { status: 500 }
      );
    }

    // Step 1: Sync historical guests data from MemberProducts
    const memberProducts = await getAllMemberProducts(config);
    
    const guestsToCreate: any[] = [];
    const guestsToUpdate: any[] = [];
    let guestsCreated = 0;
    let guestsUpdated = 0;

    // Get all existing guests (to check if they exist and get city info)
    const allExistingGuests = await db.select()
      .from(guests);

    // Create map of existing guests by memberId
    const existingGuestsMap = new Map(
      allExistingGuests.map(g => [g.memberId, g])
    );

    // Group products by memberId and get the newest one per member (by purchaseDate)
    const productsByMember = new Map<string, typeof memberProducts[0]>();
    for (const product of memberProducts) {
      const memberId = String(product.memberId);
      const existing = productsByMember.get(memberId);
      
      if (!existing) {
        productsByMember.set(memberId, product);
      } else {
        // Compare purchase dates to get the newest
        const existingDate = existing.purchaseDate ? new Date(existing.purchaseDate).getTime() : 0;
        const currentDate = product.purchaseDate ? new Date(product.purchaseDate).getTime() : 0;
        if (currentDate > existingDate) {
          productsByMember.set(memberId, product);
        }
      }
    }

    // Process each member's newest product
    for (const [memberId, product] of productsByMember) {
      const existingGuest = existingGuestsMap.get(memberId);

      // Determine city from homeClubId based on the country we're syncing
      // This is important because homeClubId is not unique across countries
      // (e.g., Amsterdam and Vienna both have clubId 1)
      let city: string | null = null;
      
      if (product.Member?.homeClubId) {
        console.log(`[Step 1] Member ${memberId} has homeClubId ${product.Member.homeClubId}, country ${country}`);
        const cityFromClubId = getCityFromHomeClubId(country, product.Member.homeClubId);
        console.log(`[Step 1] City from homeClubId for country ${country}: ${cityFromClubId}`);
        if (cityFromClubId) {
          city = cityFromClubId;
        }
      }
      
      // If we couldn't determine city from homeClubId, try existing guest record
      // But only if it matches the country we're syncing
      if (!city && existingGuest?.city) {
        const cityCountry = getCountryFromCity(existingGuest.city);
        if (cityCountry === country) {
          city = existingGuest.city;
          console.log(`[Step 1] Using existing city ${city} for member ${memberId}`);
        } else {
          console.log(`[Step 1] Existing city ${existingGuest.city} (${cityCountry}) doesn't match sync country ${country}, will update from homeClubId`);
        }
      }

      // Skip guests from non-active cities (not in our mapping)
      if (!city) {
        console.log(`[Step 1] Skipping guest ${memberId} - no city determined (homeClubId ${product.Member?.homeClubId} not in active cities list for ${country})`);
        continue;
      }

      // Verify city is valid for this country (double check)
      const cityCountry = getCountryFromCity(city);
      if (cityCountry !== country) {
        console.log(`[Step 1] Skipping guest ${memberId} - city ${city} is in country ${cityCountry}, not ${country}`);
        continue;
      }

      const guestData = {
        memberId,
        creditsLeft: product.currentQuantity,
        city,
        startDate: product.purchaseDate ? new Date(product.purchaseDate).toISOString() : new Date().toISOString(),
        packageSize: product.initialQuantity,
      };

      if (!existingGuest) {
        // Guest doesn't exist - would create
        if (dryRun) {
          guestsToCreate.push(guestData);
        } else {
          await db.insert(guests).values({
            ...guestData,
            updatedAt: new Date().toISOString(),
          });
          guestsCreated++;
        }
      } else {
        // Guest exists - check if update needed
        const needsUpdate = 
          existingGuest.creditsLeft !== product.currentQuantity ||
          existingGuest.packageSize !== product.initialQuantity ||
          (!existingGuest.city && city); // Also update if we can set city from homeClubId

        if (needsUpdate) {
          if (dryRun) {
            guestsToUpdate.push({
              ...guestData,
              currentCreditsLeft: existingGuest.creditsLeft,
              currentPackageSize: existingGuest.packageSize,
              currentCity: existingGuest.city,
            });
          } else {
            await db.update(guests)
              .set({
                creditsLeft: product.currentQuantity,
                packageSize: product.initialQuantity,
                city: city || existingGuest.city, // Update city if we have it, otherwise keep existing
                updatedAt: new Date().toISOString(),
              })
              .where(eq(guests.memberId, memberId));
            guestsUpdated++;
          }
        }
      }
    }

    // Step 2: Check conversions to Members
    // Get all Members with contracts
    const membersWithContracts = await getAllMembersWithContracts(config);
    console.log(`[Step 2] Found ${membersWithContracts.length} members with contracts`);

    // Create map of memberId -> { contractStartDate, membershipType }
    const membersMap = new Map<string, { startDate: string; membershipType: string }>();
    for (const member of membersWithContracts) {
      if (member.contracts && member.contracts.length > 0) {
        // Get newest contract (already sorted by startDate desc, top 1)
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

    console.log(`[Step 2] Created membersMap with ${membersMap.size} entries`);

    // Get all guests from database to check their convertedAt status
    const allGuests = await db.select()
      .from(guests);

    // Get all trial bookings to check if guests also had a trial
    // This helps determine the correct source for conversions
    const allTrials = await db.select()
      .from(trialBookings);
    
    // Create a map of memberId -> trial record (for checking if guest had a trial)
    const trialsByMemberId = new Map<string, typeof allTrials[0]>();
    for (const trial of allTrials) {
      if (trial.memberId && !trialsByMemberId.has(trial.memberId)) {
        trialsByMemberId.set(trial.memberId, trial);
      }
    }
    
    console.log(`[Step 2] Found ${trialsByMemberId.size} unique trials with memberId`);

    console.log(`[Step 2] Found ${allGuests.length} total guests in database`);

    // Create a set of memberIds from step 1 (guests we're syncing)
    const step1MemberIds = new Set<string>();
    for (const [memberId] of productsByMember) {
      step1MemberIds.add(memberId);
    }

    // Check guests from step 1 (from MemberProducts) to see if they've converted
    // Also check existing guests in database that haven't been converted yet
    const guestsToCheck: Array<{ memberId: string; creditsLeft: number; city: string | null; convertedAt: string | null }> = [];
    
    // Add guests from step 1
    // Create a map of memberId -> city from step 1 products
    const step1CityMap = new Map<string, string | null>();
    for (const [memberId, product] of productsByMember) {
      // Determine city from product data (same logic as step 1)
      let city: string | null = null;
      if (product.Member?.homeClubId) {
        const cityFromClubId = getCityFromHomeClubId(country, product.Member.homeClubId);
        if (cityFromClubId) {
          city = cityFromClubId;
        }
      }
      // Fallback to existing guest city if available
      if (!city) {
        const existingGuest = existingGuestsMap.get(memberId);
        if (existingGuest?.city) {
          const cityCountry = getCountryFromCity(existingGuest.city);
          if (cityCountry === country) {
            city = existingGuest.city;
          }
        }
      }
      step1CityMap.set(memberId, city);
    }
    
    for (const [memberId, product] of productsByMember) {
      const existingGuest = existingGuestsMap.get(memberId);
      const convertedAt = existingGuest?.convertedAt || null;
      
      // Only check if not already converted
      if (!convertedAt) {
        guestsToCheck.push({
          memberId,
          creditsLeft: product.currentQuantity,
          city: step1CityMap.get(memberId) || existingGuest?.city || null,
          convertedAt: null,
        });
      }
    }

    // Also check existing active guests from database that are in this country
    const activeGuestsFromDb = allGuests.filter(guest => {
      if (guest.convertedAt) return false; // Already converted
      if (step1MemberIds.has(guest.memberId)) return false; // Already in step 1 list
      if (!guest.city) return false;
      const guestCountry = getCountryFromCity(guest.city);
      return guestCountry === country;
    });

    // Add existing active guests
    for (const guest of activeGuestsFromDb) {
      guestsToCheck.push({
        memberId: guest.memberId,
        creditsLeft: guest.creditsLeft,
        city: guest.city,
        convertedAt: null,
      });
    }

    console.log(`[Step 2] Checking ${guestsToCheck.length} guests for conversions (${productsByMember.size} from step 1, ${activeGuestsFromDb.length} from database)`);

    const guestsToConvert: any[] = [];
    let guestsConverted = 0;
    let conversionsCreated = 0;

    // Check each guest
    for (const guest of guestsToCheck) {
      const contractData = membersMap.get(guest.memberId);
      
      if (contractData) {
        const { startDate: contractStartDate, membershipType } = contractData;
        console.log(`[Step 2] Found conversion for guest ${guest.memberId} with contract start ${contractStartDate}, type ${membershipType}`);
        // Guest has converted to Member
        if (dryRun) {
          guestsToConvert.push({
            memberId: guest.memberId,
            contractStartDate,
            membershipType,
            currentCreditsLeft: guest.creditsLeft,
          });
        } else {
          // Update guest convertedAt
          await db.update(guests)
            .set({
              convertedAt: contractStartDate,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(guests.memberId, guest.memberId));

          // Get city from guest record
          let cityForConversion = guest.city;
          
          // If guest has no city, try to get it from step 1 city map
          if (!cityForConversion) {
            cityForConversion = step1CityMap.get(guest.memberId) || null;
            if (cityForConversion) {
              // Update the guest record with the city
              await db.update(guests)
                .set({ city: cityForConversion })
                .where(eq(guests.memberId, guest.memberId));
              console.log(`[Step 2] Determined city ${cityForConversion} for guest ${guest.memberId} from step 1 data`);
            }
          }
          
          // Check if conversion already exists
          // Match on memberId, and if city is available, also match on city
          const existingConversionConditions = [
            eq(conversions.memberId, guest.memberId),
            or(
              eq(conversions.membershipType, 'flex'),
              eq(conversions.membershipType, 'loyalty')
            )
          ];
          
          // If we have a city, also filter by city to avoid duplicates between portals
          if (cityForConversion) {
            existingConversionConditions.push(eq(conversions.city, cityForConversion));
          } else {
            // If no city, match conversions without city (backwards compatibility)
            existingConversionConditions.push(isNull(conversions.city));
          }
          
          const existingConversion = await db.select()
            .from(conversions)
            .where(and(...existingConversionConditions))
            .limit(1);

          if (existingConversion.length === 0) {
            // Check if this guest also had a trial
            // If so, the source should be 'trial' with hadCourseStep: true (Trial → Course → Member)
            const hadTrial = trialsByMemberId.has(guest.memberId);
            const trialRecord = hadTrial ? trialsByMemberId.get(guest.memberId) : null;
            
            // Determine source and hadCourseStep
            let source: 'trial' | 'guest' | 'direct' = 'guest';
            let hadCourseStep = false;
            
            if (hadTrial && trialRecord) {
              // Guest had a trial, so path is: Trial → Course (guest) → Member
              source = 'trial';
              hadCourseStep = true; // They had the course step (being a guest)
            } else {
              // Direct guest conversion (no trial)
              source = 'guest';
              hadCourseStep = false;
            }
            
            // Create conversion record
            await db.insert(conversions).values({
              memberId: guest.memberId,
              city: cityForConversion || null, // Allow NULL city for backwards compatibility
              memberSince: contractStartDate,
              membershipType: membershipType,
              source: source,
              hadCourseStep: hadCourseStep,
            });
            conversionsCreated++;
            console.log(`[Step 2] Created conversion for guest ${guest.memberId} (city: ${cityForConversion || 'NULL'}, source: ${source}, hadCourseStep: ${hadCourseStep})`);
          } else {
            console.log(`[Step 2] Conversion already exists for guest ${guest.memberId}`);
          }

          guestsConverted++;
        }
      } else {
        console.log(`[Step 2] No contract found for guest ${guest.memberId} (not in membersMap)`);
      }
    }

    console.log(`[Step 2] Processed ${guestsToCheck.length} guests, found ${dryRun ? guestsToConvert.length : guestsConverted} conversions`);

    // Format response
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        country: countryParam,
        step1: {
          guestsToCreate,
          guestsToUpdate,
          total: guestsToCreate.length + guestsToUpdate.length,
        },
        step2: {
          guestsToConvert,
          total: guestsToConvert.length,
          debug: {
            totalGuests: allGuests.length,
            guestsToCheck: guestsToCheck.length,
            guestsFromStep1: productsByMember.size,
            guestsFromDb: activeGuestsFromDb.length,
            membersWithContracts: membersWithContracts.length,
            membersInMap: membersMap.size,
          },
        },
        summary: {
          guestsToCreate: guestsToCreate.length,
          guestsToUpdate: guestsToUpdate.length,
          guestsToConvert: guestsToConvert.length,
        },
      }, { status: 200 });
    } else {
      return NextResponse.json({
        dryRun: false,
        country: countryParam,
        step1: {
          guestsCreated,
          guestsUpdated,
          total: guestsCreated + guestsUpdated,
        },
        step2: {
          guestsConverted,
          conversionsCreated,
          total: guestsConverted,
          debug: {
            totalGuests: allGuests.length,
            guestsToCheck: guestsToCheck.length,
            guestsFromStep1: productsByMember.size,
            guestsFromDb: activeGuestsFromDb.length,
            membersWithContracts: membersWithContracts.length,
            membersInMap: membersMap.size,
          },
        },
        summary: {
          guestsCreated,
          guestsUpdated,
          guestsConverted,
        },
      }, { status: 200 });
    }

  } catch (error) {
    console.error('Error processing guests sync:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

