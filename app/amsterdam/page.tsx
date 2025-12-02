import { getDashboardData } from "../actions";
import CityDashboard from "@/components/Dashboard/CityDashboard";
import TabbedLayout from "@/components/Dashboard/TabbedLayout";
import Header from "@/components/Header";

export default async function AmsterdamPage() {
    const data = await getDashboardData();
    const amsterdamLeads = data.leads.filter(lead => lead.city.toLowerCase() === 'amsterdam');

    return (
        <>
            <Header />
            <main className="p-12 bg-gray-50 min-h-screen">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
                    <p className="text-gray-600">Boxing Gym Analytics & Lead Management</p>
                </div>

                <TabbedLayout>
                    <CityDashboard 
                        cityName="Amsterdam" 
                        leads={amsterdamLeads} 
                        allConversions={data.allConversions}
                    />
                </TabbedLayout>
            </main>
        </>
    );
}
