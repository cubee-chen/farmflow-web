import { getCurrentFarmer } from '@/lib/auth/get-current-farmer';
import { FarmerMenu } from '@/components/shared/farmer-menu';
import { NavSidebar, NavBottom } from '@/components/shared/app-nav';
import { Toaster } from '@/components/ui/sonner';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const farmer = await getCurrentFarmer();

  return (
    <div className="h-screen grid grid-rows-[3.5rem_1fr_4rem] lg:grid-rows-[3.5rem_1fr] lg:grid-cols-[14rem_1fr]">
      {/* Top bar */}
      <header className="row-start-1 col-span-full z-20 bg-white border-b flex items-center justify-between px-4">
        <span className="text-sm font-semibold tracking-tight text-emerald-700">FarmFlow</span>
        <FarmerMenu farmName={farmer.farm_name} name={farmer.name} />
      </header>

      {/* Desktop sidebar */}
      <NavSidebar />

      {/* Main content */}
      <main className="row-start-2 lg:col-start-2 overflow-auto">
        <div className="max-w-5xl mx-auto p-4">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <NavBottom />
      <Toaster position="top-center" />
    </div>
  );
}
