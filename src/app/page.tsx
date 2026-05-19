'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import PortfolioGrid from '@/components/PortfolioGrid';
import DailyLimitCard from '@/components/DailyLimitCard';
import JajanSimulator from '@/components/JajanSimulator';
import TransactionForm from '@/components/TransactionForm';
import { RefreshCw, Clock, Landmark, Wallet, ListTodo, Lock, Unlock } from 'lucide-react';

export default function Dashboard() {
  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeStr, setTimeStr] = useState('');

  // Primary Metrics States
  const [saldoBank, setSaldoBank] = useState(0);
  const [uangCash, setUangCash] = useState(0);
  const [tabungan, setTabungan] = useState(0);
  const [totalAset, setTotalAset] = useState(0);
  const [saldoOp, setSaldoOp] = useState(0);
  const [batasHr, setBatasHr] = useState(0);
  const [sisaHari, setSisaHari] = useState(1);
  const [outHariHarian, setOutHariHarian] = useState(0);

  // Lists State
  const [todayTransactions, setTodayTransactions] = useState<any[]>([]);

  // Secret Mode State
  const [secretCode, setSecretCode] = useState('');
  const isRealMode = secretCode === 'naufal';

  // Load secret code on mount to synchronize with Settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('secretCode') || '';
      setSecretCode(saved);
    }
  }, []);

  // Clock Update Effect (Runs in browser only)
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const dy = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const h = String(n.getHours()).padStart(2, '0');
      const m = String(n.getMinutes()).padStart(2, '0');
      const s = String(n.getSeconds()).padStart(2, '0');
      setTimeStr(`🕒 ${dy[n.getDay()]}, ${n.getDate()} ${mn[n.getMonth()]} ${n.getFullYear()} | ${h}:${m}:${s}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // WIB timezone calculation helper
  const getWIBDateString = () => {
    const d = new Date();
    // Convert to UTC+7 (WIB)
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));
    return wib.toISOString().split('T')[0];
  };

  // Centralized Data Fetcher
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const todayWIB = getWIBDateString();

      // 1. Fetch Transactions (from table 'transaksi')
      const { data: txns, error: txError } = await supabase
        .from('transaksi')
        .select('*');
      
      if (txError) throw txError;

      // 2. Fetch Tabungan (from table 'tabungan')
      const { data: savingData, error: saveError } = await supabase
        .from('tabungan')
        .select('*');

      if (saveError) throw saveError;

      // 3. Fetch Settings (from table 'settings')
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('*');

      if (settingsError) throw settingsError;

      // --- CALCULATIONS (Mirroring pub.py Python logic exactly) ---

      // Tabungan / Real Darurat
      const tabunganSum = (savingData || []).reduce((acc, curr) => acc + (Number(curr.nominal_terkumpul) || 0), 0);
      setTabungan(tabunganSum);

      // Saldo Bank (Incomes - active Expenses)
      const allTxns = txns || [];
      
      const totalInBank = allTxns
        .filter(t => t.tipe === 'Pemasukan' && t.sumber === 'Bank')
        .reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
      
      const totalOutBank = allTxns
        .filter(t => t.tipe === 'Pengeluaran' && t.sumber === 'Bank' && !(t.kategori === 'Scheduled Settlement' && t.status === 'Pending'))
        .reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);

      const computedBank = totalInBank - totalOutBank;
      setSaldoBank(computedBank);

      // Saldo Cash (Incomes - active Expenses)
      const totalInCash = allTxns
        .filter(t => t.tipe === 'Pemasukan' && t.sumber === 'Cash')
        .reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
      
      const totalOutCash = allTxns
        .filter(t => t.tipe === 'Pengeluaran' && t.sumber === 'Cash' && !(t.kategori === 'Scheduled Settlement' && t.status === 'Pending'))
        .reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);

      const computedCash = totalInCash - totalOutCash;
      setUangCash(computedCash);

      // Total Aset
      const computedTotalReal = computedBank + computedCash;
      setTotalAset(computedTotalReal);

      // Dana Operasional
      const computedOp = computedBank + computedCash - tabunganSum;
      setSaldoOp(computedOp);

      // Get gajian date settings
      const gajianSet = (settingsData || []).find(s => s.key === 'tanggal_gajian');
      let calculatedDays = 1;

      if (gajianSet && gajianSet.value) {
        try {
          const tDate = new Date(todayWIB + 'T00:00:00');
          const gDate = new Date(gajianSet.value + 'T00:00:00');
          const timeDiff = gDate.getTime() - tDate.getTime();
          calculatedDays = Math.max(Math.ceil(timeDiff / (1000 * 3600 * 24)), 1);
        } catch (e) {
          console.error('Error calculating days remaining:', e);
        }
      }
      setSisaHari(calculatedDays);

      // Limit Harian
      const computedBatasHr = computedOp / calculatedDays;
      setBatasHr(computedBatasHr);

      // Out Hari Harian (Makan & Bensin spent today, active)
      const jajanCategories = ["Makan", "Bensin / Mobilitas", "Makan (Sahur/Buka)"];
      
      const todayJajanSum = allTxns
        .filter(t => 
          t.tipe === 'Pengeluaran' &&
          !(t.kategori === 'Scheduled Settlement' && t.status === 'Pending') &&
          jajanCategories.includes(t.kategori) &&
          t.tanggal === todayWIB
        )
        .reduce((acc, curr) => {
          const net = Number(curr.nominal) - (Number(curr.titipan) || 0);
          return acc + net;
        }, 0);
      
      setOutHariHarian(todayJajanSum);

      // Today's transaction log (filter current date, sort newest)
      const filteredTodayLogs = allTxns
        .filter(t => t.tanggal === todayWIB)
        .sort((a, b) => b.id - a.id); // Assuming serial incrementing IDs
      
      setTodayTransactions(filteredTodayLogs);

    } catch (error) {
      console.error('Data loading failure:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0B0F19]">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-emerald-500/25 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>
        <p className="text-sm font-semibold tracking-widest text-emerald-400/80 uppercase animate-pulse">
          Memuat Dashboard Keuangan...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">💼 Financial Dashboard</h1>
            {isRealMode ? (
              <Unlock className="w-5 h-5 text-rose-500 animate-pulse ml-2" title="Mode Admin" />
            ) : (
              <Lock className="w-5 h-5 text-emerald-500 ml-2" title="Mode User" />
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 w-full md:w-auto">
          {/* Clock Display */}
          <div className="px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs font-semibold text-emerald-400 tracking-wider shadow-inner w-full sm:w-auto text-center md:text-right">
            {timeStr || '🕒 Memuat waktu...'}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md w-full sm:w-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Sinkronisasi...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      {/* Main Grid: Dashboard Modules */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Portfolios, Daily status, Simulator */}
        <div className="lg:col-span-2 space-y-8">
          <PortfolioGrid
            saldoBank={saldoBank}
            uangCash={uangCash}
            tabungan={tabungan}
            totalAset={isRealMode ? totalAset : 140000000 + totalAset}
            saldoOp={saldoOp}
            batasHr={batasHr}
            sisaHari={sisaHari}
            isRealMode={isRealMode}
            secretCode={secretCode}
            setSecretCode={setSecretCode}
          />

          <DailyLimitCard
            batasHr={batasHr}
            outHariHarian={outHariHarian}
          />

          <JajanSimulator
            saldoOp={saldoOp}
            outHariHarian={outHariHarian}
            batasHr={batasHr}
            sisaHari={sisaHari}
          />
        </div>

        {/* Right 1 Column: Form and Logs */}
        <div className="space-y-8">
          {/* Add Transaction Form */}
          <TransactionForm
            saldoBank={saldoBank}
            uangCash={uangCash}
            onSuccess={() => fetchData(true)}
          />

          {/* Today's Transactions Log */}
          <div className="glass-card p-6 border-slate-700/40 space-y-4">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <ListTodo className="w-4 h-4" /> 📋 Transaksi Hari Ini
            </h3>

            {todayTransactions.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                {todayTransactions.map((t) => (
                  <div
                    key={t.id || Math.random()}
                    className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl flex justify-between items-center text-xs tracking-wide"
                  >
                    <div>
                      <p className="font-bold text-slate-200">{t.catatan || t.kategori}</p>
                      <div className="flex gap-2 items-center mt-1 text-[10px] text-slate-400">
                        <span className="px-1.5 py-0.5 bg-slate-800 rounded font-semibold text-slate-300">
                          {t.kategori}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          {t.sumber === 'Bank' ? <Landmark className="w-2.5 h-2.5" /> : <Wallet className="w-2.5 h-2.5" />}
                          {t.sumber}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`font-black ${t.tipe === 'Pengeluaran' ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {t.tipe === 'Pengeluaran' ? '-' : '+'}Rp {t.nominal.toLocaleString('id-ID')}
                      </p>
                      {t.kategori === 'Scheduled Settlement' && (
                        <span className={`text-[9px] px-1 rounded font-bold ${t.status === 'Pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {t.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6 bg-slate-950/20 rounded-xl border border-slate-900/50">
                Belum ada transaksi aktif dicatat hari ini.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] text-slate-500 border-t border-slate-900/80 pt-6 mt-12 tracking-wider">
        NEXT-GEN CASHFLOW DASHBOARD • DESIGNED WITH GLASSMORPHISM AND TAILWIND CSS
      </footer>
    </div>
  );
}
