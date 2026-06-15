'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, History, Target, HandCoins, Settings, 
  CalendarRange, BarChart3, RefreshCw, Sun, Moon, Landmark, 
  Menu, X 
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const normalizePath = (p: string) => p.replace(/\/$/, '') || '/';
  
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isOpen, setIsOpen] = useState(false); // Mobile drawer state

  useEffect(() => {
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

      {/* 📂 Sidebar Container (Desktop fixed sidebar & Mobile slide-in drawer) */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col bg-[color:var(--background)] border-r border-[color:var(--card-border)] transition-transform duration-300 ease-in-out md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Sidebar Header (Logo & Close Button on Mobile) */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-[color:var(--card-border)]">
          <Link 
            href="/" 
            className="text-lg font-black tracking-tight text-white flex items-center gap-2.5"
            onClick={() => setIsOpen(false)}
          >
            <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain rounded-lg shadow-emerald-500/20 shadow-md animate-pulse" />
            <span>Cashflow</span>
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
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto custom-scrollbar">
          {links.map((link) => {
            const isActive = normalizePath(pathname) === normalizePath(link.href);
            const Icon = link.icon;
            
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all
                  ${isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.04)]' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50 border border-transparent'}
                `}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer (Theme Toggler on Desktop) */}
        <div className="hidden md:flex p-4 border-t border-[color:var(--card-border)]">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-850/50 border border-transparent transition-all cursor-pointer bg-slate-900/25"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4.5 h-4.5 text-amber-400 flex-shrink-0" />
                <span>Mode Terang</span>
              </>
            ) : (
              <>
                <Moon className="w-4.5 h-4.5 text-indigo-400 flex-shrink-0" />
                <span>Mode Gelap</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
