'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  BarChart3, RefreshCw, Calendar, Filter, TrendingUp, 
  ArrowUpRight, ArrowDownLeft, Landmark, Wallet, HelpCircle, 
  ChevronRight, CalendarDays
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, BarChart, PieChart, Pie, Cell,
  Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tabunganTotal, setTabunganTotal] = useState(0);
  const [gajianDate, setGajianDate] = useState(25); // Default 25

  // Tab state: 'grafik' | 'laporan'
  const [activeTab, setActiveTab] = useState<'grafik' | 'laporan'>('grafik');

  // Grafik Filter States
  const [graphRange, setGraphRange] = useState<'hari' | 'minggu' | 'bulan' | 'tahun' | 'semua' | 'custom'>('bulan');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Laporan Filter States
  const [laporanMode, setLaporanMode] = useState<'minggu' | 'bulan' | 'custom'>('bulan');
  const [selectedBulanOffset, setSelectedBulanOffset] = useState(0); // 0 = Bulan ini, 1 = 1 bulan lalu, dst.
  const [selectedMingguOffset, setSelectedMingguOffset] = useState(0); // 0 = Minggu ini, 1 = 1 minggu lalu, dst.
  const [laporanCustomStart, setLaporanCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [laporanCustomEnd, setLaporanCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Hydration safety flag
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const EXCLUDE_FROM_LIMIT = useMemo(() => ["Transfer Aset", "Scheduled Settlement", "Penyesuaian", "Menabung"], []);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. Fetch transactions
      const { data: txnData, error: txnErr } = await supabase
        .from('transaksi')
        .select('*');
      if (txnErr) throw txnErr;
      setTransactions(txnData || []);

      // 2. Fetch tabungan to calculate operational limit
      const { data: tabunganData } = await supabase.from('tabungan').select('nominal_terkumpul');
      const totalTabungan = (tabunganData || []).reduce((sum, item) => sum + Number(item.nominal_terkumpul), 0);
      setTabunganTotal(totalTabungan);

      // 3. Fetch setting gajian
      const { data: settingData } = await supabase.from('settings').select('*');
      if (settingData && settingData.length > 0) {
        const found = settingData.find(s => s.key === 'tanggal_gajian');
        if (found) setGajianDate(Number(found.value) || 25);
      }
    } catch (e) {
      console.error('Failed to fetch analytics data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Date limit logic (Batas Harian calculation)
  const stats = useMemo(() => {
    // Current local details
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Compute Bank and Cash balances
    let bankSum = 0;
    let cashSum = 0;
    transactions.forEach(t => {
      if (t.status === 'Cleared') {
        const nom = Number(t.nominal) || 0;
        if (t.tipe === 'Pemasukan') {
          if (t.sumber === 'Bank') bankSum += nom;
          else if (t.sumber === 'Cash') cashSum += nom;
        } else {
          if (t.sumber === 'Bank') bankSum -= nom;
          else if (t.sumber === 'Cash') cashSum -= nom;
        }
      }
    });

    const totalReal = bankSum + cashSum;
    const saldoOp = totalReal - tabunganTotal;

    // Remaining days to salary
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    let targetDate = new Date(currentYear, currentMonth, gajianDate);
    if (now.getDate() >= gajianDate) {
      targetDate = new Date(currentYear, currentMonth + 1, gajianDate);
    }
    
    const diffTime = targetDate.getTime() - now.getTime();
    const sisaHari = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const batasHr = Math.max(0, Math.floor(saldoOp / sisaHari));

    return { bankSum, cashSum, totalReal, saldoOp, sisaHari, batasHr, todayStr };
  }, [transactions, tabunganTotal, gajianDate]);

  // Period ranges mapping for Charts
  const chartFilteredData = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    let startLimit = new Date();
    let endLimit = new Date();

    if (graphRange === 'hari') {
      startLimit = new Date(today);
      endLimit = new Date(today);
    } else if (graphRange === 'minggu') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // start from Monday
      startLimit = new Date(today.setDate(diff));
      endLimit = new Date();
    } else if (graphRange === 'bulan') {
      startLimit = new Date(today.getFullYear(), today.getMonth(), 1);
      endLimit = new Date();
    } else if (graphRange === 'tahun') {
      startLimit = new Date(today.getFullYear(), 0, 1);
      endLimit = new Date();
    } else if (graphRange === 'custom') {
      startLimit = new Date(customStart);
      endLimit = new Date(customEnd);
    } else {
      // Semua
      startLimit = new Date(0);
      endLimit = new Date(8640000000000000);
    }

    startLimit.setHours(0,0,0,0);
    endLimit.setHours(23,59,59,999);

    return transactions.filter(t => {
      const d = new Date(t.tanggal);
      return d >= startLimit && d <= endLimit;
    });
  }, [transactions, graphRange, customStart, customEnd]);

  // 1. Chart: Daily spending trend (Bank vs Cash stacked + Total Line)
  const dailyTrendChartData = useMemo(() => {
    const map: Record<string, { date: string; Bank: number; Cash: number; Total: number }> = {};
    
    chartFilteredData.forEach(t => {
      if (t.tipe === 'Pengeluaran' && !EXCLUDE_FROM_LIMIT.includes(t.kategori)) {
        const dStr = t.tanggal;
        if (!map[dStr]) {
          map[dStr] = { date: dStr, Bank: 0, Cash: 0, Total: 0 };
        }
        const amt = Number(t.nominal) || 0;
        if (t.sumber === 'Bank') map[dStr].Bank += amt;
        else if (t.sumber === 'Cash') map[dStr].Cash += amt;
        map[dStr].Total += amt;
      }
    });

    return Object.values(map).sort((a,b) => a.date.localeCompare(b.date));
  }, [chartFilteredData, EXCLUDE_FROM_LIMIT]);

  // 2. Chart: Category distribution donut & top list
  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    chartFilteredData.forEach(t => {
      if (t.tipe === 'Pengeluaran' && !EXCLUDE_FROM_LIMIT.includes(t.kategori)) {
        const kat = t.kategori + (t.sumber === 'Cash' ? ' (Cash)' : '');
        map[kat] = (map[kat] || 0) + (Number(t.nominal) || 0);
      }
    });

    const colors = [
      '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', 
      '#EC4899', '#06B6D4', '#14B8A6', '#F43F5E', '#10B981'
    ];

    return Object.entries(map)
      .map(([name, value], idx) => ({
        name,
        value,
        color: colors[idx % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [chartFilteredData, EXCLUDE_FROM_LIMIT]);

  // 3. Chart: Cashflow bar (Pemasukan, Pengeluaran Bank, Pengeluaran Cash, Pending)
  const cashflowChartData = useMemo(() => {
    let pemasukan = 0;
    let bankKeluar = 0;
    let cashKeluar = 0;
    let pendingKeluar = 0;

    chartFilteredData.forEach(t => {
      const nom = Number(t.nominal) || 0;
      if (t.tipe === 'Pemasukan') {
        pemasukan += nom;
      } else if (t.tipe === 'Pengeluaran') {
        if (t.kategori === 'Scheduled Settlement' && t.status === 'Pending') {
          pendingKeluar += nom;
        } else {
          if (t.sumber === 'Bank') bankKeluar += nom;
          else if (t.sumber === 'Cash') cashKeluar += nom;
        }
      }
    });

    return [
      { name: 'Pemasukan', Nominal: pemasukan, fill: '#10B981' },
      { name: 'Exp Bank', Nominal: bankKeluar, fill: '#3B82F6' },
      { name: 'Exp Cash', Nominal: cashKeluar, fill: '#F59E0B' },
      { name: 'Pending', Nominal: pendingKeluar, fill: '#EF4444' }
    ];
  }, [chartFilteredData]);

  // 4. Chart: Comparison Month-over-Month (MoM)
  const momComparisonData = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    const lastMonth = curMonth === 0 ? 11 : curMonth - 1;
    const lastYear = curMonth === 0 ? curYear - 1 : curYear;

    const mapThis: Record<string, number> = {};
    const mapLast: Record<string, number> = {};

    transactions.forEach(t => {
      if (t.tipe === 'Pengeluaran' && !EXCLUDE_FROM_LIMIT.includes(t.kategori)) {
        const d = new Date(t.tanggal);
        const amt = Number(t.nominal) || 0;
        if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
          mapThis[t.kategori] = (mapThis[t.kategori] || 0) + amt;
        } else if (d.getMonth() === lastMonth && d.getFullYear() === lastYear) {
          mapLast[t.kategori] = (mapLast[t.kategori] || 0) + amt;
        }
      }
    });

    const allCategories = Array.from(new Set([...Object.keys(mapThis), ...Object.keys(mapLast)]));
    return allCategories.map(kat => ({
      kategori: kat,
      'Bulan Lalu': mapLast[kat] || 0,
      'Bulan Ini': mapThis[kat] || 0
    })).sort((a,b) => b['Bulan Ini'] - a['Bulan Ini']);
  }, [transactions, EXCLUDE_FROM_LIMIT]);

  // Multi-Period Report calculation
  const reportPeriodLimits = useMemo(() => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    let label = '';

    if (laporanMode === 'minggu') {
      // Selected week offset (0 = this week, 1 = last week, etc.)
      const mondayDiff = today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1);
      const startMonday = new Date(today.setDate(mondayDiff));
      startMonday.setDate(startMonday.getDate() - 7 * selectedMingguOffset);
      start = new Date(startMonday);
      end = new Date(startMonday);
      end.setDate(end.getDate() + 6);
      label = `Minggu ${selectedMingguOffset === 0 ? 'Ini' : `${selectedMingguOffset} Lalu`} (${start.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})} - ${end.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})})`;
    } else if (laporanMode === 'bulan') {
      const targetMonth = today.getMonth() - selectedBulanOffset;
      const targetYear = today.getFullYear();
      start = new Date(targetYear, targetMonth, 1);
      end = new Date(targetYear, targetMonth + 1, 0);
      label = start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    } else {
      start = new Date(laporanCustomStart);
      end = new Date(laporanCustomEnd);
      label = `${start.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})} - ${end.toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}`;
    }

    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
    return { start, end, label };
  }, [laporanMode, selectedBulanOffset, selectedMingguOffset, laporanCustomStart, laporanCustomEnd]);

  // Report calculations based on period limit
  const reportStats = useMemo(() => {
    const filtered = transactions.filter(t => {
      const d = new Date(t.tanggal);
      return d >= reportPeriodLimits.start && d <= reportPeriodLimits.end;
    });

    let totalIn = 0;
    let totalOut = 0;
    filtered.forEach(t => {
      const nom = Number(t.nominal) || 0;
      if (t.tipe === 'Pemasukan') {
        totalIn += nom;
      } else if (t.tipe === 'Pengeluaran' && !EXCLUDE_FROM_LIMIT.includes(t.kategori)) {
        totalOut += nom;
      }
    });

    const diffDays = Math.max(1, Math.ceil((reportPeriodLimits.end.getTime() - reportPeriodLimits.start.getTime()) / (1000 * 60 * 60 * 24)));
    const avgHarian = totalOut / diffDays;
    const netFlow = totalIn - totalOut;

    return { totalIn, totalOut, avgHarian, netFlow, diffDays };
  }, [transactions, reportPeriodLimits, EXCLUDE_FROM_LIMIT]);

  // Generating monthly options dynamically for select box
  const monthOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      options.push({
        value: i,
        label: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      });
    }
    return options;
  }, []);

  // Generating weekly options dynamically
  const weekOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    const mondayDiff = today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1);
    for (let i = 0; i < 4; i++) {
      const startMonday = new Date(today.getFullYear(), today.getMonth(), mondayDiff);
      startMonday.setDate(startMonday.getDate() - 7 * i);
      const endSunday = new Date(startMonday);
      endSunday.setDate(endSunday.getDate() + 6);
      options.push({
        value: i,
        label: `Minggu ${i === 0 ? 'Ini' : `${i} Lalu`} (${startMonday.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})} - ${endSunday.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})})`
      });
    }
    return options;
  }, []);

  if (loading) return <div className="text-center text-emerald-400 py-20 animate-pulse">Memuat Analisis & Grafik...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" /> Analisis & Laporan Multi-Periode
          </h1>
          <p className="text-sm text-slate-400">Pantau grafik tren arus kas dan laporan pengeluaran Anda.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex">
            <button
              onClick={() => setActiveTab('grafik')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'grafik' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200'}`}
            >
              📊 Grafik Analitik
            </button>
            <button
              onClick={() => setActiveTab('laporan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'laporan' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200'}`}
            >
              📋 Laporan Ringkas
            </button>
          </div>

          <button
            onClick={() => fetchData(true)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {activeTab === 'grafik' ? (
        // 📊 GRAFIK TAB
        <div className="space-y-6">
          {/* Chart Filter Range */}
          <div className="glass-card p-4 border-slate-700/50 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Rentang Waktu:</span>
              <select
                value={graphRange}
                onChange={(e) => setGraphRange(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 w-full"
              >
                <option value="hari">Hari Ini</option>
                <option value="minggu">Minggu Ini</option>
                <option value="bulan">Bulan Ini</option>
                <option value="tahun">Tahun Ini</option>
                <option value="semua">Semua Rentang</option>
                <option value="custom">Rentang Kustom</option>
              </select>
            </div>

            {graphRange === 'custom' && (
              <div className="flex items-center gap-2 w-full md:w-auto animate-fadeIn">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                />
                <span className="text-xs text-slate-500">s/d</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                />
              </div>
            )}

            <div className="flex-1"></div>
            <div className="text-[10px] text-slate-400 italic">
              *Menampilkan data terfilter ({chartFilteredData.length} transaksi)
            </div>
          </div>

          {/* Grid Layout Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Daily Spending (Composed Chart) */}
            <div className="glass-card p-5 border-slate-700/50 space-y-3">
              <h3 className="text-sm font-bold text-slate-200">📈 Tren Pengeluaran Harian (Bank vs Cash)</h3>
              <p className="text-[10px] text-slate-400">Pengeluaran harian vs batas harian jatah jajan (Rp {stats.batasHr.toLocaleString('id-ID')})</p>
              
              <div className="h-72 w-full pt-4">
                {isMounted && dailyTrendChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dailyTrendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="date" stroke="#94A3B8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} tickFormatter={(val) => `Rp ${val / 1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px' }} 
                        labelStyle={{ color: '#E2E8F0', fontWeight: 'bold', fontSize: '11px' }}
                        itemStyle={{ fontSize: '11px' }}
                        formatter={(val: number) => [`Rp ${val.toLocaleString('id-ID')}`]}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Bar dataKey="Bank" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Cash" stackId="a" fill="#10B981" radius={[2, 2, 0, 0]} />
                      <Line type="monotone" dataKey="Total" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4 }} />
                      {stats.batasHr > 0 && (
                        <ReferenceLine 
                          y={stats.batasHr} 
                          stroke="#EF4444" 
                          strokeDasharray="4 4" 
                          label={{ value: `Limit: Rp ${stats.batasHr.toLocaleString('id-ID')}`, fill: '#EF4444', fontSize: 8, position: 'insideTopRight' }} 
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                    Belum ada pengeluaran tercatat dalam rentang ini.
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Category Distribution Donut */}
            <div className="glass-card p-5 border-slate-700/50 space-y-3">
              <h3 className="text-sm font-bold text-slate-200">🍩 Distribusi Pengeluaran per Kategori</h3>
              <p className="text-[10px] text-slate-400">Total pembagian spending pengeluaran Bank & Cash</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="h-60 w-full relative flex items-center justify-center">
                  {isMounted && categoryChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px' }}
                          itemStyle={{ fontSize: '11px', color: '#FFF' }}
                          formatter={(val: number) => `Rp ${val.toLocaleString('id-ID')}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-slate-500 text-xs italic">Belum ada data.</div>
                  )}
                  {categoryChartData.length > 0 && (
                    <div className="absolute text-center">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Spending</p>
                      <p className="text-xs font-black text-white">
                        Rp {categoryChartData.reduce((s,c) => s + c.value, 0).toLocaleString('id-ID')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-center space-y-1.5 text-[11px] overflow-y-auto max-h-[240px] pr-2">
                  {categoryChartData.slice(0, 7).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-900/40 border border-slate-800/40 px-2 py-1 rounded">
                      <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-300 truncate" title={item.name}>{item.name}</span>
                      </div>
                      <span className="font-extrabold text-slate-100">Rp {item.value.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                  {categoryChartData.length > 7 && (
                    <div className="text-[10px] text-slate-500 text-center italic mt-1">
                      + {categoryChartData.length - 7} kategori lainnya
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chart 3: Cashflow Summary Bar Chart */}
            <div className="glass-card p-5 border-slate-700/50 space-y-3">
              <h3 className="text-sm font-bold text-slate-200">⚖️ Ringkasan Arus Kas</h3>
              <p className="text-[10px] text-slate-400">Total volume pemasukan vs pengeluaran bank/cash vs tagihan tertunda</p>

              <div className="h-64 w-full pt-4">
                {isMounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashflowChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} tickFormatter={(val) => `Rp ${val / 1000}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '11px' }}
                        formatter={(val: number) => [`Rp ${val.toLocaleString('id-ID')}`]}
                      />
                      <Bar dataKey="Nominal" radius={[4, 4, 0, 0]}>
                        {cashflowChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 4: Month-over-Month Comparison */}
            <div className="glass-card p-5 border-slate-700/50 space-y-3">
              <h3 className="text-sm font-bold text-slate-200">📊 Perbandingan Bulanan (Bulan Lalu vs Bulan Ini)</h3>
              <p className="text-[10px] text-slate-400">Perbandingan detail pengeluaran per kategori (Bulan Lalu vs Bulan Ini)</p>

              <div className="h-64 w-full pt-4">
                {isMounted && momComparisonData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={momComparisonData.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="kategori" stroke="#94A3B8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} tickFormatter={(val) => `Rp ${val / 1000}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '11px' }}
                        formatter={(val: number) => [`Rp ${val.toLocaleString('id-ID')}`]}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="Bulan Lalu" fill="#334155" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Bulan Ini" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                    Belum ada data perbandingan bulanan.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      ) : (
        // 📋 LAPORAN RINGKAS TAB
        <div className="space-y-6">
          
          {/* Laporan Config Filter */}
          <div className="glass-card p-5 border-slate-700/50 flex flex-col md:flex-row gap-5 items-center">
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <CalendarDays className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
                <button
                  onClick={() => setLaporanMode('minggu')}
                  className={`px-3 py-1 rounded text-[11px] font-bold ${laporanMode === 'minggu' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                >
                  Mingguan
                </button>
                <button
                  onClick={() => setLaporanMode('bulan')}
                  className={`px-3 py-1 rounded text-[11px] font-bold ${laporanMode === 'bulan' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                >
                  Bulanan
                </button>
                <button
                  onClick={() => setLaporanMode('custom')}
                  className={`px-3 py-1 rounded text-[11px] font-bold ${laporanMode === 'custom' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                >
                  Kustom
                </button>
              </div>
            </div>

            {laporanMode === 'minggu' && (
              <div className="flex items-center gap-2 w-full md:w-auto animate-fadeIn text-xs">
                <span className="text-slate-400 font-semibold whitespace-nowrap">Pilih Minggu:</span>
                <select
                  value={selectedMingguOffset}
                  onChange={(e) => setSelectedMingguOffset(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none w-full"
                >
                  {weekOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {laporanMode === 'bulan' && (
              <div className="flex items-center gap-2 w-full md:w-auto animate-fadeIn text-xs">
                <span className="text-slate-400 font-semibold whitespace-nowrap">Pilih Bulan:</span>
                <select
                  value={selectedBulanOffset}
                  onChange={(e) => setSelectedBulanOffset(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none w-full"
                >
                  {monthOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {laporanMode === 'custom' && (
              <div className="flex items-center gap-2 w-full md:w-auto animate-fadeIn text-xs">
                <input
                  type="date"
                  value={laporanCustomStart}
                  onChange={(e) => setLaporanCustomStart(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white"
                />
                <span className="text-slate-500">s/d</span>
                <input
                  type="date"
                  value={laporanCustomEnd}
                  onChange={(e) => setLaporanCustomEnd(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white"
                />
              </div>
            )}

            <div className="flex-1"></div>
            
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
              📂 Periode: {reportPeriodLimits.label}
            </span>
          </div>

          {/* Laporan Statistics Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Total Pemasukan */}
            <div className="glass-card p-5 border-slate-700/50 flex flex-col justify-between">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
                  <ArrowUpRight className="w-4.5 h-4.5 text-emerald-400 bg-emerald-500/10 p-0.5 rounded" /> Total Pemasukan
                </p>
                <p className="text-2xl font-black text-emerald-400">Rp {reportStats.totalIn.toLocaleString('id-ID')}</p>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Dana masuk pada periode terfilter</p>
            </div>

            {/* Total Pengeluaran */}
            <div className="glass-card p-5 border-slate-700/50 flex flex-col justify-between">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4.5 h-4.5 text-rose-400 bg-rose-500/10 p-0.5 rounded" /> Total Pengeluaran
                </p>
                <p className="text-2xl font-black text-rose-400">Rp {reportStats.totalOut.toLocaleString('id-ID')}</p>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Menghilangkan kategori Scheduled & Menabung</p>
            </div>

            {/* Net Cash Flow */}
            <div className="glass-card p-5 border-slate-700/50 flex flex-col justify-between">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">⚖️ Net Cash Flow</p>
                <p className={`text-2xl font-black ${reportStats.netFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Rp {reportStats.netFlow.toLocaleString('id-ID')}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded self-start mt-2 ${reportStats.netFlow >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {reportStats.netFlow >= 0 ? '📈 SURPLUS' : '📉 DEFISIT'}
              </span>
            </div>

            {/* Rata-rata Harian */}
            <div className="glass-card p-5 border-slate-700/50 flex flex-col justify-between">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">⏳ Rata-rata Harian</p>
                <p className="text-2xl font-black text-amber-400">Rp {Math.floor(reportStats.avgHarian).toLocaleString('id-ID')}</p>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Dihitung selama {reportStats.diffDays} hari aktif</p>
            </div>

          </div>

          {/* Insights / Tips */}
          <div className="glass-card p-6 border-emerald-500/20 bg-gradient-to-r from-emerald-950/5 to-transparent space-y-4">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <span>💡</span> Insights & Analisis Finansial
            </h3>
            
            <div className="space-y-2 text-slate-300 text-xs leading-relaxed">
              <div className="flex gap-2 items-start">
                <ChevronRight className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p>
                  Selama periode <strong>{reportPeriodLimits.label}</strong>, Anda mencatatkan rata-rata pengeluaran harian sebesar <strong>Rp {Math.floor(reportStats.avgHarian).toLocaleString('id-ID')}</strong>.
                </p>
              </div>
              <div className="flex gap-2 items-start">
                <ChevronRight className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p>
                  Status arus kas Anda adalah <strong className={reportStats.netFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{reportStats.netFlow >= 0 ? 'Surplus (Menguntungkan)' : 'Defisit (Waspada!)'}</strong> dengan selisih <strong>Rp {Math.abs(reportStats.netFlow).toLocaleString('id-ID')}</strong>.
                </p>
              </div>
              <div className="flex gap-2 items-start">
                <ChevronRight className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p>
                  Jika pengeluaran terus dipertahankan di rata-rata ini, Anda membutuhkan setidaknya <strong>Rp {(Math.floor(reportStats.avgHarian) * 30).toLocaleString('id-ID')}</strong> untuk operasional penuh selama 30 hari ke depan.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
