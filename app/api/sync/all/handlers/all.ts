import { NextResponse } from 'next/server';
import { syncTrials } from './trials';
import { syncGuests } from './guests';

export async function syncAll(options: { country: string; dryRun?: boolean }): Promise<NextResponse> {
  const { country, dryRun = true } = options;
  
  try {
    // Run trials sync first
    console.log('[Sync All] Starting trials sync...');
    const trialsResult = await syncTrials({ dryRun });
    const trialsData = await trialsResult.json();
    
    // Run guests sync
    console.log('[Sync All] Starting guests sync...');
    const guestsResult = await syncGuests({ country, dryRun });
    const guestsData = await guestsResult.json();
    
    // Combine results
    return NextResponse.json({
      success: true,
      dryRun,
      country,
      trials: trialsData,
      guests: guestsData,
      summary: {
        trials: {
          conversionsFound: trialsData.conversionsFound || 0,
          conversionsCreated: trialsData.conversionsCreated || 0,
        },
        guests: {
          guestsCreated: guestsData.step1?.guestsCreated || guestsData.step1?.guestsToCreate?.length || 0,
          guestsUpdated: guestsData.step1?.guestsUpdated || guestsData.step1?.guestsToUpdate?.length || 0,
          guestsConverted: guestsData.step2?.guestsConverted || guestsData.step2?.guestsToConvert?.length || 0,
          conversionsCreated: guestsData.step2?.conversionsCreated || 0,
        },
      },
    }, { status: 200 });
  } catch (error) {
    console.error('Error processing all sync:', error);
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

