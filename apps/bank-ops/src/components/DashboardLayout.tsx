'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAppSelector, useAppDispatch } from '@/store';
import { logoutUser } from '@/store/slices/authSlice';
import { useTheme } from '@/app/providers';

/* ─── RM-specific surface tokens (always dark) ─── */
// bg: #060d1a  card: #0d1526  border: rgba(255,255,255,0.07)

const NAV_ITEMS = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'Applications',
    path: '/dashboard/applications',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: 'Customers',
    path: '/dashboard/customers',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    name: 'Accounts',
    path: '/dashboard/accounts',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    name: 'KYC/AML',
    path: '/dashboard/kyc',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    name: 'Products',
    path: '/dashboard/products',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
];

const ADMIN_ITEM = {
  name: 'Admin',
  path: '/dashboard/admin',
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

const AI_KNOWLEDGE_ITEM = {
  name: 'AI Knowledge',
  path: '/dashboard/admin/ai-knowledge',
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.546z" />
    </svg>
  ),
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);
  const { theme, toggle: toggleTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    try { await dispatch(logoutUser()).unwrap(); } catch { localStorage.clear(); }
    router.push('/login');
  };

  const isActive = (path: string) =>
    path === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(path);

  const navItems = user?.userType === 'BANK_USER'
    ? [...NAV_ITEMS, AI_KNOWLEDGE_ITEM, ADMIN_ITEM]
    : NAV_ITEMS;

  const getUserRole = () => {
    if (user?.userType === 'BANK_USER') return 'RM - Corporate';
    return user?.userType ?? 'User';
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  function NavLink({ item }: { item: { name: string; path: string; icon: React.ReactNode } }) {
    const active = isActive(item.path);
    return (
      <Link
        href={item.path}
        onClick={() => setMobileSidebarOpen(false)}
        title={sidebarCollapsed ? item.name : undefined}
        className={[
          'group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200',
          sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5',
          active
            ? 'bg-cyan-500/15 text-cyan-300'
            : 'text-slate-400 hover:bg-white/5 hover:text-white',
        ].join(' ')}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-cyan-400 rounded-r-full" />
        )}
        <span className="shrink-0">{item.icon}</span>
        {!sidebarCollapsed && <span>{item.name}</span>}
      </Link>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--rm-bg)' }}>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={[
          'fixed md:sticky top-0 left-0 z-50 h-screen flex flex-col transition-all duration-300',
          'bg-gradient-to-b from-[#0a1628] via-[#0d1e3a] to-[#0f2444]',
          'border-r border-white/[0.06]',
          sidebarCollapsed ? 'w-[70px]' : 'w-[220px]',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {/* Logo */}
        <div className={['flex items-center h-16 shrink-0 border-b border-white/[0.06]', sidebarCollapsed ? 'justify-center' : 'gap-3 px-5'].join(' ')}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)' }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          {!sidebarCollapsed && (
            <div>
              <span className="text-base font-bold text-white tracking-tight leading-none block">Rayva</span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide">RM Portal</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {navItems.map(item => <NavLink key={item.path} item={item} />)}
        </nav>

        {/* User profile card */}
        {!sidebarCollapsed && (
          <div className="mx-3 mb-2 rounded-2xl p-3 border border-white/[0.07]" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)' }}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-[10px] text-slate-400 truncate">{getUserRole()}</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            </div>
            <Link href="/dashboard/rm" className="flex items-center justify-between text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
              View Profile
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}

        {/* Collapse toggle */}
        <div className="px-3 pb-4 border-t border-white/[0.06] pt-3">
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className={[
              'hidden md:flex items-center w-full rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-sm transition-colors',
              sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5',
            ].join(' ')}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`w-4 h-4 shrink-0 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ─── Main column ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 flex items-center px-4 md:px-6 gap-3 border-b transition-colors duration-200"
          style={{ backgroundColor: 'var(--rm-topbar-bg)', backdropFilter: 'blur(12px)', borderColor: 'var(--rm-topbar-border)' }}>
          {/* Mobile hamburger */}
          <button className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5" onClick={() => setMobileSidebarOpen(true)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Search */}
          <div className="relative flex-1 max-w-lg">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search customers, applications, accounts..."
              className="w-full pl-9 pr-14 py-2 rounded-xl text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-colors"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text)', border: '1px solid var(--rm-border)' }}
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">⌘K</kbd>
          </div>

          <div className="flex-1" />

          {/* Share */}
          <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border" style={{ color: 'var(--rm-text-secondary)', borderColor: 'var(--rm-border)', backgroundColor: 'transparent' }}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>

          {/* 3-dots menu */}
          <button className="p-2 rounded-xl transition-colors border" style={{ color: 'var(--rm-text-secondary)', borderColor: 'var(--rm-border)' }}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl transition-all duration-200 hover:scale-105 border"
            style={{ color: 'var(--rm-text-secondary)', borderColor: 'var(--rm-border)', backgroundColor: 'transparent' }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Notifications */}
          <button className="relative p-2 rounded-xl transition-colors border" style={{ color: 'var(--rm-text-secondary)', borderColor: 'var(--rm-border)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-[#060d1a]">8</span>
          </button>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsUserMenuOpen(v => !v)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 border"
              style={{ borderColor: 'var(--rm-border)' }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)' }}>
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--rm-text)' }}>{user?.firstName} {user?.lastName}</p>
                <p className="text-[10px]" style={{ color: 'var(--rm-text-muted)' }}>{getUserRole()}</p>
              </div>
              <svg className={`hidden sm:block w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                style={{ color: 'var(--rm-text-muted)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl shadow-2xl border py-2 z-50"
                style={{ backgroundColor: 'var(--rm-card)', borderColor: 'var(--rm-border)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--rm-border)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--rm-text-muted)' }}>{user?.email}</p>
                  <span className="inline-block mt-2 text-[10px] uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold">
                    {getUserRole()}
                  </span>
                </div>
                <div className="py-1">
                  {[
                    { href: '/dashboard/rm', label: 'My Profile' },
                    { href: '/dashboard/admin', label: 'Settings' },
                  ].map(item => (
                    <Link key={item.href} href={item.href}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ color: 'var(--rm-text-secondary)' }}
                      onClick={() => setIsUserMenuOpen(false)}>
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="border-t py-1" style={{ borderColor: 'var(--rm-border)' }}>
                  <button onClick={() => { setIsUserMenuOpen(false); handleLogout(); }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="px-6 py-3 border-t flex items-center justify-center gap-4 text-[11px] shrink-0 transition-colors"
          style={{ borderColor: 'var(--rm-border)', color: 'var(--rm-text-muted)' }}>
          <span>© 2025 NorthBank. All rights reserved.</span>
          <span className="text-slate-700">·</span>
          <a href="#" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
          <span className="text-slate-700">·</span>
          <a href="#" className="hover:text-slate-400 transition-colors">Terms of Use</a>
          <span className="text-slate-700">·</span>
          <a href="#" className="hover:text-slate-400 transition-colors">Help &amp; Support</a>
        </footer>
      </div>
    </div>
  );
}
