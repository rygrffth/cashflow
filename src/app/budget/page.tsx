'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Target, PlusCircle, TrendingUp, RefreshCw, Trash2 } from 'lucide-react';

export default function BudgetPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabunganData, setTabunganData] = useState<any[]>([]);

  const fetchTabungan = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase.from('tabungan').select('*');
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

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus target tabungan ini?')) return;
    try {
      await supabase.from('tabungan').delete().eq('id', id);
      fetchTabungan(true);
    } catch (e) {
      console.error(e);
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
          <p className="text-sm text-slate-400">Kelola dan pantau progress impian Anda.</p>
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

              return (
                <div key={item.id} className="glass-card p-5 border-slate-700/50 relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                        {item.nama}
                        {item.status === 'Selesai' && <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded uppercase">Selesai</span>}
                      </h3>
                      <p className="text-xs text-slate-400">Target: {item.tanggal_target || 'Tanpa Tenggat'}</p>
                    </div>
                    <button onClick={() => handleDelete(item.id)} className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-4 flex justify-between items-end text-sm mb-1">
                    <span className="font-bold text-emerald-400">Rp {current.toLocaleString('id-ID')}</span>
                    <span className="text-slate-400">dari Rp {target.toLocaleString('id-ID')}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-1000 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-right mt-1 text-[10px] text-slate-500 font-bold">{pct.toFixed(1)}%</div>
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
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Terkumpul</p>
                <p className="text-2xl font-black text-white">
                  Rp {tabunganData.reduce((s, i) => s + Number(i.nominal_terkumpul), 0).toLocaleString('id-ID')}
                </p>
              </div>
              <p className="text-xs text-slate-500">Nilai total ini yang menjadi acuan pengurang saldo Dana Operasional Anda.</p>
            </div>
          </div>
          
          <div className="glass-card p-5 border-slate-700/50">
             <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-2">
               <PlusCircle className="w-4 h-4" /> Tambah Target (Segera)
             </h3>
             <p className="text-xs text-slate-400">
               Fitur penambahan target baru via web sedang dalam tahap penyempurnaan UI. Silakan gunakan dashboard Supabase untuk menambahkan baris baru ke tabel <code>tabungan</code> untuk sementara.
             </p>
          </div>
        </div>

      </div>
    </div>
  );
}
