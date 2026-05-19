'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RefreshCw, Trash2, Calendar, Filter, Download } from 'lucide-react';

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // Filter states
  const [filterType, setFilterType] = useState('Semua');
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().split('T')[0].substring(0, 7)); // YYYY-MM

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
    if (!confirm('Hapus transaksi ini?')) return;
    
    try {
      const { error } = await supabase.from('transaksi').delete().eq('id', id);
      if (error) throw error;
      fetchHistory(true);
    } catch (e) {
      console.error(e);
      alert('Gagal menghapus transaksi');
    }
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
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2 transition"
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

      {/* Filters */}
      <div className="glass-card p-4 border-slate-700/50 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input 
            type="month" 
            value={filterMonth} 
            onChange={e => setFilterMonth(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-emerald-500 outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-emerald-500 outline-none w-full"
          >
            <option value="Semua">Semua Tipe</option>
            <option value="Pengeluaran">Pengeluaran</option>
            <option value="Pemasukan">Pemasukan</option>
          </select>
        </div>
        <div className="flex-1"></div>
        <button className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs flex items-center gap-2 hover:bg-slate-700 w-full md:w-auto justify-center">
          <Download className="w-3 h-3" /> Export CSV
        </button>
      </div>

      {/* Data Table */}
      <div className="glass-card overflow-hidden border-slate-700/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
              <tr>
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
                filteredData.map(t => (
                  <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="px-4 py-3 whitespace-nowrap">{t.tanggal}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-slate-800 rounded-md text-[10px] font-semibold">
                        {t.kategori}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={t.catatan}>{t.catatan}</td>
                    <td className="px-4 py-3 text-xs">{t.sumber}</td>
                    <td className={`px-4 py-3 text-right font-bold ${t.tipe === 'Pengeluaran' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {t.tipe === 'Pengeluaran' ? '-' : '+'}Rp {Number(t.nominal).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada transaksi pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
