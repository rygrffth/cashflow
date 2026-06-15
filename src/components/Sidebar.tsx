'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, History, Target, HandCoins, Settings, 
  CalendarRange, BarChart3, RefreshCw, Sun, Moon, Landmark, 
  Menu, X, ChevronLeft, ChevronRight 
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const normalizePath = (p: string) => p.replace(/\/$/, '') || '/';
  
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isOpen, setIsOpen] = useState(false); // Mobile drawer state
  const [isCollapsed, setIsCollapsed] = useState(false); // Desktop collapsed state
  const [isMounted, setIsMounted] = useState(false);

  // Load theme and collapsed state on mount
  useEffect(() => {
    setIsMounted(true);
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme as 'dark' | 'light');
    
    const savedCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    setIsCollapsed(savedCollapsed);
    
    // Sync class to body for page layout padding
    if (savedCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  const toggleCollapse = () => {
    const nextCollapsed = !isCollapsed;
    setIsCollapsed(nextCollapsed);
    localStorage.setItem('sidebar_collapsed', String(nextCollapsed));
    
    if (nextCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  };

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/history', label: 'Riwayat', icon: History },
    { href: '/budget', label: 'Tabungan', icon: Target },
    { href: '/piutang', label: 'Piutang', icon: HandCoins },
    { href: '/investasi', label: 'Investasi', icon: Landmark },
    { href: '/settlement', label: 'Settlement', icon: CalendarRange },
    { href: '/analytics', label: 'Analisis', icon: BarChart3 },
    { href: '/sync', label: 'Sinkronisasi', icon: RefreshCw },
    { href: '/settings', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <>
      {/* 📱 Mobile Header Bar (Visible on mobile only) */}
      <header className="md:hidden sticky top-0 z-40 flex h-16 items-center justify-between bg-[color:var(--background)]/85 backdrop-blur-md border-b border-[color:var(--card-border)] px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition cursor-pointer"
            title="Buka Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-md font-black tracking-tight text-white flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-5 h-5 object-contain rounded-lg" />
            <span>Cashflow</span>
          </span>
        </div>

        {/* Theme Toggle (Mobile) */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition cursor-pointer flex items-center justify-center bg-slate-900/40"
          title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
        </button>
      </header>

      {/* 📱 Mobile Drawer Overlay / Backdrop */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn"
        />
      )}

      {/* 📂 Sidebar Container */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[color:var(--background)] border-r border-[color:var(--card-border)] transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
        ${isMounted && isCollapsed ? 'md:w-16' : 'md:w-64'}
      `}>
        {/* Sidebar Header (Logo & Close Button on Mobile) */}
        <div className={`
          flex h-16 items-center justify-between border-b border-[color:var(--card-border)] transition-all duration-300
          ${isMounted && isCollapsed ? 'md:px-0 md:justify-center' : 'px-6'}
        `}>
          <Link 
            href="/" 
            className="text-lg font-black tracking-tight text-white flex items-center gap-2.5"
            onClick={() => setIsOpen(false)}
          >
            <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain rounded-lg shadow-emerald-500/20 shadow-md animate-pulse" />
            <span className={`transition-all duration-300 ${isMounted && isCollapsed ? 'md:hidden md:w-0' : 'block'}`}>
              Cashflow
            </span>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden p-1.5 -mr-1.5 rounded-lg text-slate-450 hover:text-white hover:bg-slate-800/50 transition cursor-pointer"
            title="Tutup Menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links List */}
        <nav className={`
          flex-1 space-y-1.5 py-6 overflow-y-auto custom-scrollbar transition-all duration-300
          ${isMounted && isCollapsed ? 'md:px-2' : 'px-4'}
        `}>
          {links.map((link) => {
            const isActive = normalizePath(pathname) === normalizePath(link.href);
            const Icon = link.icon;
            
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                title={isCollapsed ? link.label : undefined}
                className={`
                  flex items-center rounded-xl text-xs sm:text-sm font-semibold transition-all
                  ${isMounted && isCollapsed ? 'md:justify-center md:h-10 md:w-12 md:mx-auto' : 'px-4 py-2.5 gap-3.5'}
                  ${isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.04)]' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50 border border-transparent'}
                `}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                <span className={`transition-all duration-300 ${isMounted && isCollapsed ? 'md:hidden md:w-0' : 'block'}`}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer (Theme Toggler & Collapse Button on Desktop) */}
        <div className={`
          hidden md:flex flex-col gap-2 p-3 border-t border-[color:var(--card-border)] transition-all duration-300
          ${isMounted && isCollapsed ? 'items-center' : 'items-stretch'}
        `}>
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={isCollapsed ? (theme === 'dark' ? 'Mode Terang' : 'Mode Gelap') : undefined}
            className={`
              flex items-center rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-850/50 border border-transparent transition-all cursor-pointer bg-slate-900/25
              ${isMounted && isCollapsed ? 'justify-center h-10 w-10' : 'px-4 py-2.5 gap-3'}
            `}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4.5 h-4.5 text-amber-400 flex-shrink-0" />
                <span className={isMounted && isCollapsed ? 'hidden' : 'block'}>Mode Terang</span>
              </>
            ) : (
              <>
                <Moon className="w-4.5 h-4.5 text-indigo-400 flex-shrink-0" />
                <span className={isMounted && isCollapsed ? 'hidden' : 'block'}>Mode Gelap</span>
              </>
            )}
          </button>

          {/* Collapse Toggle Button */}
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? 'Perluas Menu' : 'Ciutkan Menu'}
            className={`
              flex items-center rounded-xl text-xs sm:text-sm font-semibold text-slate-450 hover:text-white hover:bg-slate-850/50 border border-transparent transition-all cursor-pointer
              ${isMounted && isCollapsed ? 'justify-center h-10 w-10' : 'px-4 py-2.5 gap-3'}
            `}
          >
            {isMounted && isCollapsed ? (
              <ChevronRight className="w-4.5 h-4.5 flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4.5 h-4.5 flex-shrink-0" />
                <span>Ciutkan Menu</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
