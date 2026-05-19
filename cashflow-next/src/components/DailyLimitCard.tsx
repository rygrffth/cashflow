'use client';

import React from 'react';

interface DailyLimitProps {
  batasHr: number;
  outHariHarian: number;
}

export default function DailyLimitCard({ batasHr, outHariHarian }: DailyLimitProps) {
  const sisaJatahHariIni = batasHr - outHariHarian;
  const warnaSisa = sisaJatahHariIni >= 0 ? 'text-emerald-400' : 'text-rose-500';
  const persentase = batasHr > 0 ? (outHariHarian / batasHr) * 100 : 0;
  
  // Clamped percentage for progress bar width
  const clampedPercent = Math.max(0, Math.min(persentase, 100));

  // Determine status message and colors
  const getStatusContent = () => {
    if (persentase < 30) {
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        text: `🟢 Aman Banget! Kamu masih bisa jajan Rp ${sisaJatahHariIni.toLocaleString('id-ID')} hari ini`
      };
    } else if (persentase < 50) {
      return {
        bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        text: `🔵 Hemat! Sisa budget Rp ${sisaJatahHariIni.toLocaleString('id-ID')}`
      };
    } else if (persentase < 70) {
      return {
        bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        text: `🟡 Perhatian! Budget sudah ${persentase.toFixed(1)}% terpakai`
      };
    } else if (persentase < 90) {
      return {
        bg: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
        text: `🟠 Hampir Habis! Sisa Rp ${sisaJatahHariIni.toLocaleString('id-ID')}`
      };
    } else {
      return {
        bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
        text: `🔴 KRITIS! Budget hampir habis! Sisa Rp ${sisaJatahHariIni.toLocaleString('id-ID')}`
      };
    }
  };

  const status = getStatusContent();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
        <span>💰</span> Limit Harian
      </h2>

      {/* Grid: 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Budget Hari Ini */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between border-t-4 border-t-emerald-500">
          <div>
            <p className="text-xs font-semibold text-emerald-400 tracking-wider uppercase mb-1">📊 BUDGET HARI INI</p>
            <h3 className="text-2xl font-black text-white mt-1">
              Rp {batasHr.toLocaleString('id-ID')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-2">Maksimal belanja jajan hari ini</p>
          </div>
        </div>

        {/* Terpakai */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between border-t-4 border-t-amber-500">
          <div>
            <p className="text-xs font-semibold text-amber-400 tracking-wider uppercase mb-1">💰 TERPAKAI</p>
            <h3 className="text-2xl font-black text-white mt-1">
              Rp {outHariHarian.toLocaleString('id-ID')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-2">
              {persentase.toFixed(1)}% dari budget harian
            </p>
          </div>
        </div>

        {/* Sisa */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between border-t-4 border-t-indigo-500">
          <div>
            <p className="text-xs font-semibold text-indigo-400 tracking-wider uppercase mb-1">⏳ SISA</p>
            <h3 className={`text-2xl font-black ${warnaSisa} mt-1`}>
              Rp {sisaJatahHariIni.toLocaleString('id-ID')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-2">Sisa dana jajan yang aman dipakai</p>
          </div>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="space-y-3">
        <div className="w-full bg-slate-800/80 rounded-full h-3.5 p-0.5 border border-slate-700/50 overflow-hidden">
          <div
            className="progress-bar-fill h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
            style={{ width: `${clampedPercent}%` }}
          ></div>
        </div>

        {/* Status Message Alert */}
        <div className={`p-4 rounded-xl border ${status.bg} text-sm font-semibold tracking-wide shadow-sm flex items-center gap-3 transition-all duration-300`}>
          {status.text}
        </div>
      </div>
    </div>
  );
}
