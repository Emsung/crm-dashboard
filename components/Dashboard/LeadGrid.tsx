'use client';

import { useState } from 'react';

interface Lead {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    city: string;
    country: string;
    className: string | null;
    classDate: string | null;
    memberId: string | null;
    attended: boolean | null;
    createdAt: string;
}

interface LeadGridProps {
    leads: Lead[];
}

export default function LeadGrid({ leads }: LeadGridProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [countryFilter, setCountryFilter] = useState('all');
    const [cityFilter, setCityFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState<number>(100);
    const itemsPerPage = 10;

    // Limit the leads based on selection
    const limitedLeads = limit === -1 ? leads : leads.slice(0, limit);

    // Filter leads
    const filteredLeads = limitedLeads.filter(lead => {
        const matchesSearch =
            lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.lastName?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCountry = countryFilter === 'all' || lead.country === countryFilter;
        const matchesCity = cityFilter === 'all' || lead.city === cityFilter;

        return matchesSearch && matchesCountry && matchesCity;
    });

    // Sort leads
    const sortedLeads = [...filteredLeads].sort((a, b) => {
        const dateA = a.classDate ? new Date(a.classDate).getTime() : 0;
        const dateB = b.classDate ? new Date(b.classDate).getTime() : 0;
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    // Paginate leads
    const totalPages = Math.ceil(sortedLeads.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedLeads = sortedLeads.slice(startIndex, startIndex + itemsPerPage);

    const countries = Array.from(new Set(leads.map(l => l.country)));
    const cities = Array.from(new Set(leads.map(l => l.city)));

    return (
        <div className="bg-white rounded-lg shadow mt-6">
            {/* Filters */}
            <div className="p-4 border-b flex gap-4 flex-wrap items-center">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-sm"
                />
                <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="all">All Countries</option>
                    {countries.map(country => (
                        <option key={country} value={country}>{country}</option>
                    ))}
                </select>
                <select
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="all">All Cities</option>
                    {cities.map(city => (
                        <option key={city} value={city}>{city}</option>
                    ))}
                </select>
                <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                </select>
                <select
                    value={limit}
                    onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setCurrentPage(1); // Reset to first page when changing limit
                    }}
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value={100}>Show 100</option>
                    <option value={250}>Show 250</option>
                    <option value={-1}>Show All</option>
                </select>
                <div className="ml-auto text-sm text-gray-600">
                    Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedLeads.length)} of {sortedLeads.length}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="w-40 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="w-56 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="w-40 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                            <th className="w-48 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                            <th className="w-32 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class Date</th>
                            <th className="w-28 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="w-28 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member ID</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedLeads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-900 truncate">
                                    {lead.firstName} {lead.lastName}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 truncate">{lead.email}</td>
                                <td className="px-6 py-4 text-sm text-gray-600 truncate">
                                    {lead.city}, {lead.country}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 truncate">{lead.className}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {lead.classDate ? new Date(lead.classDate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit'
                                    }) : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${lead.attended ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                        {lead.attended ? 'Attended' : 'Pending'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{lead.memberId || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="px-4 py-3 border-t flex items-center justify-between">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Previous
                    </button>

                    <div className="flex gap-2">
                        {/* First page */}
                        {currentPage > 3 && (
                            <>
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    className="px-3 py-1 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border"
                                >
                                    1
                                </button>
                                {currentPage > 4 && <span className="px-2 py-1 text-gray-500">...</span>}
                            </>
                        )}

                        {/* Pages around current */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(page => {
                                return page === currentPage ||
                                    page === currentPage - 1 ||
                                    page === currentPage + 1 ||
                                    page === currentPage - 2 ||
                                    page === currentPage + 2;
                            })
                            .map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium ${currentPage === page
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white text-gray-700 hover:bg-gray-50 border'
                                        }`}
                                >
                                    {page}
                                </button>
                            ))}

                        {/* Last page */}
                        {currentPage < totalPages - 2 && (
                            <>
                                {currentPage < totalPages - 3 && <span className="px-2 py-1 text-gray-500">...</span>}
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    className="px-3 py-1 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border"
                                >
                                    {totalPages}
                                </button>
                            </>
                        )}
                    </div>

                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
