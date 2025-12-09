'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import GuestsOverview from "@/components/Dashboard/GuestsOverview";
import GuestsAnalytics from "@/components/Dashboard/GuestsAnalytics";

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

interface GuestsData {
    totalGuests: number;
    activeGuests: number;
    convertedGuests: number;
    lowCreditsGuests: number;
    conversionRate: number;
    package10Count: number;
    package16Count: number;
    avgCredits: number;
    totalCreditsInUse: number;
    allGuests: Guest[];
    activeGuestsList: Guest[];
    lowCreditsGuestsList: Guest[];
    convertedGuestsList: Guest[];
    guestsWithConversionDetails: any[];
}

interface GuestsWrapperProps {
    data: GuestsData;
}

type Period = 'all' | 'current-month' | 'last-month' | 'last-3-months' | 'this-year' | 'last-year' | 'custom';

export default function GuestsWrapper({ data }: GuestsWrapperProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const periodFromUrl = searchParams.get('period') as Period | null;
    const [period, setPeriod] = useState<Period>(periodFromUrl || 'all');
    const [customStartDate, setCustomStartDate] = useState(searchParams.get('startDate') || '');
    const [customEndDate, setCustomEndDate] = useState(searchParams.get('endDate') || '');
    
    useEffect(() => {
        const urlPeriod = searchParams.get('period') as Period | null;
        if (urlPeriod && ['all', 'current-month', 'last-month', 'last-3-months', 'this-year', 'last-year', 'custom'].includes(urlPeriod)) {
            setPeriod(urlPeriod);
        }
        const urlStartDate = searchParams.get('startDate');
        const urlEndDate = searchParams.get('endDate');
        if (urlStartDate) setCustomStartDate(urlStartDate);
        if (urlEndDate) setCustomEndDate(urlEndDate);
    }, [searchParams]);

    const dateRange = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        let start = new Date(0);
        let end = new Date(today);

        if (period === 'custom' && customStartDate && customEndDate) {
            start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'current-month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
        } else if (period === 'last-month') {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        } else if (period === 'last-3-months') {
            start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        } else if (period === 'this-year') {
            start = new Date(today.getFullYear(), 0, 1);
        } else if (period === 'last-year') {
            start = new Date(today.getFullYear() - 1, 0, 1);
            end = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        }

        return { start, end };
    }, [period, customStartDate, customEndDate]);

    const updateCustomDates = (start: string, end: string) => {
        setCustomStartDate(start);
        setCustomEndDate(end);
        const params = new URLSearchParams(window.location.search);
        params.set('period', 'custom');
        if (start) params.set('startDate', start);
        if (end) params.set('endDate', end);
        window.history.pushState({}, '', `${pathname}?${params.toString()}`);
    };
    
    const periodButtons = [
        { value: 'all' as Period, label: 'All Time' },
        { value: 'this-year' as Period, label: 'This Year' },
        { value: 'last-year' as Period, label: 'Last Year' },
        { value: 'last-3-months' as Period, label: 'Last 3 Months' },
        { value: 'custom' as Period, label: 'Custom' },
    ];

    return (
        <div className="space-y-6">
            {/* Period Selector */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex gap-4 items-center flex-wrap">
                    <span className="text-sm font-medium text-gray-700">Period:</span>
                    <div className="flex gap-2 flex-wrap">
                        {periodButtons.map((btn) => (
                            <button
                                key={btn.value}
                                onClick={() => setPeriod(btn.value)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    period === btn.value
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {period === 'custom' && (
                        <div className="flex gap-2 items-center">
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => updateCustomDates(e.target.value, customEndDate)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-gray-500 text-sm">to</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => updateCustomDates(customStartDate, e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Overview Cards */}
            <GuestsOverview
                data={data}
                guests={data.allGuests}
                conversions={data.guestsWithConversionDetails}
                period={period}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
                dateRange={dateRange}
            />

            {/* Analytics */}
            <GuestsAnalytics
                guests={data.allGuests}
                conversions={data.guestsWithConversionDetails}
                period={period}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
            />
        </div>
    );
}
