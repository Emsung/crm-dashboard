'use client';

import { useState } from 'react';
import Overview from "@/components/Dashboard/Overview";
import AnalyticsCharts from "@/components/Dashboard/AnalyticsCharts";

interface DashboardData {
    activeLeads: number;
    totalConversions: number;
    conversionRate: number;
    recentConversions: any[];
    allConversions: any[];
    leads: any[];
}

interface DashboardWrapperProps {
    data: DashboardData;
}

type Period = 'all' | 'current-month' | 'last-month' | 'last-3-months' | 'this-year' | 'last-year' | 'custom';

export default function DashboardWrapper({ data }: DashboardWrapperProps) {
    const [period, setPeriod] = useState<Period>('current-month');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const periodButtons = [
        { value: 'current-month' as Period, label: 'Current Month' },
        { value: 'last-month' as Period, label: 'Last Month' },
        { value: 'last-3-months' as Period, label: 'Last 3 Months' },
        { value: 'this-year' as Period, label: 'This Year' },
        { value: 'last-year' as Period, label: 'Last Year' },
        { value: 'custom' as Period, label: 'Custom' },
    ];

    return (
        <>
            {/* Period Selector */}
            <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
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
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            <span className="text-gray-500 text-sm">to</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    )}
                </div>
            </div>

            <Overview
                data={data}
                leads={data.leads}
                conversions={data.allConversions}
                period={period}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
            />

            <div className="mt-8">
                <h2 className="text-2xl font-bold mb-4">Analytics</h2>
                <AnalyticsCharts
                    leads={data.leads}
                    conversions={data.allConversions}
                    period={period}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                />
            </div>
        </>
    );
}
