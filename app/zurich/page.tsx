import { getDashboardData } from "../actions";
import CityDashboard from "@/components/Dashboard/CityDashboard";
import TabbedLayout from "@/components/Dashboard/TabbedLayout";
import Header from "@/components/Header";

export default async function ZurichPage() {
  const data = await getDashboardData();
  const zurichLeads = data.leads.filter(lead => lead.city.toLowerCase() === 'zurich');

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
            cityName="Zürich" 
            leads={zurichLeads} 
            allConversions={data.allConversions}
          />
        </TabbedLayout>
      </main>
    </>
  );
}
