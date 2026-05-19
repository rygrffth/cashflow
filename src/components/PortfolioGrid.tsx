'use client';

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Wallet, Landmark, PiggyBank, Briefcase, Calendar, ShieldAlert } from 'lucide-react';

interface PortfolioProps {
  saldoBank: number;
  uangCash: number;
  tabungan: number;
  totalAset: number;
  saldoOp: number;
  batasHr: number;
  sisaHari: number;
}

export default function PortfolioGrid({
  saldoBank,
  uangCash,
  tabungan,
  totalAset,
  saldoOp,
  batasHr,
  sisaHari
}: PortfolioProps) {
  // Hydration safety flag
  const [isMounted, setIsMounted] = useState(false);

  // Toggle visibility states
  const [showBank, setShowBank] = useState(false);
  const [showCash, setShowCash] = useState(false);
  const [showTabungan, setShowTabungan] = useState(false);
  const [showAset, setShowAset] = useState(false);
  const [showOp, setShowOp] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      setShowBank(localStorage.getItem('show_bank') === 'true');
      setShowCash(localStorage.getItem('show_cash') === 'true');
      setShowTabungan(localStorage.getItem('show_tabungan') === 'true');
      setShowAset(localStorage.getItem('show_aset') === 'true');
      setShowOp(localStorage.getItem('show_op') === 'true');
    } catch (e) {
      console.error('Failed to read localStorage:', e);
    }
  }, []);

  // Persistent save helper
  const handleToggle = (key: string, value: boolean, setter: (val: boolean) => void) => {
    setter(value);
    try {
      localStorage.setItem(key, String(value));
    } catch (e) {
      console.error('Failed to write localStorage:', e);
    }
  };

  const formatCurrency = (value: number, show: boolean) => {
    if (!isMounted) return 'Rp ••••••••'; // Render placeholder on server to prevent mismatch
    return show ? `Rp ${value.toLocaleString('id-ID')}` : 'Rp ••••••••';
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
        <span>💵</span> Portofolio Aset
      </h2>

      {/* Row 1: The 4 Primary Portfolio Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Bank Card */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1">🏦 Saldo Bank / ATM</p>
              <h3 className="text-xl font-bold text-white transition-all duration-300">
                {formatCurrency(saldoBank, showBank)}
              </h3>
            </div>
            <span className="p-2 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20">
              <Landmark className="w-5 h-5" />
            </span>
          </div>
          <button
            onClick={() => handleToggle('show_bank', !showBank, setShowBank)}
            className="self-end mt-4 p-1.5 hover:bg-slate-800/60 rounded text-slate-400 hover:text-white transition-colors"
            title={showBank ? "Sembunyikan" : "Tampilkan"}
          >
            {showBank ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Cash Card */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1">💵 Uang Cash</p>
              <h3 className="text-xl font-bold text-white transition-all duration-300">
                {formatCurrency(uangCash, showCash)}
              </h3>
            </div>
            <span className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
              <Wallet className="w-5 h-5" />
            </span>
          </div>
          <button
            onClick={() => handleToggle('show_cash', !showCash, setShowCash)}
            className="self-end mt-4 p-1.5 hover:bg-slate-800/60 rounded text-slate-400 hover:text-white transition-colors"
            title={showCash ? "Sembunyikan" : "Tampilkan"}
          >
            {showCash ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Tabungan Card */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1">💰 Tabungan</p>
              <h3 className="text-xl font-bold text-white transition-all duration-300">
                {formatCurrency(tabungan, showTabungan)}
              </h3>
            </div>
            <span className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
              <PiggyBank className="w-5 h-5" />
            </span>
          </div>
          <button
            onClick={() => handleToggle('show_tabungan', !showTabungan, setShowTabungan)}
            className="self-end mt-4 p-1.5 hover:bg-slate-800/60 rounded text-slate-400 hover:text-white transition-colors"
            title={showTabungan ? "Sembunyikan" : "Tampilkan"}
          >
            {showTabungan ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Total Aset Card */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] bg-gradient-to-br from-slate-900/40 via-emerald-950/10 to-slate-900/40">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-emerald-400 tracking-wider uppercase mb-1">💎 Total Aset</p>
              <h3 className="text-xl font-bold text-white transition-all duration-300">
                {formatCurrency(totalAset, showAset)}
              </h3>
            </div>
            <span className="p-2 bg-teal-500/15 rounded-lg text-teal-400 border border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
              <span>💎</span>
            </span>
          </div>
          <button
            onClick={() => handleToggle('show_aset', !showAset, setShowAset)}
            className="self-end mt-4 p-1.5 hover:bg-slate-800/60 rounded text-slate-400 hover:text-white transition-colors"
            title={showAset ? "Sembunyikan" : "Tampilkan"}
          >
            {showAset ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Row 2: Secondary Columns (Dana Operasional, Limit Harian, Sisa Hari) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dana Operasional */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[130px] border-l-4 border-l-indigo-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1">📊 Dana Operasional</p>
              <h3 className="text-lg font-bold text-indigo-300">
                {formatCurrency(saldoOp, showOp)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Saldo Aset dikurangi Tabungan</p>
            </div>
            <span className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
              <Briefcase className="w-4 h-4" />
            </span>
          </div>
          <button
            onClick={() => handleToggle('show_op', !showOp, setShowOp)}
            className="self-end p-1.5 hover:bg-slate-800/60 rounded text-slate-400 hover:text-white transition-colors"
            title={showOp ? "Sembunyikan" : "Tampilkan"}
          >
            {showOp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Limit Harian */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[130px] border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-950/5 to-transparent">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1">⏳ Limit Jajan Harian</p>
              <h3 className="text-lg font-bold text-emerald-400">
                Rp {batasHr.toLocaleString('id-ID')}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Sisa Jatah Harian Halaman Utama</p>
            </div>
            <span className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
              <span>⏳</span>
            </span>
          </div>
          <div className="h-4"></div> {/* Spacing alignment */}
        </div>

        {/* Sisa Hari */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[130px] border-l-4 border-l-pink-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1">📅 Sisa Hari Ke Gajian</p>
              <h3 className="text-lg font-bold text-pink-400">
                {sisaHari} Hari
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Hari tersisa menuju gajian berikutnya</p>
            </div>
            <span className="p-2 bg-pink-500/10 rounded-lg text-pink-400 border border-pink-500/20">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="h-4"></div> {/* Spacing alignment */}
        </div>
      </div>
    </div>
  );
}
