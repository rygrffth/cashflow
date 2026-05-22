'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CalendarRange, PlusCircle, RefreshCw, Trash2, CheckCircle, AlertCircle, Clock, Pencil } from 'lucide-react';

export default function SettlementPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [editingSettle, setEditingSettle] = useState<any | null>(null);

  // Add Settlement Form States
  const [catatan, setCatatan] = useState('');
  const [nominal, setNominal] = useState<string>('');
  const [tenggat, setTenggat] = useState(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - offset).toISOString().split('T')[0];
  });
  const [sumber, setSumber] = useState<'Bank' | 'Cash'>('Bank');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetchSettlements = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from('transaksi')
        .select('*')
        .eq('kategori', 'Scheduled Settlement')
        .eq('status', 'Pending')
        .order('tenggat_waktu', { ascending: true });

      if (error) throw error;
      setSettlements(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const handleAddSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catatan || !nominal || Number(nominal) <= 0) {
      setFormError('⚠️ Isi catatan tagihan dan nominal > 0');
      return;
    }

    setFormLoading(true);
    setFormError('');
    setFormSuccess('');

    try {
      const today = new Date();
      const offset = today.getTimezoneOffset() * 60000;
      const todayStr = new Date(today.getTime() - offset).toISOString().split('T')[0];

      const newSettleObj = {
        tanggal: todayStr,
        tipe: 'Pengeluaran',
        kategori: 'Scheduled Settlement',
        nominal: Number(nominal),
        catatan: catatan,
        status: 'Pending',
        tenggat_waktu: tenggat,
        tanggal_bayar: '',
        sumber: sumber
      };

      const { error } = await supabase.from('transaksi').insert([newSettleObj]);
      if (error) throw error;

      setFormSuccess('✅ Jadwal tagihan baru berhasil ditambahkan!');
      setCatatan('');
      setNominal('');
      fetchSettlements(true);
    } catch (err: any) {
      console.error(err);
      setFormError(`❌ Gagal menyimpan: ${err.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  const handlePay = async (id: number, desc: string) => {
    if (!confirm(`Tandai tagihan "${desc}" sudah lunas dibayar?`)) return;

    try {
      const today = new Date();
      const offset = today.getTimezoneOffset() * 60000;
      const todayStr = new Date(today.getTime() - offset).toISOString().split('T')[0];

      const { error } = await supabase
        .from('transaksi')
        .update({
          status: 'Cleared',
          tanggal_bayar: todayStr
        })
        .eq('id', id);

      if (error) throw error;
      
      alert(`🎉 Tagihan "${desc}" berhasil dilunasi!`);
      fetchSettlements(true);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal melunasi tagihan: ${err.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus tagihan terjadwal ini? (Tindakan ini tidak memotong saldo)')) return;

    try {
      const { error } = await supabase.from('transaksi').delete().eq('id', id);
      if (error) throw error;
      fetchSettlements(true);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal menghapus tagihan: ${err.message}`);
    }
  };

  const handleUpdateSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSettle) return;
    try {
      const { error } = await supabase
        .from('transaksi')
        .update({
          nominal: Number(editingSettle.nominal),
          catatan: editingSettle.catatan,
          sumber: editingSettle.sumber,
          tenggat_waktu: editingSettle.tenggat_waktu
        })
        .eq('id', editingSettle.id);

      if (error) throw error;
      setEditingSettle(null);
      fetchSettlements(true);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal memperbarui tagihan: ${err.message}`);
    }
  };

  const totalPending = settlements.reduce((sum, item) => sum + Number(item.nominal), 0);

  // Check if deadline is overdue
  const isOverdue = (dueStr: string) => {
    if (!dueStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueStr);
    return due < today;
  };

  const overdueCount = settlements.filter(s => isOverdue(s.tenggat_waktu)).length;

  if (loading) return <div className="text-center text-emerald-400 py-20 animate-pulse">Memuat Scheduled Settlement...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarRange className="w-6 h-6 text-emerald-400" /> Scheduled Settlement
          </h1>
          <p className="text-sm text-slate-400">Kelola pembayaran masa depan (Cicilan, Tagihan, CC) yang telah dijadwalkan.</p>
        </div>
        
        <button
          onClick={() => fetchSettlements(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Settlement List */}
        <div className="lg:col-span-2 space-y-4">
          
          {overdueCount > 0 && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-400 text-xs font-bold animate-pulse">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>🚨 Ada {overdueCount} tagihan terjadwal yang sudah melewati jatuh tempo! Segera lunasi.</span>
            </div>
          )}

          <div className="glass-card p-5 border-slate-700/50">
            <h3 className="font-bold text-lg text-slate-200 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" /> Daftar Tunggu Pembayaran
            </h3>
            
            <div className="space-y-3">
              {settlements.length > 0 ? (
                settlements.map(item => {
                  const overdue = isOverdue(item.tenggat_waktu);
                  return (
                    <div key={item.id} className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div>
                        <p className="font-bold text-slate-100 flex items-center gap-2">
                          {item.catatan}
                          {overdue && <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 text-[8px] rounded uppercase font-black">Jatuh Tempo</span>}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Sumber Dana: <span className="text-slate-300 font-semibold">{item.sumber}</span> • Input: {item.tanggal}
                        </p>
                        <p className={`text-[11px] font-semibold mt-0.5 ${overdue ? 'text-rose-400' : 'text-slate-300'}`}>
                          Due Date: {item.tenggat_waktu || '-'}
                        </p>
                      </div>
                      
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                        <p className="font-black text-rose-400">Rp {Number(item.nominal).toLocaleString('id-ID')}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePay(item.id, item.catatan)}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold rounded-lg transition"
                          >
                            Lunas
                          </button>
                          <button
                            onClick={() => setEditingSettle(item)}
                            title="Edit"
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition cursor-pointer"
                          >
                            <Pencil className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            title="Hapus"
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-slate-500 text-sm italic">
                  🎉 Semua tagihan Scheduled Settlement sudah lunas!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Summary & Add Form */}
        <div className="space-y-4">
          
          {/* Summary Card */}
          <div className="glass-card p-5 border-amber-500/30 bg-gradient-to-br from-slate-900/40 via-amber-950/5 to-slate-900/40">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">⏳ TOTAL TAGIHAN PENDING</h3>
            <p className="text-3xl font-black text-amber-400">Rp {totalPending.toLocaleString('id-ID')}</p>
            <p className="text-xs text-slate-400 mt-2">{settlements.length} transaksi terjadwal perlu dilunasi.</p>
          </div>

          {/* Add Scheduled Settlement Form */}
          <div className="glass-card p-5 border-slate-700/50 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-emerald-400" /> Tambah Jadwal Tagihan
            </h3>

            {formError && <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded">{formError}</div>}
            {formSuccess && <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded">{formSuccess}</div>}

            <form onSubmit={handleAddSettlement} className="space-y-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400">Nama Tagihan / Keterangan</label>
                <input
                  type="text"
                  placeholder="Contoh: Tagihan Listrik, Cicilan Motor..."
                  value={catatan}
                  onChange={e => setCatatan(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400">Nominal Tagihan (Rp)</label>
                <input
                  type="number"
                  placeholder="Nominal..."
                  value={nominal}
                  onChange={e => setNominal(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-400">Sumber Rekening</label>
                  <select
                    value={sumber}
                    onChange={e => setSumber(e.target.value as 'Bank' | 'Cash')}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none text-[11px]"
                  >
                    <option value="Bank">Bank / ATM</option>
                    <option value="Cash">Uang Cash</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-400">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={tenggat}
                    onChange={e => setTenggat(e.target.value)}
                    onClick={(e) => (e.target as any).showPicker()}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:border-emerald-500 text-[10px] cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition mt-2 disabled:opacity-50 cursor-pointer text-xs"
              >
                {formLoading ? 'Menyimpan...' : '💾 Simpan Jadwal'}
              </button>
            </form>
          </div>

      </div>

      {/* Edit Scheduled Settlement Modal */}
      {editingSettle && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn text-sm">
          <div className="glass-card max-w-md w-full p-6 border-slate-700/50 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Pencil className="w-4.5 h-4.5 text-emerald-400" /> Edit Tagihan Terjadwal
              </h3>
              <button 
                onClick={() => setEditingSettle(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSettle} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400">Catatan Tagihan</label>
                <input
                  type="text"
                  value={editingSettle.catatan}
                  onChange={e => setEditingSettle({...editingSettle, catatan: e.target.value})}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400">Nominal (Rp)</label>
                <input
                  type="number"
                  value={editingSettle.nominal}
                  onChange={e => setEditingSettle({...editingSettle, nominal: e.target.value})}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Sumber Dana</label>
                  <select
                    value={editingSettle.sumber}
                    onChange={e => setEditingSettle({...editingSettle, sumber: e.target.value})}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  >
                    <option value="Bank">Bank / ATM</option>
                    <option value="Cash">Uang Cash</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={editingSettle.tenggat_waktu || ''}
                    onChange={e => setEditingSettle({...editingSettle, tenggat_waktu: e.target.value})}
                    onClick={(e) => (e.target as any).showPicker()}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingSettle(null)}
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
  </div>
  );
}
