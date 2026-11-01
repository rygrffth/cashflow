'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp, TrendingDown, Briefcase, PlusCircle, Trash2,
  Pencil, RefreshCw, AlertTriangle, CheckCircle, Database, HelpCircle,
  Zap, Search, Activity, Sparkles, LineChart as ChartIcon, X, Lock, Unlock, Key
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import CurrencyInput from '@/components/CurrencyInput';
import { getWIBDateString } from '@/lib/dateUtils';
import { computeFinancialBalances } from '@/lib/balanceUtils';
import { isPrivacyUnlocked, lockPrivacy, getStoredSecondaryPassword } from '@/lib/authPrivacy';
import PrivacyUnlockModal from '@/components/PrivacyUnlockModal';

export default function InvestasiPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [investasiList, setInvestasiList] = useState<any[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);

  // Privacy unlock state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);

  // Active balances for validation
  const [saldoBank, setSaldoBank] = useState(0);
  const [uangCash, setUangCash] = useState(0);

  // Form states
  const [nama, setNama] = useState('');
  const [kategori, setKategori] = useState('Saham');
  const [nominalModal, setNominalModal] = useState<string>('');
  const [nominalSekarang, setNominalSekarang] = useState<string>('');
  const [catatan, setCatatan] = useState('');
  const [potongSaldo, setPotongSaldo] = useState<'Tidak' | 'Bank' | 'Cash'>('Tidak');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Live Market Price States
  const [tickerSymbol, setTickerSymbol] = useState('');
  const [checkingPrice, setCheckingPrice] = useState(false);
  const [liveQuote, setLiveQuote] = useState<{ price: number; change24h: number; name: string; currency: string; unit: string } | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [quantity, setQuantity] = useState('');
  const [syncingAll, setSyncingAll] = useState(false);
  const [livePricesCache, setLivePricesCache] = useState<Record<string, { price: number; change24h: number; name?: string }>>({});

  // Market Benchmark & Interactive Chart States
  const [marketOverview, setMarketOverview] = useState<any | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [selectedMarketTab, setSelectedMarketTab] = useState<'EMAS' | 'USDIDR' | 'IHSG' | 'BTC'>('EMAS');
  const [marketRange, setMarketRange] = useState<'7d' | '1mo' | '3mo' | '1y'>('7d');
  const [marketChartCache, setMarketChartCache] = useState<Record<string, Array<{ date: string; price: number }>>>({});
  const [loadingMarketChart, setLoadingMarketChart] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ date: string; price: number } | null>(null);
  const [activeChart, setActiveChart] = useState<{
    symbol: string;
    name: string;
    unit: string;
    range: string;
    points: Array<{ date: string; price: number }>;
    loading: boolean;
  } | null>(null);

  // Editing state
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editKategori, setEditKategori] = useState('');
  const [editModal, setEditModal] = useState('');
  const [editSekarang, setEditSekarang] = useState('');
  const [editCatatan, setEditCatatan] = useState('');
  const [editingLoading, setEditingLoading] = useState(false);

  // Liquidation / Delete Modal state
  const [liquidatingAsset, setLiquidatingAsset] = useState<any | null>(null);
  const [liquidateDestination, setLiquidateDestination] = useState<'None' | 'Bank' | 'Cash'>('Bank');
  const [liquidateNominal, setLiquidateNominal] = useState<string>('');
  const [liquidateLoading, setLiquidateLoading] = useState(false);

  // Fetch investments
  const fetchInvestasi = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setDbError(null);

    try {
      const { data, error } = await supabase
        .from('investasi')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          setDbError('Tabel investasi belum dibuat di database Supabase Anda.');
        } else {
          throw error;
        }
      } else {
        setInvestasiList(data || []);
      }

      // Fetch active transactions to calculate available Bank & Cash balances
      const { data: txns } = await supabase
        .from('transaksi')
        .select('tipe, sumber, nominal, kategori, status');

      if (txns) {
        const computed = computeFinancialBalances(txns);
        setSaldoBank(computed.saldoBank);
        setUangCash(computed.uangCash);
      }
    } catch (e: any) {
      console.error(e);
      setDbError(e.message || 'Gagal memuat data investasi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Helper to extract ticker from asset name/category
  const extractTicker = useCallback((assetName: string, assetCat: string): string | null => {
    const upper = assetName.toUpperCase();
    if (assetCat === 'Emas' || upper.includes('EMAS') || upper.includes('ANTAM') || upper.includes('LOGAM MULIA')) return 'EMAS';
    if (upper.includes('BTC') || upper.includes('BITCOIN')) return 'BTC';
    if (upper.includes('ETH') || upper.includes('ETHEREUM')) return 'ETH';
    if (upper.includes('SOL') || upper.includes('SOLANA')) return 'SOL';
    if (upper.includes('DOGE')) return 'DOGE';
    if (upper.includes('USDT')) return 'USDT';
    if (upper.includes('BNB')) return 'BNB';
    if (upper.includes('XRP')) return 'XRP';

    // Match 4-letter stock code like BBCA, BBRI, BMRI, GOTO, TLKM, ASII
    const stockMatch = upper.match(/\b([A-Z]{4})\b/);
    if (stockMatch) return stockMatch[1];
    return null;
  }, []);

  // Helper to determine unit type and multiplier (Lot vs Gram vs Koin)
  const getUnitSpec = useCallback((cat: string, quote?: any) => {
    const isEmas = cat === 'Emas' || quote?.symbol === 'EMAS' || quote?.category === 'Emas';
    if (isEmas) {
      return {
        unitName: 'gram',
        label: 'gram emas',
        placeholder: 'Jumlah Gram...',
        hint: '1 gram × harga pasar',
        multiplier: 1
      };
    }

    const isCrypto = cat === 'Crypto' || quote?.category === 'Crypto';
    if (isCrypto) {
      return {
        unitName: 'koin',
        label: 'koin / token',
        placeholder: 'Jumlah Koin (BTC/ETH)...',
        hint: 'koin × harga pasar',
        multiplier: 1
      };
    }

    const isSaham = cat === 'Saham' || quote?.category === 'Saham';
    if (isSaham) {
      return {
        unitName: 'lot',
        label: 'lot saham (1 lot = 100 lbr)',
        placeholder: 'Jumlah Lot...',
        hint: '1 lot = 100 lembar × harga',
        multiplier: 100
      };
    }

    return {
      unitName: 'unit',
      label: 'unit penyertaan',
      placeholder: 'Jumlah Unit...',
      hint: 'unit × harga per unit',
      multiplier: 1
    };
  }, []);

  // Check live market price from our Next.js API route
  const handleCheckPrice = async (symbolOverride?: string) => {
    const sym = (symbolOverride || tickerSymbol || extractTicker(nama, kategori) || '').trim();
    if (!sym) {
      setQuoteError('⚠️ Masukkan kode ticker simbol (misal: BBCA, BTC, EMAS)');
      return;
    }

    setCheckingPrice(true);
    setQuoteError('');
    try {
      const res = await fetch(`/api/market-price?symbol=${encodeURIComponent(sym)}`);
      const data = await res.json();
      if (!data.success) {
        setQuoteError(data.error || 'Simbol pasar tidak ditemukan.');
        setLiveQuote(null);
      } else {
        setLiveQuote(data);
        setQuoteError('');
        if (!tickerSymbol) setTickerSymbol(sym);

        // Auto-switch category based on live quote
        let targetCat = kategori;
        if (data.symbol === 'EMAS' || data.category === 'Emas') {
          targetCat = 'Emas';
          setKategori('Emas');
        } else if (data.category === 'Crypto') {
          targetCat = 'Crypto';
          setKategori('Crypto');
        } else if (data.category === 'Saham') {
          targetCat = 'Saham';
          setKategori('Saham');
        }

        // Auto-calculate nominal sekarang if quantity is already entered
        if (quantity && Number(quantity) > 0) {
          const qty = Number(quantity);
          const spec = getUnitSpec(targetCat, data);
          const calculatedVal = Math.round(qty * spec.multiplier * data.price);
          setNominalSekarang(String(calculatedVal));
        }
      }
    } catch (e: any) {
      setQuoteError('Gagal menghubungi live server pasar.');
    } finally {
      setCheckingPrice(false);
    }
  };

  // Sync live market prices for all tracked portfolio assets
  const handleSyncAllLivePrices = async () => {
    if (investasiList.length === 0) return;
    setSyncingAll(true);
    const updatedCache: Record<string, { price: number; change24h: number; name?: string }> = { ...livePricesCache };

    try {
      for (const item of investasiList) {
        const sym = extractTicker(item.nama, item.kategori);
        if (sym && !updatedCache[sym]) {
          try {
            const res = await fetch(`/api/market-price?symbol=${encodeURIComponent(sym)}`);
            const data = await res.json();
            if (data.success) {
              updatedCache[sym] = {
                price: data.price,
                change24h: data.change24h,
                name: data.name
              };
            }
          } catch (fetchErr) {
            console.warn(`Sync failed for ${sym}:`, fetchErr);
          }
        }
      }
      setLivePricesCache(updatedCache);
    } finally {
      setSyncingAll(false);
    }
  };

  // Fetch market overview benchmark
  const fetchMarketOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch('/api/market-price?overview=true');
      const data = await res.json();
      if (data && data.success) {
        setMarketOverview(data);
      }
    } catch (e) {
      console.warn('Failed to load market overview:', e);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  // Fetch general market chart for selected tab & range
  const fetchMarketChart = useCallback(async (symbol: string, range: string) => {
    const key = `${symbol}_${range}`;
    if (marketChartCache[key] && marketChartCache[key].length > 0) return;

    setLoadingMarketChart(true);
    try {
      const res = await fetch(`/api/market-price?symbol=${encodeURIComponent(symbol)}&range=${range}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.chartData)) {
        setMarketChartCache(prev => ({
          ...prev,
          [key]: data.chartData
        }));
      }
    } catch (e) {
      console.warn('Failed to load market chart:', e);
    } finally {
      setLoadingMarketChart(false);
    }
  }, [marketChartCache]);

  useEffect(() => {
    fetchInvestasi();
  }, [fetchInvestasi]);

  useEffect(() => {
    setIsUnlocked(isPrivacyUnlocked());
    const handlePrivacy = () => setIsUnlocked(isPrivacyUnlocked());
    window.addEventListener('privacy-state-changed', handlePrivacy);
    return () => window.removeEventListener('privacy-state-changed', handlePrivacy);
  }, []);

  useEffect(() => {
    fetchMarketOverview();
  }, [fetchMarketOverview]);

  useEffect(() => {
    fetchMarketChart(selectedMarketTab, marketRange);
  }, [selectedMarketTab, marketRange, fetchMarketChart]);

  // Open interactive chart modal for an asset or market index
  const openChartModal = async (symbol: string, name: string, unit: string, range = '7d') => {
    setActiveChart({
      symbol,
      name,
      unit,
      range,
      points: [],
      loading: true
    });

    try {
      const res = await fetch(`/api/market-price?symbol=${encodeURIComponent(symbol)}&range=${range}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.chartData)) {
        setActiveChart(prev => prev ? {
          ...prev,
          points: data.chartData,
          loading: false
        } : null);
      } else {
        setActiveChart(prev => prev ? { ...prev, loading: false } : null);
      }
    } catch (err) {
      console.error('Failed to load chart data:', err);
      setActiveChart(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  // Handle Add Asset
  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!nama.trim()) {
      setFormError('⚠️ Nama investasi wajib diisi.');
      return;
    }

    const modalVal = Number(nominalModal) || 0;
    const sekarangVal = Number(nominalSekarang) || modalVal;

    if (modalVal <= 0) {
      setFormError('⚠️ Nominal modal awal harus lebih dari 0.');
      return;
    }

    // Validation: Check if source balance is sufficient when potongSaldo is selected
    if (potongSaldo === 'Bank' && modalVal > saldoBank) {
      setFormError(`❌ Saldo Bank tidak mencukupi (Tersedia: Rp ${saldoBank.toLocaleString('id-ID')}, Dibutuhkan: Rp ${modalVal.toLocaleString('id-ID')}). Silakan pilih sumber lain atau sesuaikan modal.`);
      return;
    }
    if (potongSaldo === 'Cash' && modalVal > uangCash) {
      setFormError(`❌ Uang Cash tidak mencukupi (Tersedia: Rp ${uangCash.toLocaleString('id-ID')}, Dibutuhkan: Rp ${modalVal.toLocaleString('id-ID')}). Silakan pilih sumber lain atau sesuaikan modal.`);
      return;
    }

    setFormLoading(true);

    try {
      // 1. Insert into investasi table
      const { error: insertErr } = await supabase
        .from('investasi')
        .insert([{
          nama: nama.trim(),
          kategori: kategori,
          nominal_modal: modalVal,
          nominal_sekarang: sekarangVal,
          catatan: catatan.trim()
        }]);

      if (insertErr) throw insertErr;

      // 2. Log transaction if potongSaldo is selected
      if (potongSaldo !== 'Tidak') {
        const todayStr = getWIBDateString();

        const { error: txnErr } = await supabase
          .from('transaksi')
          .insert([{
            tanggal: todayStr,
            tipe: 'Pengeluaran',
            kategori: 'Investasi',
            nominal: modalVal,
            catatan: `Investasi awal: ${nama.trim()}${catatan.trim() ? ` - ${catatan.trim()}` : ''}`.trim(),
            status: 'Cleared',
            sumber: potongSaldo,
            tenggat_waktu: '',
            tanggal_bayar: todayStr
          }]);

        if (txnErr) throw txnErr;
      }

      setFormSuccess('🎉 Investasi baru berhasil ditambahkan!');
      setNama('');
      setNominalModal('');
      setNominalSekarang('');
      setCatatan('');
      setPotongSaldo('Tidak');
      fetchInvestasi(true);
    } catch (err: any) {
      console.error(err);
      setFormError(`❌ Gagal menambahkan investasi: ${err.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (asset: any) => {
    setEditingAsset(asset);
    setEditNama(asset.nama);
    setEditKategori(asset.kategori);
    setEditModal(String(asset.nominal_modal));
    setEditSekarang(String(asset.nominal_sekarang));
    setEditCatatan(asset.catatan || '');
  };

  // Save Edits
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;

    setEditingLoading(true);
    try {
      const modalVal = Number(editModal) || 0;
      const sekarangVal = Number(editSekarang) || 0;

      const { error } = await supabase
        .from('investasi')
        .update({
          nama: editNama.trim(),
          kategori: editKategori,
          nominal_modal: modalVal,
          nominal_sekarang: sekarangVal,
          catatan: editCatatan.trim()
        })
        .eq('id', editingAsset.id);

      if (error) throw error;

      setEditingAsset(null);
      fetchInvestasi(true);
      alert('✅ Investasi berhasil diperbarui!');
    } catch (err: any) {
      console.error(err);
      alert(`Gagal memperbarui investasi: ${err.message}`);
    } finally {
      setEditingLoading(false);
    }
  };

  // Open Liquidation Modal
  const openLiquidateModal = (asset: any) => {
    setLiquidatingAsset(asset);
    setLiquidateDestination('Bank');
    setLiquidateNominal(String(asset.nominal_sekarang ?? asset.nominal_modal ?? 0));
  };

  // Handle Liquidation / Asset Deletion
  const handleConfirmLiquidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liquidatingAsset) return;

    setLiquidateLoading(true);
    try {
      const todayStr = getWIBDateString();
      const returnAmount = Number(liquidateNominal) || 0;

      // 1. If returning funds to Bank or Cash, insert Pemasukan transaction
      if (liquidateDestination !== 'None' && returnAmount > 0) {
        const { error: txErr } = await supabase.from('transaksi').insert([{
          tanggal: todayStr,
          tipe: 'Pemasukan',
          kategori: 'Investasi',
          nominal: returnAmount,
          catatan: `Likuidasi Aset: ${liquidatingAsset.nama}`.trim(),
          status: 'Cleared',
          sumber: liquidateDestination,
          tenggat_waktu: '',
          tanggal_bayar: todayStr
        }]);

        if (txErr) throw txErr;
      }

      // 2. Delete asset from table
      const { error: delErr } = await supabase
        .from('investasi')
        .delete()
        .eq('id', liquidatingAsset.id);

      if (delErr) throw delErr;

      setLiquidatingAsset(null);
      fetchInvestasi(true);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal memproses likuidasi: ${err.message || err}`);
    } finally {
      setLiquidateLoading(false);
    }
  };

  // Portfolio calculations
  const portfolioSummary = React.useMemo(() => {
    let totalModal = 0;
    let totalSekarang = 0;

    investasiList.forEach(item => {
      totalModal += Number(item.nominal_modal) || 0;
      totalSekarang += Number(item.nominal_sekarang) || 0;
    });

    const netGainLoss = totalSekarang - totalModal;
    const gainLossPct = totalModal > 0 ? (netGainLoss / totalModal) * 100 : 0;

    return { totalModal, totalSekarang, netGainLoss, gainLossPct };
  }, [investasiList]);

  // Table setup SQL prompt
  if (dbError && dbError.includes('Tabel investasi belum dibuat')) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="glass-card p-6 border-slate-700/50 space-y-4">
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle className="w-8 h-8 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-white">Tabel Investasi Tidak Ditemukan</h2>
              <p className="text-xs text-slate-400">Database Anda membutuhkan tabel baru untuk melacak portofolio investasi.</p>
            </div>
          </div>

          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3">
            <p className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-400" /> Jalankan Perintah SQL ini di Dashboard Supabase:
            </p>
            <pre className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-[10px] font-mono text-emerald-300 overflow-x-auto select-all">
              {`CREATE TABLE investasi (
  id bigint generated by default as identity primary key,
  nama text not null,
  kategori text not null,
  nominal_modal numeric not null default 0,
  nominal_sekarang numeric not null default 0,
  catatan text,
  created_at timestamptz default now()
);`}
            </pre>
            <p className="text-[10px] text-slate-400">
              Salin kode SQL di atas, masuk ke dashboard Supabase Anda, pilih <b>SQL Editor</b>, lalu jalankan query tersebut. Setelah itu, silakan muat ulang halaman ini.
            </p>
          </div>

          <button
            onClick={() => fetchInvestasi()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Segarkan Halaman
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-emerald-400" /> Portofolio Investasi
          </h1>
          <p className="text-sm text-slate-400">Pantau pertumbuhan modal & harga pasar langsung (IHSG, Crypto, Emas Antam).</p>
        </div>
        <div className="flex items-center gap-2">
          {isUnlocked ? (
            <button
              onClick={() => { lockPrivacy(); setIsUnlocked(false); }}
              className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Kunci kembali data portofolio"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Portofolio Terbuka • Kunci</span>
            </button>
          ) : (
            <button
              onClick={() => setIsUnlockModalOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Buka data nominal portofolio dengan password"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Buka Kunci Portofolio</span>
            </button>
          )}

          <button
            onClick={handleSyncAllLivePrices}
            disabled={syncingAll || investasiList.length === 0}
            className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Cek harga pasar live untuk semua aset"
          >
            <Activity className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
            {syncingAll ? 'Menghubungkan...' : '⚡ Cek Harga Live'}
          </button>
          <button
            onClick={() => fetchInvestasi(true)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Modal */}
        <div className="glass-card p-5 border-slate-700/50 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Modal Masuk</p>
              {!isUnlocked && (
                <span className="text-[9px] text-amber-400 font-bold bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                  🔒 Terkunci
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-white mt-1">
              {isUnlocked ? `Rp ${portfolioSummary.totalModal.toLocaleString('id-ID')}` : 'Rp ••••••••'}
            </h3>
          </div>
          <span className="p-3 bg-slate-900/40 rounded-xl text-slate-400 border border-slate-800">
            <Briefcase className="w-5 h-5 text-emerald-400" />
          </span>
        </div>

        {/* Total Nilai Sekarang */}
        <div className="glass-card p-5 border-slate-700/50 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nilai Portofolio Saat Ini</p>
              {!isUnlocked && (
                <span className="text-[9px] text-amber-400 font-bold bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                  🔒 Terkunci
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-white mt-1">
              {isUnlocked ? `Rp ${portfolioSummary.totalSekarang.toLocaleString('id-ID')}` : 'Rp ••••••••'}
            </h3>
          </div>
          <span className="p-3 bg-slate-900/40 rounded-xl text-slate-400 border border-slate-800">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </span>
        </div>

        {/* Total Return */}
        <div className="glass-card p-5 border-slate-700/50 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keuntungan / Kerugian</p>
              {!isUnlocked && (
                <span className="text-[9px] text-amber-400 font-bold bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                  🔒 Terkunci
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h3 className={`text-xl font-bold ${portfolioSummary.netGainLoss >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                {isUnlocked ? `Rp ${portfolioSummary.netGainLoss.toLocaleString('id-ID')}` : 'Rp ••••••••'}
              </h3>
              {isUnlocked && (
                <span className={`text-xs font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 ${portfolioSummary.netGainLoss >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-455'
                  }`}>
                  {portfolioSummary.netGainLoss >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {portfolioSummary.gainLossPct.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stockbit-Style General Market Trends Chart */}
      {(() => {
        const INSTRUMENTS = {
          EMAS: {
            name: 'Emas Logam Mulia',
            ticker: 'ANTAM / SPOT IDR',
            badge: 'KOMODITAS',
            unit: 'Rupiah / gram',
            icon: '🪙',
            color: '#f59e0b',
            dataObj: marketOverview?.gold
          },
          USDIDR: {
            name: 'Nilai Tukar Dollar',
            ticker: 'USD / IDR',
            badge: 'FOREX CURRENCY',
            unit: 'Rupiah per USD',
            icon: '💵',
            color: '#06b6d4',
            dataObj: marketOverview?.usdidr
          },
          IHSG: {
            name: 'IHSG Bursa Indonesia',
            ticker: '^JKSE / IDX COMPOSITE',
            badge: 'INDEX SAHAM',
            unit: 'Poin Indeks',
            icon: '🏛️',
            color: '#10b981',
            dataObj: marketOverview?.ihsg
          },
          BTC: {
            name: 'Bitcoin Crypto',
            ticker: 'BTC / IDR',
            badge: 'CRYPTO ASSET',
            unit: 'Rupiah per Koin',
            icon: '⚡',
            color: '#f97316',
            dataObj: marketOverview?.btc
          }
        };

        const activeInst = INSTRUMENTS[selectedMarketTab];
        const chartPoints = marketChartCache[`${selectedMarketTab}_${marketRange}`] || [];
        const prices = chartPoints.map(p => p.price);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
        const latestPrice = prices.length > 0 ? prices[prices.length - 1] : (activeInst?.dataObj?.price || 0);
        const firstPrice = prices.length > 0 ? prices[0] : latestPrice;
        
        // Active displayed price (reflects hovered point if user is dragging/hovering on chart ala Stockbit)
        const displayPrice = hoveredPoint ? hoveredPoint.price : latestPrice;
        const displayDate = hoveredPoint ? hoveredPoint.date : null;
        const activeDiff = displayPrice - firstPrice;
        const activePct = firstPrice > 0 ? (activeDiff / firstPrice) * 100 : 0;
        const isPositive = activeDiff >= 0;

        return (
          <div className="glass-card p-6 border-slate-800 bg-slate-950/80 rounded-2xl space-y-5 shadow-2xl relative overflow-hidden">
            
            {/* Instrument Tabs (Stockbit-style Pill Strip) */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800/80">
              {(Object.keys(INSTRUMENTS) as Array<keyof typeof INSTRUMENTS>).map((key) => {
                const inst = INSTRUMENTS[key];
                const isSelected = selectedMarketTab === key;
                const change = inst.dataObj?.change24h;

                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedMarketTab(key);
                      setHoveredPoint(null);
                    }}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 flex-shrink-0 ${
                      isSelected
                        ? 'bg-slate-900 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                        : 'bg-slate-950/40 hover:bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-sm">{inst.icon}</span>
                    <span>{inst.name}</span>
                    {change !== undefined && (
                      <span className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded ${change >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                        {change >= 0 ? '+' : ''}{change}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Stockbit Main Price Display & Timeframe Chips */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                    {activeInst.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-mono font-bold">
                    {activeInst.ticker}
                  </span>
                  {displayDate && (
                    <span className="text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 animate-fadeIn">
                      📅 {displayDate}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-3 mt-1.5 flex-wrap">
                  <h2 className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
                    {selectedMarketTab === 'IHSG' ? displayPrice.toLocaleString('id-ID') : `Rp ${displayPrice.toLocaleString('id-ID')}`}
                  </h2>
                  <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded flex items-center gap-0.5 ${isPositive ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                    {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {isPositive ? '+' : ''}{selectedMarketTab === 'IHSG' ? activeDiff.toFixed(2) : `Rp ${activeDiff.toLocaleString('id-ID')}`} ({isPositive ? '+' : ''}{activePct.toFixed(2)}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {displayDate ? '*Harga pada titik kursor kursor' : `*Harga pasar saat ini (${activeInst.unit})`}
                </p>
              </div>

              {/* Timeframe Chips ala Stockbit */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-1 flex gap-1 text-xs font-mono font-bold">
                {[
                  { id: '7d', label: '1W' },
                  { id: '1mo', label: '1M' },
                  { id: '3mo', label: '3M' },
                  { id: '1y', label: '1Y' }
                ].map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => {
                      setMarketRange(tf.id as any);
                      setHoveredPoint(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      marketRange === tf.id
                        ? 'bg-emerald-500 text-slate-950 font-black shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stockbit Chart Container */}
            <div className="h-72 w-full bg-slate-950/90 rounded-2xl p-3 border border-slate-850 flex items-center justify-center relative">
              {loadingMarketChart ? (
                <div className="text-xs text-emerald-400 animate-pulse flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-spin" /> Memuat data grafik {activeInst.name}...
                </div>
              ) : chartPoints.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartPoints}
                    margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                    onMouseMove={(state: any) => {
                      if (state?.activePayload && state.activePayload.length > 0) {
                        const payload = state.activePayload[0].payload;
                        setHoveredPoint({ date: payload.date, price: payload.price });
                      }
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <defs>
                      <linearGradient id={`grad_stockbit_${selectedMarketTab}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeInst.color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={activeInst.color} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.6} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                      tickFormatter={(val: string) => (val ? val.slice(5) : '')}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false}
                      axisLine={false}
                      orientation="right"
                      tickFormatter={(val: number) => {
                        if (val >= 1000000000) return `${(val / 1000000000).toFixed(1)}B`;
                        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                        if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                        return String(val);
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900/95 border border-slate-700/80 p-2.5 rounded-xl shadow-xl text-xs space-y-1 font-mono">
                              <p className="text-slate-400 text-[10px]">{data.date}</p>
                              <p className="font-extrabold text-white text-sm">
                                {selectedMarketTab === 'IHSG' ? data.price.toLocaleString('id-ID') : `Rp ${data.price.toLocaleString('id-ID')}`}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={activeInst.color}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill={`url(#grad_stockbit_${selectedMarketTab})`}
                      activeDot={{ r: 6, fill: activeInst.color, stroke: '#0f172a', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-slate-500 italic">Data grafik pasar sedang dipersiapkan...</p>
              )}
            </div>

            {/* Key Market Statistics Grid ala Stockbit */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Harga Buka (Open)</span>
                <p className="text-sm font-extrabold font-mono text-white mt-1">
                  {selectedMarketTab === 'IHSG' ? firstPrice.toLocaleString('id-ID') : `Rp ${firstPrice.toLocaleString('id-ID')}`}
                </p>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Tertinggi (High)</span>
                <p className="text-sm font-extrabold font-mono text-emerald-400 mt-1">
                  {selectedMarketTab === 'IHSG' ? maxPrice.toLocaleString('id-ID') : `Rp ${maxPrice.toLocaleString('id-ID')}`}
                </p>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Terendah (Low)</span>
                <p className="text-sm font-extrabold font-mono text-rose-400 mt-1">
                  {selectedMarketTab === 'IHSG' ? minPrice.toLocaleString('id-ID') : `Rp ${minPrice.toLocaleString('id-ID')}`}
                </p>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Rata-rata (Avg)</span>
                <p className="text-sm font-extrabold font-mono text-slate-200 mt-1">
                  {selectedMarketTab === 'IHSG' ? avgPrice.toLocaleString('id-ID') : `Rp ${avgPrice.toLocaleString('id-ID')}`}
                </p>
              </div>
            </div>

          </div>
        );
      })()}

      {/* Main Grid */}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Form Card */}
        <div className="glass-card p-5 border-slate-700/50 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-emerald-400" /> Catat Investasi Baru
          </h3>

          <form onSubmit={handleAddAsset} className="space-y-3 text-xs">
            {formError && <div className="p-2.5 bg-rose-500/10 text-rose-455 rounded font-bold">{formError}</div>}
            {formSuccess && <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded font-bold">{formSuccess}</div>}

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Nama Aset Investasi</label>
              <input
                type="text"
                placeholder="Contoh: Saham BBCA, Bitcoin, Emas Antam"
                value={nama}
                onChange={(e) => {
                  setNama(e.target.value);
                  const detected = extractTicker(e.target.value, kategori);
                  if (detected && !tickerSymbol) setTickerSymbol(detected);
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Live Market Price Helper */}
            <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Live Market Price (Gratis)
                </span>
                <span className="text-[9px] text-slate-500 font-mono">IDX • Crypto • Emas</span>
              </div>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Ticker: BBCA, BTC, EMAS..."
                  value={tickerSymbol}
                  onChange={(e) => setTickerSymbol(e.target.value.toUpperCase())}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white text-xs font-mono uppercase focus:outline-none focus:border-emerald-500 flex-1"
                />
                <button
                  type="button"
                  onClick={() => handleCheckPrice()}
                  disabled={checkingPrice}
                  className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Search className={`w-3 h-3 ${checkingPrice ? 'animate-spin' : ''}`} />
                  {checkingPrice ? 'Cek...' : 'Cari'}
                </button>
              </div>

              {quoteError && <p className="text-[10px] text-rose-400">{quoteError}</p>}

              {liveQuote && (
                <div className="pt-1.5 border-t border-slate-800/60 space-y-2 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-bold">{liveQuote.name}</span>
                    <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${liveQuote.change24h >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {liveQuote.change24h >= 0 ? '+' : ''}{liveQuote.change24h}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Harga Terkini ({liveQuote.unit}):</span>
                    <span className="font-mono font-extrabold text-white">Rp {liveQuote.price.toLocaleString('id-ID')}</span>
                  </div>

                  {/* Quantity calculator */}
                  {(() => {
                    const unitSpec = getUnitSpec(kategori, liveQuote);
                    return (
                      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-800/40">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-400 font-semibold">Hitung Otomatis Berdasarkan Jumlah Unit:</span>
                          <span className="text-emerald-400 font-mono text-[9px]">{unitSpec.hint}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="any"
                            placeholder={unitSpec.placeholder}
                            value={quantity}
                            onChange={(e) => {
                              const q = e.target.value;
                              setQuantity(q);
                              const num = Number(q) || 0;
                              if (num > 0 && liveQuote) {
                                const spec = getUnitSpec(kategori, liveQuote);
                                const calc = Math.round(num * spec.multiplier * liveQuote.price);
                                setNominalSekarang(String(calc));
                              }
                            }}
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white text-xs w-40 focus:outline-none focus:border-emerald-500 font-mono"
                          />
                          <span className="text-xs text-slate-300 font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
                            {unitSpec.label}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Kategori</label>
              <select
                value={kategori}
                onChange={(e) => {
                  const newCat = e.target.value;
                  setKategori(newCat);
                  if (quantity && Number(quantity) > 0 && liveQuote) {
                    const spec = getUnitSpec(newCat, liveQuote);
                    const calc = Math.round(Number(quantity) * spec.multiplier * liveQuote.price);
                    setNominalSekarang(String(calc));
                  }
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Saham">Saham</option>
                <option value="Reksadana">Reksadana</option>
                <option value="Crypto">Crypto</option>
                <option value="Emas">Emas</option>
                <option value="Obligasi">Obligasi</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Modal Awal (Capital)</label>
              <CurrencyInput
                placeholder="0"
                value={nominalModal}
                onChangeValue={(val) => setNominalModal(val)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Nilai Saat Ini (Opsional - Kosongkan jika sama)</label>
              <CurrencyInput
                placeholder="Sama dengan modal"
                value={nominalSekarang}
                onChangeValue={(val) => setNominalSekarang(val)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold flex justify-between items-center">
                <span>Potong Saldo Keuangan Aktif?</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {potongSaldo === 'Bank' ? `Sisa: Rp ${saldoBank.toLocaleString('id-ID')}` : potongSaldo === 'Cash' ? `Sisa: Rp ${uangCash.toLocaleString('id-ID')}` : ''}
                </span>
              </label>
              <select
                value={potongSaldo}
                onChange={(e) => setPotongSaldo(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Tidak">Tidak, hanya catat portofolio</option>
                <option value="Bank">🏦 Potong Saldo Bank (Tersedia: Rp {saldoBank.toLocaleString('id-ID')})</option>
                <option value="Cash">💵 Potong Saldo Cash (Tersedia: Rp {uangCash.toLocaleString('id-ID')})</option>
              </select>
              <p className="text-[10px] text-slate-500 leading-tight">
                *Jika memilih Bank/Cash, sistem akan memvalidasi saldo dan otomatis mencatat pengeluaran <b>Investasi</b>.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Catatan</label>
              <textarea
                placeholder="Keterangan tambahan..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white h-16 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold py-2 rounded-lg transition flex justify-center items-center gap-1.5 cursor-pointer mt-2"
            >
              {formLoading ? 'Menyimpan...' : 'Tambah Investasi'}
            </button>
          </form>
        </div>

        {/* Investment List Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-slate-200">📋 Daftar Aset Portofolio</h3>

          {loading ? (
            <div className="text-center text-emerald-400 py-12 animate-pulse text-xs">Memuat data portofolio...</div>
          ) : investasiList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {investasiList.map(item => {
                const modal = Number(item.nominal_modal) || 0;
                const sekarang = Number(item.nominal_sekarang) || 0;
                const diff = sekarang - modal;
                const pct = modal > 0 ? (diff / modal) * 100 : 0;
                const ticker = extractTicker(item.nama, item.kategori);
                const liveData = ticker ? livePricesCache[ticker] : null;

                return (
                  <div key={item.id} className="glass-card p-4 border-slate-700/50 flex flex-col justify-between space-y-3 text-xs relative group">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                            {item.kategori}
                          </span>
                          {ticker && (
                            <span className="text-[10px] font-bold text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              {ticker}
                            </span>
                          )}
                          {liveData && (
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${liveData.change24h >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                              Live: Rp {liveData.price.toLocaleString('id-ID')} ({liveData.change24h >= 0 ? '+' : ''}{liveData.change24h}%)
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1.5">{item.nama}</h4>
                        {item.catatan && <p className="text-[10px] text-slate-500 mt-1 italic leading-tight">{item.catatan}</p>}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-1.5 items-center">
                        {ticker && (
                          <button
                            onClick={() => openChartModal(ticker, item.nama, item.kategori === 'Saham' ? 'Rp / lembar' : 'IDR', '7d')}
                            className="p-1 hover:bg-emerald-500/10 rounded text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                            title={`Lihat Grafik Tren ${ticker}`}
                          >
                            <ChartIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                          title="Edit Aset"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openLiquidateModal(item)}
                          className="p-1 hover:bg-rose-950/20 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title="Likuidasi / Hapus Aset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-slate-800/60 pt-2.5 space-y-1.5">
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Modal Awal:</span>
                        <span className="font-mono font-bold text-white">
                          {isUnlocked ? `Rp ${modal.toLocaleString('id-ID')}` : 'Rp ••••••••'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-slate-400">
                        <span>Nilai Sekarang:</span>
                        <span className="font-mono font-bold text-white">
                          {isUnlocked ? `Rp ${sekarang.toLocaleString('id-ID')}` : 'Rp ••••••••'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-800/40 pt-1.5">
                        <span className="font-semibold text-slate-400">Gain / Loss:</span>
                        <span className={`font-mono font-extrabold flex items-center gap-0.5 ${diff >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                          {isUnlocked ? (
                            <>{diff >= 0 ? '+' : ''}Rp {diff.toLocaleString('id-ID')} ({diff >= 0 ? '+' : ''}{pct.toFixed(1)}%)</>
                          ) : (
                            'Rp ••••••••'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card p-8 text-center text-slate-500 italic text-xs">
              Belum ada portofolio investasi tercatat. Silakan masukkan aset investasi pertama Anda menggunakan formulir di sebelah kiri.
            </div>
          )}
        </div>
      </div>

      {/* Edit Asset Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card max-w-md w-full p-6 border-slate-750 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Pencil className="w-4 h-4 text-emerald-400" /> Edit Aset Investasi
              </h3>
              <button
                onClick={() => setEditingAsset(null)}
                className="text-slate-450 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Nama Investasi</label>
                <input
                  type="text"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Kategori</label>
                <select
                  value={editKategori}
                  onChange={(e) => setEditKategori(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Saham">Saham</option>
                  <option value="Reksadana">Reksadana</option>
                  <option value="Crypto">Crypto</option>
                  <option value="Emas">Emas</option>
                  <option value="Obligasi">Obligasi</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Modal Awal</label>
                <CurrencyInput
                  placeholder="0"
                  value={editModal}
                  onChangeValue={(val) => setEditModal(val)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Nilai Sekarang</label>
                <CurrencyInput
                  placeholder="0"
                  value={editSekarang}
                  onChangeValue={(val) => setEditSekarang(val)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Catatan</label>
                <textarea
                  value={editCatatan}
                  onChange={(e) => setEditCatatan(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white h-16 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2 rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editingLoading}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold py-2 rounded-lg transition cursor-pointer"
                >
                  {editingLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Liquidation / Asset Deletion Modal */}
      {liquidatingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card max-w-md w-full p-6 border-slate-700/80 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-emerald-400" /> Likuidasi / Hapus Aset Investasi
              </h3>
              <button
                type="button"
                onClick={() => setLiquidatingAsset(null)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Nama Aset:</span>
                <span className="font-bold text-white">{liquidatingAsset.nama}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Kategori:</span>
                <span className="font-medium text-slate-300">{liquidatingAsset.kategori}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Nilai Terakhir:</span>
                <span className="font-mono font-bold text-emerald-400">
                  Rp {Number(liquidatingAsset.nominal_sekarang ?? liquidatingAsset.nominal_modal ?? 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmLiquidation} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">Tujuan Pengembalian Dana</label>
                <div className="grid grid-cols-1 gap-2">
                  <label className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition ${liquidateDestination === 'Bank' ? 'bg-emerald-950/30 border-emerald-500/50 text-white' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'}`}>
                    <input
                      type="radio"
                      name="liquidateDest"
                      value="Bank"
                      checked={liquidateDestination === 'Bank'}
                      onChange={() => setLiquidateDestination('Bank')}
                      className="text-emerald-500 focus:ring-0"
                    />
                    <span>🏦 Likuidasi ke <b>Saldo Bank</b> (Catat Pemasukan)</span>
                  </label>

                  <label className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition ${liquidateDestination === 'Cash' ? 'bg-emerald-950/30 border-emerald-500/50 text-white' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'}`}>
                    <input
                      type="radio"
                      name="liquidateDest"
                      value="Cash"
                      checked={liquidateDestination === 'Cash'}
                      onChange={() => setLiquidateDestination('Cash')}
                      className="text-emerald-500 focus:ring-0"
                    />
                    <span>💵 Likuidasi ke <b>Uang Cash</b> (Catat Pemasukan)</span>
                  </label>

                  <label className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition ${liquidateDestination === 'None' ? 'bg-rose-950/30 border-rose-500/50 text-rose-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'}`}>
                    <input
                      type="radio"
                      name="liquidateDest"
                      value="None"
                      checked={liquidateDestination === 'None'}
                      onChange={() => setLiquidateDestination('None')}
                      className="text-rose-500 focus:ring-0"
                    />
                    <span>🗑️ Hapus Aset Saja (Tanpa mengubah saldo Bank/Cash)</span>
                  </label>
                </div>
              </div>

              {liquidateDestination !== 'None' && (
                <div className="space-y-1.5 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-semibold flex justify-between">
                    <span>Nominal Likuidasi Diterima (Rp)</span>
                    <span className="text-[10px] text-emerald-400">Pemasukan Investasi</span>
                  </label>
                  <CurrencyInput
                    placeholder="0"
                    value={liquidateNominal}
                    onChangeValue={(val) => setLiquidateNominal(val)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-full text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    💡 Sistem akan otomatis mencatat log transaksi <b>Pemasukan</b> senilai Rp {Number(liquidateNominal || 0).toLocaleString('id-ID')} ke <b>{liquidateDestination}</b> lalu menghapus aset ini.
                  </p>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setLiquidatingAsset(null)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={liquidateLoading}
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2 rounded-lg transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {liquidateLoading ? 'Memproses...' : 'Konfirmasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Market Chart Modal */}
      {activeChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="glass-card max-w-2xl w-full p-6 border-slate-750 space-y-4 shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs border border-emerald-500/20">
                    {activeChart.symbol}
                  </span>
                  <h3 className="text-base font-bold text-white">{activeChart.name}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Grafik tren harga pasar historis ({activeChart.unit})
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Range switcher */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-0.5 flex gap-1 text-[11px] font-mono">
                  <button
                    onClick={() => openChartModal(activeChart.symbol, activeChart.name, activeChart.unit, '7d')}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${activeChart.range === '7d' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => openChartModal(activeChart.symbol, activeChart.name, activeChart.unit, '1mo')}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${activeChart.range === '1mo' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                  >
                    1M
                  </button>
                </div>

                <button
                  onClick={() => setActiveChart(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Price Stats Banner */}
            {activeChart.points.length > 0 && (() => {
              const prices = activeChart.points.map(p => p.price);
              const latestPrice = prices[prices.length - 1];
              const minPrice = Math.min(...prices);
              const maxPrice = Math.max(...prices);
              const firstPrice = prices[0];
              const diff = latestPrice - firstPrice;
              const pct = firstPrice > 0 ? (diff / firstPrice) * 100 : 0;

              return (
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold">Harga Terakhir:</span>
                    <p className="text-sm font-black font-mono text-white">
                      {latestPrice.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold">Rentang (Min - Max):</span>
                    <p className="text-xs font-mono text-slate-300">
                      {minPrice.toLocaleString('id-ID')} - {maxPrice.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold">Perubahan Periode:</span>
                    <p className={`text-xs font-black font-mono flex items-center gap-0.5 ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {diff >= 0 ? '+' : ''}{diff.toLocaleString('id-ID')} ({diff >= 0 ? '+' : ''}{pct.toFixed(2)}%)
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Recharts Chart Area */}
            <div className="h-64 w-full bg-slate-950/40 rounded-xl p-2 border border-slate-900/60 flex items-center justify-center">
              {activeChart.loading ? (
                <div className="text-xs text-emerald-400 animate-pulse flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-spin" /> Mengambil data grafik pasar...
                </div>
              ) : activeChart.points.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeChart.points} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                      tickFormatter={(val: string) => (val ? val.slice(5) : '')}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      orientation="right"
                      tickFormatter={(val: number) => {
                        if (val >= 1000000000) return `${(val / 1000000000).toFixed(1)}B`;
                        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                        if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                        return String(val);
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '11px',
                        color: '#f8fafc'
                      }}
                      formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`, 'Harga']}
                      labelFormatter={(label: any) => `Tanggal: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#chartGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-slate-500 italic">Data grafik tidak tersedia untuk simbol ini.</p>
              )}
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-slate-800">
              <span>*Data bersumber dari Yahoo Finance & CoinGecko publik (delay ~15 menit).</span>
              <button
                onClick={() => setActiveChart(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Unlock Modal */}
      <PrivacyUnlockModal
        isOpen={isUnlockModalOpen}
        onClose={() => setIsUnlockModalOpen(false)}
        onSuccess={() => {
          setIsUnlocked(true);
          setIsUnlockModalOpen(false);
        }}
        title="Buka Kunci Portofolio Investasi"
      />
    </div>
  );
}
