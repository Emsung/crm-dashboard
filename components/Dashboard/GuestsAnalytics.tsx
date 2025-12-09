'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

type Period = 'all' | 'current-month' | 'last-month' | 'last-3-months' | 'this-year' | 'last-year' | 'custom';

interface GuestsAnalyticsProps {
    guests: Guest[];
    conversions: Conversion[];
    period: Period;
    customStartDate?: string;
    customEndDate?: string;
}

export default function GuestsAnalytics({ guests, period, customStartDate = '', customEndDate = '' }: GuestsAnalyticsProps) {
    // Calculate date ranges
    const dateRange = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        let start = new Date(0);
        let end = new Date(today);

        if (period === 'all') {
            const fiveYearsAgo = new Date(today);
            fiveYearsAgo.setFullYear(today.getFullYear() - 5);
            
            let earliestGuestDate = fiveYearsAgo;
            if (guests.length > 0) {
                const firstGuestDate = new Date(Math.min(...guests.map(g => {
                    const date = g.startDate ? new Date(g.startDate) : new Date(g.createdAt);
                    return date.getTime();
                })));
                earliestGuestDate = firstGuestDate < fiveYearsAgo ? firstGuestDate : fiveYearsAgo;
            }
            
            start = earliestGuestDate;
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
    }, [period, customStartDate, customEndDate, guests]);

    // Filter guests by period
    const filteredGuests = useMemo(() => {
        return guests.filter(guest => {
            const date = guest.startDate ? new Date(guest.startDate) : new Date(guest.createdAt);
            return date >= dateRange.start && date <= dateRange.end;
        });
    }, [guests, dateRange]);

    // === SUMMARY STATS ===
    const summaryStats = useMemo(() => {
        const totalGuests = filteredGuests.length;
        const totalConverted = filteredGuests.filter(g => g.convertedAt !== null).length;
        const conversionRate = totalGuests > 0 ? (totalConverted / totalGuests) * 100 : 0;

        // Average days to convert
        const convertedGuests = filteredGuests.filter(g => g.convertedAt && g.startDate);
        const daysToConvert = convertedGuests.map(g => {
            const start = new Date(g.startDate!);
            const convert = new Date(g.convertedAt!);
            return Math.floor((convert.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }).filter(d => d >= 0);
        
        const avgDaysToConvert = daysToConvert.length > 0
            ? Math.round(daysToConvert.reduce((sum, d) => sum + d, 0) / daysToConvert.length)
            : 0;

        return {
            totalGuests,
            totalConverted,
            conversionRate,
            avgDaysToConvert,
        };
    }, [filteredGuests]);

    // === MONTHLY COHORT CONVERSION ===
    const monthlyConversions = useMemo(() => {
        const monthMap = new Map<string, { started: number; converted: number }>();

        filteredGuests.forEach(guest => {
            const startDate = guest.startDate ? new Date(guest.startDate) : new Date(guest.createdAt);
            const monthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;

            if (!monthMap.has(monthKey)) {
                monthMap.set(monthKey, { started: 0, converted: 0 });
            }

            const data = monthMap.get(monthKey)!;
            data.started++;
            if (guest.convertedAt) data.converted++;
        });

        return Array.from(monthMap.entries())
            .map(([month, data]) => ({
                month,
                started: data.started,
                converted: data.converted,
                rate: data.started > 0 ? (data.converted / data.started) * 100 : 0,
            }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [filteredGuests]);

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-sm font-medium text-gray-500">Total Guests</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{summaryStats.totalGuests.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-sm font-medium text-gray-500">Total Conversions</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{summaryStats.totalConverted.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-sm font-medium text-gray-500">Conversion Rate</p>
                    <p className="text-3xl font-bold text-indigo-600 mt-1">{summaryStats.conversionRate.toFixed(1)}%</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-sm font-medium text-gray-500">Avg Days to Convert</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{summaryStats.avgDaysToConvert || 'N/A'}</p>
                </div>
            </div>

            {/* Conversion Rate by Start Month */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Rate by Start Month</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyConversions} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} domain={[0, 100]} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                            formatter={(value: number, name: string, props: any) => {
                                if (name === 'rate') {
                                    return [`${value.toFixed(1)}% (${props.payload.converted}/${props.payload.started})`, 'Conversion Rate'];
                                }
                                return value;
                            }}
                        />
                        <Bar dataKey="rate" fill="#10b981" radius={[4, 4, 0, 0]} name="rate" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Monthly Cohort Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Month</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Started</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Converted</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Rate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {monthlyConversions.slice(-12).map((row) => (
                                <tr key={row.month} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.month}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{row.started}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{row.converted}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            row.rate >= 30 ? 'bg-green-100 text-green-800' :
                                            row.rate >= 15 ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {row.rate.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
