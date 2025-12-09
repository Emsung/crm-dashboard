'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface TabbedLayoutProps {
    trialsContent: React.ReactNode;
    guestsContent: React.ReactNode;
}

const cities = [
    { name: 'All Cities', path: '/', key: 'all' },
    { name: 'Amsterdam', path: '/amsterdam', key: 'amsterdam' },
    { name: 'Antwerpen', path: '/antwerp', key: 'antwerpen' },
    { name: 'Basel', path: '/basel', key: 'basel' },
    { name: 'Berlin', path: '/berlin', key: 'berlin' },
    { name: 'Cologne', path: '/cologne', key: 'cologne' },
    { name: 'Munich', path: '/munich', key: 'munich' },
    { name: 'Rotterdam', path: '/rotterdam', key: 'rotterdam' },
    { name: 'Vienna', path: '/vienna', key: 'vienna' },
    { name: 'Zürich', path: '/zurich', key: 'zurich' },
];

export default function TabbedLayout({ trialsContent, guestsContent }: TabbedLayoutProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    // Get tab from URL params, default to 'trials'
    const tabFromUrl = searchParams.get('tab') as 'trials' | 'guests' | null;
    const [activeTab, setActiveTab] = useState<'trials' | 'guests'>(tabFromUrl || 'trials');
    
    // Update tab when URL changes
    useEffect(() => {
        const tab = searchParams.get('tab') as 'trials' | 'guests' | null;
        if (tab && (tab === 'trials' || tab === 'guests')) {
            setActiveTab(tab);
        }
    }, [searchParams]);
    
    // Determine current city from pathname
    const currentCity = cities.find(city => {
        if (city.path === '/') {
            return pathname === '/';
        }
        // Match exact path or path with trailing content (like /antwerp matching /antwerp)
        return pathname === city.path || pathname.startsWith(city.path + '/');
    }) || cities[0];
    
    // Helper to build city link with all current params (tab, period, etc.)
    const getCityLink = (cityPath: string) => {
        const params = new URLSearchParams(searchParams.toString());
        // Always preserve tab when switching cities (use current activeTab if not in URL)
        params.set('tab', activeTab);
        // Preserve period and custom date params if they exist
        // (period, startDate, endDate are already in searchParams if set)
        return `${cityPath}?${params.toString()}`;
    };

    return (
        <div className="space-y-6">
            {/* Main Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                <div className="flex gap-2">
                    <Link
                        href={getCityLink(pathname)}
                        onClick={(e) => {
                            e.preventDefault();
                            const params = new URLSearchParams(searchParams.toString());
                            params.set('tab', 'trials');
                            window.history.pushState({}, '', `${pathname}?${params.toString()}`);
                            setActiveTab('trials');
                        }}
                        className={`flex-1 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 text-center ${
                            activeTab === 'trials'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        Trials
                    </Link>
                    <Link
                        href={getCityLink(pathname)}
                        onClick={(e) => {
                            e.preventDefault();
                            const params = new URLSearchParams(searchParams.toString());
                            params.set('tab', 'guests');
                            window.history.pushState({}, '', `${pathname}?${params.toString()}`);
                            setActiveTab('guests');
                        }}
                        className={`flex-1 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 text-center ${
                            activeTab === 'guests'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        Guests
                    </Link>
                </div>
            </div>

            {/* City Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex gap-2 flex-wrap">
                    {cities.map((city) => {
                        const cityLink = getCityLink(city.path);
                        return (
                            <Link
                                key={city.key}
                                href={cityLink}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    currentCity.key === city.key
                                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                        : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                                }`}
                            >
                                {city.name}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div>
                {activeTab === 'trials' ? trialsContent : guestsContent}
            </div>
        </div>
    );
}

