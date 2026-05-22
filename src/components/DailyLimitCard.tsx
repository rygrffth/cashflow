'use client';

import React from 'react';

interface DailyLimitProps {
  batasHr: number;
  outHariHarian: number;
  saldoOp: number;
  sisaHari: number;
}

export default function DailyLimitCard({ batasHr, outHariHarian, saldoOp, sisaHari }: DailyLimitProps) {
  const sisaJatahHariIni = batasHr - outHariHarian;
  const warnaSisa = sisaJatahHariIni >= 0 ? 'text-emerald-400' : 'text-rose-500';
  const persentase = batasHr > 0 ? (outHariHarian / batasHr) * 100 : 0;

  const sisaHariBesok = Math.max(sisaHari - 1, 1);
  const realLimitBesok = sisaHari > 1 ? saldoOp / sisaHariBesok : saldoOp;
  const selisihLimit = realLimitBesok - batasHr;
  
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

      {/* Grid: 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Budget Hari Ini */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between border-t-4 border-t-emerald-500">
          <div>
            <p className="text-xs font-semibold text-emerald-400 tracking-wider uppercase mb-1">📊 BUDGET HARI INI</p>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
              Rp {batasHr.toLocaleString('id-ID')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-2">Jatah jajan hari ini</p>
          </div>
        </div>

        {/* Terpakai */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between border-t-4 border-t-amber-500">
          <div>
            <p className="text-xs font-semibold text-amber-400 tracking-wider uppercase mb-1">💰 TERPAKAI</p>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
              Rp {outHariHarian.toLocaleString('id-ID')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-2">
              {persentase.toFixed(1)}% dari jatah
            </p>
          </div>
        </div>

        {/* Sisa */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between border-t-4 border-t-indigo-500">
          <div>
            <p className="text-xs font-semibold text-indigo-400 tracking-wider uppercase mb-1">⏳ SISA</p>
            <h3 className={`text-xl sm:text-2xl font-black ${warnaSisa} mt-1`}>
              Rp {sisaJatahHariIni.toLocaleString('id-ID')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-2">Sisa jatah jajan hari ini</p>
          </div>
        </div>

        {/* Limit Esok Hari (Real) */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between border-t-4 border-t-sky-500">
          <div>
            <p className="text-xs font-semibold text-sky-400 tracking-wider uppercase mb-1">📅 LIMIT ESOK HARI</p>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
              Rp {realLimitBesok.toLocaleString('id-ID')}
            </h3>
            <p className={`text-[10px] mt-2 font-semibold flex items-center gap-1 ${selisihLimit > 0 ? 'text-emerald-400' : selisihLimit < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
              {selisihLimit > 0 ? (
                <>📈 Naik +Rp {selisihLimit.toLocaleString('id-ID')}</>
              ) : selisihLimit < 0 ? (
                <>📉 Turun -Rp {Math.abs(selisihLimit).toLocaleString('id-ID')}</>
              ) : (
                <>⚖️ Tetap Rp 0</>
              )}
            </p>
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
