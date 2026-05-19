'use client';

import React, { useState, useEffect } from 'react';
import { HelpCircle, AlertCircle, Info, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SimulatorProps {
  saldoOp: number;
  outHariHarian: number;
  batasHr: number;
  sisaHari: number;
}

export default function JajanSimulator({
  saldoOp,
  outHariHarian,
  batasHr,
  sisaHari
}: SimulatorProps) {
  // Batasi max simulasi agar tidak negatif
  const maxSimulasi = Math.max(0, Math.round(saldoOp + outHariHarian));
  
  // State for simulated spend
  const [simulasiJajan, setSimulasiJajan] = useState(0);

  // Initialize simulated jajan to today's actual jajan on load
  useEffect(() => {
    const defaultSim = Math.max(0, Math.min(Math.round(outHariHarian), maxSimulasi));
    setSimulasiJajan(defaultSim);
  }, [outHariHarian, maxSimulasi]);

  // Calculations
  const selisihTambah = simulasiJajan - outHariHarian;
  const danaSetelahSimulasi = saldoOp - selisihTambah;
  const sisaJatahSetelahSimulasi = batasHr - simulasiJajan;
  const persentaseSetelah = batasHr > 0 ? (simulasiJajan / batasHr) * 100 : 0;
  
  const sisaHariBesok = Math.max(sisaHari - 1, 1);
  const limitBesok = sisaHari > 1 ? danaSetelahSimulasi / sisaHariBesok : danaSetelahSimulasi;
  const selisihLimit = limitBesok - batasHr;

  return (
    <div className="space-y-6 glass-card p-6 border-slate-700/40">
      <h2 className="text-xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
        <span>🔮</span> Simulasi Jajan
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input controls */}
        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-300 flex justify-between items-center">
              <span>💰 Coba kalau jajan hari ini</span>
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-xs">
                Max: Rp {maxSimulasi.toLocaleString('id-ID')}
              </span>
            </label>
            
            {/* Number Input Box */}
            <input
              type="number"
              value={simulasiJajan}
              onChange={(e) => {
                const val = Math.max(0, Math.min(Number(e.target.value), maxSimulasi));
                setSimulasiJajan(val);
              }}
              step={5000}
              className="bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-bold focus:outline-none focus:border-emerald-500 transition-colors w-full"
            />
            
            {/* Slider */}
            <input
              type="range"
              min={0}
              max={maxSimulasi}
              step={5000}
              value={simulasiJajan}
              onChange={(e) => setSimulasiJajan(Number(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer mt-2"
            />
          </div>
        </div>

        {/* Right: Simulation Result Card */}
        <div className="bg-slate-900/35 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-center items-center text-center">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">📊 HASIL SIMULASI</p>
          <h3 className="text-3xl font-black text-amber-400 tracking-tight">
            Rp {simulasiJajan.toLocaleString('id-ID')}
          </h3>
          <p className="text-xs text-slate-400 mt-1">Kalau total jajan hari ini segini</p>
        </div>
      </div>

      {/* Grid: Dampak Simulasi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Metric 1: Sisa / Defisit */}
        <div className={`p-4 rounded-xl border flex flex-col justify-center ${sisaJatahSetelahSimulasi >= 0 ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'}`}>
          <p className="text-xs font-semibold text-slate-400 tracking-wider mb-1">Sisa / Defisit Harian</p>
          <p className={`text-base font-bold ${sisaJatahSetelahSimulasi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {sisaJatahSetelahSimulasi >= 0 
              ? `✅ Sisa: Rp ${sisaJatahSetelahSimulasi.toLocaleString('id-ID')}` 
              : `❌ Defisit: Rp ${Math.abs(sisaJatahSetelahSimulasi).toLocaleString('id-ID')}`
            }
          </p>
        </div>

        {/* Metric 2: Persentase */}
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/60 flex flex-col justify-center">
          <p className="text-xs font-semibold text-slate-400 tracking-wider mb-1">Porsi Budget Terpakai</p>
          <p className={`text-base font-bold ${persentaseSetelah <= 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {persentaseSetelah.toFixed(1)}% dari budget
          </p>
        </div>

        {/* Metric 3: Limit Besok */}
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/60 flex flex-col justify-center">
          <p className="text-xs font-semibold text-slate-400 tracking-wider mb-1">📅 Limit Esok Hari</p>
          {persentaseSetelah <= 100 ? (
            <div className="space-y-0.5">
              <p className="text-base font-bold text-sky-400">
                Rp {limitBesok.toLocaleString('id-ID')}
              </p>
              <p className={`text-[10px] flex items-center gap-1 ${selisihLimit > 0 ? 'text-emerald-400' : selisihLimit < 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {selisihLimit > 0 ? (
                  <>📈 Naik +Rp {selisihLimit.toLocaleString('id-ID')}</>
                ) : selisihLimit < 0 ? (
                  <>📉 Turun -Rp {Math.abs(selisihLimit).toLocaleString('id-ID')}</>
                ) : (
                  <>⚖️ Tetap Rp 0</>
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm font-bold text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> Melebihi Budget!
            </p>
          )}
        </div>
      </div>

      {/* Rekomendasi Section */}
      <div className="border-t border-slate-800/60 pt-5 space-y-3">
        <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Rekomendasi Dinamis
        </h3>

        {simulasiJajan > outHariHarian ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-slate-300 space-y-2 text-sm">
            <p className="font-semibold text-amber-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              ⚠️ Jika jajan bertambah Rp {Math.abs(selisihTambah).toLocaleString('id-ID')} hari ini (Total: Rp {simulasiJajan.toLocaleString('id-ID')})
            </p>
            {sisaJatahSetelahSimulasi >= 0 ? (
              <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1 text-xs">
                <li>Sisa budget jajan Anda hari ini tinggal: <strong className="text-slate-300">Rp {sisaJatahSetelahSimulasi.toLocaleString('id-ID')}</strong>.</li>
                {selisihLimit < 0 ? (
                  <li>Dampak esok hari: Jatah limit harian Anda besok akan <strong className="text-amber-400">turun Rp {Math.abs(selisihLimit).toLocaleString('id-ID')}</strong> menjadi Rp {limitBesok.toLocaleString('id-ID')}.</li>
                ) : (
                  <li>Dampak esok hari: Limit harian Anda tetap <strong className="text-emerald-400">naik Rp {selisihLimit.toLocaleString('id-ID')}</strong> menjadi Rp {limitBesok.toLocaleString('id-ID')}.</li>
                )}
              </ul>
            ) : (
              <p className="text-rose-400 font-semibold text-xs bg-rose-500/5 p-2 rounded border border-rose-500/10 mt-1">
                🚨 DEFISIT Rp {Math.abs(sisaJatahSetelahSimulasi).toLocaleString('id-ID')}! Anda harus berhemat besok atau mengambil dari tabungan/dana darurat.
              </p>
            )}
          </div>
        ) : simulasiJajan < outHariHarian ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-slate-300 space-y-2 text-sm">
            <p className="font-semibold text-emerald-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              🎉 Jika jajan dikurangi Rp {Math.abs(selisihTambah).toLocaleString('id-ID')} (Total: Rp {simulasiJajan.toLocaleString('id-ID')})
            </p>
            <p className="text-slate-400 text-xs pl-1">
              Dampak esok hari: Limit jajan harian Anda besok akan <strong className="text-emerald-400">naik sebesar Rp {selisihLimit.toLocaleString('id-ID')}</strong> menjadi Rp {limitBesok.toLocaleString('id-ID')}! Pilihan hidup hemat hari ini mengamankan jatah besok.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-slate-300 space-y-2 text-sm">
            <p className="font-semibold text-blue-400 flex items-center gap-2">
              <Info className="w-4 h-4" />
              ⚖️ Jika tidak ada jajan lagi hari ini (Tetap Rp {outHariHarian.toLocaleString('id-ID')})
            </p>
            <p className="text-slate-400 text-xs pl-1">
              Dampak esok hari: Limit jajan harian Anda besok akan disesuaikan menjadi <strong className="text-emerald-400">Rp {limitBesok.toLocaleString('id-ID')}</strong> ({selisihLimit >= 0 ? `naik +Rp ${selisihLimit.toLocaleString('id-ID')}` : `turun -Rp ${Math.abs(selisihLimit).toLocaleString('id-ID')}`}).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
