import { Suspense } from "react";
import { getDashboardData, getGuestsData } from "./actions";
import DashboardWrapper from "@/components/Dashboard/DashboardWrapper";
import LeadGrid from "@/components/Dashboard/LeadGrid";
import ConversionsTable from "@/components/Dashboard/ConversionsTable";
import TabbedLayout from "@/components/Dashboard/TabbedLayout";
import GuestsWrapper from "@/components/Dashboard/GuestsWrapper";
import GuestsCityDashboard from "@/components/Dashboard/GuestsCityDashboard";
import GuestsCityComparison from "@/components/Dashboard/GuestsCityComparison";
import Header from "@/components/Header";

export default async function Home() {
  const data = await getDashboardData();
  const guestsData = await getGuestsData();

  return (
    <>
      <Header />
      <main className="p-12 bg-gray-50 min-h-screen">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Boxing Gym Analytics & Lead Management</p>
        </div>

        <Suspense fallback={<div className="text-center py-12">Loading...</div>}>
          <TabbedLayout 
          trialsContent={
            <>
              <DashboardWrapper data={data} />

              {/* Tables removed - only show statistics */}
            </>
          }
          guestsContent={
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">City Performance Comparison</h2>
                <GuestsCityComparison
                  guests={guestsData.allGuests}
                  conversions={guestsData.guestsWithConversionDetails}
                />
              </div>
              <div className="mt-8">
                <GuestsCityDashboard
                  cityName="All Cities"
                  allGuests={guestsData.allGuests}
                  allConversions={guestsData.guestsWithConversionDetails}
                />
              </div>
            </>
          }
          />
        </Suspense>
      </main>
    </>
  );
}
