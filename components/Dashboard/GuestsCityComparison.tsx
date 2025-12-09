'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

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

interface GuestsCityComparisonProps {
    guests: Guest[];
    conversions: Conversion[];
}

export default function GuestsCityComparison({ guests, conversions }: GuestsCityComparisonProps) {
    // Group guests and conversions by city
    const cityData = useMemo(() => {
        const cityMap = new Map<string, {
            guests: Guest[];
            conversions: Conversion[];
        }>();

        // Group guests by city
        guests.forEach(guest => {
            const city = guest.city || 'Unknown';
            if (!cityMap.has(city)) {
                cityMap.set(city, { guests: [], conversions: [] });
            }
            cityMap.get(city)!.guests.push(guest);
        });

        // Group conversions by city (match via guest)
        conversions.forEach(conv => {
            const guest = guests.find(g => g.memberId === conv.memberId);
            if (guest && guest.city) {
                const city = guest.city;
                if (cityMap.has(city)) {
                    cityMap.get(city)!.conversions.push(conv);
                }
            }
        });

        // Calculate metrics per city
        return Array.from(cityMap.entries())
            .map(([city, data]) => {
                const totalGuests = data.guests.length;
                const activeGuests = data.guests.filter(g => !g.convertedAt && g.creditsLeft > 0).length;
                const convertedGuests = data.guests.filter(g => g.convertedAt !== null).length;
                const conversionRate = totalGuests > 0 ? (convertedGuests / totalGuests) * 100 : 0;
                
                // Calculate average time to convert
                const convertedWithDates = data.guests.filter(g => g.convertedAt && g.startDate);
                const avgTimeToConvert = convertedWithDates.length > 0
                    ? convertedWithDates.reduce((sum, g) => {
                        const start = new Date(g.startDate!);
                        const convert = new Date(g.convertedAt!);
                        return sum + Math.floor((convert.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                      }, 0) / convertedWithDates.length
                    : 0;

                // Package distribution
                const package10 = data.guests.filter(g => g.packageSize === 10).length;
                const package16 = data.guests.filter(g => g.packageSize === 16).length;

                // Conversion within 90 days
                const convertedWithin90 = data.guests.filter(g => {
                    if (!g.convertedAt || !g.startDate) return false;
                    const start = new Date(g.startDate);
                    const convert = new Date(g.convertedAt);
                    const days = Math.floor((convert.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    return days <= 90;
                }).length;

                const rate90 = totalGuests > 0 ? (convertedWithin90 / totalGuests) * 100 : 0;

                // Average credits left for active guests
                const activeGuestsList = data.guests.filter(g => !g.convertedAt && g.creditsLeft > 0);
                const avgCreditsLeft = activeGuestsList.length > 0
                    ? activeGuestsList.reduce((sum, g) => sum + g.creditsLeft, 0) / activeGuestsList.length
                    : 0;

                return {
                    city,
                    totalGuests,
                    activeGuests,
                    convertedGuests,
                    conversionRate,
                    rate90,
                    avgTimeToConvert: Math.round(avgTimeToConvert),
                    package10,
                    package16,
                    avgCreditsLeft: Math.round(avgCreditsLeft * 10) / 10,
                };
            })
            .filter(city => city.totalGuests > 0) // Only cities with guests
            .sort((a, b) => b.conversionRate - a.conversionRate); // Sort by conversion rate
    }, [guests, conversions]);

    // Calculate overall averages for benchmarking
    const overallAverages = useMemo(() => {
        if (cityData.length === 0) return { conversionRate: 0, rate90: 0, avgTimeToConvert: 0 };
        
        return {
            conversionRate: cityData.reduce((sum, c) => sum + c.conversionRate, 0) / cityData.length,
            rate90: cityData.reduce((sum, c) => sum + c.rate90, 0) / cityData.length,
            avgTimeToConvert: cityData.reduce((sum, c) => sum + c.avgTimeToConvert, 0) / cityData.length,
        };
    }, [cityData]);

    // Prepare chart data
    const chartData = cityData.map(city => ({
        city: city.city,
        'Overall Rate': city.conversionRate,
        '90-Day Rate': city.rate90,
        'Benchmark': overallAverages.conversionRate,
    }));

    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <p className="text-sm font-medium text-gray-600 mb-2">Average Conversion Rate</p>
                    <p className="text-3xl font-bold text-gray-900">{overallAverages.conversionRate.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 mt-1">Across all cities</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <p className="text-sm font-medium text-gray-600 mb-2">Average 90-Day Rate</p>
                    <p className="text-3xl font-bold text-gray-900">{overallAverages.rate90.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 mt-1">Within 90 days</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <p className="text-sm font-medium text-gray-600 mb-2">Avg Time to Convert</p>
                    <p className="text-3xl font-bold text-gray-900">{Math.round(overallAverages.avgTimeToConvert)} days</p>
                    <p className="text-xs text-gray-500 mt-1">Average across cities</p>
                </div>
            </div>

            {/* City Comparison Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                    City Performance Comparison
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 60 }}>
                        <defs>
                            <linearGradient id="colorOverall" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3} />
                            </linearGradient>
                            <linearGradient id="color90Day" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.3} />
                            </linearGradient>
                            <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#e5e7eb" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#e5e7eb" stopOpacity={0.3} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                            dataKey="city" 
                            angle={-45} 
                            textAnchor="end" 
                            height={100}
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis
                            domain={[0, 100]}
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
                            formatter={(value: number) => `${value.toFixed(1)}%`}
                        />
                        <Legend />
                        <Bar
                            dataKey="Overall Rate"
                            fill="url(#colorOverall)"
                            radius={[6, 6, 0, 0]}
                            name="Overall Conversion Rate %"
                        />
                        <Bar
                            dataKey="90-Day Rate"
                            fill="url(#color90Day)"
                            radius={[6, 6, 0, 0]}
                            name="90-Day Conversion Rate %"
                        />
                        <Bar
                            dataKey="Benchmark"
                            fill="url(#colorBenchmark)"
                            radius={[6, 6, 0, 0]}
                            name="Average Benchmark"
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* City Ranking Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    City Performance Ranking
                </h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Guests</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Converted</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Rate</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">90-Day Rate</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Days</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Packages</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">vs Avg</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {cityData.map((city, index) => {
                                const vsAvg = city.conversionRate - overallAverages.conversionRate;
                                const isAboveAvg = vsAvg > 0;
                                return (
                                    <tr key={city.city} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                            #{index + 1}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                                            {city.city}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                                            {city.totalGuests}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                                            {city.convertedGuests}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                                            {city.conversionRate.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                                            {city.rate90.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                                            {city.avgTimeToConvert > 0 ? `${city.avgTimeToConvert} days` : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                                            {city.package10}/{city.package16}
                                        </td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                                            isAboveAvg ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {isAboveAvg ? '+' : ''}{vsAvg.toFixed(1)}%
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Insights */}
            {cityData.length > 0 && (() => {
                const bestCity = cityData[0];
                const worstCity = cityData[cityData.length - 1];
                return (
                    <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
                        <h4 className="text-sm font-semibold text-blue-900 mb-3">Key Insights</h4>
                        <ul className="space-y-2 text-sm text-blue-800">
                            <li>
                                • <strong>Best Performing:</strong> {bestCity.city} with {bestCity.conversionRate.toFixed(1)}% conversion rate
                                {bestCity.conversionRate > overallAverages.conversionRate + 5 && (
                                    <span className="text-green-700 font-semibold"> (Significantly above average)</span>
                                )}
                            </li>
                            <li>
                                • <strong>Needs Improvement:</strong> {worstCity.city} with {worstCity.conversionRate.toFixed(1)}% conversion rate
                                {worstCity.conversionRate < overallAverages.conversionRate - 5 && (
                                    <span className="text-red-700 font-semibold"> (Significantly below average)</span>
                                )}
                            </li>
                            {bestCity.avgTimeToConvert > 0 && worstCity.avgTimeToConvert > 0 && (
                                <li>
                                    • <strong>Conversion Speed:</strong> Fastest converting city takes {Math.min(bestCity.avgTimeToConvert, worstCity.avgTimeToConvert)} days on average
                                </li>
                            )}
                            <li>
                                • <strong>Opportunity:</strong> {cityData.reduce((sum, c) => sum + c.activeGuests, 0)} active guests across all cities still have conversion potential
                            </li>
                        </ul>
                    </div>
                );
            })()}
        </div>
    );
}

