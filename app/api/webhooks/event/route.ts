import { NextResponse } from 'next/server';
import { handleContractCreated } from './handlers/conversion';
import { handleClassBooked } from './handlers/classbooked';
import { handlePurchase } from './handlers/purchase';

// Supported event types and their handlers
const EVENT_HANDLERS: Record<string, (body: any) => Promise<NextResponse>> = {
  'ContractCreated': handleContractCreated,
  'ClassesBooked': handleClassBooked,
  'ClassesBookingCancelled': handleClassBooked,
  'ClassesBookedOnStandbyList': handleClassBooked,
  'ClassesBookingPromotedFromStandbyList': handleClassBooked,
  'Purchase': handlePurchase,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.event) {
      return NextResponse.json(
        { 
          error: 'Missing event type in payload',
          supportedEvents: Object.keys(EVENT_HANDLERS)
        },
        { status: 400 }
      );
    }

    const handler = EVENT_HANDLERS[body.event];
    
    if (!handler) {
      return NextResponse.json(
        { 
          error: `Unsupported event type: ${body.event}`,
          supportedEvents: Object.keys(EVENT_HANDLERS)
        },
        { status: 400 }
      );
    }

    return await handler(body);
  } catch (error) {
    console.error('Error processing webhook event:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

