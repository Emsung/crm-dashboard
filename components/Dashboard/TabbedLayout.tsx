'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface TabbedLayoutProps {
    children: React.ReactNode;
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

export default function TabbedLayout({ children }: TabbedLayoutProps) {
    const pathname = usePathname();
    const [activeTab, setActiveTab] = useState<'trials' | 'course'>('trials');
    
    // Determine current city from pathname
    const currentCity = cities.find(city => {
        if (city.path === '/') {
            return pathname === '/';
        }
        // Match exact path or path with trailing content (like /antwerp matching /antwerp)
        return pathname === city.path || pathname.startsWith(city.path + '/');
    }) || cities[0];

    return (
        <div className="space-y-6">
            {/* Main Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('trials')}
                        className={`flex-1 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeTab === 'trials'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        Trials
                    </button>
                    <button
                        onClick={() => setActiveTab('course')}
                        disabled
                        className={`flex-1 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeTab === 'course'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        Course (Coming Soon)
                    </button>
                </div>
            </div>

            {/* City Navigation (only show for Trials tab) */}
            {activeTab === 'trials' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex gap-2 flex-wrap">
                        {cities.map((city) => (
                            <Link
                                key={city.key}
                                href={city.path}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    currentCity.key === city.key
                                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                        : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                                }`}
                            >
                                {city.name}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Content */}
            <div>
                {activeTab === 'trials' ? children : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <p className="text-gray-500 text-lg">Course tab coming soon...</p>
                    </div>
                )}
            </div>
        </div>
    );
}

