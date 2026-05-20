'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RefreshCw, Trash2, Calendar, Filter, Download, History } from 'lucide-react';

const KATEGORI_OPTIONS = [
  "Makan",
  "Bensin / Mobilitas",
  "Makan (Sahur/Buka)",
  "Kos",
  "Hiburan",
  "Kebutuhan Lab / Magang",
  "Bulanan",
  "SPay",
  "Belanja Dapur",
  "Penyesuaian",
  "Scheduled Settlement",
  "Titipan / Jastip",
  "Piutang",
  "Piutang Kembali",
  "Lainnya"
];

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // Filter states
  const [filterType, setFilterType] = useState('Semua');
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().split('T')[0].substring(0, 7)); // YYYY-MM

  // Edit Mode States
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedTransactions, setEditedTransactions] = useState<Record<number, any>>({});
  const [isSavingMassal, setIsSavingMassal] = useState(false);

  // Bulk Delete States
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingMassal, setIsDeletingMassal] = useState(false);

  const fetchHistory = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from('transaksi')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('id', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus transaksi ini secara permanen?')) return;
    
    try {
      const { error } = await supabase.from('transaksi').delete().eq('id', id);
      if (error) throw error;
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      fetchHistory(true);
    } catch (e) {
      console.error(e);
      alert('Gagal menghapus transaksi');
    }
  };

  const handleCellChange = (id: number, field: string, value: any) => {
    setEditedTransactions(prev => {
      const existing = prev[id] || { ...transactions.find(t => t.id === id) };
      return {
        ...prev,
        [id]: {
          ...existing,
          [field]: value
        }
      };
    });
  };

  const handleSaveAll = async () => {
    const ids = Object.keys(editedTransactions);
    if (ids.length === 0) {
      alert("Tidak ada perubahan untuk disimpan.");
      setIsEditMode(false);
      return;
    }

    setIsSavingMassal(true);
    try {
      const promises = ids.map(async (idStr) => {
        const id = Number(idStr);
        const updatedData = editedTransactions[id];
        
        // Validation
        const parsedNominal = Number(updatedData.nominal);
        if (isNaN(parsedNominal) || parsedNominal <= 0) {
          throw new Error(`Nominal untuk transaksi "${updatedData.catatan || updatedData.kategori}" tidak valid.`);
        }

        const { error } = await supabase
          .from('transaksi')
          .update({
            tanggal: updatedData.tanggal,
            kategori: updatedData.kategori,
            catatan: updatedData.catatan,
            sumber: updatedData.sumber,
            nominal: parsedNominal,
            tipe: updatedData.tipe,
          })
          .eq('id', id);

        if (error) throw error;
      });

      await Promise.all(promises);
      alert("✅ Berhasil menyimpan semua perubahan!");
      setEditedTransactions({});
      setIsEditMode(false);
      fetchHistory(true);
    } catch (error: any) {
      console.error("Batch update failed:", error);
      alert(`❌ Gagal menyimpan massal: ${error.message || error}`);
    } finally {
      setIsSavingMassal(false);
    }
  };

  const handleBulkDelete = async () => {
    if (deleteConfirmText !== 'KONFIRMASI') {
      alert("Silakan ketik 'KONFIRMASI' untuk memvalidasi penghapusan.");
      return;
    }
    
    setIsDeletingMassal(true);
    try {
      const { error } = await supabase
        .from('transaksi')
        .delete()
        .in('id', selectedIds);
        
      if (error) throw error;
      
      alert(`✅ Berhasil menghapus ${selectedIds.length} transaksi!`);
      setSelectedIds([]);
      setIsDeleteModalOpen(false);
      setDeleteConfirmText('');
      fetchHistory(true);
    } catch (e: any) {
      console.error(e);
      alert(`❌ Gagal menghapus transaksi massal: ${e.message || e}`);
    } finally {
      setIsDeletingMassal(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    
    const headers = ["Tanggal", "Tipe", "Kategori", "Catatan", "Sumber", "Nominal"];
    const rows = filteredData.map(t => [
      t.tanggal || '',
      t.tipe || '',
      t.kategori || '',
      (t.catatan || '').replace(/"/g, '""'),
      t.sumber || '',
      t.nominal || 0
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `riwayat_transaksi_${filterMonth || 'semua'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Derived filtered data
  const filteredData = transactions.filter(t => {
    const matchType = filterType === 'Semua' || t.tipe === filterType;
    const matchMonth = t.tanggal ? t.tanggal.startsWith(filterMonth) : false;
    return matchType && matchMonth;
  });

  // Calculate summaries
  const totalIn = filteredData.filter(t => t.tipe === 'Pemasukan').reduce((sum, t) => sum + Number(t.nominal), 0);
  const totalOut = filteredData.filter(t => t.tipe === 'Pengeluaran').reduce((sum, t) => sum + Number(t.nominal), 0);

  if (loading) {
    return <div className="text-center text-emerald-400 py-20 animate-pulse">Memuat riwayat...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Datalist for autocomplete category */}
      <datalist id="kategori-list">
        {KATEGORI_OPTIONS.map(opt => (
          <option key={opt} value={opt} />
        ))}
      </datalist>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-400" /> Riwayat Transaksi
          </h1>
          <p className="text-sm text-slate-400">Log semua pemasukan dan pengeluaran Anda.</p>
        </div>
        
        <button
          onClick={() => fetchHistory(true)}
          disabled={refreshing}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 border-slate-700/50">
          <p className="text-xs text-slate-400 font-semibold mb-1">PEMASUKAN BULAN INI</p>
          <p className="text-xl font-bold text-emerald-400">Rp {totalIn.toLocaleString('id-ID')}</p>
        </div>
        <div className="glass-card p-4 border-slate-700/50">
          <p className="text-xs text-slate-400 font-semibold mb-1">PENGELUARAN BULAN INI</p>
          <p className="text-xl font-bold text-rose-400">Rp {totalOut.toLocaleString('id-ID')}</p>
        </div>
        <div className="glass-card p-4 border-slate-700/50">
          <p className="text-xs text-slate-400 font-semibold mb-1">SALDO BERSIH (NET)</p>
          <p className={`text-xl font-bold ${totalIn - totalOut >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            Rp {(totalIn - totalOut).toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Filters & Bulk Operations bar */}
      <div className="glass-card p-4 border-slate-700/50 flex flex-col lg:flex-row gap-4 items-center">
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input 
              type="month" 
              value={filterMonth} 
              onChange={e => setFilterMonth(e.target.value)}
              onClick={(e) => (e.target as any).showPicker()}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-emerald-500 outline-none w-full sm:w-40 cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-emerald-500 outline-none w-full sm:w-40"
            >
              <option value="Semua">Semua Tipe</option>
              <option value="Pengeluaran">Pengeluaran</option>
              <option value="Pemasukan">Pemasukan</option>
            </select>
          </div>
        </div>

        <div className="flex-1"></div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          {/* Export CSV */}
          <button 
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer transition"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>

          {/* Toggle Edit Mode */}
          {!isEditMode ? (
            <button
              onClick={() => setIsEditMode(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer transition"
            >
              📝 Mode Edit Inline
            </button>
          ) : (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleSaveAll}
                disabled={isSavingMassal}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs flex items-center gap-2 justify-center cursor-pointer disabled:opacity-50 transition flex-1 sm:flex-initial"
              >
                {isSavingMassal ? 'Menyimpan...' : '💾 Simpan Massal'}
              </button>
              <button
                onClick={() => {
                  setEditedTransactions({});
                  setIsEditMode(false);
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs flex items-center gap-2 justify-center cursor-pointer transition flex-1 sm:flex-initial"
              >
                ❌ Batal
              </button>
            </div>
          )}

          {/* Hapus Massal Button */}
          {selectedIds.length > 0 && (
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs flex items-center gap-2 justify-center cursor-pointer animate-pulse transition w-full sm:w-auto"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus Terpilih ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-card overflow-hidden border-slate-700/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-center w-12">
                  <input
                    type="checkbox"
                    checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filteredData.map(t => t.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="accent-emerald-500 rounded border-slate-700 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Catatan</th>
                <th className="px-4 py-3">Sumber</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map(t => {
                  const isRowEdited = !!editedTransactions[t.id];
                  const rowData = editedTransactions[t.id] || t;
                  
                  return (
                    <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      {/* Checkbox column */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, t.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== t.id));
                            }
                          }}
                          className="accent-emerald-500 rounded border-slate-700 cursor-pointer"
                        />
                      </td>

                      {/* Tanggal */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditMode ? (
                          <input
                            type="date"
                            value={rowData.tanggal}
                            onChange={(e) => handleCellChange(t.id, 'tanggal', e.target.value)}
                            onClick={(e) => (e.target as any).showPicker()}
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:border-emerald-500 outline-none w-32 cursor-pointer"
                          />
                        ) : (
                          t.tanggal
                        )}
                      </td>

                      {/* Kategori */}
                      <td className="px-4 py-3">
                        {isEditMode ? (
                          <input
                            type="text"
                            list="kategori-list"
                            value={rowData.kategori}
                            onChange={(e) => handleCellChange(t.id, 'kategori', e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:border-emerald-500 outline-none w-full"
                          />
                        ) : (
                          <span className="px-2 py-1 bg-slate-800 rounded-md text-[10px] font-semibold">
                            {t.kategori}
                          </span>
                        )}
                      </td>

                      {/* Catatan */}
                      <td className="px-4 py-3 max-w-[200px] truncate" title={t.catatan}>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={rowData.catatan}
                            onChange={(e) => handleCellChange(t.id, 'catatan', e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:border-emerald-500 outline-none w-full"
                          />
                        ) : (
                          t.catatan
                        )}
                      </td>

                      {/* Sumber */}
                      <td className="px-4 py-3 text-xs">
                        {isEditMode ? (
                          <select
                            value={rowData.sumber}
                            onChange={(e) => handleCellChange(t.id, 'sumber', e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"
                          >
                            <option value="Bank">Bank</option>
                            <option value="Cash">Cash</option>
                          </select>
                        ) : (
                          t.sumber
                        )}
                      </td>

                      {/* Nominal / Tipe */}
                      <td className="px-4 py-3 text-right">
                        {isEditMode ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <select
                              value={rowData.tipe}
                              onChange={(e) => handleCellChange(t.id, 'tipe', e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-white focus:border-emerald-500 outline-none"
                            >
                              <option value="Pengeluaran">Out</option>
                              <option value="Pemasukan">In</option>
                            </select>
                            <input
                              type="number"
                              value={rowData.nominal}
                              onChange={(e) => handleCellChange(t.id, 'nominal', Number(e.target.value))}
                              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white text-right focus:border-emerald-500 outline-none w-28"
                            />
                          </div>
                        ) : (
                          <span className={`font-bold ${t.tipe === 'Pengeluaran' ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {t.tipe === 'Pengeluaran' ? '-' : '+'}Rp {Number(t.nominal).toLocaleString('id-ID')}
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => handleDelete(t.id)}
                          disabled={isEditMode}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition disabled:opacity-30 disabled:hover:bg-transparent"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada transaksi pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Massal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card p-6 border-slate-700/60 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Konfirmasi Hapus Massal
            </h3>
            <p className="text-xs text-slate-300">
              Anda akan menghapus <strong>{selectedIds.length} transaksi</strong> secara permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="space-y-2">
              <label className="text-[11px] text-slate-400 font-semibold block">
                Ketik <span className="text-rose-400 font-mono font-bold">KONFIRMASI</span> untuk melanjutkan:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="KONFIRMASI"
                className="bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-rose-500 w-full font-mono text-center tracking-wider"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleBulkDelete}
                disabled={deleteConfirmText !== 'KONFIRMASI' || isDeletingMassal}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-30 disabled:hover:bg-rose-600 text-white font-bold rounded-lg text-xs transition cursor-pointer"
              >
                {isDeletingMassal ? 'Menghapus...' : 'Hapus Permanen'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs transition cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
