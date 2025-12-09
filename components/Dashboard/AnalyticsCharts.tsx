'use client';

import { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Lead {
    id: number;
    createdAt: string;
    classDate: string | null;
    memberId: string | null;
}

interface Conversion {
    id: number;
    memberId: string;
    memberSince: string | null;
    membershipType: string | null;
}

type Period = 'all' | 'current-month' | 'last-month' | 'last-3-months' | 'this-year' | 'last-year' | 'custom';

interface AnalyticsChartsProps {
    leads: Lead[];
    conversions?: Conversion[];
    period: Period;
    customStartDate?: string;
    customEndDate?: string;
    showTimeToConvert?: boolean;
}

export default function AnalyticsCharts({ leads, conversions = [], period, customStartDate = '', customEndDate = '', showTimeToConvert = true }: AnalyticsChartsProps) {
    // Determine if we should group by day or month
    // For 'all' period, always use month grouping to avoid performance issues (50+ years of days)
    const groupByMonth = period === 'all' || period === 'last-3-months' || period === 'this-year' || period === 'last-year' || 
        (period === 'custom' && customStartDate && customEndDate && 
         (new Date(customEndDate).getTime() - new Date(customStartDate).getTime()) > 90 * 24 * 60 * 60 * 1000);

    // Calculate date range based on period
    const dateRange = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        let startDate = new Date(0); // Very old date for "all"
        let endDate = new Date(today);

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
            
            startDate = earliestLeadDate;
            endDate = new Date(today);
        } else if (period === 'custom' && customStartDate && customEndDate) {
            startDate = new Date(customStartDate);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999);
        } else if (period === 'current-month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'last-month') {
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        } else if (period === 'last-3-months') {
            startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'this-year') {
            startDate = new Date(today.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'last-year') {
            startDate = new Date(today.getFullYear() - 1, 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        }

        return { start: startDate, end: endDate };
    }, [period, customStartDate, customEndDate, leads]);

    // Process historical bookings data (grouped by day or month)
    const bookingsData = useMemo(() => {
        const timeMap = new Map<string, number>();

        if (groupByMonth) {
            // Group by month
            const current = new Date(dateRange.start);
            while (current <= dateRange.end) {
                const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
                if (!timeMap.has(monthKey)) {
                    timeMap.set(monthKey, 0);
                }
                current.setMonth(current.getMonth() + 1);
            }

            // Count bookings per month
            leads.forEach(lead => {
                const bookingDate = new Date(lead.createdAt);
                if (bookingDate >= dateRange.start && bookingDate <= dateRange.end) {
                    const monthKey = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
                    timeMap.set(monthKey, (timeMap.get(monthKey) || 0) + 1);
                }
            });

            // Convert to array and format
            return Array.from(timeMap.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([monthKey, count]) => {
                    const [year, month] = monthKey.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                    return {
                        date: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                        bookings: count
                    };
                });
        } else {
            // Group by day
            const current = new Date(dateRange.start);
            while (current <= dateRange.end) {
                const dateStr = current.toISOString().split('T')[0];
                timeMap.set(dateStr, 0);
                current.setDate(current.getDate() + 1);
            }

            // Count bookings per day
            leads.forEach(lead => {
                const bookingDate = new Date(lead.createdAt);
                if (bookingDate >= dateRange.start && bookingDate <= dateRange.end) {
                    const dateStr = bookingDate.toISOString().split('T')[0];
                    timeMap.set(dateStr, (timeMap.get(dateStr) || 0) + 1);
                }
            });

            // Convert to array and format
            return Array.from(timeMap.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, count]) => ({
                    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    bookings: count
                }));
        }
    }, [leads, dateRange, groupByMonth]);

    // Process upcoming trials data (next 30 days from today)
    const upcomingData = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 30);

        const dayMap = new Map<string, number>();

        // Initialize all days in next 30 days with 0
        const current = new Date(today);
        while (current <= endDate) {
            const dateStr = current.toISOString().split('T')[0];
            dayMap.set(dateStr, 0);
            current.setDate(current.getDate() + 1);
        }

        // Count trials per day
        leads.forEach(lead => {
            if (lead.classDate) {
                const classDate = new Date(lead.classDate);
                classDate.setHours(0, 0, 0, 0);
                if (classDate >= today && classDate <= endDate) {
                    const dateStr = classDate.toISOString().split('T')[0];
                    dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1);
                }
            }
        });

        // Convert to array and format
        return Array.from(dayMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, count]) => ({
                date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                trials: count
            }));
    }, [leads]);

    // Process conversion rate data
    // Use the selected period, but always group by month
    const conversionRateData = useMemo(() => {
        const timeMap = new Map<string, { leads: number; conversions: number }>();
        const conversionsByMemberId = new Map<string, Conversion[]>();
        
        // Group conversions by memberId
        conversions.forEach(conv => {
            if (!conversionsByMemberId.has(conv.memberId)) {
                conversionsByMemberId.set(conv.memberId, []);
            }
            conversionsByMemberId.get(conv.memberId)!.push(conv);
        });

        // Initialize all months in the selected period
        const current = new Date(dateRange.start);
        while (current <= dateRange.end) {
            const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
            if (!timeMap.has(monthKey)) {
                timeMap.set(monthKey, { leads: 0, conversions: 0 });
            }
            current.setMonth(current.getMonth() + 1);
        }

        // Count leads per month and check if they converted (for selected period)
        leads.forEach(lead => {
            const leadDate = new Date(lead.createdAt);
            if (leadDate >= dateRange.start && leadDate <= dateRange.end) {
                const monthKey = `${leadDate.getFullYear()}-${String(leadDate.getMonth() + 1).padStart(2, '0')}`;
                const data = timeMap.get(monthKey) || { leads: 0, conversions: 0 };
                data.leads++;
                
                // Check if this lead has a conversion
                if (lead.memberId && conversionsByMemberId.has(lead.memberId)) {
                    data.conversions++;
                }
                
                timeMap.set(monthKey, data);
            }
        });

        // Convert to array and calculate rates
        return Array.from(timeMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([monthKey, data]) => {
                const [year, month] = monthKey.split('-');
                const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                const rate = data.leads > 0 ? (data.conversions / data.leads) * 100 : 0;
                return {
                    date: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    rate: parseFloat(rate.toFixed(1)), // Round to 1 decimal
                    leads: data.leads,
                    conversions: data.conversions
                };
            });
    }, [leads, conversions, dateRange]);

    // Calculate time to convert distribution
    // Only include conversions that happened in the selected period
    const timeToConvertDistribution = useMemo(() => {
        if (!showTimeToConvert || conversions.length === 0) return [];

        const leadsByMemberId = new Map<string, Lead>();
        leads.forEach(lead => {
            if (lead.memberId) {
                const existing = leadsByMemberId.get(lead.memberId);
                if (!existing || new Date(lead.createdAt) < new Date(existing.createdAt)) {
                    leadsByMemberId.set(lead.memberId, lead);
                }
            }
        });

        const timeToConvertData: number[] = [];
        conversions.forEach(conv => {
            // Only include conversions that happened in the selected period
            if (!conv.memberSince) return;
            const conversionDate = new Date(conv.memberSince);
            if (conversionDate >= dateRange.start && conversionDate <= dateRange.end) {
                const lead = leadsByMemberId.get(conv.memberId);
                if (lead) {
                    const trialDate = new Date(lead.createdAt);
                    const daysDiff = Math.ceil((conversionDate.getTime() - trialDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysDiff >= 0 && daysDiff <= 365) { // Only count reasonable timeframes (up to 1 year)
                        timeToConvertData.push(daysDiff);
                    }
                }
            }
        });

        if (timeToConvertData.length === 0) return [];

        // Create buckets: 0-7, 8-14, 15-30, 31-60, 61-90, 91-180, 181-365 days
        const buckets = [
            { label: '0-7 days', min: 0, max: 7 },
            { label: '8-14 days', min: 8, max: 14 },
            { label: '15-30 days', min: 15, max: 30 },
            { label: '31-60 days', min: 31, max: 60 },
            { label: '61-90 days', min: 61, max: 90 },
            { label: '91-180 days', min: 91, max: 180 },
            { label: '181+ days', min: 181, max: Infinity },
        ];

        const bucketCounts = buckets.map(bucket => ({
            range: bucket.label,
            count: timeToConvertData.filter(days => days >= bucket.min && days <= bucket.max).length
        }));

        return bucketCounts;
    }, [leads, conversions, showTimeToConvert, dateRange]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Historical Bookings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">
                        New Trials Booked {groupByMonth ? 'Per Month' : 'Per Day'}
                    </h3>
                <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={bookingsData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <defs>
                            <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1f2937',
                                border: 'none',
                                borderRadius: '8px',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)',
                                padding: '10px 14px',
                                color: '#fff'
                            }}
                            labelStyle={{
                                color: '#fff',
                                fontWeight: 600,
                                marginBottom: '6px',
                                fontSize: '13px'
                            }}
                            itemStyle={{
                                color: '#fff',
                                fontSize: '13px',
                                padding: '2px 0'
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="bookings"
                            stroke="#6366f1"
                            strokeWidth={3}
                            dot={{ fill: '#6366f1', r: 4 }}
                            activeDot={{ r: 6, fill: '#6366f1' }}
                            name="Bookings"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Upcoming Trials */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Upcoming Trials (Next 30 Days)</h3>
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={upcomingData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <defs>
                            <linearGradient id="colorTrials" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.3} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1f2937',
                                border: 'none',
                                borderRadius: '8px',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)',
                                padding: '10px 14px',
                                color: '#fff'
                            }}
                            labelStyle={{
                                color: '#fff',
                                fontWeight: 600,
                                marginBottom: '6px',
                                fontSize: '13px'
                            }}
                            itemStyle={{
                                color: '#fff',
                                fontSize: '13px',
                                padding: '2px 0'
                            }}
                        />
                        <Bar
                            dataKey="trials"
                            fill="url(#colorTrials)"
                            radius={[6, 6, 0, 0]}
                            name="Scheduled Trials"
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            </div>

            {/* Conversion Rate Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                    Conversion Rate Per Month
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={conversionRateData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <defs>
                            <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                            label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280' } }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1f2937',
                                border: 'none',
                                borderRadius: '8px',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)',
                                padding: '10px 14px',
                                color: '#fff'
                            }}
                            labelStyle={{
                                color: '#fff',
                                fontWeight: 600,
                                marginBottom: '6px',
                                fontSize: '13px'
                            }}
                            itemStyle={{
                                color: '#fff',
                                fontSize: '13px',
                                padding: '2px 0'
                            }}
                            formatter={(value: number, name: string, props: any) => {
                                if (name === 'rate') {
                                    const payload = props.payload;
                                    return [
                                        `${value.toFixed(1)}%`,
                                        `Conversion Rate (${payload.conversions} of ${payload.leads} trials)`
                                    ];
                                }
                                return [value, name];
                            }}
                            labelFormatter={(label) => {
                                return label;
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="rate"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ fill: '#10b981', r: 4 }}
                            activeDot={{ r: 6, fill: '#10b981' }}
                            name="Conversion Rate"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Time to Convert Distribution */}
            {showTimeToConvert && timeToConvertDistribution.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Time to Convert Distribution</h3>
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={timeToConvertDistribution} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorTimeToConvert" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="range"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickLine={false}
                                axisLine={{ stroke: '#e5e7eb' }}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickLine={false}
                                axisLine={{ stroke: '#e5e7eb' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1f2937',
                                    border: 'none',
                                    borderRadius: '8px',
                                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)',
                                    padding: '10px 14px',
                                    color: '#fff'
                                }}
                                labelStyle={{
                                    color: '#fff',
                                    fontWeight: 600,
                                    marginBottom: '6px',
                                    fontSize: '13px'
                                }}
                                itemStyle={{
                                    color: '#fff',
                                    fontSize: '13px',
                                    padding: '2px 0'
                                }}
                                formatter={(value: number) => [`${value} conversions`, 'Count']}
                            />
                            <Bar
                                dataKey="count"
                                fill="url(#colorTimeToConvert)"
                                radius={[6, 6, 0, 0]}
                                name="Conversions"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
