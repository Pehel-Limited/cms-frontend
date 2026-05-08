'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const navItems = [
  { href: '/solicitor/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/solicitor/cases', label: 'Cases', icon: '📋' },
  { href: '/solicitor/firm', label: 'Firm Profile', icon: '🏢' },
  { href: '/solicitor/firm/users', label: 'Team', icon: '👥' },
  { href: '/solicitor/notifications', label: 'Notifications', icon: '🔔' },
];

export default function SolicitorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-lg font-bold text-white">Solicitor Portal</h1>
        <p className="text-xs text-slate-400 mt-1">Legal Case Management</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-primary-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} CMS Platform
      </div>
    </aside>
  );
}
