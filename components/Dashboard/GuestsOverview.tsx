'use client';

import { useMemo } from 'react';

interface Guest {
    id: number;
    memberId: string;
    creditsLeft: number;
    city: string | null;
    startDate: string | null;
    packageSize: number;
    convertedAt: string | null;
    createdAt: string;
}

interface Conversion {
    memberId: string;
    memberSince: string;
    membershipType: string;
}

type Period = 'all' | 'current-month' | 'last-month' | 'last-3-months' | 'this-year' | 'last-year' | 'custom';

interface GuestsOverviewProps {
    data: {
        totalGuests: number;
        activeGuests: number;
        convertedGuests: number;
        lowCreditsGuests: number;
        conversionRate: number;
        package10Count: number;
        package16Count: number;
        avgCredits: number;
        totalCreditsInUse: number;
        newGuestsInPeriod?: number;
        convertedGuestsInPeriod?: number;
        matureGuests?: number;
        matureGuestsConverted?: number;
        matureConversionRate?: number;
        overallConversionRate?: number;
    };
    guests: Guest[];
    conversions: Conversion[];
    period: Period;
    customStartDate?: string;
    customEndDate?: string;
    dateRange?: { start: Date; end: Date };
}

export default function GuestsOverview({
    data,
    guests,
    period,
    customStartDate,
    customEndDate,
}: GuestsOverviewProps) {
    // Calculate date ranges
    const currentRange = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        let currentStart = new Date(0);
        let currentEnd = new Date(today);

        if (period === 'all') {
            currentStart = new Date(0);
            currentEnd = new Date(today);
        } else if (period === 'custom' && customStartDate && customEndDate) {
            currentStart = new Date(customStartDate);
            currentStart.setHours(0, 0, 0, 0);
            currentEnd = new Date(customEndDate);
            currentEnd.setHours(23, 59, 59, 999);
        } else if (period === 'current-month') {
            currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
            currentStart.setHours(0, 0, 0, 0);
        } else if (period === 'last-month') {
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            currentStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
            currentStart.setHours(0, 0, 0, 0);
            currentEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        } else if (period === 'last-3-months') {
            currentStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
            currentStart.setHours(0, 0, 0, 0);
        } else if (period === 'this-year') {
            currentStart = new Date(today.getFullYear(), 0, 1);
            currentStart.setHours(0, 0, 0, 0);
        } else if (period === 'last-year') {
            currentStart = new Date(today.getFullYear() - 1, 0, 1);
            currentStart.setHours(0, 0, 0, 0);
            currentEnd = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        }

        return { start: currentStart, end: currentEnd };
    }, [period, customStartDate, customEndDate]);

    // Filter guests by period
    const currentPeriodGuests = useMemo(() => {
        return guests.filter(guest => {
            const date = guest.startDate ? new Date(guest.startDate) : new Date(guest.createdAt);
            return date >= currentRange.start && date <= currentRange.end;
        });
    }, [guests, currentRange]);

    // Calculate period-specific metrics
    const periodMetrics = useMemo(() => {
        const activeGuests = currentPeriodGuests.filter(g => !g.convertedAt && g.creditsLeft > 0);
        const lowCreditsGuests = activeGuests.filter(g => g.creditsLeft <= 3);

        const avgCredits = activeGuests.length > 0
            ? activeGuests.reduce((sum, g) => sum + g.creditsLeft, 0) / activeGuests.length
            : 0;

        return {
            activeGuests: activeGuests.length,
            lowCreditsGuests: lowCreditsGuests.length,
            avgCredits: Math.round(avgCredits * 100) / 100,
        };
    }, [currentPeriodGuests]);

    // Use period metrics if we have period data
    const displayMetrics = currentPeriodGuests.length > 0 ? periodMetrics : {
        activeGuests: data.activeGuests,
        lowCreditsGuests: data.lowCreditsGuests,
        avgCredits: data.avgCredits,
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Active Guests */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-500">Active Guests</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{displayMetrics.activeGuests.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">with credits remaining</p>
            </div>

            {/* Low Credits (Hot Leads) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-500">Low Credits</p>
                <p className="text-3xl font-bold text-orange-500 mt-1">{displayMetrics.lowCreditsGuests.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">guests with ≤3 credits</p>
            </div>

            {/* Average Credits */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-500">Avg Credits Remaining</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{displayMetrics.avgCredits.toFixed(1)}</p>
                <p className="text-sm text-gray-500 mt-1">per active guest</p>
            </div>
        </div>
    );
}
