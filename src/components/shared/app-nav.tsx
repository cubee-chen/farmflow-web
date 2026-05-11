'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, ListOrdered, Truck, Package, Landmark, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/intake', label: '接單', icon: Inbox },
  { href: '/orders', label: '訂單', icon: ListOrdered },
  { href: '/fulfillment', label: '出貨', icon: Truck },
  { href: '/products', label: '商品', icon: Package },
  { href: '/reconciliation', label: '對帳', icon: Landmark },
  { href: '/settings', label: '設定', icon: Settings },
];

function useNavItems() {
  const pathname = usePathname();
  return NAV_ITEMS.map((item) => ({
    ...item,
    active: pathname.startsWith(item.href),
  }));
}

export function NavSidebar() {
  const items = useNavItems();
  return (
    <nav
      className="hidden lg:flex lg:row-start-2 lg:col-start-1 flex-col gap-1 border-r bg-white px-3 py-4 overflow-y-auto"
      aria-label="主導覽"
    >
      {items.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
            active
              ? 'bg-emerald-50 text-emerald-600'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
          )}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function NavBottom() {
  const items = useNavItems();
  return (
    <nav
      className="lg:hidden row-start-3 flex items-stretch bg-white border-t"
      aria-label="主導覽"
    >
      {items.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[44px]',
            active ? 'text-emerald-600' : 'text-zinc-500'
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
          <span className="text-[10px] font-medium leading-none">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
