'use client';

import { useMemo } from 'react';

interface Conversion {
    id: number;
    memberId: string;
    memberSince: string;
    membershipType: string;
    createdAt: string;
}

interface DashboardData {
    activeLeads: number;
    totalConversions: number;
    conversionRate: number;
    recentConversions: Conversion[];
}

interface Lead {
    createdAt: string;
    classDate: string | null;
    memberId: string | null;
}

type Period = 'all' | 'current-month' | 'last-month' | 'last-3-months' | 'this-year' | 'last-year' | 'custom';

interface OverviewProps {
    data: DashboardData;
    leads: Lead[];
    conversions: Conversion[];
    period: Period;
    customStartDate?: string;
    customEndDate?: string;
}

export default function Overview({ data, leads, conversions, period, customStartDate, customEndDate }: OverviewProps) {
    // Calculate date ranges
    const { currentRange, previousRange } = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        let currentStart = new Date(0); // Very old date for "all"
        let currentEnd = new Date(today);

        if (period === 'all') {
            // For "all", use a reasonable date range (last 5 years or first lead date, whichever is more recent)
            // This prevents performance issues with 50+ years of data
            const fiveYearsAgo = new Date(today);
            fiveYearsAgo.setFullYear(today.getFullYear() - 5);
            
            // Find the earliest lead date if available
            let earliestLeadDate = fiveYearsAgo;
            if (leads.length > 0) {
                const firstLeadDate = new Date(Math.min(...leads.map(l => new Date(l.createdAt).getTime())));
                earliestLeadDate = firstLeadDate < fiveYearsAgo ? firstLeadDate : fiveYearsAgo;
            }
            
            currentStart = earliestLeadDate;
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

        // Calculate previous period (same length)
        const periodLength = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));
        const previousEnd = new Date(currentStart);
        previousEnd.setDate(previousEnd.getDate() - 1);
        previousEnd.setHours(23, 59, 59, 999);
        const previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - periodLength + 1);
        previousStart.setHours(0, 0, 0, 0);

        return {
            currentRange: { start: currentStart, end: currentEnd },
            previousRange: { start: previousStart, end: previousEnd }
        };
    }, [period, customStartDate, customEndDate, leads]);

    // Calculate metrics for current and previous periods
    const metrics = useMemo(() => {
        // Current period - count trial bookings
        const currentLeads = leads.filter(lead => {
            const date = new Date(lead.createdAt);
            return date >= currentRange.start && date <= currentRange.end;
        });

        // Get memberIds from current period leads
        const currentLeadMemberIds = new Set(
            currentLeads.map(lead => lead.memberId).filter(Boolean)
        );

        // Current period conversions
        const currentPeriodConversions = conversions.filter(conversion => {
            const date = new Date(conversion.memberSince);
            return date >= currentRange.start && date <= currentRange.end;
        });

        // Get all conversions (not just current period) to determine paths
        // We need to check if someone had a course before their membership
        const allConversionsByMember = new Map<string, typeof conversions>();
        conversions.forEach(conv => {
            if (!allConversionsByMember.has(conv.memberId)) {
                allConversionsByMember.set(conv.memberId, []);
            }
            allConversionsByMember.get(conv.memberId)!.push(conv);
        });

        // Calculate conversion paths for current period
        // Two perspectives:
        // 1. Conversions that happened this period (by conversion date) - Business Results
        // 2. Conversions from trials that started this period (by trial date) - Marketing Effectiveness
        
        // First, calculate totalTrials (needed for both perspectives)
        const totalTrials = currentLeads.length;
        
        // Perspective 1: Conversions by conversion date (what happened this period)
        let trialToCourse = 0;
        let trialToMember = 0;

        // Check each current period conversion (by conversion date)
        currentPeriodConversions.forEach(conv => {
            const memberId = conv.memberId;
            
            // Check if this member had a trial (has memberId in leads)
            const hadTrial = currentLeadMemberIds.has(memberId) || 
                leads.some(lead => lead.memberId === memberId);

            if (!hadTrial) return; // Skip if no trial found

            if (conv.membershipType === 'course') {
                trialToCourse++;
            } else if (conv.membershipType === 'flex' || conv.membershipType === 'loyalty') {
                trialToMember++;
            }
        });

        // Perspective 2: Conversion rate from this period's trials (attribution-based)
        // Only count conversions that happened THIS PERIOD from trials that started this period
        const conversionsFromPeriodTrialsInPeriod = currentPeriodConversions.filter(conv => 
            currentLeadMemberIds.has(conv.memberId)
        );

        let trialToCourseFromPeriodTrials = 0;
        let trialToMemberFromPeriodTrials = 0;

        conversionsFromPeriodTrialsInPeriod.forEach(conv => {
            if (conv.membershipType === 'course') {
                trialToCourseFromPeriodTrials++;
            } else if (conv.membershipType === 'flex' || conv.membershipType === 'loyalty') {
                trialToMemberFromPeriodTrials++;
            }
        });

        const totalConversionsFromPeriodTrials = trialToCourseFromPeriodTrials + trialToMemberFromPeriodTrials;
        
        // Calculate conversion rate based on conversions that happened this period
        const conversionRateFromPeriodTrials = totalTrials > 0 
            ? (totalConversionsFromPeriodTrials / totalTrials) * 100 
            : 0;

        // Calculate rates
        const totalConversions = trialToCourse + trialToMember;
        const totalConversionRate = totalTrials > 0 ? (totalConversions / totalTrials) * 100 : 0;
        const trialToCourseRate = totalTrials > 0 ? (trialToCourse / totalTrials) * 100 : 0;
        const trialToMemberRate = totalTrials > 0 ? (trialToMember / totalTrials) * 100 : 0;

        // Previous period calculations
        const previousLeads = leads.filter(lead => {
            const date = new Date(lead.createdAt);
            return date >= previousRange.start && date <= previousRange.end;
        });

        // First, calculate prevTotalTrials (needed for calculations)
        const prevTotalTrials = previousLeads.length;

        const previousLeadMemberIds = new Set(
            previousLeads.map(lead => lead.memberId).filter(Boolean)
        );

        const previousPeriodConversions = conversions.filter(conversion => {
            const date = new Date(conversion.memberSince);
            return date >= previousRange.start && date <= previousRange.end;
        });

        const prevConversionsByMember = new Map<string, typeof previousPeriodConversions>();
        previousPeriodConversions.forEach(conv => {
            if (!prevConversionsByMember.has(conv.memberId)) {
                prevConversionsByMember.set(conv.memberId, []);
            }
            prevConversionsByMember.get(conv.memberId)!.push(conv);
        });

        let prevTrialToCourse = 0;
        let prevTrialToMember = 0;

        previousPeriodConversions.forEach(conv => {
            const memberId = conv.memberId;
            
            const hadTrial = previousLeadMemberIds.has(memberId) || 
                leads.some(lead => lead.memberId === memberId);

            if (!hadTrial) return;

            if (conv.membershipType === 'course') {
                prevTrialToCourse++;
            } else if (conv.membershipType === 'flex' || conv.membershipType === 'loyalty') {
                prevTrialToMember++;
            }
        });

        // Previous period: Conversions from previous period's trials
        const prevConversionsFromPeriodTrials = conversions.filter(conv => {
            return previousLeadMemberIds.has(conv.memberId);
        });

        let prevTrialToCourseFromPeriodTrials = 0;
        let prevTrialToMemberFromPeriodTrials = 0;

        prevConversionsFromPeriodTrials.forEach(conv => {
            if (conv.membershipType === 'course') {
                prevTrialToCourseFromPeriodTrials++;
            } else if (conv.membershipType === 'flex' || conv.membershipType === 'loyalty') {
                prevTrialToMemberFromPeriodTrials++;
            }
        });

        const prevTotalConversionsFromPeriodTrials = prevTrialToCourseFromPeriodTrials + prevTrialToMemberFromPeriodTrials;
        const prevConversionRateFromPeriodTrials = prevTotalTrials > 0
            ? (prevTotalConversionsFromPeriodTrials / prevTotalTrials) * 100
            : 0;
        const prevTotalConversions = prevTrialToCourse + prevTrialToMember;
        const prevTotalConversionRate = prevTotalTrials > 0 ? (prevTotalConversions / prevTotalTrials) * 100 : 0;
        const prevTrialToCourseRate = prevTotalTrials > 0 ? (prevTrialToCourse / prevTotalTrials) * 100 : 0;
        const prevTrialToMemberRate = prevTotalTrials > 0 ? (prevTrialToMember / prevTotalTrials) * 100 : 0;

        // Calculate time to convert (days between trial and conversion)
        // Only for conversions that happened in the selected period
        const timeToConvertData: number[] = [];
        const leadsByMemberId = new Map<string, Lead>();
        
        // Build map of all leads by memberId to find the original trial date
        leads.forEach(lead => {
            if (lead.memberId) {
                // If multiple leads for same memberId, use the earliest one (original trial)
                const existing = leadsByMemberId.get(lead.memberId);
                if (!existing || new Date(lead.createdAt) < new Date(existing.createdAt)) {
                    leadsByMemberId.set(lead.memberId, lead);
                }
            }
        });

        // Only calculate time to convert for conversions that happened in the current period
        // Filter by conversion date (memberSince) within the selected period
        currentPeriodConversions.forEach(conv => {
            const lead = leadsByMemberId.get(conv.memberId);
            if (lead) {
                const trialDate = new Date(lead.createdAt);
                const conversionDate = new Date(conv.memberSince);
                
                // Ensure conversion date is within the selected period
                if (conversionDate >= currentRange.start && conversionDate <= currentRange.end) {
                    const daysDiff = Math.ceil((conversionDate.getTime() - trialDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysDiff >= 0) { // Only count if conversion is after trial
                        timeToConvertData.push(daysDiff);
                    }
                }
            }
        });

        const avgTimeToConvert = timeToConvertData.length > 0
            ? timeToConvertData.reduce((sum, days) => sum + days, 0) / timeToConvertData.length
            : 0;
        const medianTimeToConvert = timeToConvertData.length > 0
            ? (() => {
                const sorted = [...timeToConvertData].sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                return sorted.length % 2 === 0
                    ? (sorted[mid - 1] + sorted[mid]) / 2
                    : sorted[mid];
            })()
            : 0;

        // Previous period time to convert
        // Only for conversions that happened in the previous period
        const prevTimeToConvertData: number[] = [];
        const prevLeadsByMemberId = new Map<string, Lead>();
        
        // Build map of all leads by memberId for previous period calculations
        leads.forEach(lead => {
            if (lead.memberId) {
                const existing = prevLeadsByMemberId.get(lead.memberId);
                if (!existing || new Date(lead.createdAt) < new Date(existing.createdAt)) {
                    prevLeadsByMemberId.set(lead.memberId, lead);
                }
            }
        });

        // Only calculate time to convert for conversions that happened in the previous period
        previousPeriodConversions.forEach(conv => {
            const lead = prevLeadsByMemberId.get(conv.memberId);
            if (lead) {
                const trialDate = new Date(lead.createdAt);
                const conversionDate = new Date(conv.memberSince);
                
                // Ensure conversion date is within the previous period
                if (conversionDate >= previousRange.start && conversionDate <= previousRange.end) {
                    const daysDiff = Math.ceil((conversionDate.getTime() - trialDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysDiff >= 0) {
                        prevTimeToConvertData.push(daysDiff);
                    }
                }
            }
        });

        const prevAvgTimeToConvert = prevTimeToConvertData.length > 0
            ? prevTimeToConvertData.reduce((sum, days) => sum + days, 0) / prevTimeToConvertData.length
            : 0;

        // Calculate changes
        const totalConversionsChange = prevTotalConversions > 0
            ? ((totalConversions - prevTotalConversions) / prevTotalConversions) * 100
            : 0;
        const totalConversionRateChange = totalConversionRate - prevTotalConversionRate;
        const trialToCourseChange = prevTrialToCourse > 0
            ? ((trialToCourse - prevTrialToCourse) / prevTrialToCourse) * 100
            : 0;
        const trialToMemberChange = prevTrialToMember > 0
            ? ((trialToMember - prevTrialToMember) / prevTrialToMember) * 100
            : 0;
        const avgTimeToConvertChange = prevAvgTimeToConvert > 0
            ? ((avgTimeToConvert - prevAvgTimeToConvert) / prevAvgTimeToConvert) * 100
            : 0;
        const conversionRateFromPeriodTrialsChange = conversionRateFromPeriodTrials - prevConversionRateFromPeriodTrials;

        return {
            current: {
                leads: totalTrials,
                totalConversions,
                totalConversionRate,
                trialToCourse,
                trialToMember,
                trialToCourseRate,
                trialToMemberRate,
                avgTimeToConvert,
                medianTimeToConvert,
                // Attribution-based metrics (from this period's trials)
                totalConversionsFromPeriodTrials,
                conversionRateFromPeriodTrials,
                trialToCourseFromPeriodTrials,
                trialToMemberFromPeriodTrials,
                // Breakdown for Business Results card
                conversionsFromPeriodTrialsInPeriod: totalConversionsFromPeriodTrials,
            },
            previous: {
                leads: prevTotalTrials,
                totalConversions: prevTotalConversions,
                totalConversionRate: prevTotalConversionRate,
                trialToCourse: prevTrialToCourse,
                trialToMember: prevTrialToMember,
                trialToCourseRate: prevTrialToCourseRate,
                trialToMemberRate: prevTrialToMemberRate,
                avgTimeToConvert: prevAvgTimeToConvert,
                totalConversionsFromPeriodTrials: prevTotalConversionsFromPeriodTrials,
                conversionRateFromPeriodTrials: prevConversionRateFromPeriodTrials,
                trialToCourseFromPeriodTrials: prevTrialToCourseFromPeriodTrials,
                trialToMemberFromPeriodTrials: prevTrialToMemberFromPeriodTrials,
            },
            changes: {
                totalConversions: totalConversionsChange,
                totalConversionRate: totalConversionRateChange,
                trialToCourse: trialToCourseChange,
                trialToMember: trialToMemberChange,
                avgTimeToConvert: avgTimeToConvertChange,
                conversionRateFromPeriodTrials: conversionRateFromPeriodTrialsChange,
            }
        };
    }, [leads, conversions, currentRange, previousRange]);

    const ChangeIndicator = ({ value }: { value: number }) => {
        if (value === 0) return null;
        const isPositive = value > 0;
        return (
            <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                <span>{isPositive ? '↑' : '↓'}</span>
                <span>{Math.abs(value).toFixed(1)}%</span>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Top Row: Active Leads, Total Conversions, and Marketing Effectiveness */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Active Leads Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <p className="text-sm font-medium text-gray-600 mb-2">Active Leads (Trials)</p>
                    <div className="flex items-end justify-between mb-2">
                        <p className="text-3xl font-bold text-gray-900">{metrics.current.leads.toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-gray-500">vs previous period: {metrics.previous.leads.toLocaleString()}</p>
                </div>

                {/* Total Conversions Card - Business Results (by conversion date) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-600">Total Conversions</p>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">Business Results</span>
                    </div>
                    <div className="flex items-end justify-between mb-3">
                        <div>
                            <p className="text-3xl font-bold text-gray-900">{metrics.current.totalConversions.toLocaleString()}</p>
                            <p className="text-sm text-gray-500 mt-1">conversions this period</p>
                        </div>
                        <ChangeIndicator value={metrics.changes.totalConversions} />
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                        <div
                            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(metrics.current.totalConversionRate, 100)}%` }}
                        ></div>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                        <p>• {metrics.current.conversionsFromPeriodTrialsInPeriod} from this period's trials</p>
                        <p>• {metrics.current.totalConversions - metrics.current.conversionsFromPeriodTrialsInPeriod} from earlier trials</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 italic">Based on conversion date</p>
                </div>

                {/* Marketing Effectiveness Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">Marketing Effectiveness</span>
                    </div>
                    <div className="flex items-end justify-between mb-3">
                        <div>
                            <p className="text-3xl font-bold text-gray-900">{metrics.current.conversionRateFromPeriodTrials.toFixed(1)}%</p>
                            <p className="text-sm text-gray-500 mt-1">
                                {metrics.current.totalConversionsFromPeriodTrials.toLocaleString()} of {metrics.current.leads.toLocaleString()} trials
                            </p>
                        </div>
                        <ChangeIndicator value={metrics.changes.conversionRateFromPeriodTrials} />
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                        <div
                            className="bg-gradient-to-r from-green-500 to-green-600 h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(metrics.current.conversionRateFromPeriodTrials, 100)}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-gray-500">From {metrics.current.leads.toLocaleString()} trials this period</p>
                    <p className="text-xs text-gray-400 mt-1 italic">Based on conversions that happened this period</p>
                </div>
            </div>

            {/* Conversion Paths */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Trial → Course */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <p className="text-sm font-medium text-gray-600 mb-2">Trial → Course</p>
                    <div className="flex items-end justify-between mb-2">
                        <div>
                            <p className="text-3xl font-bold text-gray-900">{metrics.current.trialToCourse}</p>
                            <p className="text-sm text-gray-500 mt-1">{metrics.current.trialToCourseRate.toFixed(1)}%</p>
                        </div>
                        <ChangeIndicator value={metrics.changes.trialToCourse} />
                    </div>
                    <p className="text-xs text-gray-500">vs previous: {metrics.previous.trialToCourse} ({metrics.previous.trialToCourseRate.toFixed(1)}%)</p>
                </div>

                {/* Trial → Member */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <p className="text-sm font-medium text-gray-600 mb-2">Trial → Member</p>
                    <div className="flex items-end justify-between mb-2">
                        <div>
                            <p className="text-3xl font-bold text-gray-900">{metrics.current.trialToMember}</p>
                            <p className="text-sm text-gray-500 mt-1">{metrics.current.trialToMemberRate.toFixed(1)}%</p>
                        </div>
                        <ChangeIndicator value={metrics.changes.trialToMember} />
                    </div>
                    <p className="text-xs text-gray-500">vs previous: {metrics.previous.trialToMember} ({metrics.previous.trialToMemberRate.toFixed(1)}%)</p>
                </div>
            </div>

            {/* Time to Convert */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Average Time to Convert */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <p className="text-sm font-medium text-gray-600 mb-2">Avg. Time to Convert</p>
                    <div className="flex items-end justify-between mb-2">
                        <div>
                            <p className="text-3xl font-bold text-gray-900">
                                {metrics.current.avgTimeToConvert > 0 ? metrics.current.avgTimeToConvert.toFixed(1) : '-'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">days</p>
                        </div>
                        <ChangeIndicator value={metrics.changes.avgTimeToConvert} />
                    </div>
                    <p className="text-xs text-gray-500">
                        vs previous: {metrics.previous.avgTimeToConvert > 0 ? `${metrics.previous.avgTimeToConvert.toFixed(1)} days` : '-'}
                    </p>
                </div>

                {/* Median Time to Convert */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <p className="text-sm font-medium text-gray-600 mb-2">Median Time to Convert</p>
                    <div className="flex items-end justify-between mb-2">
                        <div>
                            <p className="text-3xl font-bold text-gray-900">
                                {metrics.current.medianTimeToConvert > 0 ? metrics.current.medianTimeToConvert.toFixed(1) : '-'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">days</p>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">Time from trial to conversion</p>
                </div>
            </div>
        </div>
    );
}
