'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Wallet, Landmark, PiggyBank, Briefcase, Calendar, ShieldAlert, CalendarClock, ChevronRight, AlertTriangle, Lock, Unlock, Key } from 'lucide-react';
import { isPrivacyUnlocked, isMasterAdmin, getStoredSecondaryPassword, lockPrivacy, setActiveAccessCode } from '@/lib/authPrivacy';
import PrivacyUnlockModal from './PrivacyUnlockModal';

interface PortfolioProps {
  saldoBank: number;
  uangCash: number;
  tabungan: number;
  totalAset: number;
  saldoOp: number;
  batasHr: number;
  sisaHari: number;
  targetGajianFormatted?: string;
  isRealMode: boolean;
  secretCode: string;
  setSecretCode: (val: string) => void;
  piutangSum: number;
  piutangCount: number;
  settlementSum?: number;
  settlementCount?: number;
  urgentSettlementCount?: number;
  isPastRolledOver?: boolean;
}

export default function PortfolioGrid({
  saldoBank,
  uangCash,
  tabungan,
  totalAset,
  saldoOp,
  batasHr,
  sisaHari,
  targetGajianFormatted,
  isRealMode,
  secretCode,
  setSecretCode,
  piutangSum,
  piutangCount,
  settlementSum = 0,
  settlementCount = 0,
  urgentSettlementCount = 0,
  isPastRolledOver = false
}: PortfolioProps) {
  // Hydration safety flag
  const [isMounted, setIsMounted] = useState(false);

  // Toggle visibility states
  const [showBank, setShowBank] = useState(false);
  const [showCash, setShowCash] = useState(false);
  const [showTabungan, setShowTabungan] = useState(false);
  const [showAset, setShowAset] = useState(false);
  const [showOp, setShowOp] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);

  // Privacy Unlock Modal State
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const isUnlocked = isPrivacyUnlocked(secretCode);

  // Load preferences from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      setShowBank(localStorage.getItem('show_bank') === 'true');
      setShowCash(localStorage.getItem('show_cash') === 'true');
      setShowTabungan(localStorage.getItem('show_tabungan') === 'true');
      setShowAset(localStorage.getItem('show_aset') === 'true');
      setShowOp(localStorage.getItem('show_op') === 'true');
      setShowSettlement(localStorage.getItem('show_settlement') === 'true');
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

  const handleLockNow = () => {
    lockPrivacy();
    setSecretCode('');
  };

  const formatCurrency = (value: number, show: boolean) => {
    if (!isMounted) return 'Rp ••••••••'; // Render placeholder on server to prevent mismatch
    return show ? `Rp ${value.toLocaleString('id-ID')}` : 'Rp ••••••••';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
          <span>💵</span> Portofolio Aset
        </h2>

        {/* Quick Privacy Lock / Unlock Indicator */}
        <div className="flex items-center gap-2">
          {isUnlocked ? (
            <button
              onClick={handleLockNow}
              className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              title="Klik untuk mengunci kembali data sensitif"
            >
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isMasterAdmin(secretCode) ? 'Mode Admin' : 'Mode Biasa (Terbuka)'} • Kunci</span>
            </button>
          ) : (
            <button
              onClick={() => setIsUnlockModalOpen(true)}
              className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              title="Buka data nominal tabungan, total aset, settlement"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Buka Data Sensitif</span>
            </button>
          )}
        </div>
      </div>


      {/* Row 1: The 4 Primary Portfolio Cards (Horizontal Snap Scroll on Mobile, 4-col Grid on Desktop) */}
      <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        {/* Bank Card */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] min-w-[80vw] sm:min-w-[280px] md:min-w-0 snap-center shrink-0 md:shrink">
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
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] min-w-[80vw] sm:min-w-[280px] md:min-w-0 snap-center shrink-0 md:shrink">
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
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] min-w-[80vw] sm:min-w-[280px] md:min-w-0 snap-center shrink-0 md:shrink">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">💰 Tabungan</p>
                {!isUnlocked && (
                  <span className="text-[9px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    🔒 Terkunci
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white transition-all duration-300">
                {isUnlocked ? formatCurrency(tabungan, showTabungan) : 'Rp ••••••••'}
              </h3>
            </div>
            <span className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
              <PiggyBank className="w-5 h-5" />
            </span>
          </div>
          <div className="flex justify-end items-center gap-2 mt-4">
            {!isUnlocked ? (
              <button
                onClick={() => setIsUnlockModalOpen(true)}
                className="px-2 py-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded transition cursor-pointer flex items-center gap-1"
                title="Buka data tabungan dengan password"
              >
                <Lock className="w-3 h-3" /> Buka Kunci
              </button>
            ) : (
              <button
                onClick={() => handleToggle('show_tabungan', !showTabungan, setShowTabungan)}
                className="self-end p-1.5 hover:bg-slate-800/60 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={showTabungan ? "Sembunyikan" : "Tampilkan"}
              >
                {showTabungan ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Total Aset Card */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] min-w-[80vw] sm:min-w-[280px] md:min-w-0 snap-center shrink-0 md:shrink bg-gradient-to-br from-slate-900/40 via-emerald-950/10 to-slate-900/40">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">💎 Total Aset</p>
                {!isUnlocked && (
                  <span className="text-[9px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    🔒 Terkunci
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white transition-all duration-300">
                {isUnlocked ? formatCurrency(totalAset, showAset) : 'Rp ••••••••'}
              </h3>
            </div>
            <span className="p-2 bg-teal-500/15 rounded-lg text-teal-400 border border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
              <span>💎</span>
            </span>
          </div>
          <div className="flex justify-end items-center gap-2 mt-4">
            {!isUnlocked ? (
              <button
                onClick={() => setIsUnlockModalOpen(true)}
                className="px-2 py-1 text-[11px] font-bold text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 rounded transition cursor-pointer flex items-center gap-1"
                title="Buka data total aset dengan password"
              >
                <Lock className="w-3 h-3" /> Buka Kunci
              </button>
            ) : (
              <button
                onClick={() => handleToggle('show_aset', !showAset, setShowAset)}
                className="self-end p-1.5 hover:bg-slate-800/60 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={showAset ? "Sembunyikan" : "Tampilkan"}
              >
                {showAset ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Secondary Columns (Horizontal Snap Scroll on Mobile, 4-col Grid on Desktop) */}
      <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        {/* Dana Operasional */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[130px] min-w-[80vw] sm:min-w-[280px] md:min-w-0 snap-center shrink-0 md:shrink border-l-4 border-l-indigo-500">
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

        {/* Scheduled Settlement */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[130px] min-w-[80vw] sm:min-w-[280px] md:min-w-0 snap-center shrink-0 md:shrink border-l-4 border-l-rose-500 bg-gradient-to-r from-rose-950/10 to-transparent group">
          <div className="flex justify-between items-start">
            <Link href="/settlement" className="flex-1 cursor-pointer pr-2">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase group-hover:text-rose-300 transition-colors">
                  ⏳ Scheduled Settlement
                </p>
                {!isUnlocked && (
                  <span className="text-[9px] text-amber-400 font-bold bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                    🔒 Terkunci
                  </span>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="text-lg font-bold text-rose-400 group-hover:text-rose-300 transition-colors">
                {isUnlocked ? formatCurrency(settlementSum, showSettlement) : 'Rp ••••••••'}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-400">{settlementCount} tagihan pending</span>
                {urgentSettlementCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                    <AlertTriangle className="w-2.5 h-2.5" /> {urgentSettlementCount} segera
                  </span>
                )}
              </div>
            </Link>
            <Link href="/settlement" className="p-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg text-rose-400 border border-rose-500/20 transition-colors">
              <CalendarClock className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-800/40">
            <Link href="/settlement" className="text-[10px] text-rose-400/80 hover:text-rose-300 flex items-center gap-1 font-semibold">
              Buka Jadwal <ChevronRight className="w-3 h-3" />
            </Link>
            {!isUnlocked ? (
              <button
                onClick={() => setIsUnlockModalOpen(true)}
                className="px-2 py-0.5 text-[10px] font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded transition cursor-pointer flex items-center gap-1"
                title="Buka data tagihan dengan password"
              >
                <Lock className="w-2.5 h-2.5" /> Buka
              </button>
            ) : (
              <button
                onClick={() => handleToggle('show_settlement', !showSettlement, setShowSettlement)}
                className="p-1 hover:bg-slate-800/60 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={showSettlement ? "Sembunyikan" : "Tampilkan"}
              >
                {showSettlement ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Piutang Aktif */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[130px] min-w-[80vw] sm:min-w-[280px] md:min-w-0 snap-center shrink-0 md:shrink border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-955/5 to-transparent group">
          <div className="flex justify-between items-start">
            <Link href="/piutang" className="flex-1 cursor-pointer pr-2">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase group-hover:text-amber-300 transition-colors">
                  💸 Piutang Aktif
                </p>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="text-lg font-bold text-amber-400 group-hover:text-amber-300 transition-colors">
                Rp {piutangSum.toLocaleString('id-ID')}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">{piutangCount} piutang belum lunas</p>
            </Link>
            <Link href="/piutang" className="p-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg text-amber-400 border border-amber-500/20 transition-colors">
              <span>💸</span>
            </Link>
          </div>
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-800/40">
            <Link href="/piutang" className="text-[10px] text-amber-400/80 hover:text-amber-300 flex items-center gap-1 font-semibold">
              Kelola Piutang <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Sisa Hari */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between min-h-[130px] min-w-[80vw] sm:min-w-[280px] md:min-w-0 snap-center shrink-0 md:shrink border-l-4 border-l-pink-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1">📅 Sisa Hari Ke Gajian</p>
              <h3 className="text-lg font-bold text-pink-400">
                {sisaHari} Hari
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                {targetGajianFormatted ? `🎯 Target: ${targetGajianFormatted}` : 'Hari tersisa menuju gajian berikutnya'}
              </p>
              {isPastRolledOver && (
                <div className="mt-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30"
                    title="Tanggal gajian bulan ini telah lewat, target otomatis bergulir ke bulan berikutnya"
                  >
                    🔄 Siklus Baru (Auto-Roll)
                  </span>
                </div>
              )}
            </div>
            <span className="p-2 bg-pink-500/10 rounded-lg text-pink-400 border border-pink-500/20">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="h-4"></div> {/* Spacing alignment */}
        </div>
      </div>

      <PrivacyUnlockModal
        isOpen={isUnlockModalOpen}
        onClose={() => setIsUnlockModalOpen(false)}
        onSuccess={(isMaster) => {
          const pass = isMaster ? 'naufal' : getStoredSecondaryPassword();
          setSecretCode(pass);
          setIsUnlockModalOpen(false);
        }}
        title="Buka Kunci Data Sensitif"
      />
    </div>
  );
}
