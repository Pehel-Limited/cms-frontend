'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { useState, useRef, useEffect } from 'react';
import type { RootState, AppDispatch } from '@/store';
import { logout as logoutAction } from '@/store/slices/authSlice';
import { authService } from '@/services/api/auth-service';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useTheme } from '@/app/providers';

/* ─── Nav items ────────────────────────────────────────────── */

const NAV_MAIN = [
  {
    name: 'Overview',
    path: '/portal',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'Accounts',
    path: '/portal/accounts',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    name: 'AI Assistant',
    path: '/portal/ai-assistant',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
  },
  {
    name: 'Payments',
    path: '/portal/payments',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
      </svg>
    ),
  },
  {
    name: 'Cards',
    path: '/portal/cards',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m0 0a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 9" />
      </svg>
    ),
  },
  {
    name: 'Transactions',
    path: '/portal/transactions',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    name: 'Applications',
    path: '/portal/applications',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: 'Documents',
    path: '/portal/documents',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: 'Insights',
    path: '/portal/insights',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

const NAV_BOTTOM = [
  {
    name: 'Messages',
    path: '/portal/messages',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    name: 'Settings',
    path: '/portal/profile',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

/* ─── Nav grouping ──────────────────────────────────────────
   Same destinations as before, organised into labelled groups so a
   9-item list stays scannable instead of reading as one long column. */

type NavItem = { name: string; path: string; icon: React.ReactNode };

const ALL_NAV: NavItem[] = [...NAV_MAIN, ...NAV_BOTTOM];
const byPath = (path: string): NavItem =>
  ALL_NAV.find(i => i.path === path) ?? ALL_NAV[0];

const NAV_SECTIONS: { label?: string; items: NavItem[] }[] = [
  { items: [byPath('/portal')] },
  {
    label: 'Banking',
    items: ['/portal/accounts', '/portal/payments', '/portal/cards', '/portal/transactions'].map(byPath),
  },
  {
    label: 'Borrowing',
    items: ['/portal/applications', '/portal/documents'].map(byPath),
  },
  {
    label: 'Insights & help',
    items: ['/portal/insights', '/portal/ai-assistant', '/portal/messages'].map(byPath),
  },
];

const NAV_FOOTER: NavItem[] = [byPath('/portal/profile')];

/* Primary destinations surfaced as a thumb-reachable bar on small screens */
const MOBILE_NAV: NavItem[] = ['/portal', '/portal/accounts', '/portal/payments', '/portal/applications'].map(byPath);

/* Longest-prefix match drives the page title shown in the top bar */
const PAGE_TITLES: { path: string; title: string; subtitle: string }[] = [
  { path: '/portal/accounts', title: 'Accounts', subtitle: 'Balances and account details' },
  { path: '/portal/ai-assistant', title: 'AI Assistant', subtitle: 'Get instant answers about your finances' },
  { path: '/portal/payments', title: 'Payments', subtitle: 'Transfers, payees and scheduled payments' },
  { path: '/portal/cards', title: 'Cards', subtitle: 'Manage your debit and credit cards' },
  { path: '/portal/transactions', title: 'Transactions', subtitle: 'Search and review your activity' },
  { path: '/portal/applications', title: 'Applications', subtitle: 'Track your credit applications' },
  { path: '/portal/documents', title: 'Documents', subtitle: 'Upload and manage your paperwork' },
  { path: '/portal/insights', title: 'Insights', subtitle: 'Understand where your money goes' },
  { path: '/portal/messages', title: 'Messages', subtitle: 'Your conversations with the bank' },
  { path: '/portal/products', title: 'Products', subtitle: 'Explore what we can offer you' },
  { path: '/portal/company', title: 'Company', subtitle: 'Business profile and people' },
  { path: '/portal/profile', title: 'Settings', subtitle: 'Profile, security and preferences' },
];


export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/portal/login' || pathname === '/portal/register';
  if (isAuthPage) return <>{children}</>;
  return (
    <AuthGuard>
      <PortalShell>{children}</PortalShell>
    </AuthGuard>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const { theme, toggle: toggleTheme } = useTheme();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  /* Restore the collapsed preference so the shell feels persistent */
  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem('cms-sidebar-collapsed') === '1');
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('cms-sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* Escape closes whichever overlay is open, and focus returns to its trigger */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (isUserMenuOpen) {
        setIsUserMenuOpen(false);
        menuButtonRef.current?.focus();
      }
      setMobileSidebarOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isUserMenuOpen]);

  /* Prevent the page behind the mobile drawer from scrolling */
  useEffect(() => {
    document.body.style.overflow = mobileSidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileSidebarOpen]);

  const handleLogout = async () => {
    await authService.logout();
    dispatch(logoutAction());
    router.push('/portal/login');
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  const isActive = (path: string) =>
    path === '/portal' ? pathname === '/portal' : pathname.startsWith(path);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const page =
    PAGE_TITLES.filter(p => pathname.startsWith(p.path)).sort((a, b) => b.path.length - a.path.length)[0] ??
    { title: 'Overview', subtitle: `${getGreeting()}, ${user?.firstName ?? 'there'}` };

  function NavLink({ item }: { item: NavItem }) {
    const active = isActive(item.path);
    return (
      <Link
        href={item.path}
        onClick={() => setMobileSidebarOpen(false)}
        aria-current={active ? 'page' : undefined}
        title={sidebarCollapsed ? item.name : undefined}
        className={[
          'group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
          sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
          active
            ? 'bg-white/[0.18] text-white'
            : 'text-purple-100/70 hover:bg-white/10 hover:text-white',
        ].join(' ')}
      >
        {active && (
          <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white" />
        )}
        <span className={active ? 'shrink-0' : 'shrink-0 opacity-80 group-hover:opacity-100'}>
          {item.icon}
        </span>
        {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
      </Link>
    );
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div
        className={[
          'flex h-16 shrink-0 items-center border-b border-white/10',
          sidebarCollapsed ? 'justify-center' : 'gap-3 px-5',
        ].join(' ')}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-inner backdrop-blur">
          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-lg font-bold leading-none tracking-tight">Rayva</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-purple-200/70">Personal banking</p>
          </div>
        )}
      </div>

      {/* Grouped nav */}
      <nav aria-label="Main" className="sidebar-scrollbar flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.label ?? `group-${i}`} className={i === 0 ? '' : 'mt-5'}>
            {section.label && !sidebarCollapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-purple-200/50">
                {section.label}
              </p>
            )}
            {section.label && sidebarCollapsed && (
              <div className="mx-auto mb-2 h-px w-6 bg-white/15" />
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink key={item.path} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Quick Transfer widget */}
      {!sidebarCollapsed && (
        <div className="mx-3 mb-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
          <div className="mb-1.5 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20">
              <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-white">Quick transfer</span>
          </div>
          <p className="mb-2 text-[10px] leading-tight text-purple-200/70">Send money to your saved payees</p>
          <Link
            href="/portal/payments"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/20 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/30"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
            </svg>
            Send money
          </Link>
        </div>
      )}

      {/* Footer nav + collapse + logout */}
      <div className="space-y-0.5 border-t border-white/10 px-3 pb-4 pt-3">
        {NAV_FOOTER.map(item => (
          <NavLink key={item.path} item={item} />
        ))}

        <button
          onClick={toggleSidebar}
          aria-expanded={!sidebarCollapsed}
          className={[
            'hidden w-full items-center rounded-xl text-sm text-purple-200/70 transition-colors hover:bg-white/10 hover:text-white lg:flex',
            sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
          ].join(' ')}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={`h-5 w-5 shrink-0 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>

        <button
          onClick={handleLogout}
          className={[
            'flex w-full items-center rounded-xl text-sm text-purple-200/70 transition-colors hover:bg-red-500/15 hover:text-red-200',
            sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
          ].join(' ')}
          title={sidebarCollapsed ? 'Log out' : undefined}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!sidebarCollapsed && <span>Log out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--surface-bg)' }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={[
          'mesh-hero fixed left-0 top-0 z-50 flex h-screen flex-col text-white shadow-2xl transition-[width,transform] duration-300 ease-in-out lg:sticky lg:shadow-none',
          sidebarCollapsed ? 'lg:w-[76px]' : 'lg:w-[248px]',
          'w-[264px]',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {sidebarContent}
      </aside>

      {/* ─── Main column ─── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-4 backdrop-blur-xl transition-colors duration-200 sm:gap-3 lg:px-6"
          style={{ backgroundColor: 'var(--topbar-bg)', borderColor: 'var(--topbar-border)' }}
        >
          {/* Mobile hamburger */}
          <button
            className="icon-btn lg:hidden"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileSidebarOpen}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Page title — orients the user without spending a whole extra header row */}
          <div className="min-w-0 flex-1 lg:flex-none">
            <h1 className="truncate text-base font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {page.title}
            </h1>
            <p className="hidden truncate text-xs sm:block" style={{ color: 'var(--text-muted)' }}>
              {page.subtitle}
            </p>
          </div>

          {/* Search */}
          <div className="relative mx-auto hidden w-full max-w-sm lg:block">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              aria-label="Search"
              placeholder="Search anything..."
              className="input py-2 pl-9 pr-4 text-sm"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="icon-btn"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Notifications bell */}
            <button className="icon-btn relative hidden sm:inline-flex" aria-label="Notifications, 3 unread">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                3
              </span>
            </button>

            {/* Messages */}
            <Link href="/portal/messages" className="icon-btn hidden sm:inline-flex" aria-label="Messages">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </Link>

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                ref={menuButtonRef}
                onClick={() => setIsUserMenuOpen(v => !v)}
                className="flex items-center gap-2 rounded-xl border py-1 pl-1 pr-2 transition-colors sm:pr-3"
                style={{ borderColor: 'var(--surface-border)' }}
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
                aria-label="Account menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#7f2b7b] to-[#ae3fa9] text-xs font-bold text-white shadow-sm">
                  {initials}
                </span>
                <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:block" style={{ color: 'var(--text-primary)' }}>
                  {user?.firstName} {user?.lastName}
                </span>
                <svg
                  className="hidden h-4 w-4 transition-transform duration-200 sm:block"
                  style={{
                    color: 'var(--text-muted)',
                    transform: isUserMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div
                  role="menu"
                  className="animate-fade-in absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border py-2"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--surface-border)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                >
                  <div className="border-b px-4 py-3" style={{ borderColor: 'var(--surface-border)' }}>
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                    <span className="badge badge-primary mt-2 text-[10px] uppercase tracking-wider">
                      Customer
                    </span>
                  </div>
                  <div className="py-1">
                    {[
                    { href: '/portal/profile', label: 'My Profile' },
                    { href: '/portal/documents', label: 'Documents' },
                    { href: '/portal/messages', label: 'Messages' },
                  ].map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ color: 'var(--text-secondary)' }}
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                  </div>
                  <div className="border-t py-1" style={{ borderColor: 'var(--surface-border)' }}>
                    <button
                      role="menuitem"
                      onClick={() => { setIsUserMenuOpen(false); handleLogout(); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 pb-24 pt-5 focus:outline-none sm:px-6 sm:pb-8 lg:px-8 lg:pt-6"
        >
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>

      {/* ─── Mobile bottom navigation ─── */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl lg:hidden"
        style={{
          backgroundColor: 'var(--topbar-bg)',
          borderColor: 'var(--topbar-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map(item => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
                style={{ color: active ? 'var(--brand-on-soft)' : 'var(--text-muted)' }}
              >
                <span className={active ? 'scale-110 transition-transform' : 'transition-transform'}>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label="More options"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
