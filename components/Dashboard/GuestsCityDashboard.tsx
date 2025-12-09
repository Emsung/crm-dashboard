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

interface Conversion {
    memberId: string;
    memberSince: string;
    membershipType: string;
    startDate?: string | null;
    convertedAt?: string | null;
}

interface GuestsCityDashboardProps {
    cityName: string;
    allGuests: Guest[];
    allConversions: Conversion[];
}

type Period = 'all' | 'current-month' | 'last-month' | 'last-3-months' | 'this-year' | 'last-year' | 'custom';

export default function GuestsCityDashboard({ cityName, allGuests, allConversions }: GuestsCityDashboardProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const periodFromUrl = searchParams.get('period') as Period | null;
    const [period, setPeriod] = useState<Period>(periodFromUrl || 'all');
    const [customStartDate, setCustomStartDate] = useState(searchParams.get('startDate') || '');
    const [customEndDate, setCustomEndDate] = useState(searchParams.get('endDate') || '');
    
    // Update period when URL changes
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

    // Normalize city names for comparison
    const normalizeCityName = (name: string): string => {
        const normalized = name.toLowerCase().trim();
        if (normalized === 'antwerp' || normalized === 'antwerpen') return 'antwerpen';
        return normalized;
    };

    const cityNameNormalized = normalizeCityName(cityName);

    // Filter guests for this city
    const cityGuests = useMemo(() => {
        if (cityName === 'All Cities') {
            return allGuests;
        }
        return allGuests.filter(guest => {
            if (!guest.city) return false;
            return normalizeCityName(guest.city) === cityNameNormalized;
        });
    }, [allGuests, cityName, cityNameNormalized]);

    // Filter conversions for this city
    const cityConversions = useMemo(() => {
        if (cityName === 'All Cities') {
            return allConversions;
        }
        return allConversions.filter(conv => {
            const guest = allGuests.find(g => g.memberId === conv.memberId);
            if (guest && guest.city) {
                return normalizeCityName(guest.city) === cityNameNormalized;
            }
            return false;
        });
    }, [allConversions, allGuests, cityName, cityNameNormalized]);

    // Calculate date ranges for period filtering
    const dateRange = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        let start = new Date(0);
        let end = new Date(today);

        if (period === 'all') {
            start = new Date(0);
            end = new Date(today);
        } else if (period === 'custom' && customStartDate && customEndDate) {
            start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'current-month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
        } else if (period === 'last-month') {
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        } else if (period === 'last-3-months') {
            start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
            start.setHours(0, 0, 0, 0);
        } else if (period === 'this-year') {
            start = new Date(today.getFullYear(), 0, 1);
            start.setHours(0, 0, 0, 0);
        } else if (period === 'last-year') {
            start = new Date(today.getFullYear() - 1, 0, 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        }

        return { start, end };
    }, [period, customStartDate, customEndDate]);

    // Calculate city-specific metrics
    const cityMetrics = useMemo(() => {
        const activeGuests = cityGuests.filter(g => !g.convertedAt && g.creditsLeft > 0);
        const convertedGuests = cityGuests.filter(g => g.convertedAt !== null);
        const lowCreditsGuests = activeGuests.filter(g => g.creditsLeft <= 3);
        
        const overallConversionRate = cityGuests.length > 0 
            ? (convertedGuests.length / cityGuests.length) * 100 
            : 0;

        const avgCredits = activeGuests.length > 0
            ? activeGuests.reduce((sum, g) => sum + g.creditsLeft, 0) / activeGuests.length
            : 0;

        const totalCreditsInUse = activeGuests.reduce((sum, g) => sum + g.creditsLeft, 0);
        const package10Count = cityGuests.filter(g => g.packageSize === 10).length;
        const package16Count = cityGuests.filter(g => g.packageSize === 16).length;

        return {
            totalGuests: cityGuests.length,
            activeGuests: activeGuests.length,
            convertedGuests: convertedGuests.length,
            lowCreditsGuests: lowCreditsGuests.length,
            conversionRate: overallConversionRate,
            package10Count,
            package16Count,
            avgCredits: Math.round(avgCredits * 100) / 100,
            totalCreditsInUse,
        };
    }, [cityGuests]);

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
                data={cityMetrics}
                guests={cityGuests}
                conversions={cityConversions}
                period={period}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
                dateRange={dateRange}
            />

            {/* Analytics */}
            <GuestsAnalytics
                guests={cityGuests}
                conversions={cityConversions}
                period={period}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
            />
        </div>
    );
}
