'use client';

interface Conversion {
    id: number;
    memberId: string;
    memberSince: string | null;
    membershipType: string | null;
    createdAt: string;
    firstName?: string | null;
    lastName?: string | null;
    city?: string | null;
    trialDate?: string | null; // Trial date (from trialBookings.createdAt)
}

interface ConversionsTableProps {
    conversions: Conversion[];
}

export default function ConversionsTable({ conversions }: ConversionsTableProps) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Member</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">City</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Trial Date</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Conversion Date</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Days to Convert</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {conversions.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center justify-center">
                                        <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <p className="text-sm font-medium text-gray-500">No conversions yet</p>
                                        <p className="text-xs text-gray-400 mt-1">Conversions will appear here when users sign up for memberships</p>
                                    </div>
                                </td>
                            </tr>
                            ) : (
                                conversions.map((conversion, index) => {
                                    const conversionDate = conversion.memberSince ? new Date(conversion.memberSince) : null;
                                    const conversionDateFormatted = conversionDate 
                                        ? conversionDate.toLocaleDateString('en-US', { 
                                            year: 'numeric', 
                                            month: 'short', 
                                            day: 'numeric' 
                                        })
                                        : '-';
                                    
                                    // Calculate trial date and days to convert
                                    let trialDateFormatted = '-';
                                    let daysToConvert: number | null = null;
                                    
                                    if (conversion.trialDate) {
                                        const trialDate = new Date(conversion.trialDate);
                                        trialDateFormatted = trialDate.toLocaleDateString('en-US', { 
                                            year: 'numeric', 
                                            month: 'short', 
                                            day: 'numeric' 
                                        });
                                        
                                        // Calculate days between trial and conversion
                                        if (conversionDate) {
                                            const daysDiff = Math.ceil((conversionDate.getTime() - trialDate.getTime()) / (1000 * 60 * 60 * 24));
                                            if (daysDiff >= 0) {
                                                daysToConvert = daysDiff;
                                            }
                                        }
                                    }
                                    
                                    // Use combination of id and index to ensure unique keys
                                    const uniqueKey = `${conversion.id}-${conversion.memberId}-${index}`;
                                    
                                    return (
                                        <tr key={uniqueKey} className="hover:bg-gray-50 transition-colors duration-150">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {conversion.firstName || conversion.lastName 
                                                    ? `${conversion.firstName || ''} ${conversion.lastName || ''}`.trim()
                                                    : 'Unknown'}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                ID: {conversion.memberId}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {conversion.city || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${
                                                conversion.membershipType === 'loyalty'
                                                    ? 'bg-purple-100 text-purple-800'
                                                    : conversion.membershipType === 'course'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-indigo-100 text-indigo-800'
                                            }`}>
                                                {!conversion.membershipType 
                                                    ? 'Unknown'
                                                    : conversion.membershipType === 'course' 
                                                    ? 'Course Participant'
                                                    : conversion.membershipType.charAt(0).toUpperCase() + conversion.membershipType.slice(1) + ' Member'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {trialDateFormatted}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {conversionDateFormatted}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {daysToConvert !== null ? (
                                                <span className="text-sm font-medium text-gray-900">
                                                    {daysToConvert} {daysToConvert === 1 ? 'day' : 'days'}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
