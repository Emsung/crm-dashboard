'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Overview from "@/components/Dashboard/Overview";
import AnalyticsCharts from "@/components/Dashboard/AnalyticsCharts";
import ConversionsTable from "@/components/Dashboard/ConversionsTable";

interface Lead {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    city: string;
    country: string;
    className: string | null;
    classDate: string | null;
    classTime: string | null;
    memberId: string | null;
    attended: boolean | null;
    createdAt: string;
}

interface Conversion {
    id: number;
    memberId: string;
    country?: string | null;
    memberSince: string | null;
    membershipType: string | null;
    createdAt: string;
    firstName?: string | null;
    lastName?: string | null;
    city?: string | null;
    trialDate?: string | null; // Trial date (from trialBookings.createdAt)
}

interface CityDashboardProps {
    cityName: string;
    leads: Lead[];
    allConversions: Conversion[];
}

type Period = 'all' | 'current-month' | 'last-month' | 'last-3-months' | 'this-year' | 'last-year' | 'custom';

export default function CityDashboard({ cityName, leads, allConversions }: CityDashboardProps) {
    const searchParams = useSearchParams();
    const periodFromUrl = searchParams.get('period') as Period | null;
    const [period, setPeriod] = useState<Period>(periodFromUrl || 'current-month');
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

    // Filter conversions for this city
    // Filter by city first, then match details from leads
    // Normalize city names for comparison (handle "antwerp" vs "antwerpen", etc.)
    const normalizeCityName = (name: string): string => {
        const normalized = name.toLowerCase().trim();
        // Handle common variations
        if (normalized === 'antwerp' || normalized === 'antwerpen') return 'antwerpen';
        return normalized;
    };
    
    const cityNameNormalized = normalizeCityName(cityName);
    
    // Create a map of memberId to lead for this city (for getting details and verification)
    const cityLeadsByMemberId = useMemo(() => {
        const map = new Map<string, Lead>();
        leads.forEach(lead => {
            if (lead.memberId) {
                // Only keep the first lead for each memberId (they should all be from same city anyway)
                if (!map.has(lead.memberId)) {
                    map.set(lead.memberId, lead);
                }
            }
        });
        return map;
    }, [leads]);
    
    const cityConversions = useMemo(() => {
        // First, filter conversions by city (primary filter)
        // Match on both memberId and country to differentiate between portals
        // If city field is missing, also check if memberId+country exists in this city's leads
        const conversionsForCity = allConversions.filter(conversion => {
            // If conversion has a city field, use it as the primary filter (with normalization)
            if (conversion.city) {
                return normalizeCityName(conversion.city) === cityNameNormalized;
            }
            
            // If no city field, check if memberId exists in this city's leads
            // Also check city if available to ensure we match the right portal
            const matchingLead = cityLeadsByMemberId.get(conversion.memberId);
            if (matchingLead) {
                // If conversion has city, it should match the lead's city
                if (conversion.city && matchingLead.city) {
                    return normalizeCityName(conversion.city) === normalizeCityName(matchingLead.city);
                }
                // If no city in conversion, assume it matches (for backwards compatibility)
                return true;
            }
            return false;
        });
        
        // Then, enrich with details from leads (for name, trial date, etc.) and ensure city is correct
        return conversionsForCity.map(conversion => {
            const matchingLead = cityLeadsByMemberId.get(conversion.memberId);
            if (matchingLead) {
                // Use details from the lead to ensure we have the correct information
                return {
                    ...conversion,
                    city: matchingLead.city, // Always use city from lead (most reliable)
                    firstName: matchingLead.firstName || conversion.firstName,
                    lastName: matchingLead.lastName || conversion.lastName,
                    trialDate: matchingLead.createdAt || conversion.trialDate // Add trial date from lead
                };
            }
            // If no matching lead found but conversion passed city filter, return as-is
            return conversion;
        });
    }, [allConversions, cityLeadsByMemberId, cityNameNormalized]);

    // Prepare data structure for Overview component
    const dashboardData = useMemo(() => {
        return {
            activeLeads: leads.length,
            totalConversions: cityConversions.length,
            conversionRate: leads.length > 0 ? (cityConversions.length / leads.length) * 100 : 0,
            recentConversions: cityConversions.slice(0, 5),
            allConversions: cityConversions,
            leads: leads,
        };
    }, [leads, cityConversions]);

    const pathname = usePathname();
    
    const updatePeriod = (newPeriod: Period) => {
        setPeriod(newPeriod);
        const params = new URLSearchParams(window.location.search);
        params.set('period', newPeriod);
        if (newPeriod !== 'custom') {
            params.delete('startDate');
            params.delete('endDate');
        }
        window.history.pushState({}, '', `${pathname}?${params.toString()}`);
    };
    
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
        { value: 'all' as Period, label: 'All' },
        { value: 'current-month' as Period, label: 'Current Month' },
        { value: 'last-month' as Period, label: 'Last Month' },
        { value: 'last-3-months' as Period, label: 'Last 3 Months' },
        { value: 'this-year' as Period, label: 'This Year' },
        { value: 'last-year' as Period, label: 'Last Year' },
        { value: 'custom' as Period, label: 'Custom' },
    ];

    return (
        <div className="space-y-8">
            {/* Period Selector */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex gap-4 items-center flex-wrap">
                    <span className="text-sm font-medium text-gray-700">Period:</span>
                    <div className="flex gap-2 flex-wrap">
                        {periodButtons.map((btn) => (
                            <button
                                key={btn.value}
                                onClick={() => updatePeriod(btn.value)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    period === btn.value
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
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
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            <span className="text-gray-500 text-sm">to</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => updateCustomDates(customStartDate, e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <Overview
                data={dashboardData}
                leads={leads}
                conversions={cityConversions}
                period={period}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
            />

            {/* Graphs */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h2>
                <AnalyticsCharts
                    leads={leads}
                    conversions={cityConversions}
                    period={period}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                />
            </div>

            {/* Tables removed - only show statistics */}
        </div>
    );
}

