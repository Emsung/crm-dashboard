import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guests } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCountryFromCity } from '@/lib/perfectgym-utils';

export async function handlePurchase(body: any): Promise<NextResponse> {
  try {
    // For Purchase events, the body structure might be different
    // Support both direct body format and nested data format
    const data = body.data || body;
    
    // Validate required fields
    const { memberId, city, start_date, credits } = data;

    if (!memberId) {
      return NextResponse.json(
        { error: 'Missing required field: memberId' },
        { status: 400 }
      );
    }

    if (!city) {
      return NextResponse.json(
        { error: 'Missing required field: city' },
        { status: 400 }
      );
    }

    if (!start_date) {
      return NextResponse.json(
        { error: 'Missing required field: start_date' },
        { status: 400 }
      );
    }

    if (!credits || (credits !== 10 && credits !== 16)) {
      return NextResponse.json(
        { error: 'Missing or invalid credits field. Must be 10 or 16' },
        { status: 400 }
      );
    }

    // Validate country can be determined from city
    const country = getCountryFromCity(city);
    if (!country) {
      return NextResponse.json(
        { error: `Unknown city: ${city}. Cannot determine country.` },
        { status: 400 }
      );
    }

    const memberIdString = String(memberId);
    const startDateISO = new Date(start_date).toISOString();

    // Check if guest record already exists
    const existingGuest = await db.select()
      .from(guests)
      .where(eq(guests.memberId, memberIdString))
      .limit(1);

    if (existingGuest.length > 0) {
      // Update existing record
      await db.update(guests)
        .set({
          creditsLeft: credits,
          city: city,
          startDate: startDateISO,
          packageSize: credits,
          updatedAt: new Date().toISOString(),
          // Reset converted_at if it was set (new package purchase)
          convertedAt: null,
        })
        .where(eq(guests.memberId, memberIdString));

      console.log(`[Purchase] Updated guest record for memberId ${memberIdString}: new package with ${credits} credits`);
    } else {
      // Create new record
      await db.insert(guests).values({
        memberId: memberIdString,
        creditsLeft: credits,
        city: city,
        startDate: startDateISO,
        packageSize: credits,
        updatedAt: new Date().toISOString(),
      });

      console.log(`[Purchase] Created new guest record for memberId ${memberIdString} with ${credits} credits`);
    }

    return NextResponse.json({ 
      success: true,
      memberId: memberIdString,
      credits: credits,
      city: city,
      country: country
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing purchase webhook:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

