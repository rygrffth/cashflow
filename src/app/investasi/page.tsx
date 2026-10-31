'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp, TrendingDown, Briefcase, PlusCircle, Trash2,
  Pencil, RefreshCw, AlertTriangle, CheckCircle, Database, HelpCircle
} from 'lucide-react';
import CurrencyInput from '@/components/CurrencyInput';
import { getWIBDateString } from '@/lib/dateUtils';
import { computeFinancialBalances } from '@/lib/balanceUtils';

export default function InvestasiPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [investasiList, setInvestasiList] = useState<any[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchInvestasi();
  }, [fetchInvestasi]);

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-emerald-400" /> Portofolio Investasi
          </h1>
          <p className="text-sm text-slate-400">Catat dan pantau pertumbuhan modal investasi Anda.</p>
        </div>
        <button
          onClick={() => fetchInvestasi(true)}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Modal */}
        <div className="glass-card p-5 border-slate-700/50 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Modal Masuk</p>
            <h3 className="text-xl font-bold text-white mt-1">
              Rp {portfolioSummary.totalModal.toLocaleString('id-ID')}
            </h3>
          </div>
          <span className="p-3 bg-slate-900/40 rounded-xl text-slate-400 border border-slate-800">
            <Briefcase className="w-5 h-5 text-emerald-400" />
          </span>
        </div>

        {/* Total Nilai Sekarang */}
        <div className="glass-card p-5 border-slate-700/50 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nilai Portofolio Saat Ini</p>
            <h3 className="text-xl font-bold text-white mt-1">
              Rp {portfolioSummary.totalSekarang.toLocaleString('id-ID')}
            </h3>
          </div>
          <span className="p-3 bg-slate-900/40 rounded-xl text-slate-400 border border-slate-800">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </span>
        </div>

        {/* Total Return */}
        <div className="glass-card p-5 border-slate-700/50 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keuntungan / Kerugian</p>
            <div className="flex items-center gap-2 mt-1">
              <h3 className={`text-xl font-bold ${portfolioSummary.netGainLoss >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                Rp {portfolioSummary.netGainLoss.toLocaleString('id-ID')}
              </h3>
              <span className={`text-xs font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 ${portfolioSummary.netGainLoss >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-455'
                }`}>
                {portfolioSummary.netGainLoss >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {portfolioSummary.gainLossPct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

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
                placeholder="Contoh: Saham BBRI, Reksadana Sucor"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Kategori</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
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

                return (
                  <div key={item.id} className="glass-card p-4 border-slate-700/50 flex flex-col justify-between space-y-3 text-xs relative group">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                          {item.kategori}
                        </span>
                        <h4 className="text-sm font-bold text-white mt-1.5">{item.nama}</h4>
                        {item.catatan && <p className="text-[10px] text-slate-500 mt-1 italic leading-tight">{item.catatan}</p>}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-1.5">
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
                        <span className="font-mono font-bold text-white">Rp {modal.toLocaleString('id-ID')}</span>
                      </div>

                      <div className="flex justify-between items-center text-slate-400">
                        <span>Nilai Sekarang:</span>
                        <span className="font-mono font-bold text-white">Rp {sekarang.toLocaleString('id-ID')}</span>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-800/40 pt-1.5">
                        <span className="font-semibold text-slate-400">Gain / Loss:</span>
                        <span className={`font-mono font-extrabold flex items-center gap-0.5 ${diff >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                          {diff >= 0 ? '+' : ''}Rp {diff.toLocaleString('id-ID')} ({diff >= 0 ? '+' : ''}{pct.toFixed(1)}%)
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

    </div>
  );
}
