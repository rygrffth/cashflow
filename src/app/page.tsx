'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import PortfolioGrid from '@/components/PortfolioGrid';
import { JAJAN_CATEGORIES } from '@/config/categories';
import DailyLimitCard from '@/components/DailyLimitCard';
import JajanSimulator from '@/components/JajanSimulator';
import TransactionForm from '@/components/TransactionForm';
import { RefreshCw, Clock, Landmark, Wallet, ListTodo, Lock, Unlock, Pencil, Trash2, Target, TrendingUp, PlusCircle } from 'lucide-react';
import { getWIBDateString, parseDateParts } from '@/lib/dateUtils';
import { calculateGajianCycle } from '@/lib/gajianUtils';
import { computeFinancialBalances } from '@/lib/balanceUtils';
import CurrencyInput from '@/components/CurrencyInput';

export default function Dashboard() {
  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeStr, setTimeStr] = useState('');

  // Primary Metrics States
  const [saldoBank, setSaldoBank] = useState(0);
  const [uangCash, setUangCash] = useState(0);
  const [tabungan, setTabungan] = useState(0);
  const [totalInvestasi, setTotalInvestasi] = useState(0);
  const [totalAset, setTotalAset] = useState(0);
  const [saldoOp, setSaldoOp] = useState(0);
  const [batasHr, setBatasHr] = useState(0);
  const [sisaHari, setSisaHari] = useState(1);
  const [targetGajianFormatted, setTargetGajianFormatted] = useState('');
  const [outHariHarian, setOutHariHarian] = useState(0);
  const [piutangCount, setPiutangCount] = useState(0);
  const [piutangSum, setPiutangSum] = useState(0);

  // Category Budgets Tracking State
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});
  const [monthlySpendMap, setMonthlySpendMap] = useState<Record<string, number>>({});
  const [excludeCategories, setExcludeCategories] = useState<string[]>([]);

  // Lists State
  const [todayTransactions, setTodayTransactions] = useState<any[]>([]);
  const [editingTxn, setEditingTxn] = useState<any | null>(null);

  // Transaction Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Secret Mode State
  const [secretCode, setSecretCode] = useState('');
  const [fakeOffset, setFakeOffset] = useState(140000000);
  const isRealMode = secretCode === 'naufal';

  // Listen to open-transaction-modal event dispatched from Sidebar FAB
  useEffect(() => {
    const handleOpenModal = () => setIsModalOpen(true);
    window.addEventListener('open-transaction-modal', handleOpenModal);
    return () => window.removeEventListener('open-transaction-modal', handleOpenModal);
  }, []);

  // Load secret code and fake offset on mount to synchronize with Settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('secretCode') || '';
      setSecretCode(saved);
      const savedOffset = localStorage.getItem('fake_asset_offset');
      if (savedOffset !== null && !isNaN(Number(savedOffset))) {
        setFakeOffset(Number(savedOffset));
      }
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

      // 4. Fetch Piutang (from table 'piutang')
      const { data: piutangData, error: piutangError } = await supabase
        .from('piutang')
        .select('*');

      if (piutangError) throw piutangError;

      // 5. Fetch Investasi (from table 'investasi')
      const { data: investasiData } = await supabase
        .from('investasi')
        .select('*');

      const activePiutang = (piutangData || []).filter(p => (p.status || p.Status) === 'Belum Lunas');
      setPiutangCount(activePiutang.length);
      setPiutangSum(activePiutang.reduce((s, i) => s + Number(i.nominal || i.Nominal || 0), 0));

      // --- CALCULATIONS ---
      // Tabungan / Real Darurat
      const tabunganSum = (savingData || []).reduce((acc, curr) => acc + (Number(curr.nominal_terkumpul) || 0), 0);
      setTabungan(tabunganSum);

      // Investasi (Nilai sekarang atau modal)
      const investasiSum = (investasiData || []).reduce((acc, curr) => acc + (Number(curr.nominal_sekarang ?? curr.nominal_modal) || 0), 0);
      setTotalInvestasi(investasiSum);

      // Saldo Finansial Terpusat (Bank, Cash, Total Aset termasuk Investasi & Tabungan, Saldo Op)
      const allTxns = txns || [];
      const balances = computeFinancialBalances(allTxns, tabunganSum, investasiSum);
      setSaldoBank(balances.saldoBank);
      setUangCash(balances.uangCash);
      setTotalAset(balances.totalAset);
      setSaldoOp(balances.saldoOp);

      // Siklus Gajian Dinamis (Otomatis bergulir bulanan jika tanggal terlewat, bebas diubah di Settings)
      const gajianSet = (settingsData || []).find(s => s.key === 'tanggal_gajian');
      const cycleResult = calculateGajianCycle(gajianSet?.value, todayWIB);
      setSisaHari(cycleResult.daysRemaining);
      setTargetGajianFormatted(cycleResult.targetDateFormatted);

      // Limit Harian
      const computedBatasHr = Math.max(0, Math.floor(balances.saldoOp / cycleResult.daysRemaining));
      setBatasHr(computedBatasHr);

      // Category Budgets from settings
      const budgetSet = (settingsData || []).find(s => s.key === 'category_budgets');
      if (budgetSet && budgetSet.value) {
        try {
          setCategoryBudgets(JSON.parse(budgetSet.value));
        } catch (e) {
          console.error('Error parsing category_budgets:', e);
        }
      }

      // Hitung pengeluaran bulanan per kategori untuk progress bar budget
      const { year: curY, month: curM } = parseDateParts(todayWIB);
      const catSpend: Record<string, number> = {};
      allTxns.forEach(t => {
        if (t.tipe === 'Pengeluaran' && t.tanggal && !(t.kategori === 'Scheduled Settlement' && t.status === 'Pending')) {
          const p = parseDateParts(t.tanggal);
          if (p.year === curY && p.month === curM) {
            const net = Number(t.nominal) - (Number(t.titipan) || 0);
            catSpend[t.kategori] = (catSpend[t.kategori] || 0) + net;
          }
        }
      });
      setMonthlySpendMap(catSpend);

      // Excluded Categories from settings (Filter Kategori Operational)
      const excludeSet = (settingsData || []).find(s => s.key === 'exclude_categories');
      let excludedCats: string[] = [];
      if (excludeSet && excludeSet.value) {
        try {
          excludedCats = typeof excludeSet.value === 'string'
            ? JSON.parse(excludeSet.value)
            : (Array.isArray(excludeSet.value) ? excludeSet.value : []);
          setExcludeCategories(excludedCats);
        } catch (e) {
          console.error('Error parsing exclude_categories:', e);
        }
      }

      // Out Hari Harian (Jajan Hari Ini yang dihitung ke Limit Harian)
      // Menghormati pengaturan Filter Kategori Operational (excludedCats)
      const isCountedInDailyLimit = (kat: string) => {
        const normKat = (kat || '').trim().toLowerCase();
        // Jika dicentang di Settings (dikecualikan), PASTI TIDAK DIHITUNG
        if (excludedCats.some(c => (c || '').trim().toLowerCase() === normKat)) return false;

        // Kategori non-harian bawaan
        const nonDailySystem = [
          'kos',
          'investasi',
          'transfer aset',
          'scheduled settlement',
          'penyesuaian',
          'menabung',
          'tarik tabungan',
          'piutang',
          'piutang kembali'
        ];
        if (nonDailySystem.includes(normKat)) return false;

        // Kategori jajan harian aktif
        return JAJAN_CATEGORIES.some(c => c.trim().toLowerCase() === normKat);
      };

      const todayJajanSum = allTxns
        .filter(t =>
          t.tipe === 'Pengeluaran' &&
          !(t.kategori === 'Scheduled Settlement' && t.status === 'Pending') &&
          isCountedInDailyLimit(t.kategori) &&
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

  const handleDeleteTxn = async (id: number) => {
    if (!confirm('Hapus transaksi ini secara permanen?')) return;
    try {
      const targetTxn = todayTransactions.find(t => t.id === id);
      if (targetTxn) {
        let tabId = targetTxn.tabungan_id;
        if (!tabId && (targetTxn.kategori === 'Menabung' || targetTxn.kategori === 'Tarik Tabungan')) {
          const { data: allTabs } = await supabase.from('tabungan').select('id, nama');
          const match = allTabs?.find(tb => (targetTxn.catatan || '').toLowerCase().includes(tb.nama.toLowerCase()));
          if (match) tabId = match.id;
          else if (allTabs && allTabs.length === 1) tabId = allTabs[0].id;
        }

        if (tabId) {
          try {
            const { data: targetTabungan } = await supabase
              .from('tabungan')
              .select('*')
              .eq('id', tabId)
              .single();

            if (targetTabungan) {
              const curTerkumpul = Number(targetTabungan.nominal_terkumpul) || 0;
              const nom = Number(targetTxn.nominal) || 0;
              const isSetor = targetTxn.kategori === 'Menabung' || targetTxn.tipe === 'Pengeluaran';
              const newTerkumpul = isSetor ? Math.max(0, curTerkumpul - nom) : curTerkumpul + nom;
              const newStatus = newTerkumpul >= Number(targetTabungan.target_nominal) ? 'Selesai' : 'Aktif';

              await supabase.from('tabungan').update({
                nominal_terkumpul: newTerkumpul,
                status: newStatus
              }).eq('id', tabId);
            }
          } catch (syncErr) {
            console.warn('Tabungan sync skipped on delete:', syncErr);
          }
        }
      }

      const { error } = await supabase.from('transaksi').delete().eq('id', id);
      if (error) throw error;
      fetchData(true);
    } catch (e: any) {
      console.error(e);
      alert(`Gagal menghapus transaksi: ${e.message}`);
    }
  };

  const handleUpdateTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxn) return;
    try {
      const oldTxn = todayTransactions.find(t => t.id === editingTxn.id);
      const newNominal = Number(editingTxn.nominal);
      const oldNominal = Number(oldTxn?.nominal || 0);
      const nominalDiff = newNominal - oldNominal;

      let tabId = editingTxn.tabungan_id;
      if (!tabId && (editingTxn.kategori === 'Menabung' || editingTxn.kategori === 'Tarik Tabungan')) {
        const { data: allTabs } = await supabase.from('tabungan').select('id, nama');
        const match = allTabs?.find(tb => (editingTxn.catatan || '').toLowerCase().includes(tb.nama.toLowerCase()));
        if (match) tabId = match.id;
        else if (allTabs && allTabs.length === 1) tabId = allTabs[0].id;
      }

      // Sinkron penuh ke target tabungan jika transaksi ini bertipe tabungan
      if (tabId && nominalDiff !== 0) {
        const { data: targetTabungan } = await supabase
          .from('tabungan')
          .select('*')
          .eq('id', tabId)
          .single();

        if (targetTabungan) {
          const curTerkumpul = Number(targetTabungan.nominal_terkumpul) || 0;
          const isSetor = editingTxn.kategori === 'Menabung' || editingTxn.tipe === 'Pengeluaran';
          const newTerkumpul = isSetor ? Math.max(0, curTerkumpul + nominalDiff) : Math.max(0, curTerkumpul - nominalDiff);
          const newStatus = newTerkumpul >= Number(targetTabungan.target_nominal) ? 'Selesai' : 'Aktif';

          await supabase.from('tabungan').update({
            nominal_terkumpul: newTerkumpul,
            status: newStatus
          }).eq('id', tabId);
        }
      }

      const { error } = await supabase
        .from('transaksi')
        .update({
          tanggal: editingTxn.tanggal,
          tipe: editingTxn.tipe,
          kategori: editingTxn.kategori,
          nominal: newNominal,
          catatan: editingTxn.catatan,
          sumber: editingTxn.sumber,
          status: editingTxn.status,
          tenggat_waktu: editingTxn.tenggat_waktu || ''
        })
        .eq('id', editingTxn.id);

      if (error) throw error;
      setEditingTxn(null);
      fetchData(true);
      alert('✅ Transaksi & saldo tabungan berhasil disinkronkan!');
    } catch (e: any) {
      console.error(e);
      alert(`Gagal memperbarui transaksi: ${e.message}`);
    }
  };

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
              <span title="Mode Admin">
                <Unlock className="w-5 h-5 text-rose-500 animate-pulse ml-2" />
              </span>
            ) : (
              <span title="Mode User">
                <Lock className="w-5 h-5 text-emerald-500 ml-2" />
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Clock Display */}
          <div className="px-3.5 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs font-semibold text-emerald-400 tracking-wider shadow-inner">
            {timeStr || '🕒 Memuat waktu...'}
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Refresh Icon */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition cursor-pointer active:scale-95"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* Prominent Desktop + Catat Transaksi Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold rounded-xl text-xs cursor-pointer transition-all shadow-[0_4px_16px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)]"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>Catat Transaksi</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid: Dashboard Modules */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Portfolios, Daily status, Simulator */}
        <div className="lg:col-span-2 space-y-8">
          {(() => {
            const displayedTotalAset = isRealMode ? totalAset : (fakeOffset + totalAset);
            // Tabungan ikut menyesuaikan secara dinamis saat bukan Mode Admin agar:
            // Saldo Aset dikurangi Tabungan = Dana Operasional (saldoOp)
            const displayedTabungan = isRealMode ? tabungan : Math.max(0, displayedTotalAset - saldoOp);

            return (
              <PortfolioGrid
                saldoBank={saldoBank}
                uangCash={uangCash}
                tabungan={displayedTabungan}
                totalAset={displayedTotalAset}
                saldoOp={saldoOp}
                batasHr={batasHr}
                sisaHari={sisaHari}
                targetGajianFormatted={targetGajianFormatted}
                isRealMode={isRealMode}
                secretCode={secretCode}
                setSecretCode={setSecretCode}
                piutangSum={piutangSum}
                piutangCount={piutangCount}
              />
            );
          })()}

          <DailyLimitCard
            batasHr={batasHr}
            outHariHarian={outHariHarian}
            saldoOp={saldoOp}
            sisaHari={sisaHari}
          />

          <JajanSimulator
            saldoOp={saldoOp}
            outHariHarian={outHariHarian}
            batasHr={batasHr}
            sisaHari={sisaHari}
            piutangCount={piutangCount}
            piutangSum={piutangSum}
          />

          {/* Visual Progress Budget Bulanan per Kategori */}
          {Object.keys(categoryBudgets).length > 0 && (
            <div className="glass-card p-6 border-slate-700/50 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <Target className="w-4 h-4" /> 🎯 Budget Kategori Bulan Ini
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">Realisasi vs Target Anggaran</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {Object.entries(categoryBudgets).map(([cat, budgetNominal]) => {
                  const spent = monthlySpendMap[cat] || 0;
                  const bNom = Number(budgetNominal) || 0;
                  const pct = bNom > 0 ? (spent / bNom) * 100 : 0;
                  const clampedPct = Math.min(pct, 100);
                  const sisa = bNom - spent;
                  const isOver = sisa < 0;

                  return (
                    <div key={cat} className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">{cat}</span>
                        <span className={`text-[11px] font-bold ${isOver ? 'text-rose-400' : 'text-slate-400'}`}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>

                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct > 100 ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${clampedPct}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>Terpakai: Rp {spent.toLocaleString('id-ID')}</span>
                        <span className={isOver ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                          {isOver ? `Lebih Rp ${Math.abs(sisa).toLocaleString('id-ID')}` : `Sisa Rp ${sisa.toLocaleString('id-ID')}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Column: Today's Transactions Log (Clean & Compact) */}
        <div className="space-y-8">
          <div className="glass-card p-6 border-slate-700/40 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <ListTodo className="w-4 h-4" /> 📋 Transaksi Hari Ini
              </h3>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Catat</span>
              </button>
            </div>

            {todayTransactions.length > 0 ? (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 no-scrollbar">
                {todayTransactions.map((t) => {
                  const normKat = (t.kategori || '').trim().toLowerCase();
                  const isExcludedFromLimit =
                    excludeCategories.some(c => (c || '').trim().toLowerCase() === normKat) ||
                    !JAJAN_CATEGORIES.some(c => c.trim().toLowerCase() === normKat);
                  return (
                    <div
                      key={t.id || Math.random()}
                      className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl flex justify-between items-center text-xs tracking-wide"
                    >
                      <div>
                        <p className="font-bold text-slate-200">{t.catatan || t.kategori}</p>
                        <div className="flex flex-wrap gap-2 items-center mt-1 text-[10px] text-slate-400">
                          <span className="px-1.5 py-0.5 bg-slate-800 rounded font-semibold text-slate-300">
                            {t.kategori}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            {t.sumber === 'Bank' ? <Landmark className="w-2.5 h-2.5" /> : <Wallet className="w-2.5 h-2.5" />}
                            {t.sumber}
                          </span>
                          {t.tipe === 'Pengeluaran' && isExcludedFromLimit && (
                            <>
                              <span>•</span>
                              <span className="text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium">
                                Dikecualikan dari Limit
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                    <div className="flex items-center gap-3">
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
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingTxn(t)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTxn(t.id)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-950/20 rounded-xl border border-slate-900/50 space-y-3">
                <p className="text-xs text-slate-400">
                  Belum ada transaksi aktif dicatat hari ini.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Catat Transaksi Sekarang</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 🚀 New Transaction Modal / Bottom Sheet */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-700/60 shadow-2xl bg-slate-950/95 animate-slideUp sm:animate-scaleUp">
            <TransactionForm
              saldoBank={saldoBank}
              uangCash={uangCash}
              onSuccess={() => {
                fetchData(true);
                setIsModalOpen(false);
              }}
              onClose={() => setIsModalOpen(false)}
            />
          </div>
        </div>
      )}



      {/* Edit Transaction Modal */}
      {editingTxn && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-card max-w-md w-full p-6 border-slate-700/50 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-400" /> Edit Transaksi
              </h3>
              <button
                onClick={() => setEditingTxn(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateTxn} className="space-y-4 text-sm">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400">Tanggal</label>
                <input
                  type="date"
                  value={editingTxn.tanggal}
                  onChange={e => setEditingTxn({ ...editingTxn, tanggal: e.target.value })}
                  onClick={(e) => (e.target as any).showPicker()}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Tipe</label>
                  <select
                    value={editingTxn.tipe}
                    onChange={e => setEditingTxn({ ...editingTxn, tipe: e.target.value })}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  >
                    <option value="Pengeluaran">Pengeluaran</option>
                    <option value="Pemasukan">Pemasukan</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Sumber</label>
                  <select
                    value={editingTxn.sumber}
                    onChange={e => setEditingTxn({ ...editingTxn, sumber: e.target.value })}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  >
                    <option value="Bank">Bank</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400">Kategori</label>
                <input
                  type="text"
                  value={editingTxn.kategori}
                  onChange={e => setEditingTxn({ ...editingTxn, kategori: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400">Nominal (Rp)</label>
                <CurrencyInput
                  placeholder="0"
                  value={editingTxn.nominal}
                  onChangeValue={val => setEditingTxn({ ...editingTxn, nominal: val })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs w-full font-bold"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400">Catatan</label>
                <input
                  type="text"
                  value={editingTxn.catatan || ''}
                  onChange={e => setEditingTxn({ ...editingTxn, catatan: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingTxn(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg text-xs font-black transition cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
