'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { HandCoins, RefreshCw, CheckCircle, Clock } from 'lucide-react';

export default function PiutangPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [piutangData, setPiutangData] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchPiutang = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.from('piutang').select('*').order('Tanggal', { ascending: false });
      
      if (error) {
        if (error.code === '42P01') {
          throw new Error('Tabel piutang belum dibuat di Supabase.');
        }
        throw error;
      }
      setPiutangData(data || []);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Gagal mengambil data piutang.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPiutang();
  }, [fetchPiutang]);

  const handleLunas = async (id: number) => {
    if (!confirm('Tandai piutang ini sudah lunas?')) return;
    
    try {
      const today = new Date();
      const offset = today.getTimezoneOffset() * 60000;
      const wib = new Date(today.getTime() - offset).toISOString().split('T')[0];

      const { error } = await supabase
        .from('piutang')
        .update({ Tanggal_Lunas: wib, Status: 'Lunas' })
        .eq('id', id);
        
      if (error) throw error;
      fetchPiutang(true);
    } catch (e) {
      console.error(e);
      alert('Gagal memperbarui status lunas.');
    }
  };

  const activePiutang = piutangData.filter(p => !p.Tanggal_Lunas || p.Tanggal_Lunas === '');
  const historyPiutang = piutangData.filter(p => p.Tanggal_Lunas && p.Tanggal_Lunas !== '');

  const totalActive = activePiutang.reduce((s, i) => s + Number(i.Nominal), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <HandCoins className="w-6 h-6 text-emerald-400" /> Manajemen Piutang
          </h1>
          <p className="text-sm text-slate-400">Daftar uang Anda yang dipinjam atau dipegang orang lain.</p>
        </div>
        
        <button
          onClick={() => fetchPiutang(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {errorMsg ? (
        <div className="glass-card p-6 border-rose-500/50 bg-rose-500/10">
          <h3 className="text-rose-400 font-bold mb-2">⚠️ Error Data Piutang</h3>
          <p className="text-sm text-slate-300">{errorMsg}</p>
          <p className="text-xs text-slate-400 mt-4">
            Anda perlu membuat tabel <code>piutang</code> di Supabase. Lihat log instalasi untuk perintah SQL-nya.
          </p>
        </div>
      ) : loading ? (
        <div className="text-center text-emerald-400 py-20 animate-pulse">Memuat daftar piutang...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 space-y-6">
            
            {/* Active Piutang */}
            <div className="glass-card p-5 border-slate-700/50">
              <h3 className="font-bold text-lg text-emerald-400 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" /> Piutang Aktif (Belum Lunas)
              </h3>
              
              <div className="space-y-3">
                {activePiutang.length > 0 ? (
                  activePiutang.map(p => (
                    <div key={p.id} className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-100">{p.Nama}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{p.Tanggal} • {p.Catatan}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-amber-400 mb-1">Rp {Number(p.Nominal).toLocaleString('id-ID')}</p>
                        <button 
                          onClick={() => handleLunas(p.id)}
                          className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded"
                        >
                          Tandai Lunas
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 italic py-4 text-center">Tidak ada piutang aktif.</p>
                )}
              </div>
            </div>

            {/* History Piutang */}
            <div className="glass-card p-5 border-slate-700/50">
              <h3 className="font-bold text-lg text-slate-300 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> Riwayat Lunas
              </h3>
              
              <div className="space-y-3">
                {historyPiutang.length > 0 ? (
                  historyPiutang.slice(0, 10).map(p => (
                    <div key={p.id} className="p-3 bg-slate-900/30 rounded-xl border border-slate-800 flex justify-between items-center opacity-70">
                      <div>
                        <p className="font-bold text-slate-300 line-through">{p.Nama}</p>
                        <p className="text-[10px] text-slate-500">Lunas pada: {p.Tanggal_Lunas}</p>
                      </div>
                      <p className="font-bold text-emerald-400/70">Rp {Number(p.Nominal).toLocaleString('id-ID')}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 italic py-4 text-center">Belum ada riwayat lunas.</p>
                )}
              </div>
            </div>
            
          </div>

          <div className="space-y-4">
             <div className="glass-card p-5 border-amber-500/30">
               <h3 className="text-sm font-bold text-amber-400 mb-2">Total Piutang Aktif</h3>
               <p className="text-3xl font-black text-white">Rp {totalActive.toLocaleString('id-ID')}</p>
               <p className="text-[10px] text-slate-400 mt-2">
                 Dana ini tidak dihitung dalam Saldo Cash atau Saldo Bank Anda sampai ditandai Lunas.
               </p>
             </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
