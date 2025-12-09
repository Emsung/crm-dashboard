import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guests } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getPerfectGymConfig, getCountryFromCity, checkMemberMembership, getMemberProducts } from '@/lib/perfectgym-utils';

// Events that should trigger credits check
const SUPPORTED_EVENTS = [
  'ClassesBooked',
  'ClassesBookingCancelled',
  'ClassesBookedOnStandbyList',
  'ClassesBookingPromotedFromStandbyList',
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate event type
    if (!body.event || !SUPPORTED_EVENTS.includes(body.event)) {
      return NextResponse.json(
        { error: `Invalid or unsupported event. Expected one of: ${SUPPORTED_EVENTS.join(', ')}` },
        { status: 400 }
      );
    }

    // Extract userId from payload
    const userId = body.data?.userId || body.data?.user?.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId in payload data' },
        { status: 400 }
      );
    }

    const memberId = String(userId);

    // Try to get city from payload or from existing guest record
    let city: string | null = null;
    let country: string | null = null;

    // Check if we have city in payload (might not be present)
    if (body.data?.city) {
      const payloadCity = String(body.data.city);
      city = payloadCity;
      country = getCountryFromCity(payloadCity);
    }

    // If no city in payload, try to get it from existing guest record
    if (!city || !country) {
      const existingGuest = await db.select()
        .from(guests)
        .where(eq(guests.memberId, memberId))
        .limit(1);

      if (existingGuest.length > 0 && existingGuest[0].city) {
        const existingCity = existingGuest[0].city;
        city = existingCity;
        if (existingCity) {
          country = getCountryFromCity(existingCity);
        }
      }
    }

    // If still no country, we can't proceed
    if (!country) {
      console.warn(`[ClassBooked] Could not determine country for memberId ${memberId}. City: ${city || 'unknown'}`);
      return NextResponse.json(
        { error: 'Could not determine country/city for member. Please provide city in payload or ensure guest record exists.' },
        { status: 400 }
      );
    }

    // Get PerfectGym config
    const config = await getPerfectGymConfig(country);
    if (!config) {
      return NextResponse.json(
        { error: `No PerfectGym configuration found for country: ${country}` },
        { status: 500 }
      );
    }

    // First check: Is this member already a Member (not a Guest)?
    const membershipCheck = await checkMemberMembership(config, memberId);
    if (membershipCheck.hasMembership) {
      // Member already has membership, skip credits check
      console.log(`[ClassBooked] Member ${memberId} already has membership, skipping credits check`);
      return NextResponse.json({ 
        success: true, 
        message: 'Member already has membership, credits check skipped',
        hasMembership: true 
      }, { status: 200 });
    }

    // Member is still a Guest, check credits
    const productsResult = await getMemberProducts(config, memberId);
    
    if (productsResult.currentQuantity === null) {
      // No course package found for this member
      console.log(`[ClassBooked] No course package found for memberId ${memberId}`);
      return NextResponse.json({ 
        success: true, 
        message: 'No course package found for this member',
        hasMembership: false,
        creditsLeft: null
      }, { status: 200 });
    }

    const currentCredits = productsResult.currentQuantity;
    const initialQuantity = productsResult.initialQuantity;
    const purchaseDate = productsResult.purchaseDate;

    // Check if guest record exists
    const existingGuest = await db.select()
      .from(guests)
      .where(eq(guests.memberId, memberId))
      .limit(1);

    if (existingGuest.length > 0) {
      // Update existing record if credits changed
      const storedCredits = existingGuest[0].creditsLeft;
      if (storedCredits !== currentCredits) {
        await db.update(guests)
          .set({
            creditsLeft: currentCredits,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(guests.memberId, memberId));

        console.log(`[ClassBooked] Updated credits for memberId ${memberId}: ${storedCredits} -> ${currentCredits}`);
      } else {
        console.log(`[ClassBooked] No change in credits for memberId ${memberId}: ${currentCredits}`);
      }
    } else {
      // Create new guest record if it doesn't exist
      // Use purchaseDate from the newest product as startDate
      const startDate = purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString();
      
      await db.insert(guests).values({
        memberId: memberId,
        creditsLeft: currentCredits,
        city: city || null,
        startDate: startDate,
        packageSize: initialQuantity || 0,
        updatedAt: new Date().toISOString(),
      });

      console.log(`[ClassBooked] Created new guest record for memberId ${memberId} with ${currentCredits} credits, startDate: ${startDate}`);
    }

    return NextResponse.json({ 
      success: true,
      memberId,
      creditsLeft: currentCredits,
      hasMembership: false
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing classbooked webhook:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

