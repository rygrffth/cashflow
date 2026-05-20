'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Target, PlusCircle, TrendingUp, RefreshCw, Trash2, ArrowUpRight, ArrowDownLeft, ShieldAlert, Pencil } from 'lucide-react';

export default function BudgetPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabunganData, setTabunganData] = useState<any[]>([]);
  const [editingTabungan, setEditingTabungan] = useState<any | null>(null);

  // Add Target Form States
  const [nama, setNama] = useState('');
  const [targetNominal, setTargetNominal] = useState<number | ''>('');
  const [tanggalMulai, setTanggalMulai] = useState(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - offset).toISOString().split('T')[0];
  });
  const [tanggalTarget, setTanggalTarget] = useState(() => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const offset = nextYear.getTimezoneOffset() * 60000;
    return new Date(nextYear.getTime() - offset).toISOString().split('T')[0];
  });
  const [kategori, setKategori] = useState('Umum');
  const [prioritas, setPrioritas] = useState(3);
  const [catatan, setCatatan] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Inline Setor/Tarik States
  const [activeForm, setActiveForm] = useState<{ id: number; type: 'setor' | 'tarik' } | null>(null);
  const [txnNominal, setTxnNominal] = useState<number | ''>('');
  const [txnSumber, setTxnSumber] = useState<'Bank' | 'Cash'>('Bank');
  const [txnCatatan, setTxnCatatan] = useState('');
  const [txnLoading, setTxnLoading] = useState(false);

  const fetchTabungan = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase.from('tabungan').select('*').order('id', { ascending: true });
      if (error) throw error;
      setTabunganData(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTabungan();
  }, [fetchTabungan]);

  const handleCreateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama || !targetNominal || Number(targetNominal) <= 0) {
      setErrorMsg('⚠️ Isi nama target dan nominal minimal > 0');
      return;
    }

    setFormLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase
        .from('tabungan')
        .insert([{
          nama,
          target_nominal: Number(targetNominal),
          nominal_terkumpul: 0,
          tanggal_mulai: tanggalMulai,
          tanggal_target: tanggalTarget,
          kategori,
          prioritas: Number(prioritas),
          catatan,
          status: 'Aktif'
        }]);

      if (error) throw error;

      setSuccessMsg('✅ Target tabungan baru berhasil dibuat!');
      setNama('');
      setTargetNominal('');
      setCatatan('');
      fetchTabungan(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`❌ Gagal: ${err.message || 'Error database'}`);
    } finally {
      setFormLoading(false);
    }
  };

  const handleTransaction = async (targetId: number, currentTerkumpul: number, targetNominalVal: number, targetNama: string) => {
    if (!txnNominal || Number(txnNominal) <= 0) {
      alert('Masukkan nominal valid.');
      return;
    }

    const amt = Number(txnNominal);
    const isSetor = activeForm?.type === 'setor';

    if (!isSetor && amt > currentTerkumpul) {
      alert('Nominal penarikan melebihi jumlah terkumpul!');
      return;
    }

    setTxnLoading(true);

    try {
      const today = new Date();
      const offset = today.getTimezoneOffset() * 60000;
      const tglStr = new Date(today.getTime() - offset).toISOString().split('T')[0];

      const newTerkumpul = isSetor ? currentTerkumpul + amt : currentTerkumpul - amt;
      const newStatus = newTerkumpul >= targetNominalVal ? 'Selesai' : 'Aktif';

      // 1. Update nominal_terkumpul in tabungan table
      const { error: updateError } = await supabase
        .from('tabungan')
        .update({
          nominal_terkumpul: newTerkumpul,
          status: newStatus
        })
        .eq('id', targetId);

      if (updateError) throw updateError;

      // 2. Insert to transaksi_tabungan sub-table
      try {
        await supabase
          .from('transaksi_tabungan')
          .insert([{
            tabungan_id: targetId,
            tanggal: tglStr,
            nominal: amt,
            tipe: isSetor ? 'Setor' : 'Tarik',
            catatan: txnCatatan
          }]);
      } catch (subErr) {
        console.warn('transaksi_tabungan insert failed (table might not exist, skipping):', subErr);
      }

      // 3. Insert into main transaksi table
      const mainTxnObj = {
        tanggal: tglStr,
        tipe: isSetor ? 'Pengeluaran' : 'Pemasukan',
        kategori: isSetor ? 'Menabung' : 'Tarik Tabungan',
        nominal: amt,
        catatan: isSetor 
          ? `Setor Tabungan: ${targetNama} - ${txnCatatan}`.trim()
          : `Tarik dari Tabungan: ${targetNama} - ${txnCatatan}`.trim(),
        status: 'Cleared',
        tenggat_waktu: '',
        tanggal_bayar: tglStr,
        sumber: txnSumber,
        tabungan_id: targetId
      };

      const { error: mainTxnError } = await supabase
        .from('transaksi')
        .insert([mainTxnObj]);

      if (mainTxnError) throw mainTxnError;

      // Success Reset
      setActiveForm(null);
      setTxnNominal('');
      setTxnCatatan('');
      fetchTabungan(true);
      alert(`✅ Berhasil ${isSetor ? 'menabung' : 'menarik'} Rp ${amt.toLocaleString('id-ID')}!`);
    } catch (err: any) {
      console.error(err);
      alert(`❌ Transaksi Gagal: ${err.message || 'Error database'}`);
    } finally {
      setTxnLoading(false);
    }
  };

  const handleUpdateTabungan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTabungan) return;
    try {
      const { error } = await supabase
        .from('tabungan')
        .update({
          nama: editingTabungan.nama,
          target_nominal: Number(editingTabungan.target_nominal),
          nominal_terkumpul: Number(editingTabungan.nominal_terkumpul),
          tanggal_mulai: editingTabungan.tanggal_mulai,
          tanggal_target: editingTabungan.tanggal_target,
          kategori: editingTabungan.kategori,
          catatan: editingTabungan.catatan,
          status: editingTabungan.status
        })
        .eq('id', editingTabungan.id);

      if (error) throw error;
      setEditingTabungan(null);
      fetchTabungan(true);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal memperbarui target tabungan: ${err.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus target tabungan ini?')) return;
    try {
      const { error } = await supabase.from('tabungan').delete().eq('id', id);
      if (error) throw error;
      fetchTabungan(true);
    } catch (e: any) {
      console.error(e);
      alert(`Gagal menghapus target: ${e.message}`);
    }
  };

  if (loading) return <div className="text-center text-emerald-400 py-20 animate-pulse">Memuat target tabungan...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-400" /> Target Budget & Tabungan
          </h1>
          <p className="text-sm text-slate-400">Kelola target tabungan kamu dan lacak progresnya</p>
        </div>
        
        <button
          onClick={() => fetchTabungan(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Target List */}
        <div className="lg:col-span-2 space-y-4">
          {tabunganData.length > 0 ? (
            tabunganData.map(item => {
              const target = Number(item.target_nominal) || 1;
              const current = Number(item.nominal_terkumpul) || 0;
              const pct = Math.min(100, Math.max(0, (current / target) * 100));
              const isFormOpen = activeForm?.id === item.id;

              return (
                <div key={item.id} className="glass-card p-5 border-slate-700/50 relative overflow-hidden group space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                        {item.nama}
                        {item.status === 'Selesai' ? (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded uppercase font-bold">Selesai</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded uppercase font-bold">Aktif</span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Kategori: <span className="text-slate-300 font-semibold">{item.kategori}</span> • Target: <span className="text-emerald-400 font-semibold">{item.tanggal_target || 'Tanpa Tenggat'}</span></p>
                    </div>
                    <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => setEditingTabungan(item)} className="text-slate-500 hover:text-emerald-400 transition cursor-pointer">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="text-slate-500 hover:text-rose-400 transition cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {item.catatan && (
                    <p className="text-xs text-slate-400 italic bg-slate-950/20 border border-slate-900/40 p-2.5 rounded-lg">
                      &ldquo;{item.catatan}&rdquo;
                    </p>
                  )}

                  <div className="flex justify-between items-end text-sm">
                    <span className="font-extrabold text-emerald-400 text-lg">Rp {current.toLocaleString('id-ID')}</span>
                    <span className="text-slate-400 text-xs">dari Rp {target.toLocaleString('id-ID')}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900 shadow-inner">
                    <div 
                      className={`h-full bg-gradient-to-r ${item.status === 'Selesai' ? 'from-emerald-500 to-teal-400' : 'from-emerald-500 to-emerald-300'} transition-all duration-1000 ease-out`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                    <span>Mulai: {item.tanggal_mulai}</span>
                    <span className="text-slate-300">{pct.toFixed(1)}% Terkumpul</span>
                  </div>

                  {/* Setor/Tarik Buttons */}
                  {item.status !== 'Selesai' && (
                    <div className="flex gap-2 pt-2 border-t border-slate-800/40">
                      <button
                        onClick={() => {
                          if (isFormOpen && activeForm?.type === 'setor') setActiveForm(null);
                          else {
                            setActiveForm({ id: item.id, type: 'setor' });
                            setTxnNominal('');
                            setTxnCatatan('');
                          }
                        }}
                        className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 flex items-center justify-center gap-1 transition"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" /> Nabung (Setor)
                      </button>
                      <button
                        onClick={() => {
                          if (isFormOpen && activeForm?.type === 'tarik') setActiveForm(null);
                          else {
                            setActiveForm({ id: item.id, type: 'tarik' });
                            setTxnNominal('');
                            setTxnCatatan('');
                          }
                        }}
                        className="flex-1 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-lg border border-rose-500/20 flex items-center justify-center gap-1 transition"
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5" /> Tarik
                      </button>
                    </div>
                  )}

                  {/* Setor/Tarik Inline Form */}
                  {isFormOpen && (
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3 animate-fadeIn">
                      <h4 className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5">
                        {activeForm.type === 'setor' ? (
                          <span className="text-emerald-400 flex items-center gap-1">📈 Setor ke {item.nama}</span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">📉 Tarik dari {item.nama}</span>
                        )}
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 font-semibold">Nominal (Rp)</label>
                          <input
                            type="number"
                            placeholder="Nominal..."
                            value={txnNominal}
                            onChange={(e) => setTxnNominal(e.target.value === '' ? '' : Number(e.target.value))}
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 font-semibold">Sumber Rekening</label>
                          <select
                            value={txnSumber}
                            onChange={(e) => setTxnSumber(e.target.value as 'Bank' | 'Cash')}
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="Bank">Bank / ATM</option>
                            <option value="Cash">Uang Cash</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 font-semibold">Catatan</label>
                          <input
                            type="text"
                            placeholder="Keterangan..."
                            value={txnCatatan}
                            onChange={(e) => setTxnCatatan(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setActiveForm(null)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[11px]"
                        >
                          Batal
                        </button>
                        <button
                          disabled={txnLoading}
                          onClick={() => handleTransaction(item.id, current, target, item.nama)}
                          className={`px-3 py-1 rounded text-[11px] font-bold text-slate-950 ${activeForm.type === 'setor' ? 'bg-emerald-400 hover:bg-emerald-500' : 'bg-rose-400 hover:bg-rose-500'}`}
                        >
                          {txnLoading ? 'Menyimpan...' : 'Konfirmasi'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="glass-card p-8 text-center text-slate-500 border-slate-700/50">
              Belum ada target tabungan yang dibuat.
            </div>
          )}
        </div>

        {/* Right Col: Info / Add New */}
        <div className="space-y-4">
          <div className="glass-card p-5 border-slate-700/50">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4" /> Ringkasan Tabungan
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Terkumpul (Semua)</p>
                <p className="text-2xl font-black text-white">
                  Rp {tabunganData.reduce((s, i) => s + Number(i.nominal_terkumpul), 0).toLocaleString('id-ID')}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Terkumpul (Aktif)</p>
                <p className="text-xl font-bold text-emerald-400">
                  Rp {tabunganData.filter(i => i.status === 'Aktif').reduce((s, i) => s + Number(i.nominal_terkumpul), 0).toLocaleString('id-ID')}
                </p>
              </div>
              <p className="text-[11px] text-slate-500 italic border-t border-slate-800/80 pt-2 mt-2">
                *Nilai total ini yang menjadi acuan pengurang saldo Dana Operasional Anda di halaman Dashboard.
              </p>
            </div>
          </div>
          
          {/* Create Budget Target Form */}
          <div className="glass-card p-5 border-slate-700/50 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-emerald-400" /> Buat Target Baru
            </h3>

            {errorMsg && <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded">{errorMsg}</div>}
            {successMsg && <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded">{successMsg}</div>}

            <form onSubmit={handleCreateTarget} className="space-y-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400">Nama Target</label>
                <input
                  type="text"
                  placeholder="Contoh: Beli Laptop Baru"
                  value={nama}
                  onChange={e => setNama(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400">Target Nominal (Rp)</label>
                <input
                  type="number"
                  placeholder="Nominal target..."
                  value={targetNominal}
                  onChange={e => setTargetNominal(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-400">Tgl Mulai</label>
                  <input
                    type="date"
                    value={tanggalMulai}
                    onChange={e => setTanggalMulai(e.target.value)}
                    onClick={(e) => (e.target as any).showPicker()}
                    className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-emerald-500 text-[10px] cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-400">Tgl Target</label>
                  <input
                    type="date"
                    value={tanggalTarget}
                    onChange={e => setTanggalTarget(e.target.value)}
                    onClick={(e) => (e.target as any).showPicker()}
                    className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-emerald-500 text-[10px] cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-400">Kategori</label>
                  <select
                    value={kategori}
                    onChange={e => setKategori(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none"
                  >
                    <option value="Umum">Umum</option>
                    <option value="Kendaraan">Kendaraan</option>
                    <option value="Pendidikan">Pendidikan</option>
                    <option value="Properti">Properti</option>
                    <option value="Investasi">Investasi</option>
                    <option value="Liburan">Liburan</option>
                    <option value="Darurat">Darurat</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-400">Prioritas (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={prioritas}
                    onChange={e => setPrioritas(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500 text-xs text-center font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400">Catatan</label>
                <textarea
                  placeholder="Keterangan target (opsional)..."
                  value={catatan}
                  onChange={e => setCatatan(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs min-h-[50px] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition mt-2 disabled:opacity-50 cursor-pointer text-xs"
              >
                {formLoading ? 'Menyimpan...' : '💾 Simpan Target'}
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Edit Tabungan Modal */}
      {editingTabungan && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn text-sm">
          <div className="glass-card max-w-md w-full p-6 border-slate-700/50 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-400" /> Edit Target Tabungan
              </h3>
              <button 
                onClick={() => setEditingTabungan(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateTabungan} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400">Nama Target</label>
                <input
                  type="text"
                  value={editingTabungan.nama}
                  onChange={e => setEditingTabungan({...editingTabungan, nama: e.target.value})}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Kategori</label>
                  <input
                    type="text"
                    value={editingTabungan.kategori}
                    onChange={e => setEditingTabungan({...editingTabungan, kategori: e.target.value})}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Status</label>
                  <select
                    value={editingTabungan.status}
                    onChange={e => setEditingTabungan({...editingTabungan, status: e.target.value})}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Target Nominal (Rp)</label>
                  <input
                    type="number"
                    value={editingTabungan.target_nominal}
                    onChange={e => setEditingTabungan({...editingTabungan, target_nominal: e.target.value})}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Terkumpul (Rp)</label>
                  <input
                    type="number"
                    value={editingTabungan.nominal_terkumpul}
                    onChange={e => setEditingTabungan({...editingTabungan, nominal_terkumpul: e.target.value})}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={editingTabungan.tanggal_mulai || ''}
                    onChange={e => setEditingTabungan({...editingTabungan, tanggal_mulai: e.target.value})}
                    onClick={(e) => (e.target as any).showPicker()}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Tanggal Target</label>
                  <input
                    type="date"
                    value={editingTabungan.tanggal_target || ''}
                    onChange={e => setEditingTabungan({...editingTabungan, tanggal_target: e.target.value})}
                    onClick={(e) => (e.target as any).showPicker()}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400">Catatan</label>
                <textarea
                  value={editingTabungan.catatan || ''}
                  onChange={e => setEditingTabungan({...editingTabungan, catatan: e.target.value})}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs min-h-[50px] resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingTabungan(null)}
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
