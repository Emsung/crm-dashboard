import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversions } from '@/lib/db/schema';

function mapMembershipType(paymentPlanName: string): string {
    const name = (paymentPlanName || '').toLowerCase();
    
    if (name.includes('loyalty')) {
        return 'loyalty';
    } else if (name.includes('flex')) {
        return 'flex';
    }
    // Default to 'flex' for other membership types
    return 'flex';
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
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

        await db.insert(conversions).values({
            memberId: String(userId),
            memberSince: contractSignDate,
            membershipType: membershipType,
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Error processing conversion webhook:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
