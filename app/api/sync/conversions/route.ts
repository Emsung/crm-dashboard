import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trialBookings, conversions } from '@/lib/db/schema';
import { eq, and, isNull, isNotNull, notInArray, sql } from 'drizzle-orm';

// Platform configurations with API credentials
const platforms = {
  DE: {
    clientId: '9591d82ffbc24ee18f4bbe7e3e92c59b',
    clientSecret: 'a1a5b237f34e4140ab89a81479f2a1c5118a2aa2cced409fba41076c7beb7813',
    apiUrl: 'https://12rounds-de.perfectgym.com',
  },
  NL: {
    clientId: 'e8e27a49fb4e425e9e293aa81c194b57',
    clientSecret: 'cbb6487180e34ec3bdecf7a8cbbdd3212e98086b421d4ed4b5870a59d5c8b7d5',
    apiUrl: 'https://boxingcommunity.perfectgym.com',
  },
  CH: {
    clientId: '830c954215e646b8ba07320b632f39d8',
    clientSecret: '484d3e59a7724bb99a0e999fa35d2324106cab1022b84ecdbe99379b09eaff54',
    apiUrl: 'https://12rounds-ch.perfectgym.com',
  },
  AT: {
    clientId: '94783152f4894e7cb6a1a5937ef350c1',
    clientSecret: '3966290bcd7742ec85f71d0f26dea9e987c646763f834c9eb558c6b1699896df',
    apiUrl: 'https://12rounds-at.perfectgym.com',
  },
} as const;

type Platform = keyof typeof platforms;

// Map country codes to platform codes
const countryToPlatform: Record<string, Platform> = {
  'NL': 'NL',
  'DE': 'DE',
  'CH': 'CH',
  'AT': 'AT',
  // Add more mappings as needed
};

interface PerfectGymConfig {
  clientId: string;
  clientSecret: string;
  apiUrl: string;
}

async function getPerfectGymConfig(country: string): Promise<PerfectGymConfig | null> {
  const platform = countryToPlatform[country];
  if (!platform) {
    console.warn(`Unknown country code: ${country}`);
    return null;
  }

  const platformConfig = platforms[platform];
  if (!platformConfig) {
    console.warn(`No platform config found for: ${platform}`);
    return null;
  }

  return {
    clientId: platformConfig.clientId,
    clientSecret: platformConfig.clientSecret,
    apiUrl: platformConfig.apiUrl,
  };
}

async function checkMemberMembership(
  config: PerfectGymConfig,
  memberId: string
): Promise<{ hasMembership: boolean; membershipType?: string; memberSince?: string }> {
  try {
    // Check for active contracts (memberships)
    // Contracts represent memberships in PerfectGym API
    // Expand PaymentPlan to get membership type information
    const contractsUrl = `${config.apiUrl}/Api/v2.2/odata/Contracts?$filter=MemberId eq ${memberId} and IsActive eq true&$expand=PaymentPlan($expand=MembershipType)&$orderby=StartDate desc&$top=1`;
    
    console.log(`[Check Membership] Checking member ${memberId} at: ${contractsUrl}`);
    
    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(contractsUrl, {
      headers: {
        'x-Client-id': config.clientId,
        'x-Client-Secret': config.clientSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        // 404 could mean member doesn't exist or has no contracts
        // This is not necessarily an error - just means no membership found
        console.log(`[Check Membership] No contracts found for member ${memberId} (404)`);
      } else {
        console.error(`[Check Membership] Failed to fetch contracts for member ${memberId}: ${response.status} ${response.statusText}`);
        const errorText = await response.text().catch(() => '');
        console.error(`[Check Membership] Error response: ${errorText}`);
      }
      return { hasMembership: false };
    }

    const data = await response.json();
    
    if (data && data.value && data.value.length > 0) {
      const contract = data.value[0];
      const paymentPlan = contract.PaymentPlan || contract.paymentPlan;
      const membershipTypeObj = paymentPlan?.MembershipType || paymentPlan?.membershipType;
      const paymentPlanName = (paymentPlan?.Name || paymentPlan?.name || '').toLowerCase();
      const membershipTypeName = (membershipTypeObj?.Name || membershipTypeObj?.name || '').toLowerCase();
      
      // Determine membership type: check payment plan name first (more reliable), then membership type name
      let membershipType = 'flex'; // default
      
      if (paymentPlanName.includes('loyalty') || membershipTypeName.includes('loyalty')) {
        membershipType = 'loyalty';
      } else if (paymentPlanName.includes('flex') || membershipTypeName.includes('flex')) {
        membershipType = 'flex';
      }
      // Note: "Open" membership type might also indicate loyalty in some systems
      // Adjust based on your business logic

      return {
        hasMembership: true,
        membershipType,
        memberSince: contract.StartDate || contract.startDate,
      };
    }

    return { hasMembership: false };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Timeout checking membership for member ${memberId}`);
    } else {
      console.error(`Error checking membership for member ${memberId}:`, error);
    }
    return { hasMembership: false };
  }
}

async function checkMemberPurchase(
  config: PerfectGymConfig,
  memberId: string
): Promise<{ hasPurchase: boolean; purchaseDate?: string; productName?: string }> {
  try {
    // Check for product purchases (beginners package)
    // Get all purchases and expand product to check if it's a beginners package
    const purchasesUrl = `${config.apiUrl}/Api/v2.2/odata/MemberProducts?$filter=MemberId eq ${memberId}&$expand=Product&$orderby=PurchaseDate desc`;
    
    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(purchasesUrl, {
      headers: {
        'x-Client-id': config.clientId,
        'x-Client-Secret': config.clientSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Failed to fetch purchases for member ${memberId}: ${response.status}`);
      return { hasPurchase: false };
    }

    const data = await response.json();
    
    if (data && data.value && data.value.length > 0) {
      // Check if any purchase is for a beginners package
      for (const purchase of data.value) {
        const productName = (purchase.Product?.Name || purchase.product?.name || '').toLowerCase();
        const initialQuantity = purchase.InitialQuantity || purchase.initialQuantity;
        
        // Exclude trial class products
        if (
          productName.includes('trial') ||
          productName === 'trial class'
        ) {
          continue; // Skip trial products
        }

        // Check for beginners package: products with initialQuantity of 10 or 16
        if (initialQuantity === 10 || initialQuantity === 16) {
          return {
            hasPurchase: true,
            purchaseDate: purchase.PurchaseDate || purchase.purchaseDate,
            productName: purchase.Product?.Name || purchase.product?.name || 'Beginners Package',
          };
        }
      }
    }

    return { hasPurchase: false };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Timeout checking purchase for member ${memberId}`);
    } else {
      console.error(`Error checking purchase for member ${memberId}:`, error);
    }
    return { hasPurchase: false };
  }
}

export async function GET() {
  const startTime = Date.now();
  console.log('[Sync Conversions] Starting sync...');
  
  try {
    // Get all trial bookings that have a memberId but no conversion yet
    console.log('[Sync Conversions] Fetching existing conversions...');
    const existingConversions = await db.select({ memberId: conversions.memberId })
      .from(conversions);

    const existingMemberIds = existingConversions.map(c => c.memberId).filter(Boolean);
    console.log(`[Sync Conversions] Found ${existingMemberIds.length} existing conversions`);

    // Build the where condition
    const conditions = [isNotNull(trialBookings.memberId)];
    
    if (existingMemberIds.length > 0) {
      conditions.push(notInArray(trialBookings.memberId, existingMemberIds));
    }

    console.log('[Sync Conversions] Fetching trials to check...');
    const trialsToCheck = await db.select()
      .from(trialBookings)
      .where(and(...conditions));

    console.log(`[Sync Conversions] Found ${trialsToCheck.length} trials to check`);

    if (trialsToCheck.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No trials to check',
        conversionsFound: 0,
        conversionsCreated: 0,
      });
    }

    // Limit processing to prevent timeouts (process max 50 at a time)
    const maxTrials = 999;
    const trialsToProcess = trialsToCheck.slice(0, maxTrials);
    
    if (trialsToCheck.length > maxTrials) {
      console.log(`[Sync Conversions] Limiting to first ${maxTrials} trials (out of ${trialsToCheck.length})`);
    }

    let conversionsFound = 0;
    let conversionsCreated = 0;
    const errors: string[] = [];

    // Process each trial booking
    for (let i = 0; i < trialsToProcess.length; i++) {
      const trial = trialsToProcess[i];
      console.log(`[Sync Conversions] Processing trial ${i + 1}/${trialsToProcess.length} (memberId: ${trial.memberId})`);
      if (!trial.memberId || !trial.country) {
        continue;
      }

      const config = await getPerfectGymConfig(trial.country);
      if (!config) {
        errors.push(`No API config found for country: ${trial.country} (memberId: ${trial.memberId})`);
        continue;
      }

      // Check for existing conversions (can have both course and membership)
      const existingConversions = await db.select()
        .from(conversions)
        .where(eq(conversions.memberId, trial.memberId));

      const hasCourseConversion = existingConversions.some(c => c.membershipType === 'course');
      const hasMembershipConversion = existingConversions.some(c => c.membershipType === 'flex' || c.membershipType === 'loyalty');

      // If they already have a membership, skip entirely (fully converted)
      if (hasMembershipConversion) {
        continue;
      }

      // Check for membership first (highest priority - everyone should become a member)
      // This handles: Trial → Member OR Course → Member
      const membershipCheck = await checkMemberMembership(config, trial.memberId);
      
      if (membershipCheck.hasMembership && membershipCheck.memberSince) {
        conversionsFound++;
        try {
          // Create new membership conversion
          await db.insert(conversions).values({
            memberId: trial.memberId,
            memberSince: membershipCheck.memberSince,
            membershipType: membershipCheck.membershipType || 'flex',
          });
          conversionsCreated++;
          if (hasCourseConversion) {
            console.log(`[Sync Conversions] Created membership conversion for course participant ${trial.memberId} (Course → Member)`);
          } else {
            console.log(`[Sync Conversions] Created membership conversion for ${trial.memberId} (Trial → Member)`);
          }
          continue; // Skip course check if membership found
        } catch (error) {
          errors.push(`Failed to create membership conversion for member ${trial.memberId}: ${error}`);
          continue;
        }
      }

      // If no membership and no course conversion yet, check for purchase (beginners package)
      // Once someone has a course conversion, we only check for membership (course → member)
      if (!hasCourseConversion) {
        const purchaseCheck = await checkMemberPurchase(config, trial.memberId);
        
        if (purchaseCheck.hasPurchase && purchaseCheck.purchaseDate) {
          conversionsFound++;
          try {
            // For purchase conversions (beginners package), use the purchase date
            // and set membershipType to 'course' to distinguish from direct memberships
            await db.insert(conversions).values({
              memberId: trial.memberId,
              memberSince: purchaseCheck.purchaseDate,
              membershipType: 'course', // Course participant (beginners package purchase) - Trial → Course
            });
            conversionsCreated++;
            console.log(`[Sync Conversions] Created course conversion for ${trial.memberId} (Trial → Course)`);
          } catch (error) {
            errors.push(`Failed to create conversion for purchase ${trial.memberId}: ${error}`);
          }
        }
      } else {
        // They have a course conversion but no membership yet
        // We already checked for membership above, so nothing more to do
        // Next sync will check again for course → member upgrade
        console.log(`[Sync Conversions] Member ${trial.memberId} has course conversion, waiting for membership upgrade`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Sync Conversions] Completed in ${duration}s - Found: ${conversionsFound}, Created: ${conversionsCreated}`);
    
    return NextResponse.json({
      success: true,
      message: `Checked ${trialsToProcess.length} trials${trialsToCheck.length > maxTrials ? ` (${trialsToCheck.length - maxTrials} remaining)` : ''}`,
      conversionsFound,
      conversionsCreated,
      trialsChecked: trialsToProcess.length,
      trialsRemaining: Math.max(0, trialsToCheck.length - maxTrials),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[Sync Conversions] Error after ${duration}s:`, error);
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

