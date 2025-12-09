import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversions, guests } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { determineConversionSource } from '@/lib/conversion-helpers';

export function mapMembershipType(paymentPlanName: string): string {
    const name = (paymentPlanName || '').toLowerCase();
    
    if (name.includes('loyalty')) {
        return 'loyalty';
    } else if (name.includes('flex')) {
        return 'flex';
    }
    // Default to 'flex' for other membership types
    return 'flex';
}

export async function handleContractCreated(body: any): Promise<NextResponse> {
    try {
        // Validate PerfectGym ContractCreated webhook payload
        if (body.event !== 'ContractCreated' || !body.data) {
            return NextResponse.json(
                { error: 'Invalid payload format. Expected ContractCreated event with data object' },
                { status: 400 }
            );
        }

        const { userId, contractSignDate, paymentPlanName } = body.data;

        if (!userId || !contractSignDate || !paymentPlanName) {
            return NextResponse.json(
                { error: 'Missing required fields: userId, contractSignDate, or paymentPlanName' },
                { status: 400 }
            );
        }

        const membershipType = mapMembershipType(paymentPlanName);
        const memberId = String(userId);

        // Determine conversion source and course step
        const conversionSource = await determineConversionSource(memberId);

        // City is required - if we can't determine it, we can't create the conversion
        if (!conversionSource.city) {
            console.error(`[Conversion Webhook] Could not determine city for memberId ${memberId}`);
            return NextResponse.json(
                { error: 'Could not determine city for member. Please ensure member exists in guests or trialBookings table.' },
                { status: 400 }
            );
        }

        await db.insert(conversions).values({
            memberId: memberId,
            city: conversionSource.city,
            memberSince: contractSignDate,
            membershipType: membershipType,
            source: conversionSource.source,
            hadCourseStep: conversionSource.hadCourseStep,
        });

        // Update guests table if this member was a guest (set converted_at)
        // Only update if membershipType is 'flex' or 'loyalty' (not 'course')
        if (membershipType === 'flex' || membershipType === 'loyalty') {
            await db.update(guests)
                .set({
                    convertedAt: contractSignDate,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(guests.memberId, memberId));
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Error processing conversion webhook:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

