import { db } from '@/lib/db';
import { farmers } from '@/lib/db/schema';
import { getCurrentFarmerId } from '@/lib/auth/farmer-context';
import { FarmerSwitcher } from '@/components/shared/farmer-switcher';
import { NavSidebar, NavBottom } from '@/components/shared/app-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [allFarmers, currentFarmerId] = await Promise.all([
    db
      .select({ id: farmers.id, name: farmers.name, farm_name: farmers.farm_name })
      .from(farmers),
    getCurrentFarmerId(),
  ]);

  const effectiveFarmerId = currentFarmerId ?? allFarmers[0]?.id ?? '';

  return (
    <div className="h-screen grid grid-rows-[3.5rem_1fr_4rem] lg:grid-rows-[3.5rem_1fr] lg:grid-cols-[14rem_1fr]">
      {/* Top bar */}
      <header className="row-start-1 col-span-full z-20 bg-white border-b flex items-center justify-between px-4">
        <span className="text-sm font-semibold tracking-tight text-emerald-700">FarmFlow</span>
        <FarmerSwitcher farmers={allFarmers} currentFarmerId={effectiveFarmerId} />
      </header>

      {/* Desktop sidebar — placed before main so grid auto-places main to col 2 */}
      <NavSidebar />

      {/* Main content */}
      <main className="row-start-2 lg:col-start-2 overflow-auto">
        <div className="max-w-5xl mx-auto p-4">{children}</div>
      </main>

      {/* Mobile bottom tab bar — placed after main to stay in row 3 */}
      <NavBottom />
    </div>
  );
}
