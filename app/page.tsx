import { getDashboardData } from "./actions";
import DashboardWrapper from "@/components/Dashboard/DashboardWrapper";
import LeadGrid from "@/components/Dashboard/LeadGrid";
import ConversionsTable from "@/components/Dashboard/ConversionsTable";
import TabbedLayout from "@/components/Dashboard/TabbedLayout";
import Header from "@/components/Header";

export default async function Home() {
  const data = await getDashboardData();

  return (
    <>
      <Header />
      <main className="p-12 bg-gray-50 min-h-screen">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Boxing Gym Analytics & Lead Management</p>
        </div>

        <TabbedLayout>
          <DashboardWrapper data={data} />

          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Latest Conversions</h2>
            <ConversionsTable conversions={data.recentConversions} />
          </div>

          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Trial Management</h2>
            <LeadGrid leads={data.leads} />
          </div>
        </TabbedLayout>
      </main>
    </>
  );
}
