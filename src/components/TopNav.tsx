'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, History, Target, HandCoins, Settings, CalendarRange, BarChart3, RefreshCw, Sun, Moon } from 'lucide-react';

export default function TopNav() {
  const pathname = usePathname();
  const normalizePath = (p: string) => p.replace(/\/$/, '') || '/';
  
  const [theme, setTheme] = React.useState<'dark' | 'light'>('dark');

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme as 'dark' | 'light');
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

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/history', label: 'Riwayat', icon: History },
    { href: '/budget', label: 'Tabungan', icon: Target },
    { href: '/piutang', label: 'Piutang', icon: HandCoins },
    { href: '/settlement', label: 'Settlement', icon: CalendarRange },
    { href: '/analytics', label: 'Analisis', icon: BarChart3 },
    { href: '/sync', label: 'Sinkronisasi', icon: RefreshCw },
    { href: '/settings', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-[color:var(--background)]/80 backdrop-blur-md border-b border-[color:var(--card-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <img src="/logo.png" alt="Cashflow Logo" className="w-6 h-6 object-contain rounded-lg shadow-emerald-500/20 shadow-md animate-pulse" />
              <span className="hidden sm:block">Cashflow</span>
            </span>
          </div>

          {/* Navigation Links & Theme Toggle */}
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar pl-4 sm:pl-0">
              {links.map((link) => {
                const isActive = normalizePath(pathname) === normalizePath(link.href);
                const Icon = link.icon;
                
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap
                      ${isActive 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'}
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className={`${isActive ? 'block' : 'hidden md:block'}`}>{link.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex-shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent transition-all cursor-pointer flex items-center justify-center bg-slate-900/40"
              title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}
