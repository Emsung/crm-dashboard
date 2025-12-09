import { NextRequest, NextResponse } from 'next/server';
import { syncTrials } from './handlers/trials';
import { syncGuests } from './handlers/guests';
import { syncAll } from './handlers/all';

const SYNC_TYPES = ['trials', 'guests', 'all'] as const;
type SyncType = typeof SYNC_TYPES[number];

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as SyncType | null;
    const country = searchParams.get('country'); // nl, de, ch, at
    const execute = searchParams.get('execute') === 'true';
    const dryRun = !execute; // Default to dry run unless execute=true

    // Validate type
    if (!type || !SYNC_TYPES.includes(type)) {
      return NextResponse.json(
        { 
          error: `Invalid or missing 'type' parameter. Must be one of: ${SYNC_TYPES.join(', ')}`,
          supportedTypes: SYNC_TYPES
        },
        { status: 400 }
      );
    }

    // Validate country (required for guests and all)
    if ((type === 'guests' || type === 'all') && !country) {
      return NextResponse.json(
        { error: `Missing 'country' parameter. Required for type: ${type}` },
        { status: 400 }
      );
    }

    // Route to appropriate handler
    switch (type) {
      case 'trials':
        return await syncTrials({ dryRun });
      
      case 'guests':
        if (!country) {
          return NextResponse.json(
            { error: 'Country parameter required for guests sync' },
            { status: 400 }
          );
        }
        return await syncGuests({ country, dryRun });
      
      case 'all':
        if (!country) {
          return NextResponse.json(
            { error: 'Country parameter required for all sync' },
            { status: 400 }
          );
        }
        return await syncAll({ country, dryRun });
      
      default:
        return NextResponse.json(
          { error: `Unsupported sync type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in sync/all:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

