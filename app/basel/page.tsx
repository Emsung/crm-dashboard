import { getDashboardData, getGuestsData } from "../actions";
import CityDashboard from "@/components/Dashboard/CityDashboard";
import GuestsCityDashboard from "@/components/Dashboard/GuestsCityDashboard";
import TabbedLayout from "@/components/Dashboard/TabbedLayout";
import Header from "@/components/Header";

export default async function BaselPage() {
  const data = await getDashboardData();
  const guestsData = await getGuestsData();
  const baselLeads = data.leads.filter(lead => lead.city.toLowerCase() === 'basel');

  return (
    <>
      <Header />
      <main className="p-12 bg-gray-50 min-h-screen">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Boxing Gym Analytics & Lead Management</p>
        </div>

        <TabbedLayout
          trialsContent={
            <CityDashboard 
              cityName="Basel" 
              leads={baselLeads} 
              allConversions={data.allConversions}
            />
          }
          guestsContent={
            <GuestsCityDashboard
              cityName="Basel"
              allGuests={guestsData.allGuests}
              allConversions={guestsData.guestsWithConversionDetails}
            />
          }
        />
      </main>
    </>
  );
}
