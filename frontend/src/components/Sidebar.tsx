'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons, IconKey } from './icons';

const NAV: { href: string; label: string; icon: IconKey }[] = [
  { href: '/', label: 'Dashboard', icon: 'dashboard' },
  { href: '/depots', label: 'Depots', icon: 'depot' },
  { href: '/vehicles', label: 'Vehicles', icon: 'vehicle' },
  { href: '/deliveries', label: 'Deliveries', icon: 'delivery' },
  { href: '/inventory', label: 'Inventory', icon: 'inventory' },
  { href: '/forecast', label: 'Forecast', icon: 'forecast' },
  { href: '/optimize', label: 'Optimize', icon: 'optimize' },
  { href: '/planner', label: 'Trip Planner', icon: 'planner' },
  { href: '/dispatch', label: 'Dispatch', icon: 'dispatch' },
  { href: '/map', label: 'Route Map', icon: 'map' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-200 bg-white"
      style={{ width: 'var(--sidebar-w)' }}
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-sm">
          R
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800">RouteDemand</div>
          <div className="text-xs text-slate-400">VRP Platform</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = Icons[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-500" />
              )}
              <Icon className={`h-5 w-5 ${active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-400">
        Route optimization MVP
      </div>
    </aside>
  );
}
