'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Target, 
  PlusCircle, 
  TrendingUp, 
  RefreshCw, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Pencil, 
  History, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  ShoppingCart,
  Wallet
} from 'lucide-react';

export default function BudgetPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabunganData, setTabunganData] = useState<any[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [editingTabungan, setEditingTabungan] = useState<any | null>(null);

  // Add Target Form States
  const [nama, setNama] = useState('');
  const [targetNominal, setTargetNominal] = useState<string>('');
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
  const [txnNominal, setTxnNominal] = useState<string>('');
  const [txnSumber, setTxnSumber] = useState<'Bank' | 'Cash'>('Bank');
  const [txnCatatan, setTxnCatatan] = useState('');
  const [txnLoading, setTxnLoading] = useState(false);

  // Delete Target Modal States
  const [targetToDelete, setTargetToDelete] = useState<any | null>(null);
  const [deleteTargetReason, setDeleteTargetReason] = useState('');
  const [deleteTargetAction, setDeleteTargetAction] = useState<'spend' | 'return_bank' | 'delete_only'>('spend');
  const [deletingTargetLoading, setDeletingTargetLoading] = useState(false);

  // Delete History Item Modal States
  const [historyToDelete, setHistoryToDelete] = useState<any | null>(null);
  const [deleteHistoryReason, setDeleteHistoryReason] = useState('');
  const [adjustBalanceOnDelete, setAdjustBalanceOnDelete] = useState(true);
  const [reverseMainTxn, setReverseMainTxn] = useState(true);
  const [deletingHistoryLoading, setDeletingHistoryLoading] = useState(false);

  // Bulk Delete & Edit History Item States
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<number[]>([]);
  const [isBulkDeletingHistory, setIsBulkDeletingHistory] = useState(false);
  const [editingHistoryItem, setEditingHistoryItem] = useState<any | null>(null);
  const [editHistoryForm, setEditHistoryForm] = useState<{
    tanggal: string;
    tabungan_id: number;
    tipe: 'Setor' | 'Tarik';
    nominal: string;
    catatan: string;
  }>({
    tanggal: '',
    tabungan_id: 0,
    tipe: 'Setor',
    nominal: '',
    catatan: ''
  });

  const fetchTabungan = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase.from('tabungan').select('*').order('id', { ascending: true });
      if (error) throw error;
      setTabunganData(data || []);

      // Fetch history from transaksi_tabungan
      const { data: hData, error: hError } = await supabase
        .from('transaksi_tabungan')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('id', { ascending: false });

      if (!hError && hData) {
        setHistoryData(hData);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(`Gagal memuat tabungan: ${e.message}`);
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

  // Handle Target Deletion with Reason & Fund Options
  const handleConfirmDeleteTarget = async () => {
    if (!targetToDelete) return;
    setDeletingTargetLoading(true);

    try {
      const today = new Date();
      const offset = today.getTimezoneOffset() * 60000;
      const tglStr = new Date(today.getTime() - offset).toISOString().split('T')[0];
      const terkumpul = Number(targetToDelete.nominal_terkumpul) || 0;

      // Handle based on action if there is balance
      if (terkumpul > 0) {
        if (deleteTargetAction === 'return_bank') {
          // Return to Bank balance as income
          await supabase.from('transaksi').insert([{
            tanggal: tglStr,
            tipe: 'Pemasukan',
            kategori: 'Tarik Tabungan',
            nominal: terkumpul,
            catatan: `Pengembalian Tabungan: ${targetToDelete.nama}${deleteTargetReason ? ' - ' + deleteTargetReason : ''}`.trim(),
            status: 'Cleared',
            tenggat_waktu: '',
            tanggal_bayar: tglStr,
            sumber: 'Bank',
            tabungan_id: targetToDelete.id
          }]);

          await supabase.from('transaksi_tabungan').insert([{
            tabungan_id: targetToDelete.id,
            tanggal: tglStr,
            nominal: terkumpul,
            tipe: 'Tarik',
            catatan: `Kembali ke Bank: ${deleteTargetReason || 'Batal nabung'}`.trim()
          }]);
        } else if (deleteTargetAction === 'spend') {
          // Uang tabungan sudah dibelanjakan (misal beli kulkas)
          // Catat penarikan di transaksi_tabungan sebagai arsip pencairan
          await supabase.from('transaksi_tabungan').insert([{
            tabungan_id: targetToDelete.id,
            tanggal: tglStr,
            nominal: terkumpul,
            tipe: 'Tarik',
            catatan: deleteTargetReason ? `[Dibelanjakan] ${deleteTargetReason}` : '[Pencairan Selesai]'
          }]);
        }
      }

      // Delete target from tabungan table
      const { error } = await supabase.from('tabungan').delete().eq('id', targetToDelete.id);
      if (error) throw error;

      setTargetToDelete(null);
      setDeleteTargetReason('');
      fetchTabungan(true);
      alert(`✅ Target tabungan "${targetToDelete.nama}" berhasil dihapus.`);
    } catch (e: any) {
      console.error(e);
      alert(`❌ Gagal menghapus target: ${e.message}`);
    } finally {
      setDeletingTargetLoading(false);
    }
  };

  // Handle Deleting Specific Item from History
  const handleConfirmDeleteHistory = async () => {
    if (!historyToDelete) return;
    setDeletingHistoryLoading(true);

    try {
      const targetId = historyToDelete.tabungan_id;
      const amt = Number(historyToDelete.nominal) || 0;
      const isSetor = historyToDelete.tipe === 'Setor';

      // 1. Adjust tabungan target balance if option selected
      if (adjustBalanceOnDelete && targetId) {
        const target = tabunganData.find(t => t.id === targetId);
        if (target) {
          const currentTerkumpul = Number(target.nominal_terkumpul) || 0;
          // If deleting 'Setor', reduce balance; if deleting 'Tarik', restore balance
          const newTerkumpul = isSetor ? Math.max(0, currentTerkumpul - amt) : currentTerkumpul + amt;
          const targetNominal = Number(target.target_nominal) || 0;
          const newStatus = newTerkumpul >= targetNominal ? 'Selesai' : 'Aktif';

          await supabase.from('tabungan').update({
            nominal_terkumpul: newTerkumpul,
            status: newStatus
          }).eq('id', targetId);
        }
      }

      // 2. Delete linked transaction in main transaksi table if needed
      if (reverseMainTxn && targetId) {
        try {
          await supabase.from('transaksi').delete().match({
            tabungan_id: targetId,
            nominal: amt,
            tanggal: historyToDelete.tanggal
          });
        } catch (subErr) {
          console.warn('Failed to clean up main transaksi:', subErr);
        }
      }

      // 3. Delete from transaksi_tabungan
      const { error } = await supabase.from('transaksi_tabungan').delete().eq('id', historyToDelete.id);
      if (error) throw error;

      setHistoryToDelete(null);
      setDeleteHistoryReason('');
      fetchTabungan(true);
      alert(`✅ Riwayat transaksi tabungan berhasil dihapus.`);
    } catch (e: any) {
      console.error(e);
      alert(`❌ Gagal menghapus riwayat: ${e.message}`);
    } finally {
      setDeletingHistoryLoading(false);
    }
  };

  // Bulk Delete History Items
  const handleBulkDeleteHistory = async () => {
    if (selectedHistoryIds.length === 0) return;
    if (!confirm(`Hapus ${selectedHistoryIds.length} riwayat transaksi tabungan yang dipilih secara permanen?`)) return;

    setIsBulkDeletingHistory(true);
    try {
      const { error } = await supabase
        .from('transaksi_tabungan')
        .delete()
        .in('id', selectedHistoryIds);

      if (error) throw error;

      alert(`✅ Berhasil menghapus ${selectedHistoryIds.length} riwayat tabungan!`);
      setSelectedHistoryIds([]);
      fetchTabungan(true);
    } catch (e: any) {
      console.error(e);
      alert(`❌ Gagal menghapus riwayat massal: ${e.message}`);
    } finally {
      setIsBulkDeletingHistory(false);
    }
  };

  // Update a Specific History Item and Synchronize Target Balance
  const handleUpdateHistoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHistoryItem) return;

    try {
      const oldNominal = Number(editingHistoryItem.nominal) || 0;
      const oldTipe = editingHistoryItem.tipe;
      const oldTargetId = editingHistoryItem.tabungan_id;

      const newNominal = Number(editHistoryForm.nominal) || 0;
      const newTipe = editHistoryForm.tipe;
      const newTargetId = Number(editHistoryForm.tabungan_id);

      if (newNominal <= 0) {
        alert('Nominal harus lebih dari 0.');
        return;
      }

      // 1. Update transaksi_tabungan
      const { error } = await supabase
        .from('transaksi_tabungan')
        .update({
          tanggal: editHistoryForm.tanggal,
          tabungan_id: newTargetId,
          tipe: newTipe,
          nominal: newNominal,
          catatan: editHistoryForm.catatan
        })
        .eq('id', editingHistoryItem.id);

      if (error) throw error;

      // 2. Adjust target tabungan balance
      if (oldTargetId === newTargetId) {
        const target = tabunganData.find(t => t.id === newTargetId);
        if (target) {
          const currentTerkumpul = Number(target.nominal_terkumpul) || 0;
          const oldContribution = oldTipe === 'Setor' ? oldNominal : -oldNominal;
          const newContribution = newTipe === 'Setor' ? newNominal : -newNominal;
          const updatedTerkumpul = Math.max(0, currentTerkumpul - oldContribution + newContribution);
          const targetNominal = Number(target.target_nominal) || 0;

          await supabase.from('tabungan').update({
            nominal_terkumpul: updatedTerkumpul,
            status: updatedTerkumpul >= targetNominal ? 'Selesai' : 'Aktif'
          }).eq('id', newTargetId);
        }
      } else {
        // Different targets
        const oldTarget = tabunganData.find(t => t.id === oldTargetId);
        if (oldTarget) {
          const oldTerkumpul = Number(oldTarget.nominal_terkumpul) || 0;
          const oldContribution = oldTipe === 'Setor' ? oldNominal : -oldNominal;
          const updatedOld = Math.max(0, oldTerkumpul - oldContribution);
          await supabase.from('tabungan').update({
            nominal_terkumpul: updatedOld,
            status: updatedOld >= Number(oldTarget.target_nominal) ? 'Selesai' : 'Aktif'
          }).eq('id', oldTargetId);
        }

        const newTarget = tabunganData.find(t => t.id === newTargetId);
        if (newTarget) {
          const newCurrent = Number(newTarget.nominal_terkumpul) || 0;
          const newContribution = newTipe === 'Setor' ? newNominal : -newNominal;
          const updatedNew = Math.max(0, newCurrent + newContribution);
          await supabase.from('tabungan').update({
            nominal_terkumpul: updatedNew,
            status: updatedNew >= Number(newTarget.target_nominal) ? 'Selesai' : 'Aktif'
          }).eq('id', newTargetId);
        }
      }

      setEditingHistoryItem(null);
      fetchTabungan(true);
      alert('✅ Riwayat transaksi tabungan berhasil diperbarui!');
    } catch (err: any) {
      console.error(err);
      alert(`❌ Gagal memperbarui riwayat: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-emerald-400 py-20 animate-pulse">
        Memuat target tabungan...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-400" /> Target Budget & Tabungan
          </h1>
          <p className="text-sm text-slate-400">Kelola target tabungan, mutasi simpanan, dan riwayat pencairan dana</p>
        </div>
        
        <button
          onClick={() => fetchTabungan(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2 transition cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Target List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span>🎯</span> Daftar Target Tabungan ({tabunganData.length})
          </h2>

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
                    <div className="flex gap-2 items-center">
                      <button 
                        onClick={() => setEditingTabungan(item)} 
                        className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 rounded-lg transition cursor-pointer"
                        title="Edit Target"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => {
                          setTargetToDelete(item);
                          setDeleteTargetReason('');
                          setDeleteTargetAction('spend');
                        }} 
                        className="p-1.5 bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
                        title="Hapus / Cairkan Tabungan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

                  {/* Setor/Tarik Buttons: ALWAYS ACTIVE even if Selesai */}
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
                      className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" /> Nabung (Setor)
                    </button>
                    {current > 0 && (
                      <button
                        onClick={() => {
                          if (isFormOpen && activeForm?.type === 'tarik') setActiveForm(null);
                          else {
                            setActiveForm({ id: item.id, type: 'tarik' });
                            setTxnNominal('');
                            setTxnCatatan('');
                          }
                        }}
                        className="flex-1 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-lg border border-rose-500/20 flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5" /> Tarik / Pakai Dana
                      </button>
                    )}
                  </div>

                  {/* Setor/Tarik Inline Form */}
                  {activeForm && activeForm.id === item.id && (
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3 animate-fadeIn">
                      <h4 className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5">
                        {activeForm.type === 'setor' ? (
                          <span className="text-emerald-400 flex items-center gap-1">📈 Setor ke {item.nama}</span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">📉 Tarik / Gunakan Dana dari {item.nama}</span>
                        )}
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 font-semibold">Nominal (Rp)</label>
                          <input
                            type="number"
                            placeholder="Nominal..."
                            value={txnNominal}
                            onChange={(e) => setTxnNominal(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 font-semibold">Tujuan / Rekening</label>
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
                          <label className="text-[10px] text-slate-400 font-semibold">Catatan / Alasan (Opsional)</label>
                          <input
                            type="text"
                            placeholder="Misal: Buat beli kulkas, dll..."
                            value={txnCatatan}
                            onChange={(e) => setTxnCatatan(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setActiveForm(null)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[11px] cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          disabled={txnLoading}
                          onClick={() => handleTransaction(item.id, current, target, item.nama)}
                          className={`px-3 py-1 rounded text-[11px] font-bold text-slate-950 cursor-pointer ${activeForm.type === 'setor' ? 'bg-emerald-400 hover:bg-emerald-500' : 'bg-rose-400 hover:bg-rose-500'}`}
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
                *Total dana yang berhasil disisihkan dan aman tersimpan di pos tabungan Anda.
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
                  onChange={e => setTargetNominal(e.target.value)}
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

      {/* History Section: Riwayat Transaksi Tabungan */}
      <div className="glass-card p-6 border-slate-700/50 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" /> 📜 Riwayat Transaksi Tabungan
            </h2>
            <p className="text-xs text-slate-400">Daftar mutasi setor, tarik, dan pencairan dana tabungan</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedHistoryIds.length > 0 && (
              <button
                onClick={handleBulkDeleteHistory}
                disabled={isBulkDeletingHistory}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus Terpilih ({selectedHistoryIds.length})
              </button>
            )}
            <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg">
              {historyData.length} Catatan Riwayat
            </span>
          </div>
        </div>

        {historyData.length > 0 ? (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={historyData.length > 0 && selectedHistoryIds.length === historyData.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedHistoryIds(historyData.map(h => h.id));
                        else setSelectedHistoryIds([]);
                      }}
                      className="accent-emerald-500 rounded border-slate-700 cursor-pointer"
                      title="Pilih Semua"
                    />
                  </th>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Target Tabungan</th>
                  <th className="py-2.5 px-3">Tipe</th>
                  <th className="py-2.5 px-3">Nominal</th>
                  <th className="py-2.5 px-3">Catatan / Alasan</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {historyData.map(h => {
                  const target = tabunganData.find(t => t.id === h.tabungan_id);
                  const isSetor = h.tipe === 'Setor';
                  return (
                    <tr key={h.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedHistoryIds.includes(h.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedHistoryIds(prev => [...prev, h.id]);
                            else setSelectedHistoryIds(prev => prev.filter(id => id !== h.id));
                          }}
                          className="accent-emerald-500 rounded border-slate-700 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{h.tanggal}</td>
                      <td className="py-3 px-3 font-semibold text-white whitespace-nowrap">
                        {target ? target.nama : `Target #${h.tabungan_id}`}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isSetor ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
                            📈 Setor
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-bold">
                            📉 Tarik / Pakai
                          </span>
                        )}
                      </td>
                      <td className={`py-3 px-3 font-extrabold whitespace-nowrap ${isSetor ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isSetor ? '+' : '-'}Rp {Number(h.nominal).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                        {h.catatan || <span className="text-slate-500 italic">Tanpa catatan</span>}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingHistoryItem(h);
                              setEditHistoryForm({
                                tanggal: h.tanggal,
                                tabungan_id: h.tabungan_id,
                                tipe: h.tipe,
                                nominal: String(h.nominal),
                                catatan: h.catatan || ''
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition cursor-pointer"
                            title="Edit riwayat ini"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setHistoryToDelete(h);
                              setDeleteHistoryReason('');
                              setAdjustBalanceOnDelete(true);
                              setReverseMainTxn(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                            title="Hapus riwayat ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs">
            Belum ada riwayat transaksi tabungan tercatat.
          </div>
        )}
      </div>

      {/* Delete Target Modal */}
      {targetToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn text-sm">
          <div className="glass-card max-w-lg w-full p-6 border-slate-700/50 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2 text-rose-400">
                <Trash2 className="w-4 h-4 text-rose-400" /> Hapus / Tutup Tabungan &ldquo;{targetToDelete.nama}&rdquo;
              </h3>
              <button 
                onClick={() => setTargetToDelete(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Target:</span>
                <span className="font-semibold text-slate-200">Rp {Number(targetToDelete.target_nominal).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Dana Terkumpul Saat Ini:</span>
                <span className="font-extrabold text-emerald-400">Rp {Number(targetToDelete.nominal_terkumpul).toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Input Alasan (Opsional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Alasan / Catatan Penggunaan Dana <span className="text-slate-500 font-normal">(Opsional)</span>
              </label>
              <input
                type="text"
                placeholder="Misal: Buat beli kulkas, ditarik tunai, target batal, dll..."
                value={deleteTargetReason}
                onChange={(e) => setDeleteTargetReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
              />
              <p className="text-[11px] text-slate-400 italic">
                *Boleh diisi alasan belanja (misal: buat beli kulkas) atau dibiarkan kosong tanpa alasan.
              </p>
            </div>

            {/* Pilihan Tindakan Dana Terkumpul jika > 0 */}
            {Number(targetToDelete.nominal_terkumpul) > 0 ? (
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <label className="text-xs font-semibold text-slate-300">
                  Tindakan untuk Dana Terkumpul (Rp {Number(targetToDelete.nominal_terkumpul).toLocaleString('id-ID')}):
                </label>
                
                <div className="space-y-2">
                  <label 
                    onClick={() => setDeleteTargetAction('spend')}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${deleteTargetAction === 'spend' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
                  >
                    <input 
                      type="radio" 
                      name="deleteAction" 
                      checked={deleteTargetAction === 'spend'} 
                      onChange={() => setDeleteTargetAction('spend')}
                      className="mt-0.5 text-emerald-500" 
                    />
                    <div>
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5" /> Sudah Dibelanjakan / Digunakan
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Uang tabungan sudah dipakai sesuai kebutuhan (misal beli kulkas). Riwayat penarikan disimpan dan target ditutup.
                      </p>
                    </div>
                  </label>

                  <label 
                    onClick={() => setDeleteTargetAction('return_bank')}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${deleteTargetAction === 'return_bank' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
                  >
                    <input 
                      type="radio" 
                      name="deleteAction" 
                      checked={deleteTargetAction === 'return_bank'} 
                      onChange={() => setDeleteTargetAction('return_bank')}
                      className="mt-0.5 text-blue-500" 
                    />
                    <div>
                      <div className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" /> Batalkan & Kembalikan ke Saldo Bank
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Uang tabungan dikembalikan ke saldo Bank operasional sebagai pemasukan tarik tabungan.
                      </p>
                    </div>
                  </label>

                  <label 
                    onClick={() => setDeleteTargetAction('delete_only')}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${deleteTargetAction === 'delete_only' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
                  >
                    <input 
                      type="radio" 
                      name="deleteAction" 
                      checked={deleteTargetAction === 'delete_only'} 
                      onChange={() => setDeleteTargetAction('delete_only')}
                      className="mt-0.5 text-rose-500" 
                    />
                    <div>
                      <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Hapus Bersih Data Target
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Hapus target dari daftar tanpa mutasi saldo tambahan.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 pt-2 border-t border-slate-800">
                Target ini belum memiliki saldo terkumpul. Target akan langsung dihapus dari sistem.
              </p>
            )}

            <div className="flex gap-2 pt-3 justify-end border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTargetToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                disabled={deletingTargetLoading}
                onClick={handleConfirmDeleteTarget}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                {deletingTargetLoading ? 'Menghapus...' : 'Konfirmasi Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete History Item Modal */}
      {historyToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn text-sm">
          <div className="glass-card max-w-md w-full p-6 border-slate-700/50 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2 text-rose-400">
                <Trash2 className="w-4 h-4 text-rose-400" /> Hapus Riwayat Transaksi Tabungan
              </h3>
              <button 
                onClick={() => setHistoryToDelete(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Tanggal:</span>
                <span className="text-slate-200 font-semibold">{historyToDelete.tanggal}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tipe & Nominal:</span>
                <span className={`font-extrabold ${historyToDelete.tipe === 'Setor' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {historyToDelete.tipe === 'Setor' ? '📈 Setor' : '📉 Tarik'} Rp {Number(historyToDelete.nominal).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Catatan Saat Ini:</span>
                <span className="text-slate-200 italic">{historyToDelete.catatan || '-'}</span>
              </div>
            </div>

            {/* Input Alasan (Opsional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Alasan Penghapusan <span className="text-slate-500 font-normal">(Opsional)</span>
              </label>
              <input
                type="text"
                placeholder="Misal: Salah input nominal, dibatalkan, buat beli kulkas, dll..."
                value={deleteHistoryReason}
                onChange={(e) => setDeleteHistoryReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
              />
            </div>

            {/* Opsi Penyesuaian Saldo */}
            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={adjustBalanceOnDelete}
                  onChange={(e) => setAdjustBalanceOnDelete(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span>Sesuaikan saldo terkumpul pada target tabungan terkait</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reverseMainTxn}
                  onChange={(e) => setReverseMainTxn(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span>Hapus juga pencatatan transaksi di riwayat transaksi utama</span>
              </label>
            </div>

            <div className="flex gap-2 pt-3 justify-end border-t border-slate-800">
              <button
                type="button"
                onClick={() => setHistoryToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                disabled={deletingHistoryLoading}
                onClick={handleConfirmDeleteHistory}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                {deletingHistoryLoading ? 'Menghapus...' : 'Konfirmasi Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="text-slate-400 hover:text-white cursor-pointer"
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

      {/* Edit History Item Modal */}
      {editingHistoryItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn text-sm">
          <div className="glass-card max-w-md w-full p-6 border-slate-700/50 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-400" /> Edit Riwayat Tabungan
              </h3>
              <button 
                onClick={() => setEditingHistoryItem(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateHistoryItem} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400">Target Tabungan</label>
                <select
                  value={editHistoryForm.tabungan_id}
                  onChange={e => setEditHistoryForm({ ...editHistoryForm, tabungan_id: Number(e.target.value) })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  required
                >
                  {tabunganData.map(t => (
                    <option key={t.id} value={t.id}>{t.nama}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Tanggal</label>
                  <input
                    type="date"
                    value={editHistoryForm.tanggal}
                    onChange={e => setEditHistoryForm({ ...editHistoryForm, tanggal: e.target.value })}
                    onClick={(e) => (e.target as any).showPicker()}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs cursor-pointer"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Tipe Transaksi</label>
                  <select
                    value={editHistoryForm.tipe}
                    onChange={e => setEditHistoryForm({ ...editHistoryForm, tipe: e.target.value as 'Setor' | 'Tarik' })}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  >
                    <option value="Setor">Setor</option>
                    <option value="Tarik">Tarik / Pakai</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400">Nominal (Rp)</label>
                <input
                  type="number"
                  value={editHistoryForm.nominal}
                  onChange={e => setEditHistoryForm({ ...editHistoryForm, nominal: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs font-bold"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400">Catatan / Keterangan</label>
                <textarea
                  value={editHistoryForm.catatan}
                  onChange={e => setEditHistoryForm({ ...editHistoryForm, catatan: e.target.value })}
                  placeholder="Keterangan transaksi..."
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs min-h-[60px] resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingHistoryItem(null)}
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
